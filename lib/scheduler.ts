import cron from 'node-cron'
import { db } from './db'
import { schedules, xiaomiAccounts, runLogs } from './db/schema'
import { eq } from 'drizzle-orm'
import { setSteps, decryptTokenData, generateRandomStep } from './xiaomi/client'
import { refreshAppToken } from './xiaomi/auth'
import { encrypt, decrypt } from './crypto'
import { sendBarkPush } from './bark'
import { sendTelegramPush } from './telegram'
import { v4 as uuid } from 'uuid'

export function startScheduler() {
  console.log('[Scheduler] Starting...')

  cron.schedule('* * * * *', async () => {
    await checkAndRunSchedules()
  })

  console.log('[Scheduler] Running')
}

async function checkAndRunSchedules() {
  const now = new Date()
  // 北京时间匹配 cron
  const bjOffset = 8 * 60 * 60 * 1000
  const bjNow = new Date(now.getTime() + bjOffset)
  const currentMinute = bjNow.getUTCMinutes()
  const currentHour = bjNow.getUTCHours()
  const currentDay = bjNow.getUTCDate()
  const currentMonth = bjNow.getUTCMonth() + 1
  const currentDow = bjNow.getUTCDay()

  const activeSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.isActive, true))

  for (const schedule of activeSchedules) {
    if (!schedule.cronExpression) continue

    const cronParts = schedule.cronExpression.split(' ')
    if (cronParts.length !== 5) continue

    const [minute, hour, dom, month, dow] = cronParts

    function matchesCronField(field: string, current: number): boolean {
      if (field === '*') return true
      if (field === current.toString()) return true
      // 范围匹配
      if (field.includes('-')) {
        const [start, end] = field.split('-').map(Number)
        return current >= start && current <= end
      }
      // 列表匹配
      if (field.includes(',')) {
        return field.split(',').map(Number).includes(current)
      }
      return false
    }

    const shouldRun =
      matchesCronField(minute, currentMinute) &&
      matchesCronField(hour, currentHour) &&
      matchesCronField(dom, currentDay) &&
      matchesCronField(month, currentMonth) &&
      matchesCronField(dow, currentDow)

    if (!shouldRun) continue

    if (schedule.lastRunAt) {
      const diff = now.getTime() - new Date(schedule.lastRunAt).getTime()
      if (diff < 60000) continue
    }

    await executeSchedule(schedule)
  }
}

async function executeSchedule(schedule: typeof schedules.$inferSelect) {
  console.log(`[Scheduler] Executing schedule ${schedule.id}`)

  const account = await db
    .select()
    .from(xiaomiAccounts)
    .where(eq(xiaomiAccounts.id, schedule.xiaomiAccountId))
    .limit(1)

  if (!account[0]) {
    console.error(`[Scheduler] Account ${schedule.xiaomiAccountId} not found`)
    return
  }

  const acc = account[0]

  try {
    let token = decryptTokenData(acc.tokenData, acc.tokenIv || '')
    if (!token) {
      console.error(`[Scheduler] Token decryption failed for account ${acc.id}`)
      return
    }

    const steps = generateRandomStep(schedule.minStep, schedule.maxStep)
    let result = await setSteps(token, acc.deviceId || '', acc.xiaomiUserId || '', steps)

    // 401 时自动刷新 token
    if (!result.success && result.error?.includes('401') && acc.loginTokenData && acc.loginTokenIv) {
      console.log(`[Scheduler] Token expired for ${acc.id}, attempting refresh...`)

      const loginToken = decrypt(acc.loginTokenData, acc.loginTokenIv)
      if (loginToken) {
        const refresh = await refreshAppToken(loginToken, acc.deviceId || '')
        if (refresh.appToken) {
          const newEncrypted = encrypt(refresh.appToken)
          const ltUpdate: Record<string, unknown> = {
            tokenData: newEncrypted.encrypted,
            tokenIv: newEncrypted.iv,
            updatedAt: new Date(),
          }
          if (refresh.loginToken) {
            const ltEncrypted = encrypt(refresh.loginToken)
            ltUpdate.loginTokenData = ltEncrypted.encrypted
            ltUpdate.loginTokenIv = ltEncrypted.iv
          }
          await db
            .update(xiaomiAccounts)
            .set(ltUpdate as typeof xiaomiAccounts.$inferInsert)
            .where(eq(xiaomiAccounts.id, acc.id))

          token = refresh.appToken
          result = await setSteps(token, acc.deviceId || '', acc.xiaomiUserId || '', steps)
          console.log(`[Scheduler] Retry after refresh: ${result.success ? 'success' : 'failed'}`)
        } else {
          console.error(`[Scheduler] Token refresh failed: ${refresh.error}`)
        }
      }
    }

    const now = new Date()

    await db.insert(runLogs).values({
      id: uuid(),
      scheduleId: schedule.id,
      executedAt: now,
      stepWritten: result.success ? steps : null,
      status: result.success ? 'success' : 'failed',
      errorMessage: result.error || null,
    })

    await db
      .update(schedules)
      .set({ lastRunAt: now, updatedAt: now })
      .where(eq(schedules.id, schedule.id))

    // 回写账号状态
    await db
      .update(xiaomiAccounts)
      .set({
        lastSyncAt: now,
        updatedAt: now,
        ...(result.success
          ? { status: 'active', lastError: null }
          : { status: 'error', lastError: result.error || '同步失败' }),
      })
      .where(eq(xiaomiAccounts.id, schedule.xiaomiAccountId))

    if (result.success) {
      const pushOpts = { userId: schedule.userId, title: '刷步数成功', body: `已设置步数: ${steps}` }
      await Promise.all([sendBarkPush(pushOpts), sendTelegramPush(pushOpts)])
    } else {
      const pushOpts = { userId: schedule.userId, title: '刷步数失败', body: result.error || '未知错误' }
      await Promise.all([sendBarkPush(pushOpts), sendTelegramPush(pushOpts)])
    }
  } catch (error) {
    console.error(`[Scheduler] Error executing schedule ${schedule.id}:`, error)
  }
}

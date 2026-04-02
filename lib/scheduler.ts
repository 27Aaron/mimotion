import cron from 'node-cron'
import { db } from './db'
import { schedules, xiaomiAccounts, runLogs, users } from './db/schema'
import { eq } from 'drizzle-orm'
import { setSteps, decryptTokenData, generateRandomStep } from './xiaomi/client'
import { refreshAppToken } from './xiaomi/auth'
import { encrypt, decrypt } from './crypto'
import { sendBarkPush } from './bark'
import { loginXiaomiAccount } from './xiaomi/auth'
import { sendTelegramPush } from './telegram'
import { v4 as uuid } from 'uuid'

let schedulerRunning = false

// 直接加载消息文件（scheduler 无 HTTP 请求上下文，不能用 next-intl）
import zhMessages from '../messages/zh.json'
import enMessages from '../messages/en.json'
const messagesMap: Record<string, Record<string, string>> = {
  zh: zhMessages.scheduler,
  en: enMessages.scheduler,
}

function t(locale: string, key: string, params?: Record<string, string>): string {
  const msgs = messagesMap[locale] || messagesMap.zh
  let text = msgs[key] || `${key}`
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v)
    }
  }
  return text
}

// 用 globalThis 防止 HMR 热更新重复注册 cron
const globalForScheduler = globalThis as typeof globalThis & {
  __schedulerTask?: ReturnType<typeof cron.schedule>
}

export function startScheduler() {
  // 销毁旧的 cron task（HMR 后旧模块的 task 引用存在 globalThis 上）
  if (globalForScheduler.__schedulerTask) {
    globalForScheduler.__schedulerTask.stop()
    console.log('[Scheduler] Stopped previous instance')
  }

  console.log('[Scheduler] Starting...')

  globalForScheduler.__schedulerTask = cron.schedule('* * * * *', async () => {
    if (schedulerRunning) return
    schedulerRunning = true
    try {
      await checkAndRunSchedules()
    } finally {
      schedulerRunning = false
    }
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

  const executedAccounts = new Set<string>()

  for (const schedule of activeSchedules) {
    if (!schedule.cronExpression) continue

    const cronParts = schedule.cronExpression.split(' ')
    if (cronParts.length !== 5) continue

    const [minute, hour, dom, month, dow] = cronParts

    function matchesCronField(field: string, current: number): boolean {
      if (field === '*') return true
      if (field === current.toString()) return true
      // 步长匹配（如 */5）
      if (field.startsWith('*/')) {
        const step = parseInt(field.slice(2))
        return step > 0 && current % step === 0
      }
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

    // 同一账号同一分钟内只执行一次
    if (executedAccounts.has(schedule.xiaomiAccountId)) continue

    if (schedule.lastRunAt) {
      const diff = now.getTime() - new Date(schedule.lastRunAt).getTime()
      if (diff < 60000) continue
    }

    await executeSchedule(schedule)
    executedAccounts.add(schedule.xiaomiAccountId)
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

  const userRow = await db
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, schedule.userId))
    .limit(1)
  const userLocale = userRow[0]?.locale || 'zh'

  try {
    let token = decryptTokenData(acc.tokenData, acc.tokenIv || '')
    if (!token) {
      console.error(`[Scheduler] Token decryption failed for account ${acc.id}`)
      return
    }

    const steps = generateRandomStep(schedule.minStep, schedule.maxStep)
    let result = await setSteps(token, acc.deviceId || '', acc.xiaomiUserId || '', steps)

    // 401 时自动刷新 token
    let tokenExpired = false
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
          // login_token 也过期了（0104），尝试用密码重新登录
          if ((refresh.error?.includes('0104') || refresh.error?.includes('400')) && acc.passwordData && acc.passwordIv && acc.account) {
            console.log(`[Scheduler] Attempting full re-login for ${acc.id}...`)
            try {
              const password = decrypt(acc.passwordData, acc.passwordIv)
              const relogin = await loginXiaomiAccount(acc.account, password)
              if (relogin.success && relogin.token) {
                const newEncrypted = encrypt(relogin.token)
                const reloginUpdate: Record<string, unknown> = {
                  tokenData: newEncrypted.encrypted,
                  tokenIv: newEncrypted.iv,
                  deviceId: relogin.deviceId || acc.deviceId,
                  xiaomiUserId: relogin.userId || acc.xiaomiUserId,
                  status: 'active',
                  lastError: null,
                  updatedAt: new Date(),
                }
                if (relogin.loginToken) {
                  const ltEncrypted = encrypt(relogin.loginToken)
                  reloginUpdate.loginTokenData = ltEncrypted.encrypted
                  reloginUpdate.loginTokenIv = ltEncrypted.iv
                }
                await db
                  .update(xiaomiAccounts)
                  .set(reloginUpdate as typeof xiaomiAccounts.$inferInsert)
                  .where(eq(xiaomiAccounts.id, acc.id))

                token = relogin.token
                result = await setSteps(token, relogin.deviceId || acc.deviceId || '', relogin.userId || acc.xiaomiUserId || '', steps)
                console.log(`[Scheduler] Re-login retry: ${result.success ? 'success' : 'failed'}`)
              } else {
                console.error(`[Scheduler] Re-login failed: ${relogin.error}`)
                tokenExpired = true
              }
            } catch (reloginErr) {
              console.error(`[Scheduler] Re-login exception:`, reloginErr)
              tokenExpired = true
            }
          } else {
            tokenExpired = true
          }
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
          : { status: 'error', lastError: tokenExpired ? t(userLocale, 'tokenExpired') : (result.error || t(userLocale, 'syncFailed')) }),
      })
      .where(eq(xiaomiAccounts.id, schedule.xiaomiAccountId))

    if (result.success) {
      const pushOpts = { userId: schedule.userId, title: 'MiMotion', subtitle: t(userLocale, 'pushSuccessSubtitle'), body: t(userLocale, 'pushSuccessBody', { steps: String(steps) }) }
      await Promise.all([sendBarkPush(pushOpts), sendTelegramPush(pushOpts)])
    } else if (tokenExpired) {
      const pushOpts = { userId: schedule.userId, title: 'MiMotion', subtitle: t(userLocale, 'pushTokenExpiredSubtitle'), body: t(userLocale, 'pushTokenExpiredBody') }
      await Promise.all([sendBarkPush(pushOpts), sendTelegramPush(pushOpts)])
    } else {
      const pushOpts = { userId: schedule.userId, title: 'MiMotion', subtitle: t(userLocale, 'pushFailSubtitle'), body: result.error || t(userLocale, 'pushFailBody', { error: '' }) }
      await Promise.all([sendBarkPush(pushOpts), sendTelegramPush(pushOpts)])
    }
  } catch (error) {
    console.error(`[Scheduler] Error executing schedule ${schedule.id}:`, error)
  }
}

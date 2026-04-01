import cron from 'node-cron'
import { db } from './db'
import { schedules, xiaomiAccounts, runLogs } from './db/schema'
import { eq } from 'drizzle-orm'
import { setSteps, decryptTokenData, generateRandomStep } from './xiaomi/client'
import { sendBarkPush } from './bark'
import { v4 as uuid } from 'uuid'

export function startScheduler() {
  console.log('[Scheduler] Starting...')

  // 每分钟检查一次
  cron.schedule('* * * * *', async () => {
    await checkAndRunSchedules()
  })

  console.log('[Scheduler] Running')
}

async function checkAndRunSchedules() {
  const now = new Date()
  // 用北京时间匹配 cron 表达式，与 Python 源码一致
  const bjOffset = 8 * 60 * 60 * 1000
  const bjNow = new Date(now.getTime() + bjOffset)
  const currentMinute = bjNow.getUTCMinutes()
  const currentHour = bjNow.getUTCHours()

  const activeSchedules = await db
    .select()
    .from(schedules)
    .where(eq(schedules.isActive, true))

  for (const schedule of activeSchedules) {
    if (!schedule.cronExpression) continue

    const cronParts = schedule.cronExpression.split(' ')
    if (cronParts.length !== 5) continue

    const [minute, hour] = cronParts

    const shouldRun =
      (minute === '*' || parseInt(minute) === currentMinute) &&
      (hour === '*' || parseInt(hour) === currentHour)

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

  try {
    const token = decryptTokenData(account[0].tokenData, account[0].tokenIv || '')
    if (!token) {
      console.error(`[Scheduler] Token decryption failed for account ${account[0].id}`)
      return
    }
    const steps = generateRandomStep(schedule.minStep, schedule.maxStep)
    const result = await setSteps(token, account[0].deviceId || '', account[0].xiaomiUserId || '', steps)

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

    if (result.success) {
      await sendBarkPush({
        userId: schedule.userId,
        title: '刷步数成功',
        body: `已设置步数: ${steps}`,
      })
    } else {
      await sendBarkPush({
        userId: schedule.userId,
        title: '刷步数失败',
        body: result.error || '未知错误',
      })
    }
  } catch (error) {
    console.error(`[Scheduler] Error executing schedule ${schedule.id}:`, error)
  }
}

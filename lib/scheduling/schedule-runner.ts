import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'

import { sendBarkPush } from '../bark'
import { db, sqlite } from '../db'
import { schedules, users, xiaomiAccounts } from '../db/schema'
import { sendTelegramPush } from '../telegram'
import { generateRandomStep } from '../xiaomi/client'
import { syncXiaomiAccount, type AccountSyncResult } from '../xiaomi/sync-account'
import { getNextCronOccurrence } from './cron'
import {
  finishExecution,
  MAX_EXECUTION_ATTEMPTS,
  retryExecution,
  setExecutionTargetStep,
  type ClaimedExecution,
} from './execution-store'

interface RunnerDependencies {
  now: () => Date
  randomStep: typeof generateRandomStep
  syncAccount: typeof syncXiaomiAccount
  sendBark: typeof sendBarkPush
  sendTelegram: typeof sendTelegramPush
}

export interface RunExecutionResult {
  status: 'succeeded' | 'failed' | 'retrying' | 'discarded'
  executionId: string
  step?: number
  errorCode?: string
}

function messageFor(locale: string, key: 'success' | 'failed' | 'tokenExpired', steps?: number, error?: string) {
  const zh = locale !== 'en'
  if (key === 'success') {
    return {
      subtitle: zh ? '刷步成功' : 'Steps updated',
      body: zh ? `已设置步数: ${steps}` : `Steps set to ${steps}`,
    }
  }
  if (key === 'tokenExpired') {
    return {
      subtitle: zh ? '登录凭证已过期' : 'Credentials expired',
      body: zh ? '请重新绑定小米账号以继续刷步' : 'Please reconnect the Xiaomi account.',
    }
  }
  return {
    subtitle: zh ? '刷步失败' : 'Step update failed',
    body: error || (zh ? '同步失败' : 'Sync failed'),
  }
}

function persistCredentialUpdate(accountId: string, result: AccountSyncResult, now: Date) {
  if (!result.credentialUpdate) return

  const update = result.credentialUpdate
  return db.update(xiaomiAccounts).set({
    tokenData: update.tokenData,
    tokenIv: update.tokenIv,
    ...(update.loginTokenData && { loginTokenData: update.loginTokenData }),
    ...(update.loginTokenIv && { loginTokenIv: update.loginTokenIv }),
    ...(update.deviceId && { deviceId: update.deviceId }),
    ...(update.xiaomiUserId && { xiaomiUserId: update.xiaomiUserId }),
    updatedAt: now,
  }).where(eq(xiaomiAccounts.id, accountId))
}

export async function runClaimedExecution(
  execution: ClaimedExecution,
  overrides: Partial<RunnerDependencies> = {},
): Promise<RunExecutionResult> {
  const dependencies: RunnerDependencies = {
    now: overrides.now || (() => new Date()),
    randomStep: overrides.randomStep || generateRandomStep,
    syncAccount: overrides.syncAccount || syncXiaomiAccount,
    sendBark: overrides.sendBark || sendBarkPush,
    sendTelegram: overrides.sendTelegram || sendTelegramPush,
  }

  const schedule = await db.select().from(schedules)
    .where(eq(schedules.id, execution.scheduleId)).limit(1)
  const account = await db.select().from(xiaomiAccounts)
    .where(eq(xiaomiAccounts.id, execution.xiaomiAccountId)).limit(1)

  if (!schedule[0] || !account[0] || account[0].userId !== schedule[0].userId) {
    const now = dependencies.now()
    finishExecution(sqlite, {
      executionId: execution.id,
      status: 'failed',
      now,
      targetStep: execution.targetStep,
      errorCode: 'INVALID_EXECUTION_DATA',
      errorMessage: 'Schedule or Xiaomi account no longer exists or ownership does not match',
    })
    return { status: 'discarded', executionId: execution.id, errorCode: 'INVALID_EXECUTION_DATA' }
  }

  const selectedSchedule = schedule[0]
  const selectedAccount = account[0]
  const step = execution.targetStep ?? setExecutionTargetStep(
    sqlite,
    execution.id,
    dependencies.randomStep(selectedSchedule.minStep, selectedSchedule.maxStep),
    dependencies.now(),
  )

  let syncResult: AccountSyncResult
  try {
    syncResult = await dependencies.syncAccount(selectedAccount, step)
    await persistCredentialUpdate(selectedAccount.id, syncResult, dependencies.now())
  } catch (error) {
    syncResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected execution error',
      errorCode: 'NETWORK_ERROR',
      retryable: true,
    }
  }

  const completedAt = dependencies.now()
  const errorCode = syncResult.errorCode || (syncResult.success ? undefined : 'REMOTE_ERROR')
  const errorMessage = syncResult.error || null

  if (!syncResult.success && syncResult.retryable && execution.attempt < MAX_EXECUTION_ATTEMPTS) {
    retryExecution(
      sqlite,
      execution.id,
      completedAt,
      errorCode || 'RETRYABLE_ERROR',
      errorMessage || 'Retryable execution error',
    )
    return { status: 'retrying', executionId: execution.id, step, errorCode }
  }

  const finalStatus = syncResult.success ? 'succeeded' : 'failed'
  const nextRunAt = getNextCronOccurrence(selectedSchedule.cronExpression, completedAt)

  sqlite.transaction(() => {
    finishExecution(sqlite, {
      executionId: execution.id,
      status: finalStatus,
      now: completedAt,
      targetStep: step,
      errorCode: errorCode || null,
      errorMessage,
    })

    sqlite.prepare(`
      INSERT INTO run_logs (id, schedule_id, executed_at, step_written, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      selectedSchedule.id,
      completedAt.getTime(),
      syncResult.success ? step : null,
      syncResult.success ? 'success' : 'failed',
      errorMessage,
    )

    sqlite.prepare(`
      UPDATE schedules
      SET last_run_at = ?, next_run_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      completedAt.getTime(),
      nextRunAt?.getTime() || null,
      completedAt.getTime(),
      selectedSchedule.id,
    )

    sqlite.prepare(`
      UPDATE xiaomi_accounts
      SET last_sync_at = ?, status = ?, last_error = ?, updated_at = ?
      WHERE id = ?
    `).run(
      completedAt.getTime(),
      syncResult.success ? 'active' : 'error',
      syncResult.success ? null : errorMessage,
      completedAt.getTime(),
      selectedAccount.id,
    )
  }).immediate()

  const localeRow = await db.select({ locale: users.locale }).from(users)
    .where(eq(users.id, selectedSchedule.userId)).limit(1)
  const notificationKind = syncResult.success
    ? 'success'
    : syncResult.tokenExpired
      ? 'tokenExpired'
      : 'failed'
  const notification = messageFor(
    localeRow[0]?.locale || 'zh',
    notificationKind,
    step,
    errorMessage || undefined,
  )
  const pushOptions = {
    userId: selectedSchedule.userId,
    title: 'MiMotion',
    subtitle: notification.subtitle,
    body: notification.body,
  }
  await Promise.allSettled([
    dependencies.sendBark(pushOptions),
    dependencies.sendTelegram(pushOptions),
  ])

  return {
    status: finalStatus,
    executionId: execution.id,
    step,
    errorCode,
  }
}

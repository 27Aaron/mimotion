import Database from 'better-sqlite3'

export const MAX_EXECUTION_ATTEMPTS = 3
export const STALE_EXECUTION_MS = 5 * 60 * 1000

export interface ClaimedExecution {
  id: string
  scheduleId: string
  xiaomiAccountId: string
  scheduledFor: Date
  attempt: number
  targetStep: number | null
}

interface ExecutionRow {
  id: string
  scheduleId: string
  xiaomiAccountId: string
  scheduledFor: number
  attempt: number
  targetStep: number | null
}

export function enqueueExecution(
  sqlite: Database.Database,
  input: {
    id: string
    scheduleId: string
    xiaomiAccountId: string
    scheduledFor: Date
    now: Date
  },
): boolean {
  const result = sqlite.prepare(`
    INSERT OR IGNORE INTO run_executions (
      id, schedule_id, xiaomi_account_id, scheduled_for, status,
      attempt, claimed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
  `).run(
    input.id,
    input.scheduleId,
    input.xiaomiAccountId,
    input.scheduledFor.getTime(),
    input.now.getTime(),
    input.now.getTime(),
    input.now.getTime(),
  )

  return result.changes === 1
}

export function recoverStaleExecutions(
  sqlite: Database.Database,
  now: Date,
  staleAfterMs = STALE_EXECUTION_MS,
  maxAttempts = MAX_EXECUTION_ATTEMPTS,
): { requeued: number; failed: number } {
  const staleBefore = now.getTime() - staleAfterMs

  const transaction = sqlite.transaction(() => {
    const requeued = sqlite.prepare(`
      UPDATE run_executions
      SET status = 'pending', started_at = NULL, updated_at = ?,
          error_code = 'WORKER_TIMEOUT', error_message = 'Worker stopped before finishing the execution'
      WHERE status = 'running' AND updated_at < ? AND attempt < ?
    `).run(now.getTime(), staleBefore, maxAttempts).changes

    const failed = sqlite.prepare(`
      UPDATE run_executions
      SET status = 'failed', finished_at = ?, updated_at = ?,
          error_code = 'WORKER_TIMEOUT', error_message = 'Execution exceeded the retry limit after worker timeouts'
      WHERE status = 'running' AND updated_at < ? AND attempt >= ?
    `).run(now.getTime(), now.getTime(), staleBefore, maxAttempts).changes

    return { requeued, failed }
  })

  return transaction.immediate()
}

export function claimNextExecution(
  sqlite: Database.Database,
  now: Date,
  maxAttempts = MAX_EXECUTION_ATTEMPTS,
): ClaimedExecution | null {
  const transaction = sqlite.transaction(() => {
    const row = sqlite.prepare(`
      SELECT
        candidate.id,
        candidate.schedule_id AS scheduleId,
        candidate.xiaomi_account_id AS xiaomiAccountId,
        candidate.scheduled_for AS scheduledFor,
        candidate.attempt,
        candidate.target_step AS targetStep
      FROM run_executions candidate
      WHERE candidate.status = 'pending'
        AND candidate.attempt < ?
        AND NOT EXISTS (
          SELECT 1 FROM run_executions running
          WHERE running.xiaomi_account_id = candidate.xiaomi_account_id
            AND running.status = 'running'
        )
      ORDER BY candidate.scheduled_for ASC, candidate.created_at ASC
      LIMIT 1
    `).get(maxAttempts) as ExecutionRow | undefined

    if (!row) return null

    const claimed = sqlite.prepare(`
      UPDATE run_executions
      SET status = 'running', attempt = attempt + 1,
          started_at = ?, updated_at = ?, error_code = NULL, error_message = NULL
      WHERE id = ? AND status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM run_executions running
          WHERE running.xiaomi_account_id = ?
            AND running.status = 'running'
            AND running.id <> ?
        )
    `).run(now.getTime(), now.getTime(), row.id, row.xiaomiAccountId, row.id)

    if (claimed.changes !== 1) return null

    return {
      id: row.id,
      scheduleId: row.scheduleId,
      xiaomiAccountId: row.xiaomiAccountId,
      scheduledFor: new Date(row.scheduledFor),
      attempt: row.attempt + 1,
      targetStep: row.targetStep,
    }
  })

  return transaction.immediate()
}

export function setExecutionTargetStep(
  sqlite: Database.Database,
  executionId: string,
  targetStep: number,
  now: Date,
): number {
  sqlite.prepare(`
    UPDATE run_executions
    SET target_step = COALESCE(target_step, ?), updated_at = ?
    WHERE id = ?
  `).run(targetStep, now.getTime(), executionId)

  const row = sqlite.prepare('SELECT target_step AS targetStep FROM run_executions WHERE id = ?')
    .get(executionId) as { targetStep: number } | undefined
  if (!row) throw new Error(`Execution ${executionId} no longer exists`)
  return row.targetStep
}

export function retryExecution(
  sqlite: Database.Database,
  executionId: string,
  now: Date,
  errorCode: string,
  errorMessage: string,
): void {
  sqlite.prepare(`
    UPDATE run_executions
    SET status = 'pending', started_at = NULL, updated_at = ?,
        error_code = ?, error_message = ?
    WHERE id = ? AND status = 'running'
  `).run(now.getTime(), errorCode, errorMessage, executionId)
}

export function finishExecution(
  sqlite: Database.Database,
  input: {
    executionId: string
    status: 'succeeded' | 'failed'
    now: Date
    targetStep: number | null
    errorCode?: string | null
    errorMessage?: string | null
  },
): void {
  sqlite.prepare(`
    UPDATE run_executions
    SET status = ?, target_step = COALESCE(target_step, ?),
        finished_at = ?, updated_at = ?, error_code = ?, error_message = ?
    WHERE id = ? AND status = 'running'
  `).run(
    input.status,
    input.targetStep,
    input.now.getTime(),
    input.now.getTime(),
    input.errorCode || null,
    input.errorMessage || null,
    input.executionId,
  )
}

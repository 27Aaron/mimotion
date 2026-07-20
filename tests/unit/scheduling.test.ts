import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

import { getNextCronOccurrence, matchesCronExpression } from '../../lib/scheduling/cron'
import {
  claimNextExecution,
  enqueueExecution,
  finishExecution,
  recoverStaleExecutions,
} from '../../lib/scheduling/execution-store'

function createExecutionDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE run_executions (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      xiaomi_account_id TEXT NOT NULL,
      scheduled_for INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt INTEGER NOT NULL DEFAULT 0,
      target_step INTEGER,
      claimed_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      error_code TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX run_executions_schedule_slot_uidx
      ON run_executions(schedule_id, scheduled_for);
    CREATE UNIQUE INDEX run_executions_account_slot_uidx
      ON run_executions(xiaomi_account_id, scheduled_for);
  `)
  return sqlite
}

test('cron matching uses Asia/Shanghai time and supports Sunday alias 7', () => {
  const sundayAt0830Shanghai = new Date('2026-04-19T00:30:00.000Z')
  assert.equal(matchesCronExpression('30 8 * * 0', sundayAt0830Shanghai), true)
  assert.equal(matchesCronExpression('30 8 * * 7', sundayAt0830Shanghai), true)
  assert.equal(matchesCronExpression('*/15 8 * * *', sundayAt0830Shanghai), true)
})

test('next cron occurrence is calculated in Asia/Shanghai', () => {
  const next = getNextCronOccurrence('30 8 * * *', new Date('2026-04-19T00:31:00.000Z'))
  assert.equal(next?.toISOString(), '2026-04-20T00:30:00.000Z')
})

test('execution enqueue is idempotent per schedule and account slot', () => {
  const sqlite = createExecutionDb()
  const now = new Date('2026-04-19T00:30:05.000Z')
  const scheduledFor = new Date('2026-04-19T00:30:00.000Z')

  assert.equal(enqueueExecution(sqlite, {
    id: 'execution-1', scheduleId: 'schedule-1', xiaomiAccountId: 'account-1', scheduledFor, now,
  }), true)
  assert.equal(enqueueExecution(sqlite, {
    id: 'execution-2', scheduleId: 'schedule-1', xiaomiAccountId: 'account-1', scheduledFor, now,
  }), false)
  assert.equal(enqueueExecution(sqlite, {
    id: 'execution-3', scheduleId: 'schedule-2', xiaomiAccountId: 'account-1', scheduledFor, now,
  }), false)
})

test('only one execution for an account can be running', () => {
  const sqlite = createExecutionDb()
  const now = new Date('2026-04-19T00:30:05.000Z')

  enqueueExecution(sqlite, {
    id: 'execution-1', scheduleId: 'schedule-1', xiaomiAccountId: 'account-1',
    scheduledFor: new Date('2026-04-19T00:29:00.000Z'), now,
  })
  enqueueExecution(sqlite, {
    id: 'execution-2', scheduleId: 'schedule-2', xiaomiAccountId: 'account-1',
    scheduledFor: new Date('2026-04-19T00:30:00.000Z'), now,
  })

  const first = claimNextExecution(sqlite, now)
  assert.equal(first?.id, 'execution-1')
  assert.equal(claimNextExecution(sqlite, now), null)

  finishExecution(sqlite, {
    executionId: first!.id, status: 'succeeded', now, targetStep: 12345,
  })
  assert.equal(claimNextExecution(sqlite, now)?.id, 'execution-2')
})

test('stale executions are requeued until the retry limit', () => {
  const sqlite = createExecutionDb()
  const startedAt = new Date('2026-04-19T00:20:00.000Z')
  enqueueExecution(sqlite, {
    id: 'execution-1', scheduleId: 'schedule-1', xiaomiAccountId: 'account-1',
    scheduledFor: startedAt, now: startedAt,
  })
  claimNextExecution(sqlite, startedAt)

  const recovered = recoverStaleExecutions(sqlite, new Date('2026-04-19T00:30:00.000Z'))
  assert.deepEqual(recovered, { requeued: 1, failed: 0 })
  assert.equal(claimNextExecution(sqlite, new Date('2026-04-19T00:30:01.000Z'))?.attempt, 2)
})

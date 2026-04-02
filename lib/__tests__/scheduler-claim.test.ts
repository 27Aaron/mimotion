import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

import { claimScheduleExecution } from '../scheduler-claim'

test('claimScheduleExecution only allows one claim per schedule per minute', () => {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      last_run_at INTEGER,
      updated_at INTEGER
    )
  `)

  sqlite
    .prepare('INSERT INTO schedules (id, last_run_at, updated_at) VALUES (?, ?, ?)')
    .run('schedule-1', null, new Date('2026-04-15T00:00:00.000Z').getTime())

  const minuteStart = new Date('2026-04-15T08:30:00.000Z')
  const firstClaimAt = new Date('2026-04-15T08:30:10.000Z')
  const secondClaimAt = new Date('2026-04-15T08:30:40.000Z')
  const nextMinuteClaimAt = new Date('2026-04-15T08:31:05.000Z')

  assert.equal(claimScheduleExecution(sqlite, 'schedule-1', minuteStart, firstClaimAt), true)
  assert.equal(claimScheduleExecution(sqlite, 'schedule-1', minuteStart, secondClaimAt), false)
  assert.equal(
    claimScheduleExecution(
      sqlite,
      'schedule-1',
      new Date('2026-04-15T08:31:00.000Z'),
      nextMinuteClaimAt,
    ),
    true,
  )
})

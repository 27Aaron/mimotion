import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { formatShanghaiDateTime } from '../../lib/time/format'

const testAccounts = sqliteTable('xiaomi_accounts', {
  id: text('id').primaryKey(),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

const testSchedules = sqliteTable('schedules', {
  lastRunAt: integer('last_run_at', { mode: 'timestamp_ms' }),
  nextRunAt: integer('next_run_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

test('formatShanghaiDateTime uses Shanghai time and includes the year', () => {
  const formatted = formatShanghaiDateTime('2026-07-20T05:05:00.000Z', 'zh-CN')

  assert.match(formatted, /2026/)
  assert.match(formatted, /07/)
  assert.match(formatted, /20/)
  assert.match(formatted, /13/)
  assert.match(formatted, /05/)
  assert.equal(formatShanghaiDateTime(null, 'zh-CN'), '-')
  assert.equal(formatShanghaiDateTime('not-a-date', 'zh-CN'), '-')
})

test('timestamp migration normalizes seconds without changing milliseconds', () => {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE users (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE invite_codes (created_at INTEGER NOT NULL);
    CREATE TABLE xiaomi_accounts (
      id TEXT PRIMARY KEY,
      last_sync_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE schedules (
      last_run_at INTEGER,
      next_run_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE run_logs (executed_at INTEGER NOT NULL);
    CREATE TABLE run_executions (
      scheduled_for INTEGER NOT NULL,
      claimed_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE rate_limits (reset_at INTEGER NOT NULL);
  `)

  const seconds = 1_784_523_900
  const milliseconds = seconds * 1000
  sqlite.prepare(`
    INSERT INTO xiaomi_accounts (id, last_sync_at, created_at, updated_at)
    VALUES ('account-1', ?, ?, ?)
  `).run(milliseconds, seconds, milliseconds)
  sqlite.prepare(`
    INSERT INTO schedules (last_run_at, next_run_at, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(milliseconds, seconds, seconds, milliseconds)

  const migration = fs.readFileSync(
    new URL('../../drizzle/migrations/0003_normalize_timestamps_to_milliseconds.sql', import.meta.url),
    'utf8',
  )
  for (const statement of migration.split('--> statement-breakpoint')) {
    if (statement.trim()) sqlite.exec(statement)
  }

  const row = drizzle(sqlite).select().from(testAccounts).get()
  assert.ok(row)
  assert.equal(row.createdAt.getTime(), milliseconds)
  assert.equal(row.lastSyncAt?.getTime(), milliseconds)
  assert.equal(row.updatedAt.getTime(), milliseconds)

  const schedule = drizzle(sqlite).select().from(testSchedules).get()
  assert.ok(schedule)
  assert.equal(schedule.lastRunAt?.getTime(), milliseconds)
  assert.equal(schedule.nextRunAt?.getTime(), milliseconds)
  assert.equal(schedule.createdAt.getTime(), milliseconds)
  assert.equal(schedule.updatedAt.getTime(), milliseconds)
})

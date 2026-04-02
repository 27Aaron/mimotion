import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

import { deleteOwnedUnusedInviteCode, deleteOwnedSchedule, isOwnedXiaomiAccount } from '../ownership'
import { isSafeBarkUrl } from '../safe-url'

function createAccessControlDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE xiaomi_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL
    );

    CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      xiaomi_account_id TEXT NOT NULL
    );

    CREATE TABLE run_logs (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL
    );

    CREATE TABLE invite_codes (
      code TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      used_by TEXT
    );
  `)

  return sqlite
}

test('deleteOwnedSchedule only removes schedules and logs for the owner', () => {
  const sqlite = createAccessControlDb()
  sqlite.prepare('INSERT INTO schedules (id, user_id, xiaomi_account_id) VALUES (?, ?, ?)').run('sched-1', 'user-1', 'acc-1')
  sqlite.prepare('INSERT INTO run_logs (id, schedule_id) VALUES (?, ?)').run('log-1', 'sched-1')

  assert.equal(deleteOwnedSchedule(sqlite, 'sched-1', 'user-2'), false)
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM schedules WHERE id = ?').get('sched-1').count, 1)
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM run_logs WHERE schedule_id = ?').get('sched-1').count, 1)

  assert.equal(deleteOwnedSchedule(sqlite, 'sched-1', 'user-1'), true)
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM schedules WHERE id = ?').get('sched-1').count, 0)
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM run_logs WHERE schedule_id = ?').get('sched-1').count, 0)
})

test('isOwnedXiaomiAccount rejects foreign account ids', () => {
  const sqlite = createAccessControlDb()
  sqlite.prepare('INSERT INTO xiaomi_accounts (id, user_id) VALUES (?, ?)').run('acc-1', 'user-1')

  assert.equal(isOwnedXiaomiAccount(sqlite, 'user-1', 'acc-1'), true)
  assert.equal(isOwnedXiaomiAccount(sqlite, 'user-2', 'acc-1'), false)
})

test('deleteOwnedUnusedInviteCode only deletes unused codes for the creating admin', () => {
  const sqlite = createAccessControlDb()
  sqlite.prepare('INSERT INTO invite_codes (code, created_by, used_by) VALUES (?, ?, ?)').run('CODE1', 'admin-1', null)
  sqlite.prepare('INSERT INTO invite_codes (code, created_by, used_by) VALUES (?, ?, ?)').run('CODE2', 'admin-1', 'user-1')

  assert.equal(deleteOwnedUnusedInviteCode(sqlite, 'CODE1', 'admin-2'), 'not_found')
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM invite_codes WHERE code = ?').get('CODE1').count, 1)

  assert.equal(deleteOwnedUnusedInviteCode(sqlite, 'CODE2', 'admin-1'), 'used')
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM invite_codes WHERE code = ?').get('CODE2').count, 1)

  assert.equal(deleteOwnedUnusedInviteCode(sqlite, 'CODE1', 'admin-1'), 'deleted')
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM invite_codes WHERE code = ?').get('CODE1').count, 0)
})

test('isSafeBarkUrl rejects localhost and private literal IPs', () => {
  assert.equal(isSafeBarkUrl('https://api.day.app/abc'), true)
  assert.equal(isSafeBarkUrl('http://127.0.0.1/push'), false)
  assert.equal(isSafeBarkUrl('http://192.168.1.10/push'), false)
  assert.equal(isSafeBarkUrl('ftp://example.com/push'), false)
  assert.equal(isSafeBarkUrl('not-a-url'), false)
})

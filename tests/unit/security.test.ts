import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'

import { buildSameOriginRedirectLocation } from '../../lib/auth/redirect-url'
import { registerUserWithInvite } from '../../lib/auth/registration'
import { deleteOwnedUnusedInviteCode, deleteOwnedSchedule, deleteOwnedXiaomiAccount, isOwnedXiaomiAccount } from '../../lib/db/ownership'
import { isSafeBarkUrl } from '../../lib/security/safe-url'

function getCount(sqlite: Database.Database, query: string, ...params: unknown[]): number {
  const row = sqlite.prepare(query).get(...params) as { count: number }
  return row.count
}

function createAccessControlDb() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      locale TEXT DEFAULT 'zh',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

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
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM schedules WHERE id = ?', 'sched-1'), 1)
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM run_logs WHERE schedule_id = ?', 'sched-1'), 1)

  assert.equal(deleteOwnedSchedule(sqlite, 'sched-1', 'user-1'), true)
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM schedules WHERE id = ?', 'sched-1'), 0)
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM run_logs WHERE schedule_id = ?', 'sched-1'), 0)
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
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM invite_codes WHERE code = ?', 'CODE1'), 1)

  assert.equal(deleteOwnedUnusedInviteCode(sqlite, 'CODE2', 'admin-1'), 'used')
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM invite_codes WHERE code = ?', 'CODE2'), 1)

  assert.equal(deleteOwnedUnusedInviteCode(sqlite, 'CODE1', 'admin-1'), 'deleted')
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM invite_codes WHERE code = ?', 'CODE1'), 0)
})

test('deleteOwnedXiaomiAccount atomically removes only owned data', () => {
  const sqlite = createAccessControlDb()
  sqlite.prepare('INSERT INTO xiaomi_accounts (id, user_id) VALUES (?, ?)').run('acc-1', 'user-1')
  sqlite.prepare('INSERT INTO schedules (id, user_id, xiaomi_account_id) VALUES (?, ?, ?)').run('sched-1', 'user-1', 'acc-1')
  sqlite.prepare('INSERT INTO run_logs (id, schedule_id) VALUES (?, ?)').run('log-1', 'sched-1')

  assert.equal(deleteOwnedXiaomiAccount(sqlite, 'acc-1', 'user-2'), false)
  assert.equal(deleteOwnedXiaomiAccount(sqlite, 'acc-1', 'user-1'), true)
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM xiaomi_accounts'), 0)
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM schedules'), 0)
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM run_logs'), 0)
})

test('registerUserWithInvite claims an invite exactly once', () => {
  const sqlite = createAccessControlDb()
  sqlite.prepare('INSERT INTO invite_codes (code, created_by, used_by) VALUES (?, ?, ?)').run('A1B2C3D4', 'admin-1', null)
  const now = new Date('2026-07-19T00:00:00.000Z')

  assert.equal(registerUserWithInvite(sqlite, {
    userId: 'user-1', username: 'alice', passwordHash: 'hash', inviteCode: 'A1B2C3D4', now,
  }), 'success')
  assert.equal(registerUserWithInvite(sqlite, {
    userId: 'user-2', username: 'bob', passwordHash: 'hash', inviteCode: 'A1B2C3D4', now,
  }), 'code_used')
  assert.equal(getCount(sqlite, 'SELECT count(*) AS count FROM users'), 1)
})

test('isSafeBarkUrl rejects localhost and private literal IPs', () => {
  assert.equal(isSafeBarkUrl('https://api.day.app/abc'), true)
  assert.equal(isSafeBarkUrl('http://127.0.0.1/push'), false)
  assert.equal(isSafeBarkUrl('http://192.168.1.10/push'), false)
  assert.equal(isSafeBarkUrl('http://[::1]/push'), false)
  assert.equal(isSafeBarkUrl('http://169.254.169.254/latest/meta-data'), false)
  assert.equal(isSafeBarkUrl('ftp://example.com/push'), false)
  assert.equal(isSafeBarkUrl('not-a-url'), false)
})

test('redirect locations stay on the browser current origin', () => {
  assert.equal(buildSameOriginRedirectLocation('/zh/login'), '/zh/login')
  assert.throws(() => buildSameOriginRedirectLocation('https://evil.example/login'))
  assert.throws(() => buildSameOriginRedirectLocation('//evil.example/login'))
  assert.throws(() => buildSameOriginRedirectLocation('/\\evil.example/login'))
  assert.throws(() => buildSameOriginRedirectLocation('/zh/login\r\nX-Test: injected'))
})

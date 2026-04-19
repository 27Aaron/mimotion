import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

const dbPath = process.env.DATABASE_URL || './data/mimotion.db'

const dir = path.dirname(dbPath)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    is_admin integer DEFAULT 0,
    locale text DEFAULT 'zh',
    bark_url text,
    telegram_bot_token text,
    telegram_chat_id text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    code text PRIMARY KEY,
    created_by text NOT NULL REFERENCES users(id),
    used_by text REFERENCES users(id),
    created_at integer NOT NULL
  );
  CREATE INDEX IF NOT EXISTS invite_codes_used_by_idx ON invite_codes(used_by);

  CREATE TABLE IF NOT EXISTS xiaomi_accounts (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    xiaomi_user_id text,
    account text,
    token_data text NOT NULL,
    token_iv text,
    login_token_data text,
    login_token_iv text,
    password_data text,
    password_iv text,
    device_id text,
    nickname text,
    status text DEFAULT 'active',
    last_sync_at integer,
    last_error text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE INDEX IF NOT EXISTS xiaomi_accounts_user_id_idx ON xiaomi_accounts(user_id);

  CREATE TABLE IF NOT EXISTS schedules (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id),
    xiaomi_account_id text NOT NULL REFERENCES xiaomi_accounts(id),
    cron_expression text NOT NULL,
    min_step integer NOT NULL,
    max_step integer NOT NULL,
    is_active integer DEFAULT 1,
    last_run_at integer,
    next_run_at integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );
  CREATE INDEX IF NOT EXISTS schedules_user_id_idx ON schedules(user_id);
  CREATE INDEX IF NOT EXISTS schedules_is_active_idx ON schedules(is_active);

  CREATE TABLE IF NOT EXISTS run_logs (
    id text PRIMARY KEY,
    schedule_id text NOT NULL REFERENCES schedules(id),
    executed_at integer NOT NULL,
    step_written integer,
    status text,
    error_message text
  );
  CREATE INDEX IF NOT EXISTS run_logs_schedule_id_idx ON run_logs(schedule_id);
`)

const adminUsername = process.env.ADMIN_USERNAME || 'admin'
const adminPassword = process.env.ADMIN_PASSWORD || 'password'

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername)
if (!existing) {
  const passwordHash = bcrypt.hashSync(adminPassword, 10)
  const id = crypto.randomUUID()
  const now = Date.now()
  db.prepare(
    'INSERT INTO users (id, username, password_hash, is_admin, locale, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)'
  ).run(id, adminUsername, passwordHash, 'zh', now, now)
  console.log(`Admin user created: ${adminUsername}`)
} else {
  console.log('Admin user already exists')
}

db.close()

import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const dbPath = process.env.DATABASE_URL || './data/mimotion.db'
const migrationsDir = process.env.MIGRATIONS_DIR || path.join(projectDir, 'drizzle', 'migrations')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

function applyMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _mimotion_migrations (
      name TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)

  const migrationFiles = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort()

  const getApplied = db.prepare('SELECT hash FROM _mimotion_migrations WHERE name = ?')
  const recordApplied = db.prepare(
    'INSERT INTO _mimotion_migrations (name, hash, applied_at) VALUES (?, ?, ?)',
  )

  for (const name of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8')
    const hash = crypto.createHash('sha256').update(sql).digest('hex')
    const applied = getApplied.get(name)

    if (applied) {
      if (applied.hash !== hash) {
        throw new Error(`Migration ${name} changed after it was applied`)
      }
      continue
    }

    const statements = sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter(Boolean)

    db.transaction(() => {
      for (const statement of statements) db.exec(statement)
      recordApplied.run(name, hash, Date.now())
    }).immediate()

    console.log(`[Database] Applied migration ${name}`)
  }
}

function initializeAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'password'
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername)

  if (existing) {
    console.log('[Database] Admin user already exists')
    return
  }

  if (process.env.NODE_ENV === 'production' && adminPassword === 'password') {
    throw new Error('ADMIN_PASSWORD must be changed from the default before first production start')
  }

  const passwordHash = bcrypt.hashSync(adminPassword, 12)
  const id = crypto.randomUUID()
  const now = Date.now()
  db.prepare(
    'INSERT INTO users (id, username, password_hash, is_admin, locale, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
  ).run(id, adminUsername, passwordHash, 'zh', now, now)
  console.log(`[Database] Admin user created: ${adminUsername}`)
}

try {
  applyMigrations()
  initializeAdmin()
} finally {
  db.close()
}

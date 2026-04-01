import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  barkUrl: text('bark_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const inviteCodes = sqliteTable('invite_codes', {
  code: text('code').primaryKey(),
  createdBy: text('created_by').notNull().references(() => users.id),
  usedBy: text('used_by').references(() => users.id),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const xiaomiAccounts = sqliteTable('xiaomi_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  xiaomiUserId: text('xiaomi_user_id'),
  tokenData: text('token_data').notNull(),
  tokenIv: text('token_iv'),
  deviceId: text('device_id'),
  nickname: text('nickname'),
  status: text('status').default('active'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  xiaomiAccountId: text('xiaomi_account_id').notNull().references(() => xiaomiAccounts.id),
  cronExpression: text('cron_expression').notNull(),
  minStep: integer('min_step').notNull(),
  maxStep: integer('max_step').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const runLogs = sqliteTable('run_logs', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id),
  executedAt: integer('executed_at', { mode: 'timestamp' }).notNull(),
  stepWritten: integer('step_written'),
  status: text('status'),
  errorMessage: text('error_message'),
})

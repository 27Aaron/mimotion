import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  locale: text('locale').default('zh'),
  // Legacy plaintext columns are retained for a backwards-compatible one-way
  // migration. New writes use the encrypted data/iv pairs below.
  barkUrl: text('bark_url'),
  barkUrlData: text('bark_url_data'),
  barkUrlIv: text('bark_url_iv'),
  telegramBotToken: text('telegram_bot_token'),
  telegramBotTokenData: text('telegram_bot_token_data'),
  telegramBotTokenIv: text('telegram_bot_token_iv'),
  telegramChatId: text('telegram_chat_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const inviteCodes = sqliteTable('invite_codes', {
  code: text('code').primaryKey(),
  createdBy: text('created_by').notNull().references(() => users.id),
  usedBy: text('used_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('invite_codes_used_by_idx').on(table.usedBy),
])

export const xiaomiAccounts = sqliteTable('xiaomi_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  xiaomiUserId: text('xiaomi_user_id'),
  account: text('account'),
  tokenData: text('token_data').notNull(),
  tokenIv: text('token_iv'),
  loginTokenData: text('login_token_data'),
  loginTokenIv: text('login_token_iv'),
  passwordData: text('password_data'),
  passwordIv: text('password_iv'),
  deviceId: text('device_id'),
  nickname: text('nickname'),
  status: text('status').default('active'),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('xiaomi_accounts_user_id_idx').on(table.userId),
])

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
}, (table) => [
  index('schedules_user_id_idx').on(table.userId),
  index('schedules_is_active_idx').on(table.isActive),
])

export const runLogs = sqliteTable('run_logs', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id),
  executedAt: integer('executed_at', { mode: 'timestamp' }).notNull(),
  stepWritten: integer('step_written'),
  status: text('status'),
  errorMessage: text('error_message'),
}, (table) => [
  index('run_logs_schedule_id_idx').on(table.scheduleId),
  index('run_logs_schedule_executed_at_idx').on(table.scheduleId, table.executedAt),
])

/**
 * Durable execution state used by the scheduler worker.
 *
 * run_logs remains the user-facing immutable history. This table is the
 * scheduler's coordination primitive: it makes a scheduled minute idempotent,
 * prevents two schedules for the same Xiaomi account from running in parallel,
 * and allows a crashed worker to resume an unfinished execution.
 */
export const runExecutions = sqliteTable('run_executions', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  xiaomiAccountId: text('xiaomi_account_id').notNull().references(() => xiaomiAccounts.id, { onDelete: 'cascade' }),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['pending', 'running', 'succeeded', 'failed'] }).notNull().default('pending'),
  attempt: integer('attempt').notNull().default(0),
  targetStep: integer('target_step'),
  claimedAt: integer('claimed_at', { mode: 'timestamp' }).notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  uniqueIndex('run_executions_schedule_slot_uidx').on(table.scheduleId, table.scheduledFor),
  uniqueIndex('run_executions_account_slot_uidx').on(table.xiaomiAccountId, table.scheduledFor),
  index('run_executions_status_updated_idx').on(table.status, table.updatedAt),
])

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: integer('reset_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('rate_limits_reset_at_idx').on(table.resetAt),
])

CREATE TABLE IF NOT EXISTS `invite_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`used_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `invite_codes_used_by_idx` ON `invite_codes` (`used_by`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `run_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`xiaomi_account_id` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`target_step` integer,
	`claimed_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`error_code` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`xiaomi_account_id`) REFERENCES `xiaomi_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `run_executions_schedule_slot_uidx` ON `run_executions` (`schedule_id`,`scheduled_for`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `run_executions_account_slot_uidx` ON `run_executions` (`xiaomi_account_id`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `run_executions_status_updated_idx` ON `run_executions` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `run_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`executed_at` integer NOT NULL,
	`step_written` integer,
	`status` text,
	`error_message` text,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `run_logs_schedule_id_idx` ON `run_logs` (`schedule_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `run_logs_schedule_executed_at_idx` ON `run_logs` (`schedule_id`,`executed_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`xiaomi_account_id` text NOT NULL,
	`cron_expression` text NOT NULL,
	`min_step` integer NOT NULL,
	`max_step` integer NOT NULL,
	`is_active` integer DEFAULT true,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`xiaomi_account_id`) REFERENCES `xiaomi_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `schedules_user_id_idx` ON `schedules` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `schedules_is_active_idx` ON `schedules` (`is_active`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`is_admin` integer DEFAULT false,
	`locale` text DEFAULT 'zh',
	`bark_url` text,
	`telegram_bot_token` text,
	`telegram_chat_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `xiaomi_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`xiaomi_user_id` text,
	`account` text,
	`token_data` text NOT NULL,
	`token_iv` text,
	`login_token_data` text,
	`login_token_iv` text,
	`password_data` text,
	`password_iv` text,
	`device_id` text,
	`nickname` text,
	`status` text DEFAULT 'active',
	`last_sync_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `xiaomi_accounts_user_id_idx` ON `xiaomi_accounts` (`user_id`);

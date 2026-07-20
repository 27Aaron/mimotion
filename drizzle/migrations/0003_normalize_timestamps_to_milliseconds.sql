UPDATE `users` SET
  `created_at` = CASE WHEN `created_at` < 100000000000 THEN `created_at` * 1000 ELSE `created_at` END,
  `updated_at` = CASE WHEN `updated_at` < 100000000000 THEN `updated_at` * 1000 ELSE `updated_at` END;--> statement-breakpoint
UPDATE `invite_codes` SET
  `created_at` = CASE WHEN `created_at` < 100000000000 THEN `created_at` * 1000 ELSE `created_at` END;--> statement-breakpoint
UPDATE `xiaomi_accounts` SET
  `last_sync_at` = CASE WHEN `last_sync_at` < 100000000000 THEN `last_sync_at` * 1000 ELSE `last_sync_at` END,
  `created_at` = CASE WHEN `created_at` < 100000000000 THEN `created_at` * 1000 ELSE `created_at` END,
  `updated_at` = CASE WHEN `updated_at` < 100000000000 THEN `updated_at` * 1000 ELSE `updated_at` END;--> statement-breakpoint
UPDATE `schedules` SET
  `last_run_at` = CASE WHEN `last_run_at` < 100000000000 THEN `last_run_at` * 1000 ELSE `last_run_at` END,
  `next_run_at` = CASE WHEN `next_run_at` < 100000000000 THEN `next_run_at` * 1000 ELSE `next_run_at` END,
  `created_at` = CASE WHEN `created_at` < 100000000000 THEN `created_at` * 1000 ELSE `created_at` END,
  `updated_at` = CASE WHEN `updated_at` < 100000000000 THEN `updated_at` * 1000 ELSE `updated_at` END;--> statement-breakpoint
UPDATE `run_logs` SET
  `executed_at` = CASE WHEN `executed_at` < 100000000000 THEN `executed_at` * 1000 ELSE `executed_at` END;--> statement-breakpoint
UPDATE `run_executions` SET
  `scheduled_for` = CASE WHEN `scheduled_for` < 100000000000 THEN `scheduled_for` * 1000 ELSE `scheduled_for` END,
  `claimed_at` = CASE WHEN `claimed_at` < 100000000000 THEN `claimed_at` * 1000 ELSE `claimed_at` END,
  `started_at` = CASE WHEN `started_at` < 100000000000 THEN `started_at` * 1000 ELSE `started_at` END,
  `finished_at` = CASE WHEN `finished_at` < 100000000000 THEN `finished_at` * 1000 ELSE `finished_at` END,
  `created_at` = CASE WHEN `created_at` < 100000000000 THEN `created_at` * 1000 ELSE `created_at` END,
  `updated_at` = CASE WHEN `updated_at` < 100000000000 THEN `updated_at` * 1000 ELSE `updated_at` END;--> statement-breakpoint
UPDATE `rate_limits` SET
  `reset_at` = CASE WHEN `reset_at` < 100000000000 THEN `reset_at` * 1000 ELSE `reset_at` END;

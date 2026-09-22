ALTER TABLE `schedules` ADD COLUMN `calendar_mode` text NOT NULL DEFAULT 'weekly';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `schedules_calendar_mode_idx` ON `schedules` (`calendar_mode`);

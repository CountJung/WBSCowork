CREATE TABLE `bug_report_purge_receipts` (
	`report_id` integer PRIMARY KEY NOT NULL,
	`actor_id` integer,
	`operation_token` text NOT NULL,
	`fingerprint` text NOT NULL,
	`report_version` integer NOT NULL,
	`event_count` integer NOT NULL,
	`last_event_id` integer NOT NULL,
	`purged_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bug_report_purge_receipts_operation_token_unique` ON `bug_report_purge_receipts` (`operation_token`);--> statement-breakpoint
ALTER TABLE `bug_report_events` ADD `lifecycle_action` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `verified_by` integer REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `verification_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `trashed_at` text;--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `trashed_by` integer REFERENCES users(id) ON DELETE SET NULL;
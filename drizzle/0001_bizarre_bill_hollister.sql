CREATE TABLE `file_cleanup_jobs` (
	`object_key` text PRIMARY KEY NOT NULL,
	`not_before` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `file_cleanup_due_idx` ON `file_cleanup_jobs` (`not_before`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `creation_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `submissions_creation_token_unique` ON `submissions` (`creation_token`);
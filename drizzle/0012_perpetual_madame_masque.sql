CREATE TABLE `notification_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_id` integer NOT NULL,
	`project_id` integer NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` integer NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_read_unique` ON `notification_reads` (`recipient_id`,`source_kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `notification_reads_project_idx` ON `notification_reads` (`project_id`);
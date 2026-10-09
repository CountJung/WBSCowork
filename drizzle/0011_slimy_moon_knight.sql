CREATE TABLE `task_template_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`actor_id` integer,
	`template_key` text NOT NULL,
	`template_version` integer NOT NULL,
	`operation_token` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`task_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_template_runs_operation_token_unique` ON `task_template_runs` (`operation_token`);
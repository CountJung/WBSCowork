CREATE TABLE `task_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`actor_id` integer,
	`operation_token` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`assignee_id` integer,
	`reviewer_id` integer,
	`note` text DEFAULT '' NOT NULL,
	`task_version` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_events_operation_token_unique` ON `task_events` (`operation_token`);--> statement-breakpoint
CREATE INDEX `task_events_task_idx` ON `task_events` (`task_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_events_version_unique` ON `task_events` (`task_id`,`task_version`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `creation_token` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `status` text DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `workflow_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `last_operation_token` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reviewer_id` integer REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_creation_token_unique` ON `tasks` (`creation_token`);
--> statement-breakpoint
-- Snapshot only the currently known state, never fabricate historical assignment times.
INSERT INTO task_events(task_id,actor_id,operation_token,request_fingerprint,kind,status,assignee_id,reviewer_id,note,task_version)
SELECT id,NULL,'baseline:task:' || id,'0000000000000000000000000000000000000000000000000000000000000000','baseline',status,assignee_id,reviewer_id,'업무 이력 도입 시점의 상태',version FROM tasks
WHERE NOT EXISTS (SELECT 1 FROM task_events e WHERE e.task_id=tasks.id AND e.task_version=tasks.version);

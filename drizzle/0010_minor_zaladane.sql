CREATE TABLE `task_dependencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`predecessor_id` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`predecessor_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_dependency_self_check" CHECK("task_dependencies"."task_id" <> "task_dependencies"."predecessor_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_dependency_unique` ON `task_dependencies` (`task_id`,`predecessor_id`);--> statement-breakpoint
CREATE INDEX `task_dependency_project_idx` ON `task_dependencies` (`project_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `dependency_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `dependency_token` text;
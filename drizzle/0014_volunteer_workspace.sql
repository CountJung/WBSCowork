CREATE TABLE `activity_team_members` (
	`project_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`team_id`, `user_id`),
	FOREIGN KEY (`project_id`,`user_id`) REFERENCES `project_members`(`project_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`,`team_id`) REFERENCES `activity_teams`(`project_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "activity_team_role_check" CHECK("activity_team_members"."role" IN ('member','leader')),
	CONSTRAINT "activity_team_active_check" CHECK("activity_team_members"."active" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `activity_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`activity_kind` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_team_project_unique` ON `activity_teams` (`project_id`,`id`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`project_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_member_active_check" CHECK("project_members"."active" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `project_workspace_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`actor_id` integer,
	`operation_token` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`workspace_version` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_workspace_operation_unique` ON `project_workspace_events` (`project_id`,`operation_token`);--> statement-breakpoint
ALTER TABLE `projects` ADD `project_type` text DEFAULT 'collaboration' NOT NULL CONSTRAINT project_type_check CHECK(project_type IN ('collaboration','volunteering'));
--> statement-breakpoint
ALTER TABLE `projects` ADD `workspace_version` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `projects` ADD `workspace_token` text;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `activity_team_id` integer REFERENCES activity_teams(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `completion_mode` text DEFAULT 'submission_required' NOT NULL CONSTRAINT task_completion_mode_check CHECK(completion_mode IN ('submission_required','direct_completion'));

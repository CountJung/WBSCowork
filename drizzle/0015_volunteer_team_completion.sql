CREATE TABLE `activity_team_leaders` (
	`team_id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`user_id` integer,
	FOREIGN KEY (`project_id`,`team_id`) REFERENCES `activity_teams`(`project_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`,`user_id`) REFERENCES `activity_team_members`(`team_id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_by` integer REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` text;
--> statement-breakpoint
INSERT INTO activity_team_leaders(team_id,project_id,user_id) SELECT team_id,project_id,user_id FROM activity_team_members WHERE role='leader' AND active=1;

CREATE TABLE `team_preparation_revisions` (
	`team_id` integer NOT NULL,
	`project_id` integer NOT NULL,
	`version` integer NOT NULL,
	`document_json` text NOT NULL,
	`changed_by` integer NOT NULL,
	`changed_at` text NOT NULL,
	`mutation_key` text NOT NULL,
	`request_hash` text NOT NULL,
	PRIMARY KEY(`team_id`, `version`),
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`,`team_id`) REFERENCES `activity_teams`(`project_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "team_preparation_revision_version_check" CHECK("team_preparation_revisions"."version">=1),
	CONSTRAINT "team_preparation_revision_document_check" CHECK(length(CAST("team_preparation_revisions"."document_json" AS BLOB))<=65536)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_preparation_revision_mutation_unique` ON `team_preparation_revisions` (`team_id`,`mutation_key`);--> statement-breakpoint
CREATE TABLE `team_preparation_sheets` (
	`team_id` integer PRIMARY KEY NOT NULL,
	`project_id` integer NOT NULL,
	`version` integer NOT NULL,
	`document_json` text NOT NULL,
	`updated_by` integer NOT NULL,
	`updated_at` text NOT NULL,
	`mutation_key` text NOT NULL,
	`request_hash` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`,`team_id`) REFERENCES `activity_teams`(`project_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "team_preparation_sheet_version_check" CHECK("team_preparation_sheets"."version">=1),
	CONSTRAINT "team_preparation_sheet_document_check" CHECK(length(CAST("team_preparation_sheets"."document_json" AS BLOB))<=65536)
);

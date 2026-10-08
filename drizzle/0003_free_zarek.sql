CREATE TABLE `bug_report_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`actor_id` integer,
	`operation_token` text NOT NULL,
	`kind` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`fix_commit` text DEFAULT '' NOT NULL,
	`report_version` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `bug_reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "bug_event_kind_check" CHECK("bug_report_events"."kind" IN ('created','addendum','review'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bug_report_events_operation_token_unique` ON `bug_report_events` (`operation_token`);--> statement-breakpoint
CREATE INDEX `bug_events_report_idx` ON `bug_report_events` (`report_id`,`id`);--> statement-breakpoint
CREATE TABLE `bug_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reporter_id` integer,
	`creation_token` text NOT NULL,
	`last_operation_token` text NOT NULL,
	`title` text NOT NULL,
	`reproduction` text NOT NULL,
	`expected` text NOT NULL,
	`actual` text NOT NULL,
	`page_path` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`fix_commit` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "bug_status_check" CHECK("bug_reports"."status" IN ('new','in_progress','resolved','closed')),
	CONSTRAINT "bug_priority_check" CHECK("bug_reports"."priority" IN ('low','normal','high'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bug_reports_creation_token_unique` ON `bug_reports` (`creation_token`);--> statement-breakpoint
CREATE INDEX `bug_reports_reporter_idx` ON `bug_reports` (`reporter_id`,`id`);--> statement-breakpoint
CREATE INDEX `bug_reports_status_idx` ON `bug_reports` (`status`,`id`);
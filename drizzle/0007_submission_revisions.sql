CREATE TABLE `submission_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`revision_number` integer NOT NULL,
	`actor_id` integer,
	`operation_token` text NOT NULL,
	`request_fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_events_operation_token_unique` ON `submission_events` (`operation_token`);--> statement-breakpoint
CREATE INDEX `submission_events_submission_idx` ON `submission_events` (`submission_id`,`id`);--> statement-breakpoint
CREATE TABLE `submission_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`revision_number` integer NOT NULL,
	`editor_id` integer,
	`content` text NOT NULL,
	`visibility` text NOT NULL,
	`material_url` text DEFAULT '' NOT NULL,
	`change_summary` text DEFAULT '' NOT NULL,
	`file_path` text,
	`file_name` text,
	`file_mime_type` text,
	`file_size_bytes` integer,
	`source` text DEFAULT 'live' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_revision_unique` ON `submission_revisions` (`submission_id`,`revision_number`);--> statement-breakpoint
CREATE INDEX `submission_revisions_submission_idx` ON `submission_revisions` (`submission_id`,`id`);--> statement-breakpoint
ALTER TABLE `comments` ADD `revision_number` integer;--> statement-breakpoint
ALTER TABLE `submission_attachments` ADD `revision_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `current_revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `last_operation_token` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `material_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Preserve only the surviving projection; earlier overwritten versions cannot be reconstructed.
INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,material_url,change_summary,file_path,file_name,file_mime_type,file_size_bytes,source)
SELECT id,1,NULL,content,visibility,material_url,'이력 도입 시점의 기존 자료',file_path,file_name,file_mime_type,file_size_bytes,'legacy' FROM submissions;
--> statement-breakpoint
INSERT INTO submission_events(submission_id,revision_number,actor_id,operation_token,request_fingerprint,kind,body)
SELECT id,1,NULL,'baseline:submission:' || id,'0000000000000000000000000000000000000000000000000000000000000000','baseline','이력 도입 시점의 기존 자료' FROM submissions;
--> statement-breakpoint
CREATE TRIGGER submission_revision_file_cleanup BEFORE DELETE ON submission_revisions
WHEN OLD.file_path IS NOT NULL
BEGIN
  INSERT INTO file_cleanup_jobs(object_key,not_before) VALUES(OLD.file_path,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(object_key) DO UPDATE SET not_before=MIN(file_cleanup_jobs.not_before,excluded.not_before);
END;

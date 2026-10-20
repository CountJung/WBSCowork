CREATE TABLE `bug_report_screenshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`report_id` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`file_mime_type` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`content_hash` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `bug_reports`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bug_screenshot_ordinal_check" CHECK("bug_report_screenshots"."ordinal" BETWEEN 0 AND 2),
	CONSTRAINT "bug_screenshot_size_check" CHECK("bug_report_screenshots"."file_size_bytes" BETWEEN 1 AND 2097152),
	CONSTRAINT "bug_screenshot_type_check" CHECK("bug_report_screenshots"."file_mime_type" IN ('image/png','image/jpeg','image/webp'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bug_report_screenshots_file_path_unique` ON `bug_report_screenshots` (`file_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `bug_screenshot_ordinal_unique` ON `bug_report_screenshots` (`report_id`,`ordinal`);--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `creation_fingerprint` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER bug_screenshots_validate_staging BEFORE INSERT ON bug_report_screenshots BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM file_cleanup_jobs WHERE object_key=NEW.file_path AND staging_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')) THEN RAISE(ABORT,'Screenshot staging lease expired') END;
END;
--> statement-breakpoint
CREATE TRIGGER bug_screenshots_finish_staging AFTER INSERT ON bug_report_screenshots BEGIN
  DELETE FROM file_cleanup_jobs WHERE object_key=NEW.file_path;
END;
--> statement-breakpoint
CREATE TRIGGER bug_screenshots_queue_delete BEFORE DELETE ON bug_report_screenshots BEGIN
  INSERT INTO file_cleanup_jobs(object_key,not_before) VALUES(OLD.file_path,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(object_key) DO UPDATE SET not_before=excluded.not_before,staging_expires_at=NULL;
END;

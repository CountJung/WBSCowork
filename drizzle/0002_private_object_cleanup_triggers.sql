CREATE TRIGGER attachments_queue_delete BEFORE DELETE ON submission_attachments BEGIN
  INSERT INTO file_cleanup_jobs(object_key, not_before) VALUES (OLD.file_path, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(object_key) DO UPDATE SET not_before=excluded.not_before;
END;
--> statement-breakpoint
CREATE TRIGGER submissions_queue_delete BEFORE DELETE ON submissions WHEN OLD.file_path IS NOT NULL BEGIN
  INSERT INTO file_cleanup_jobs(object_key, not_before) VALUES (OLD.file_path, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(object_key) DO UPDATE SET not_before=excluded.not_before;
END;
--> statement-breakpoint
CREATE TRIGGER submissions_queue_replace BEFORE UPDATE OF file_path ON submissions WHEN OLD.file_path IS NOT NULL AND OLD.file_path IS NOT NEW.file_path BEGIN
  INSERT INTO file_cleanup_jobs(object_key, not_before) VALUES (OLD.file_path, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  ON CONFLICT(object_key) DO UPDATE SET not_before=excluded.not_before;
END;
--> statement-breakpoint
CREATE TRIGGER attachments_finish_staging AFTER INSERT ON submission_attachments BEGIN
  DELETE FROM file_cleanup_jobs WHERE object_key=NEW.file_path;
END;

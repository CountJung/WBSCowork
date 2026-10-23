/** Native screenshot staging and reversible quarantine. Existing files/accounts are untouched. */
const newTables=[`CREATE TABLE IF NOT EXISTS native_bug_file_cleanup_jobs (
 object_key VARCHAR(512) NOT NULL PRIMARY KEY,
 quarantine_key VARCHAR(512) NOT NULL UNIQUE,
 content_hash CHAR(64) NOT NULL,
 file_size_bytes BIGINT NOT NULL,
 state VARCHAR(16) NOT NULL DEFAULT 'staged',
 not_before DATETIME NOT NULL,
 staging_expires_at DATETIME NULL,
 attempts INT NOT NULL DEFAULT 0,
 last_error VARCHAR(64) NOT NULL DEFAULT '',
 quarantined_at DATETIME NULL,
 restored_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY native_bug_cleanup_due_idx (state,not_before),
 CONSTRAINT native_bug_cleanup_state_check CHECK(state IN ('staged','queued','quarantined','restored')),
 CONSTRAINT native_bug_cleanup_size_check CHECK(file_size_bytes BETWEEN 1 AND 2097152),
 CONSTRAINT native_bug_cleanup_attempts_check CHECK(attempts>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`];
const guardStatement=`SELECT COUNT(*) INTO eligible FROM native_bug_file_cleanup_jobs WHERE object_key=NEW.file_path AND content_hash=NEW.content_hash AND file_size_bytes=NEW.file_size_bytes AND state='staged' AND staging_expires_at>CURRENT_TIMESTAMP FOR UPDATE;
 IF eligible<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Native screenshot staging lease is unavailable'; END IF;`;
const triggers=[
 {name:"native_bug_screenshot_stage_insert",event:"INSERT",body:`BEGIN DECLARE eligible INT DEFAULT 0; ${guardStatement} END`},
 {name:"native_bug_screenshot_stage_update",event:"UPDATE",body:`BEGIN DECLARE eligible INT DEFAULT 0; IF NOT (NEW.file_path<=>OLD.file_path) THEN ${guardStatement} END IF; END`},
] as const;
export const nativeMigrationV13={version:13,name:"native_bug_file_quarantine",verifierVersion:1,newTables,triggers,statements:newTables} as const;

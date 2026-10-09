/** Minimal per-recipient read receipts; no duplicated notification bodies. */
const newTables=[`CREATE TABLE IF NOT EXISTS notification_reads (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 recipient_id BIGINT NOT NULL,
 project_id BIGINT NOT NULL,
 source_kind VARCHAR(16) NOT NULL,
 source_id BIGINT NOT NULL,
 read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY notification_read_unique (recipient_id,source_kind,source_id),
 KEY notification_reads_project_idx (project_id),
 CONSTRAINT notification_read_user_fk FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT notification_read_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`];
export const nativeMigrationV8={version:8,name:'notification_read_receipts',verifierVersion:1,newTables,statements:newTables} as const;

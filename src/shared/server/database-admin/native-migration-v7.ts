/** Immutable atomic template application receipt. */
const newTables=[`CREATE TABLE IF NOT EXISTS task_template_runs (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT NOT NULL,
 actor_id BIGINT NULL,
 template_key VARCHAR(64) NOT NULL,
 template_version INT NOT NULL,
 operation_token VARCHAR(191) NOT NULL UNIQUE,
 request_fingerprint CHAR(64) NOT NULL,
 task_count INT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at DATETIME NULL,
 CONSTRAINT task_template_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
 CONSTRAINT task_template_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`];
export const nativeMigrationV7={version:7,name:'task_template_applications',verifierVersion:1,newTables,statements:newTables} as const;

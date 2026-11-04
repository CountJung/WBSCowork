/** Additive project polls and account-linked single ballot storage; no legacy row rewrites. */
const newTables = [
`CREATE TABLE IF NOT EXISTS project_polls (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 project_id BIGINT NOT NULL,
 title VARCHAR(160) NOT NULL,
 description TEXT NOT NULL,
 starts_at VARCHAR(24) NOT NULL,
 ends_at VARCHAR(24) NOT NULL,
 options_json TEXT NOT NULL,
 created_by BIGINT NOT NULL,
 created_at VARCHAR(24) NOT NULL,
 mutation_key CHAR(36) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 UNIQUE KEY project_poll_parent_unique(project_id,id),
 UNIQUE KEY project_poll_receipt_unique(project_id,created_by,mutation_key),
 CONSTRAINT project_poll_project_fk FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT,
 CONSTRAINT project_poll_creator_fk FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT project_poll_period_check CHECK(starts_at<ends_at),
 CONSTRAINT project_poll_title_check CHECK(CHAR_LENGTH(title) BETWEEN 1 AND 160),
 CONSTRAINT project_poll_options_check CHECK(JSON_VALID(options_json) AND JSON_LENGTH(options_json) BETWEEN 2 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS project_poll_ballots (
 poll_id BIGINT NOT NULL,
 project_id BIGINT NOT NULL,
 user_id BIGINT NOT NULL,
 option_id INT NOT NULL,
 updated_at VARCHAR(24) NOT NULL,
 write_token CHAR(36) NOT NULL,
 PRIMARY KEY(poll_id,user_id),
 CONSTRAINT project_poll_ballot_user_fk FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT project_poll_ballot_poll_fk FOREIGN KEY(project_id,poll_id) REFERENCES project_polls(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT project_poll_ballot_option_check CHECK(option_id BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
] as const;
export const nativeMigrationV18 = { version: 18, name: "project_polls", verifierVersion: 1, newTables, statements: newTables } as const;

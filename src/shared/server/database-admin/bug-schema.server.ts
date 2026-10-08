/** Additive native MariaDB schema; Sites uses versioned SQLite migrations. */
export const bugSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS bug_reports (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    reporter_id BIGINT NULL, creation_token VARCHAR(128) NOT NULL UNIQUE,
    last_operation_token VARCHAR(128) NOT NULL,
    title VARCHAR(160) NOT NULL, reproduction TEXT NOT NULL, expected TEXT NOT NULL, actual TEXT NOT NULL,
    page_path VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'new', priority VARCHAR(16) NOT NULL DEFAULT 'normal',
    resolution TEXT NOT NULL DEFAULT '', fix_commit VARCHAR(40) NOT NULL DEFAULT '',
    version INT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY bug_reports_reporter_idx(reporter_id,id), KEY bug_reports_status_idx(status,id),
    CONSTRAINT bug_reports_reporter_fk FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT bug_status_check CHECK(status IN ('new','in_progress','resolved','closed')),
    CONSTRAINT bug_priority_check CHECK(priority IN ('low','normal','high'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS bug_report_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    report_id BIGINT NOT NULL, actor_id BIGINT NULL, operation_token VARCHAR(128) NOT NULL UNIQUE,
    kind VARCHAR(16) NOT NULL, body TEXT NOT NULL DEFAULT '', status VARCHAR(16) NOT NULL,
    priority VARCHAR(16) NOT NULL, resolution TEXT NOT NULL DEFAULT '', fix_commit VARCHAR(40) NOT NULL DEFAULT '',
    report_version INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY bug_events_report_idx(report_id,id),
    CONSTRAINT bug_events_report_fk FOREIGN KEY(report_id) REFERENCES bug_reports(id),
    CONSTRAINT bug_events_actor_fk FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT bug_event_kind_check CHECK(kind IN ('created','addendum','review'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;

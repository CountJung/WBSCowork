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
    verified_at DATETIME NULL, verified_by BIGINT NULL, verification_note TEXT NOT NULL DEFAULT '',
    trashed_at DATETIME NULL, trashed_by BIGINT NULL,
    version INT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY bug_reports_reporter_idx(reporter_id,id), KEY bug_reports_status_idx(status,id),
    CONSTRAINT bug_reports_verified_by_fk FOREIGN KEY(verified_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT bug_reports_trashed_by_fk FOREIGN KEY(trashed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT bug_reports_reporter_fk FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT bug_status_check CHECK(status IN ('new','in_progress','resolved','closed')),
    CONSTRAINT bug_priority_check CHECK(priority IN ('low','normal','high'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS bug_report_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    report_id BIGINT NOT NULL, actor_id BIGINT NULL, operation_token VARCHAR(128) NOT NULL UNIQUE,
    kind VARCHAR(16) NOT NULL, body TEXT NOT NULL DEFAULT '', status VARCHAR(16) NOT NULL,
    priority VARCHAR(16) NOT NULL, resolution TEXT NOT NULL DEFAULT '', fix_commit VARCHAR(40) NOT NULL DEFAULT '',
    lifecycle_action VARCHAR(16) NOT NULL DEFAULT '',
    report_version INT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY bug_events_report_idx(report_id,id),
    CONSTRAINT bug_events_report_fk FOREIGN KEY(report_id) REFERENCES bug_reports(id),
    CONSTRAINT bug_events_actor_fk FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT bug_event_kind_check CHECK(kind IN ('created','addendum','review'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS bug_report_purge_receipts (
    report_id BIGINT NOT NULL PRIMARY KEY, actor_id BIGINT NULL,
    operation_token VARCHAR(128) NOT NULL UNIQUE, fingerprint CHAR(64) NOT NULL,
    report_version INT NOT NULL, event_count INT NOT NULL, last_event_id BIGINT NOT NULL,
    purged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bug_purge_actor_fk FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;
export const bugLifecycleColumns = [
  { name: "verified_at", definition: "verified_at DATETIME NULL" },
  { name: "verified_by", definition: "verified_by BIGINT NULL" },
  {
    name: "verification_note",
    definition: "verification_note TEXT NOT NULL DEFAULT ''",
  },
  { name: "trashed_at", definition: "trashed_at DATETIME NULL" },
  { name: "trashed_by", definition: "trashed_by BIGINT NULL" },
];
export const bugEventLifecycleColumns = [
  {
    name: "lifecycle_action",
    definition: "lifecycle_action VARCHAR(16) NOT NULL DEFAULT ''",
  },
];

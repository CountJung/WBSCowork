/** Immutable native migration 0001. Append a new version; never edit a released specification. */
export const nativeSchemaV1 = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'member', 'guest') NOT NULL DEFAULT 'guest',
    google_id VARCHAR(255) NULL,
    avatar_url VARCHAR(500) NULL,
    last_login_at DATETIME NULL,
    last_synced_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_email_unique (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS projects (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    parent_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    depth INT NOT NULL DEFAULT 0,
    order_index INT NOT NULL DEFAULT 0,
    assignee_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY tasks_project_idx (project_id),
    KEY tasks_parent_idx (parent_id),
    KEY tasks_assignee_idx (assignee_id),
    CONSTRAINT tasks_project_fk FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT tasks_parent_fk FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE SET NULL,
    CONSTRAINT tasks_assignee_fk FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
    file_path VARCHAR(500) NULL,
    file_name VARCHAR(255) NULL,
    file_mime_type VARCHAR(255) NULL,
    file_size_bytes BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY submissions_task_idx (task_id),
    KEY submissions_author_idx (author_id),
    CONSTRAINT submissions_task_fk FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT submissions_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS submission_attachments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_mime_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
    file_size_bytes BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY submission_attachments_submission_idx (submission_id),
    CONSTRAINT submission_attachments_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS comments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY comments_submission_idx (submission_id),
    KEY comments_author_idx (author_id),
    CONSTRAINT comments_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
    CONSTRAINT comments_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
] as const;

const requiredUsersColumns = [
  { name: "google_id", definition: "google_id VARCHAR(255) NULL" },
  { name: "avatar_url", definition: "avatar_url VARCHAR(500) NULL" },
  { name: "last_login_at", definition: "last_login_at DATETIME NULL" },
  { name: "last_synced_at", definition: "last_synced_at DATETIME NULL" },
];
const requiredSubmissionColumns = [
  { name: "visibility", definition: "visibility ENUM('public', 'private') NOT NULL DEFAULT 'public'" },
  { name: "file_name", definition: "file_name VARCHAR(255) NULL" },
  { name: "file_mime_type", definition: "file_mime_type VARCHAR(255) NULL" },
  { name: "file_size_bytes", definition: "file_size_bytes BIGINT NULL" },
];
const bugLifecycleColumns = [
  { name: "verified_at", definition: "verified_at DATETIME NULL" },
  { name: "verified_by", definition: "verified_by BIGINT NULL" },
  {
    name: "verification_note",
    definition: "verification_note TEXT NOT NULL DEFAULT ''",
  },
  { name: "trashed_at", definition: "trashed_at DATETIME NULL" },
  { name: "trashed_by", definition: "trashed_by BIGINT NULL" },
];
const bugEventLifecycleColumns = [
  {
    name: "lifecycle_action",
    definition: "lifecycle_action VARCHAR(16) NOT NULL DEFAULT ''",
  },
];

export const nativeMigrationV1 = {
  version: 1,
  name: "baseline_and_legacy_additive_upgrade",
  verifierVersion: 1,
  statements: nativeSchemaV1,
  additions: [
    ...requiredUsersColumns.map(column => ({ table: "users", ...column })),
    ...requiredSubmissionColumns.map(column => ({ table: "submissions", ...column })),
    ...bugLifecycleColumns.map(column => ({ table: "bug_reports", ...column })),
    ...bugEventLifecycleColumns.map(column => ({ table: "bug_report_events", ...column })),
  ],
  roleUpgrade: { table: "users", column: "role", allowed: ["admin", "member", "guest"], definition: "role ENUM('admin', 'member', 'guest') NOT NULL DEFAULT 'guest'" },
  additiveForeignKeys: ["verified_by", "trashed_by"],
} as const;

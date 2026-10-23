CREATE TABLE project_report_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  project_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  time_zone TEXT NOT NULL,
  lookback_hours INTEGER NOT NULL,
  formats_json TEXT NOT NULL,
  audience_mode TEXT NOT NULL DEFAULT 'public_only',
  delivery_mode TEXT NOT NULL DEFAULT 'none',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  CONSTRAINT report_schedule_project_fk FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT,
  CONSTRAINT report_schedule_creator_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT report_schedule_enabled_check CHECK(enabled IN (0,1)),
  CONSTRAINT report_schedule_hours_check CHECK(lookback_hours BETWEEN 1 AND 744),
  CONSTRAINT report_schedule_formats_check CHECK(formats_json IN ('["docx"]','["pptx"]','["docx","pptx"]')),
  CONSTRAINT report_schedule_audience_check CHECK(audience_mode='public_only'),
  CONSTRAINT report_schedule_delivery_check CHECK(delivery_mode='none'),
  CONSTRAINT report_schedule_version_check CHECK(version>=1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX report_schedule_project_unique ON project_report_schedules (id,project_id);
--> statement-breakpoint
CREATE INDEX report_schedule_project_idx ON project_report_schedules (project_id,created_by);
--> statement-breakpoint
CREATE TABLE project_report_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  project_id INTEGER NOT NULL,
  requested_by INTEGER NOT NULL,
  schedule_id INTEGER NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  dry_run INTEGER NOT NULL DEFAULT 1,
  formats_json TEXT NOT NULL,
  audience_mode TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  snapshot_at TEXT NOT NULL,
  snapshot_json TEXT NULL,
  snapshot_hash TEXT NULL,
  lease_token TEXT NULL,
  lease_until TEXT NULL,
  heartbeat_at TEXT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT report_run_project_fk FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT,
  CONSTRAINT report_run_requester_fk FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT report_run_schedule_fk FOREIGN KEY (schedule_id,project_id) REFERENCES project_report_schedules (id,project_id) ON DELETE RESTRICT,
  CONSTRAINT report_run_status_check CHECK(status IN ('queued','running','rendered','failed','skipped')),
  CONSTRAINT report_run_dry_check CHECK(dry_run IN (0,1)),
  CONSTRAINT report_run_audience_check CHECK(audience_mode IN ('public_only','requester_scope')),
  CONSTRAINT report_run_formats_check CHECK(formats_json IN ('["docx"]','["pptx"]','["docx","pptx"]')),
  CONSTRAINT report_run_attempts_check CHECK(attempts BETWEEN 0 AND 3),
  CONSTRAINT report_run_period_check CHECK(period_start<period_end AND period_end<=snapshot_at AND snapshot_at<expires_at)
);
--> statement-breakpoint
CREATE UNIQUE INDEX report_run_key_unique ON project_report_runs (idempotency_key);
--> statement-breakpoint
CREATE INDEX report_run_project_idx ON project_report_runs (project_id,requested_by,created_at);
--> statement-breakpoint
CREATE INDEX report_run_lease_idx ON project_report_runs (status,lease_until);
--> statement-breakpoint
CREATE TABLE project_report_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  run_id INTEGER NOT NULL,
  format TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'staged',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT report_artifact_run_fk FOREIGN KEY (run_id) REFERENCES project_report_runs (id) ON DELETE RESTRICT,
  CONSTRAINT report_artifact_format_check CHECK(format IN ('docx','pptx')),
  CONSTRAINT report_artifact_size_check CHECK(size_bytes BETWEEN 1 AND 8388608),
  CONSTRAINT report_artifact_state_check CHECK(state IN ('staged','ready','quarantining','quarantined'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX report_artifact_run_format_unique ON project_report_artifacts (run_id,format);
--> statement-breakpoint
CREATE UNIQUE INDEX report_artifact_storage_unique ON project_report_artifacts (storage_key);
--> statement-breakpoint
CREATE INDEX report_artifact_expiry_idx ON project_report_artifacts (state,expires_at);

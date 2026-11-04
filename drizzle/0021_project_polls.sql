CREATE TABLE project_polls (
 id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 title TEXT NOT NULL,
 description TEXT NOT NULL,
 starts_at TEXT NOT NULL,
 ends_at TEXT NOT NULL,
 options_json TEXT NOT NULL,
 created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL,
 mutation_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 CONSTRAINT project_poll_period_check CHECK(starts_at<ends_at),
 CONSTRAINT project_poll_title_check CHECK(length(title) BETWEEN 1 AND 160),
 CONSTRAINT project_poll_options_check CHECK(json_valid(options_json) AND json_array_length(options_json) BETWEEN 2 AND 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX project_poll_parent_unique ON project_polls(project_id,id);
--> statement-breakpoint
CREATE UNIQUE INDEX project_poll_receipt_unique ON project_polls(project_id,created_by,mutation_key);
--> statement-breakpoint
CREATE TABLE project_poll_ballots (
 poll_id INTEGER NOT NULL,
 project_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 option_id INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 write_token TEXT NOT NULL,
 PRIMARY KEY(poll_id,user_id),
 CONSTRAINT project_poll_ballot_poll_fk FOREIGN KEY(project_id,poll_id) REFERENCES project_polls(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT project_poll_ballot_option_check CHECK(option_id BETWEEN 1 AND 10)
);

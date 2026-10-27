CREATE TABLE project_media_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 project_id INTEGER NOT NULL,
 team_id INTEGER NOT NULL,
 created_by INTEGER NOT NULL,
 title VARCHAR(120) NOT NULL,
 caption TEXT NOT NULL,
 visibility VARCHAR(16) NOT NULL DEFAULT 'team_private',
 file_path VARCHAR(512) NOT NULL,
 file_name VARCHAR(255) NOT NULL,
 file_mime_type VARCHAR(32) NOT NULL,
 file_size_bytes INTEGER NOT NULL,
 content_hash CHAR(64) NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 mutation_key CHAR(36) NOT NULL,
 upload_key TEXT NOT NULL,
 request_hash CHAR(64) NOT NULL,
 created_at VARCHAR(24) NOT NULL,
 updated_at VARCHAR(24) NOT NULL,
 CONSTRAINT project_media_team_fk FOREIGN KEY(project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT project_media_author_fk FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT project_media_visibility_check CHECK(visibility IN ('team_private','project')),
 CONSTRAINT project_media_type_check CHECK(file_mime_type IN ('image/png','image/jpeg','image/webp','video/mp4','video/webm')),
 CONSTRAINT project_media_size_check CHECK(file_size_bytes>0 AND file_size_bytes<=20971520),
 CONSTRAINT project_media_version_check CHECK(version>=1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX project_media_parent_unique ON project_media_items(project_id,team_id,id);
--> statement-breakpoint
CREATE UNIQUE INDEX project_media_upload_unique ON project_media_items(project_id,team_id,upload_key);
--> statement-breakpoint
CREATE UNIQUE INDEX project_media_path_unique ON project_media_items(file_path);
--> statement-breakpoint
CREATE TABLE project_media_revisions (
 media_id INTEGER NOT NULL,
 project_id INTEGER NOT NULL,
 team_id INTEGER NOT NULL,
 version INTEGER NOT NULL,
 title VARCHAR(120) NOT NULL,
 caption TEXT NOT NULL,
 visibility VARCHAR(16) NOT NULL,
 changed_by INTEGER NOT NULL,
 changed_at VARCHAR(24) NOT NULL,
 mutation_key CHAR(36) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 PRIMARY KEY(media_id,version),
 CONSTRAINT project_media_revision_parent_fk FOREIGN KEY(project_id,team_id,media_id) REFERENCES project_media_items(project_id,team_id,id) ON DELETE RESTRICT,
 CONSTRAINT project_media_revision_actor_fk FOREIGN KEY(changed_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT project_media_revision_visibility_check CHECK(visibility IN ('team_private','project')),
 CONSTRAINT project_media_revision_version_check CHECK(version>=1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX project_media_revision_mutation_unique ON project_media_revisions(media_id,mutation_key);
--> statement-breakpoint
CREATE TABLE project_media_upload_staging (
 object_key VARCHAR(512) NOT NULL PRIMARY KEY,
 project_id INTEGER NOT NULL,
 team_id INTEGER NOT NULL,
 actor_id INTEGER NOT NULL,
 content_hash CHAR(64) NOT NULL,
 file_size_bytes INTEGER NOT NULL,
 state VARCHAR(16) NOT NULL DEFAULT 'staged',
 staging_expires_at VARCHAR(24) NOT NULL,
 created_at VARCHAR(24) NOT NULL,
 CONSTRAINT project_media_staging_team_fk FOREIGN KEY(project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT project_media_staging_actor_fk FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT project_media_staging_state_check CHECK(state IN ('staged','attached','failed')),
 CONSTRAINT project_media_staging_size_check CHECK(file_size_bytes>0 AND file_size_bytes<=20971520)
);

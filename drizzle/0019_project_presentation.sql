CREATE TABLE project_presentation_settings (
 project_id INTEGER NOT NULL,
 layout TEXT NOT NULL,
 title TEXT NOT NULL,
 intro TEXT NOT NULL,
 version INTEGER NOT NULL,
 updated_by INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 mutation_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 PRIMARY KEY (project_id),
 CONSTRAINT portal_settings_actor_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT portal_settings_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
 CONSTRAINT portal_settings_check_0 CHECK(version>=1),
 CONSTRAINT portal_settings_check_1 CHECK(layout IN ('workspace','volunteer_presentation'))
);
--> statement-breakpoint
CREATE TABLE project_presentation_revisions (
 project_id INTEGER NOT NULL,
 layout TEXT NOT NULL,
 title TEXT NOT NULL,
 intro TEXT NOT NULL,
 version INTEGER NOT NULL,
 updated_by INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 mutation_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 PRIMARY KEY (project_id,version),
 CONSTRAINT portal_settings_revision_actor_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT portal_settings_revision_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT,
 CONSTRAINT portal_settings_revision_check_0 CHECK(version>=1),
 CONSTRAINT portal_settings_revision_check_1 CHECK(layout IN ('workspace','volunteer_presentation'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX portal_settings_revision_mutation_unique ON project_presentation_revisions (project_id,mutation_key);
--> statement-breakpoint
CREATE TABLE team_presentation_publications (
 team_id INTEGER NOT NULL,
 project_id INTEGER NOT NULL,
 audience TEXT NOT NULL,
 preparation_version INTEGER NULL,
 version INTEGER NOT NULL,
 updated_by INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 mutation_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 PRIMARY KEY (team_id),
 CONSTRAINT portal_team_publication_actor_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT portal_team_publication_team_fk FOREIGN KEY (project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT portal_team_publication_preparation_fk FOREIGN KEY (team_id,preparation_version) REFERENCES team_preparation_revisions(team_id,version) ON DELETE RESTRICT,
 CONSTRAINT portal_team_publication_check_0 CHECK(version>=1),
 CONSTRAINT portal_team_publication_check_1 CHECK(audience IN ('team_private','project')),
 CONSTRAINT portal_team_publication_check_2 CHECK(audience='team_private' OR preparation_version IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE team_presentation_revisions (
 team_id INTEGER NOT NULL,
 project_id INTEGER NOT NULL,
 audience TEXT NOT NULL,
 preparation_version INTEGER NULL,
 version INTEGER NOT NULL,
 updated_by INTEGER NOT NULL,
 updated_at TEXT NOT NULL,
 mutation_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 PRIMARY KEY (team_id,version),
 CONSTRAINT portal_team_revision_actor_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT portal_team_revision_team_fk FOREIGN KEY (project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT portal_team_revision_preparation_fk FOREIGN KEY (team_id,preparation_version) REFERENCES team_preparation_revisions(team_id,version) ON DELETE RESTRICT,
 CONSTRAINT portal_team_revision_check_0 CHECK(version>=1),
 CONSTRAINT portal_team_revision_check_1 CHECK(audience IN ('team_private','project')),
 CONSTRAINT portal_team_revision_check_2 CHECK(audience='team_private' OR preparation_version IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX portal_team_revision_mutation_unique ON team_presentation_revisions (team_id,mutation_key);

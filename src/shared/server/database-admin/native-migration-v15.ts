/** Additive team preparation sheets and append-only application revision history. */
const newTables=[
`CREATE TABLE IF NOT EXISTS team_preparation_sheets (
 team_id BIGINT NOT NULL PRIMARY KEY,
 project_id BIGINT NOT NULL,
 version INT NOT NULL,
 document_json MEDIUMTEXT NOT NULL,
 updated_by BIGINT NOT NULL,
 updated_at VARCHAR(24) NOT NULL,
 mutation_key CHAR(36) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 CONSTRAINT team_preparation_sheet_team_fk FOREIGN KEY (project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT team_preparation_sheet_actor_fk FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT team_preparation_sheet_version_check CHECK(version>=1),
 CONSTRAINT team_preparation_sheet_document_check CHECK(OCTET_LENGTH(document_json)<=65536)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS team_preparation_revisions (
 team_id BIGINT NOT NULL,
 project_id BIGINT NOT NULL,
 version INT NOT NULL,
 document_json MEDIUMTEXT NOT NULL,
 changed_by BIGINT NOT NULL,
 changed_at VARCHAR(24) NOT NULL,
 mutation_key CHAR(36) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 PRIMARY KEY (team_id,version),
 UNIQUE KEY team_preparation_revision_mutation_unique (team_id,mutation_key),
 CONSTRAINT team_preparation_revision_team_fk FOREIGN KEY (project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE RESTRICT,
 CONSTRAINT team_preparation_revision_actor_fk FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT team_preparation_revision_version_check CHECK(version>=1),
 CONSTRAINT team_preparation_revision_document_check CHECK(OCTET_LENGTH(document_json)<=65536)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;
export const nativeMigrationV15={version:15,name:"team_preparation_sheets",verifierVersion:1,newTables,statements:newTables} as const;

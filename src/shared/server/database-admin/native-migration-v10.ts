/** Policy-independent volunteer workspace storage. No account-role or data rewrite. */
import { nativeMigrationV1 } from "./native-migration-v1";

const additions = [
  { table: "projects", name: "project_type", definition: "project_type VARCHAR(32) NOT NULL DEFAULT 'collaboration'" },
  { table: "projects", name: "workspace_version", definition: "workspace_version INT NOT NULL DEFAULT 0" },
  { table: "projects", name: "workspace_token", definition: "workspace_token VARCHAR(36) NULL" },
  { table: "tasks", name: "activity_team_id", definition: "activity_team_id BIGINT NULL" },
  { table: "tasks", name: "completion_mode", definition: "completion_mode VARCHAR(32) NOT NULL DEFAULT 'submission_required'" },
] as const;
const checks = [
  { table: "projects", name: "project_type_check", definition: "CONSTRAINT project_type_check CHECK(project_type IN ('collaboration','volunteering'))" },
  { table: "tasks", name: "task_completion_mode_check", definition: "CONSTRAINT task_completion_mode_check CHECK(completion_mode IN ('submission_required','direct_completion'))" },
] as const;
const foreignKeys = [
  { table: "tasks", column: "activity_team_id", definition: "CONSTRAINT tasks_activity_team_fk FOREIGN KEY (activity_team_id) REFERENCES activity_teams(id) ON DELETE SET NULL" },
] as const;
const newTables = [
  `CREATE TABLE IF NOT EXISTS project_members (
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    active INT NOT NULL DEFAULT 1,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id,user_id),
    CONSTRAINT project_member_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_member_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT project_member_active_check CHECK(active IN (0,1))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS activity_teams (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    activity_kind VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY activity_team_project_unique (project_id,id),
    CONSTRAINT activity_team_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS activity_team_members (
    project_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'member',
    active INT NOT NULL DEFAULT 1,
    PRIMARY KEY (team_id,user_id),
    CONSTRAINT activity_team_member_project_fk FOREIGN KEY (project_id,user_id) REFERENCES project_members(project_id,user_id) ON DELETE CASCADE,
    CONSTRAINT activity_team_member_team_fk FOREIGN KEY (project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE CASCADE,
    CONSTRAINT activity_team_role_check CHECK(role IN ('member','leader')),
    CONSTRAINT activity_team_active_check CHECK(active IN (0,1))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS project_workspace_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    actor_id BIGINT NULL,
    operation_token VARCHAR(36) NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    workspace_version INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY project_workspace_operation_unique (project_id,operation_token),
    CONSTRAINT project_workspace_event_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT project_workspace_event_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;
export const nativeMigrationV10 = {
  version: 10, name: "volunteer_workspace", verifierVersion: 1, additions, checks, foreignKeys, newTables,
  statements: [
    ...["projects", "tasks"].map(table => {
      const baseline = nativeMigrationV1.statements.find(statement => statement.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`))!;
      const entries = [...additions.filter(column => column.table === table).map(column => column.definition),
        ...checks.filter(check => check.table === table).map(check => check.definition),
        ...foreignKeys.filter(key => key.table === table).map(key => key.definition)];
      return baseline.replace("(\n", `(\n${entries.map(entry => `    ${entry},`).join("\n")}\n`);
    }), ...newTables,
  ],
} as const;

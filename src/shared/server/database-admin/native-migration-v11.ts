/** Single canonical team leader and nullable completion attribution; legacy rows are retained. */
import { nativeMigrationV1 } from "./native-migration-v1";
const additions = [
  {table:"tasks",name:"completed_by",definition:"completed_by BIGINT NULL"},
  {table:"tasks",name:"completed_at",definition:"completed_at DATETIME NULL"},
] as const;
const foreignKeys = [{table:"tasks",column:"completed_by",definition:"CONSTRAINT tasks_completed_by_fk FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL"}] as const;
const newTables = [`CREATE TABLE IF NOT EXISTS activity_team_leaders (
  team_id BIGINT NOT NULL PRIMARY KEY,
  project_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  CONSTRAINT team_leader_team_fk FOREIGN KEY (project_id,team_id) REFERENCES activity_teams(project_id,id) ON DELETE CASCADE,
  CONSTRAINT team_leader_member_fk FOREIGN KEY (team_id,user_id) REFERENCES activity_team_members(team_id,user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`] as const;
const duplicateLeadersSql = "SELECT team_id FROM activity_team_members WHERE role='leader' AND active=1 GROUP BY team_id HAVING COUNT(*)>1 LIMIT 1";
const baselineSql = "INSERT INTO activity_team_leaders(team_id,project_id,user_id) SELECT m.team_id,m.project_id,m.user_id FROM activity_team_members m WHERE m.role='leader' AND m.active=1 AND NOT EXISTS(SELECT 1 FROM activity_team_leaders current_leader WHERE current_leader.team_id=m.team_id)";
export const nativeMigrationV11 = {
  version:11,name:"volunteer_team_completion",verifierVersion:1,additions,foreignKeys,newTables,duplicateLeadersSql,baselineSql,
  statements:[...newTables,nativeMigrationV1.statements.find(statement=>statement.startsWith("CREATE TABLE IF NOT EXISTS tasks ("))!.replace("(\n",`(\n${[...additions.map(column=>column.definition),...foreignKeys.map(key=>key.definition)].map(entry=>`    ${entry},`).join("\n")}\n`)],
} as const;

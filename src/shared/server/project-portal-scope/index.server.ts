import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import type { ProjectSqlGuard, ProjectViewer } from "@/src/shared/server/project-scope/index.server";
export type { ProjectViewer, ProjectSqlGuard };
function fixed(expression: string) {
  if (!/^(?:[a-z_]+\.)?[a-z_]+$/.test(expression)) throw new Error("Invalid fixed portal scope expression.");
  return expression;
}
/** Only the server-resolved identity is accepted; a claimed email may never select another ID. */
function identity(viewer: ProjectViewer) {
  const id = Number.isSafeInteger(viewer.userId) && Number(viewer.userId) > 0 ? viewer.userId : null;
  const email = typeof viewer.email === "string" ? viewer.email.trim().toLowerCase() : "";
  return { id, email, su: viewer.isSuperuser ? 1 : 0, configured: getRuntimeEnv().auth.superuserEmail?.trim().toLowerCase() ?? "" };
}
function membership(project: string, user: string) {
  return `EXISTS(SELECT 1 FROM project_members portal_member WHERE portal_member.project_id=${project} AND portal_member.user_id=${user} AND portal_member.active=1)`;
}
/** New project portals always require membership, including legacy-readable WBS projects. */
export function projectPortalAccessGuard(viewer: ProjectViewer, project = "p.id"): ProjectSqlGuard {
  const p = fixed(project), current = identity(viewer);
  return { sql: `EXISTS(SELECT 1 FROM projects portal_project JOIN users portal_user ON portal_user.id=? AND LOWER(TRIM(portal_user.email))=? WHERE portal_project.id=${p} AND ((?=1 AND LOWER(TRIM(portal_user.email))=?) OR ${membership("portal_project.id", "portal_user.id")}))`, params: [current.id, current.email, current.su, current.configured] };
}
export function projectPortalManagementGuard(viewer: ProjectViewer, project = "p.id"): ProjectSqlGuard {
  const p = fixed(project), current = identity(viewer);
  return { sql: `EXISTS(SELECT 1 FROM projects portal_project JOIN users portal_user ON portal_user.id=? AND LOWER(TRIM(portal_user.email))=? WHERE portal_project.id=${p} AND ((?=1 AND LOWER(TRIM(portal_user.email))=?) OR (portal_user.role='admin' AND ${membership("portal_project.id", "portal_user.id")})))`, params: [current.id, current.email, current.su, current.configured] };
}
export function projectPortalTeamGuard(viewer: ProjectViewer, options: { project?: string; team?: string; edit: boolean }): ProjectSqlGuard {
  const project = fixed(options.project ?? "p.id"), team = fixed(options.team ?? "t.id"), current = identity(viewer);
  const leader = options.edit ? " AND portal_team_member.role='leader' AND EXISTS(SELECT 1 FROM activity_team_leaders portal_leader WHERE portal_leader.project_id=portal_team_member.project_id AND portal_leader.team_id=portal_team_member.team_id AND portal_leader.user_id=portal_team_member.user_id)" : "";
  return {
    sql: `EXISTS(SELECT 1 FROM activity_teams portal_team JOIN projects portal_project ON portal_project.id=portal_team.project_id JOIN users portal_user ON portal_user.id=? AND LOWER(TRIM(portal_user.email))=? WHERE portal_team.id=${team} AND portal_project.id=${project} AND ((?=1 AND LOWER(TRIM(portal_user.email))=?) OR (${membership("portal_project.id", "portal_user.id")} AND (portal_user.role='admin' OR (portal_user.role IN ('member','admin') AND EXISTS(SELECT 1 FROM activity_team_members portal_team_member WHERE portal_team_member.project_id=portal_project.id AND portal_team_member.team_id=portal_team.id AND portal_team_member.user_id=portal_user.id AND portal_team_member.active=1${leader}))))))`,
    params: [current.id, current.email, current.su, current.configured],
  };
}
export async function assertProjectPortalAccess(viewer: ProjectViewer, projectId: number) {
  if (!Number.isSafeInteger(projectId) || projectId < 1) throw new Error("Project portal not found.");
  const scope = projectPortalAccessGuard(viewer, "p.id");
  if (!(await getDatabasePool().query(`SELECT p.id FROM projects p WHERE p.id=? AND ${scope.sql}`, [projectId, ...scope.params]) as unknown[]).length) throw new Error("Project portal not found.");
}

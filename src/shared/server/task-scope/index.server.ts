import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";

export type ScopeActor = { userId: number; isSuperuser: boolean };
export type SqlGuard = { sql: string; params: unknown[] };
function field(expression: string) {
  if (!/^(?:[a-z_]+\.[a-z_]+|NULL)$/.test(expression)) throw new Error("Invalid fixed task scope expression.");
  return expression;
}
function superuserEmail() { return getRuntimeEnv().auth.superuserEmail ?? ""; }

/** Current canonical pointer, roster and account must all agree. Never grants private access. */
export function currentTeamLeaderSql(project: string, team: string, user: string) {
  return `EXISTS(SELECT 1 FROM activity_team_leaders scoped_leader
    JOIN activity_team_members scoped_member ON scoped_member.project_id=scoped_leader.project_id AND scoped_member.team_id=scoped_leader.team_id AND scoped_member.user_id=scoped_leader.user_id
    JOIN project_members scoped_project_member ON scoped_project_member.project_id=scoped_leader.project_id AND scoped_project_member.user_id=scoped_leader.user_id
    WHERE scoped_leader.project_id=${field(project)} AND scoped_leader.team_id=${field(team)} AND scoped_leader.user_id=${field(user)}
    AND scoped_member.active=1 AND scoped_project_member.active=1)`;
}

/** Project/team-qualified task management; collaboration keeps its existing member policy. */
export function taskManagementGuard(actor: ScopeActor, project = "tasks.project_id", team = "tasks.activity_team_id"): SqlGuard {
  return {sql:`EXISTS(SELECT 1 FROM projects scope_project JOIN users scope_actor ON scope_actor.id=?
    WHERE scope_project.id=${field(project)} AND (scope_actor.role='admin' OR (?=1 AND LOWER(scope_actor.email)=?)
    OR (scope_actor.role='member' AND (scope_project.project_type='collaboration' OR (scope_project.project_type='volunteering' AND ${currentTeamLeaderSql(project,team,"scope_actor.id")})))))`,
    params:[actor.userId,actor.isSuperuser?1:0,superuserEmail()]};
}

/** Status execution adds the current assignee, but never other collaboration members. */
export function taskExecutionGuard(actor: ScopeActor, project = "tasks.project_id", team = "tasks.activity_team_id", assignee = "tasks.assignee_id"): SqlGuard {
  return {sql:`EXISTS(SELECT 1 FROM projects scope_project JOIN users scope_actor ON scope_actor.id=?
    WHERE scope_project.id=${field(project)} AND (scope_actor.role='admin' OR (?=1 AND LOWER(scope_actor.email)=?)
      OR (scope_actor.role='member' AND (
        (scope_project.project_type='volunteering' AND ${currentTeamLeaderSql(project,team,"scope_actor.id")})
        OR (${field(assignee)}=scope_actor.id AND (scope_project.project_type='collaboration' OR (
          EXISTS(SELECT 1 FROM project_members own_pm WHERE own_pm.project_id=${field(project)} AND own_pm.user_id=scope_actor.id AND own_pm.active=1)
          AND (${field(team)} IS NULL OR EXISTS(SELECT 1 FROM activity_team_members own_tm WHERE own_tm.project_id=${field(project)} AND own_tm.team_id=${field(team)} AND own_tm.user_id=scope_actor.id AND own_tm.active=1))
        )))
      ))))`, params:[actor.userId,actor.isSuperuser?1:0,superuserEmail()]};
}

/** New volunteer assignments require an active project roster and, when selected, team roster. */
export function taskAssignmentGuard(project: string, team: string, assignee: string): SqlGuard {
  return {sql:`(${field(assignee)} IS NULL OR EXISTS(SELECT 1 FROM users assigned JOIN projects assignment_project ON assignment_project.id=${field(project)}
    WHERE assigned.id=${field(assignee)} AND (assigned.role IN ('member','admin') OR LOWER(assigned.email)=?)
      AND (assignment_project.project_type='collaboration' OR (
        EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=${field(project)} AND pm.user_id=assigned.id AND pm.active=1)
        AND (${field(team)} IS NULL OR EXISTS(SELECT 1 FROM activity_team_members tm WHERE tm.project_id=${field(project)} AND tm.team_id=${field(team)} AND tm.user_id=assigned.id AND tm.active=1))
      ))))`,params:[superuserEmail()]};
}

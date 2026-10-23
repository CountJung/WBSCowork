import {assertProjectAccess,projectAccessGuard,assertProjectSuperuser} from "@/src/shared/server/project-scope/index.server";
import { createHash } from "node:crypto";
import { databaseBatch, getDatabasePool, type QueryStatement } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { normalizeWorkspaceCommand, workspaceId, type ActivityKind, type ProjectType, type ProjectWorkspace, type ProjectAccessPreview, type TeamRole, type WorkspaceActor, type WorkspaceCommand, type TaskTeamDirectory } from "../model/workspace";

const adminSql = "EXISTS(SELECT 1 FROM users actor WHERE actor.id=? AND ((?=1 AND LOWER(actor.email)=?) OR (actor.role='admin' AND EXISTS(SELECT 1 FROM project_members manager WHERE manager.project_id=? AND manager.user_id=actor.id AND manager.active=1))))";
const superuserSql="EXISTS(SELECT 1 FROM users actor WHERE actor.id=? AND ?=1 AND LOWER(actor.email)=?)";
const eligibleSql = "(u.role IN ('member','admin') OR LOWER(u.email)=?)";
function adminParams(actor: WorkspaceActor,projectId:number) {
  return [actor.userId, actor.isSuperuser ? 1 : 0, getRuntimeEnv().auth.superuserEmail ?? "",projectId];
}
async function assertWorkspaceAdmin(actor: WorkspaceActor,projectId:number) {
  workspaceId(actor.userId);
  const rows = await getDatabasePool().query(`SELECT 1 AS allowed WHERE ${adminSql}`, adminParams(actor,projectId)) as { allowed: number }[];
  if (!rows.length) throw new Error("프로젝트 명단·활동팀 관리는 관리자만 할 수 있습니다.");
}

/** Roster administration stays admin-only; task management is separately team-scoped. */
export async function getProjectWorkspace(projectId: number, actor: WorkspaceActor): Promise<ProjectWorkspace> {
  workspaceId(projectId);
  await assertWorkspaceAdmin(actor,projectId);
  const db = getDatabasePool();
  // Multiple roster queries must correspond to one committed workspace version.
  for (let attempt = 0; attempt < 3; attempt++) {
    const header = (await db.query(`SELECT project_type,workspace_version FROM projects WHERE id=? AND ${adminSql}`, [projectId, ...adminParams(actor,projectId)]) as { project_type: ProjectType; workspace_version: number }[])[0];
    if (!header) throw new Error("프로젝트를 찾을 수 없거나 권한이 변경되었습니다.");
    const [members, teams, teamMembers] = await Promise.all([
      db.query("SELECT user_id,active FROM project_members WHERE project_id=? ORDER BY user_id", [projectId]) as Promise<{ user_id: number; active: number }[]>,
      db.query("SELECT t.id,t.name,t.activity_kind,l.user_id AS leader_user_id FROM activity_teams t LEFT JOIN activity_team_leaders l ON l.team_id=t.id AND l.project_id=t.project_id WHERE t.project_id=? ORDER BY t.id", [projectId]) as Promise<{ id: number; name: string; activity_kind: ActivityKind;leader_user_id:number|null }[]>,
      db.query("SELECT team_id,user_id,role,active FROM activity_team_members WHERE project_id=? ORDER BY team_id,user_id", [projectId]) as Promise<{ team_id: number; user_id: number; role: TeamRole; active: number }[]>,
    ]);
    const current = (await db.query(`SELECT workspace_version FROM projects WHERE id=? AND ${adminSql}`, [projectId, ...adminParams(actor,projectId)]) as { workspace_version: number }[])[0];
    if (current && Number(current.workspace_version) === Number(header.workspace_version)) {
      return { projectId, projectType: header.project_type, version: Number(header.workspace_version),
        members: members.map(row => ({ userId: Number(row.user_id), active: Number(row.active) === 1 })),
        teams: teams.map(row => ({ id: Number(row.id), name: row.name, activityKind: row.activity_kind,leaderUserId:row.leader_user_id===null?null:Number(row.leader_user_id) })),
        teamMembers: teamMembers.map(row => ({ teamId: Number(row.team_id), userId: Number(row.user_id), role: row.role, active: Number(row.active) === 1 })),
      };
    }
  }
  throw new Error("프로젝트 명단이 변경되었습니다. 새로고침해 주세요.");
}

type Mutation = { guard: string; params: unknown[]; statements: QueryStatement[] };

/** Task metadata is shared with authenticated readers; assignment rosters are scoped. */
export async function getProjectTaskTeams(projectId:number,actor:WorkspaceActor):Promise<TaskTeamDirectory> {
  workspaceId(projectId);workspaceId(actor.userId);
  await assertProjectAccess(projectId,actor);
  const db=getDatabasePool();
  const binding=projectAccessGuard(actor,"t.project_id");
  if(!(await db.query("SELECT id FROM users WHERE id=?",[actor.userId]) as {id:number}[]).length)throw new Error("사용자를 확인할 수 없습니다.");
  const teams=await db.query(`SELECT t.id,t.name,t.activity_kind,l.user_id AS leader_user_id FROM activity_teams t LEFT JOIN activity_team_leaders l ON l.team_id=t.id AND l.project_id=t.project_id WHERE t.project_id=? AND ${binding.sql} ORDER BY t.id`,[projectId,...binding.params]) as {id:number;name:string;activity_kind:ActivityKind;leader_user_id:number|null}[];
  const members=await db.query(`SELECT tm.team_id,tm.user_id FROM activity_team_members tm JOIN project_members pm ON pm.project_id=tm.project_id AND pm.user_id=tm.user_id JOIN users u ON u.id=tm.user_id WHERE tm.project_id=? AND tm.active=1 AND pm.active=1 AND ${eligibleSql} AND (${adminSql} OR EXISTS(SELECT 1 FROM activity_team_leaders l JOIN activity_team_members lm ON lm.team_id=l.team_id AND lm.user_id=l.user_id AND lm.project_id=l.project_id JOIN project_members lp ON lp.project_id=lm.project_id AND lp.user_id=lm.user_id JOIN users actor ON actor.id=lm.user_id WHERE l.team_id=tm.team_id AND l.project_id=tm.project_id AND l.user_id=? AND lm.active=1 AND lp.active=1 AND lm.role='leader' AND (actor.role IN ('member','admin') OR LOWER(actor.email)=?))) ORDER BY tm.team_id,tm.user_id`,[projectId,getRuntimeEnv().auth.superuserEmail??"",...adminParams(actor,projectId),actor.userId,getRuntimeEnv().auth.superuserEmail??""]) as {team_id:number;user_id:number}[];
  const memberIdsByTeam:Record<number,number[]>={};
  for(const row of members)(memberIdsByTeam[Number(row.team_id)]??=[]).push(Number(row.user_id));
  const projectMembers=await db.query(`SELECT pm.user_id FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=? AND pm.active=1 AND ${eligibleSql} AND ${adminSql} ORDER BY pm.user_id`,[projectId,getRuntimeEnv().auth.superuserEmail??"",...adminParams(actor,projectId)]) as {user_id:number}[];
  return {teams:teams.map(t=>({id:Number(t.id),name:t.name,activityKind:t.activity_kind,leaderUserId:t.leader_user_id===null?null:Number(t.leader_user_id)})),memberIdsByTeam,projectMemberIds:projectMembers.map(r=>Number(r.user_id))};
}

function commandMutation(projectId: number, command: WorkspaceCommand, applied: string, appliedParams: unknown[]): Mutation {
  const select = (sql: string, params: unknown[] = []) => ({ sql: `${sql} AND ${applied}`, params: [...params, ...appliedParams] });
  switch (command.kind) {
    case "access_mode": {
      const eligible=(field:string)=>`EXISTS(SELECT 1 FROM users bound_user WHERE bound_user.id=${field} AND (LOWER(bound_user.email)=? OR EXISTS(SELECT 1 FROM project_members bound_member WHERE bound_member.project_id=projects.id AND bound_member.user_id=bound_user.id AND bound_member.active=1)))`;
      return {guard:command.accessMode==='members_only'?`NOT EXISTS(SELECT 1 FROM tasks pending WHERE pending.project_id=projects.id AND pending.status<>'done' AND pending.assignee_id IS NOT NULL AND NOT ${eligible('pending.assignee_id')}) AND NOT EXISTS(SELECT 1 FROM tasks reviewing WHERE reviewing.project_id=projects.id AND reviewing.status='review_pending' AND reviewing.reviewer_id IS NOT NULL AND NOT ${eligible('reviewing.reviewer_id')}) AND NOT EXISTS(SELECT 1 FROM activity_team_leaders leader WHERE leader.project_id=projects.id AND leader.user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM project_members bound_leader WHERE bound_leader.project_id=projects.id AND bound_leader.user_id=leader.user_id AND bound_leader.active=1))`:'1=1',params:command.accessMode==='members_only'?[getRuntimeEnv().auth.superuserEmail??'',getRuntimeEnv().auth.superuserEmail??'']:[],statements:[select('UPDATE projects SET access_mode=? WHERE id=?',[command.accessMode,projectId])]};
    }
    case "project_type":
      return { guard: "NOT EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=projects.id) AND NOT EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=projects.id) AND NOT EXISTS(SELECT 1 FROM activity_teams t WHERE t.project_id=projects.id)", params: [],
        statements: [select("UPDATE projects SET project_type=? WHERE id=?", [command.projectType, projectId])] };
    case "project_member": {
      const upsert = isHostedRuntime() ? " ON CONFLICT(project_id,user_id) DO UPDATE SET active=excluded.active" : " ON DUPLICATE KEY UPDATE active=VALUES(active)";
      // Departure preserves completed history; unfinished assignments, pending
      // reviewers and canonical leadership must be explicitly handed over first.
      return { guard: command.active ? "EXISTS(SELECT 1 FROM users u WHERE u.id=?)" : "EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=projects.id AND m.user_id=?) AND NOT EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=projects.id AND t.assignee_id=? AND t.status<>'done') AND NOT EXISTS(SELECT 1 FROM tasks review_task WHERE review_task.project_id=projects.id AND review_task.reviewer_id=? AND review_task.status='review_pending') AND NOT EXISTS(SELECT 1 FROM activity_team_leaders current_leader WHERE current_leader.project_id=projects.id AND current_leader.user_id=?)",
        params: command.active ? [command.userId] : [command.userId, command.userId, command.userId, command.userId],
        statements: [
          { ...select("INSERT INTO project_members(project_id,user_id,active) SELECT ?,?,? WHERE 1=1", [projectId, command.userId, command.active ? 1 : 0]),
            sql: select("INSERT INTO project_members(project_id,user_id,active) SELECT ?,?,? WHERE 1=1").sql + upsert },
          ...(!command.active ? [select("UPDATE activity_team_members SET active=0 WHERE project_id=? AND user_id=?", [projectId, command.userId])] : []),
          ...(!command.active ? [select("UPDATE activity_team_leaders SET user_id=NULL WHERE project_id=? AND user_id=?", [projectId, command.userId])] : []),
        ] };
    }
    case "create_team":
      return { guard: "NOT EXISTS(SELECT 1 FROM activity_teams t WHERE t.project_id=projects.id AND t.name=?)", params: [command.name],
        statements: [select("INSERT INTO activity_teams(project_id,activity_kind,name) SELECT ?,?,? WHERE 1=1", [projectId, command.activityKind, command.name])] };
    case "team_member": {
      const upsert = isHostedRuntime() ? " ON CONFLICT(team_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active" : " ON DUPLICATE KEY UPDATE role=VALUES(role),active=VALUES(active)";
      const leaderGuard = command.active && command.role === "leader" ? ` AND EXISTS(SELECT 1 FROM users u WHERE u.id=? AND ${eligibleSql})` : "";
      const leaveGuard = !command.active ? " AND NOT EXISTS(SELECT 1 FROM tasks t WHERE t.project_id=projects.id AND t.activity_team_id=? AND t.assignee_id=? AND t.status<>'done')" : "";
      const statement = select("INSERT INTO activity_team_members(project_id,team_id,user_id,role,active) SELECT ?,?,?,?,? WHERE 1=1", [projectId, command.teamId, command.userId, command.role, command.active ? 1 : 0]);
      return { guard: `EXISTS(SELECT 1 FROM activity_teams t WHERE t.id=? AND t.project_id=projects.id) AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=projects.id AND m.user_id=? AND m.active=1)${leaderGuard}${leaveGuard}`,
        params: [command.teamId, command.userId, ...(leaderGuard ? [command.userId, getRuntimeEnv().auth.superuserEmail ?? ""] : []), ...(leaveGuard ? [command.teamId, command.userId] : [])],
        statements: [
          ...(command.active && command.role === "leader" ? [select("UPDATE activity_team_members SET role='member' WHERE project_id=? AND team_id=? AND role='leader'",[projectId,command.teamId])] : []),
          { ...statement, sql: statement.sql + upsert },
          ...(command.active && command.role === "leader" ? [{...select("INSERT INTO activity_team_leaders(team_id,project_id,user_id) SELECT ?,?,? WHERE 1=1",[command.teamId,projectId,command.userId]),sql:select("INSERT INTO activity_team_leaders(team_id,project_id,user_id) SELECT ?,?,? WHERE 1=1").sql+(isHostedRuntime()?" ON CONFLICT(team_id) DO UPDATE SET user_id=excluded.user_id":" ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)")}] : [select("UPDATE activity_team_leaders SET user_id=NULL WHERE project_id=? AND team_id=? AND user_id=?",[projectId,command.teamId,command.userId])]),
        ] };
    }
    case "task_team": {
      const teamGuard = command.teamId === null ? "" : ` AND EXISTS(SELECT 1 FROM activity_teams team WHERE team.id=? AND team.project_id=projects.id)
        AND EXISTS(SELECT 1 FROM tasks target WHERE target.id=? AND (target.assignee_id IS NULL OR EXISTS(SELECT 1 FROM activity_team_members tm JOIN project_members pm ON pm.project_id=tm.project_id AND pm.user_id=tm.user_id JOIN users u ON u.id=tm.user_id WHERE tm.project_id=projects.id AND tm.team_id=? AND tm.user_id=target.assignee_id AND tm.active=1 AND pm.active=1 AND ${eligibleSql})))`;
      return { guard: `EXISTS(SELECT 1 FROM tasks t WHERE t.id=? AND t.project_id=projects.id AND t.version=? AND t.status='planned')${teamGuard}`,
        params: [command.taskId, command.taskVersion, ...(command.teamId === null ? [] : [command.teamId, command.taskId, command.teamId, getRuntimeEnv().auth.superuserEmail ?? ""])],
        statements: [select("UPDATE tasks SET activity_team_id=?,version=version+1 WHERE id=? AND project_id=? AND version=?", [command.teamId, command.taskId, projectId, command.taskVersion])] };
    }
  }
}

export async function changeProjectWorkspace(input: { projectId: number; version: number; actor: WorkspaceActor; token: string; command: WorkspaceCommand }) {
  workspaceId(input.projectId);
  if (!Number.isSafeInteger(input.version) || input.version < 0) throw new Error("프로젝트 명단 버전이 올바르지 않습니다.");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.token)) throw new Error("요청 식별자가 올바르지 않습니다.");
  await assertWorkspaceAdmin(input.actor,input.projectId);
  const token = input.token.toLowerCase(), command = normalizeWorkspaceCommand(input.command);
  if(command.kind==='project_member'||command.kind==='access_mode')await assertProjectSuperuser(input.actor);
  const fingerprint = createHash("sha256").update(JSON.stringify({ command, version: input.version, actorId: input.actor.userId })).digest("hex");
  const db = getDatabasePool();
  const find = async () => (await db.query("SELECT actor_id,request_fingerprint,workspace_version FROM project_workspace_events WHERE project_id=? AND operation_token=?", [input.projectId, token]) as { actor_id: number; request_fingerprint: string; workspace_version: number }[])[0];
  const previous = await find();
  if (previous) {
    if (Number(previous.actor_id) !== input.actor.userId || previous.request_fingerprint !== fingerprint) throw new Error("같은 요청을 다른 내용에 사용할 수 없습니다.");
    return { version: Number(previous.workspace_version), replayed: true };
  }
  if(command.kind==='access_mode'){
    const preview=await previewProjectAccess(input.projectId,input.actor);
    if(preview.version!==input.version||preview.impactHash!==command.impactHash)throw new Error('영향 미리보기가 변경되었습니다. 다시 확인해 주세요.');
    if(command.accessMode==='members_only'&&!preview.canRestrict)throw new Error('진행 담당자·검토자 재배정 또는 팀장 해임 후 다시 확인해 주세요.');
  }
  const authority=(command.kind==='project_member'||command.kind==='access_mode')?{sql:superuserSql,params:[input.actor.userId,input.actor.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??'']}:{sql:adminSql,params:adminParams(input.actor,input.projectId)};
  const applied = "EXISTS(SELECT 1 FROM projects applied WHERE applied.id=? AND applied.workspace_version=? AND applied.workspace_token=?) AND NOT EXISTS(SELECT 1 FROM project_workspace_events e WHERE e.project_id=? AND e.operation_token=?)";
  const appliedParams = [input.projectId, input.version + 1, token, input.projectId, token];
  const mutation = commandMutation(input.projectId, command, applied, appliedParams);
  await databaseBatch([
    { sql: `UPDATE projects SET workspace_version=workspace_version+1,workspace_token=? WHERE id=? AND workspace_version=? AND ${authority.sql} AND NOT EXISTS(SELECT 1 FROM project_workspace_events e WHERE e.project_id=? AND e.operation_token=?)${["project_type","project_member","access_mode"].includes(command.kind) ? "" : " AND project_type='volunteering'"} AND ${mutation.guard}`,
      params: [token, input.projectId, input.version, ...authority.params, input.projectId, token, ...mutation.params] },
    ...mutation.statements,
    { sql: `INSERT INTO project_workspace_events(project_id,actor_id,operation_token,request_fingerprint,kind,detail,workspace_version) SELECT ?,?,?,?,?,?,? WHERE ${applied}`,
      params: [input.projectId, input.actor.userId, token, fingerprint, command.kind, JSON.stringify(command), input.version + 1, ...appliedParams] },
  ]);
  const saved = await find();
  if (!saved || Number(saved.actor_id) !== input.actor.userId || saved.request_fingerprint !== fingerprint) throw new Error("명단·업무·권한이 변경되었거나 같은 프로젝트의 유효한 참여자가 아닙니다. 새로고침해 주세요.");
  return { version: Number(saved.workspace_version), replayed: false };
}


/** A read-only administrator preview. Never infers or grants membership. */
export async function previewProjectAccess(projectId:number,actor:WorkspaceActor):Promise<ProjectAccessPreview>{
  workspaceId(projectId);await assertProjectSuperuser(actor);
  const db=getDatabasePool();
  for(let attempt=0;attempt<3;attempt++){
    const header=(await db.query(`SELECT access_mode,workspace_version FROM projects WHERE id=? AND ${adminSql}`,[projectId,...adminParams(actor,projectId)]) as {access_mode:ProjectAccessPreview['accessMode'];workspace_version:number}[])[0];
    if(!header)throw new Error("프로젝트를 찾을 수 없거나 권한이 변경되었습니다.");
    const [members,users,tasks,leaders]=await Promise.all([
      db.query('SELECT user_id,active FROM project_members WHERE project_id=? ORDER BY user_id',[projectId]) as Promise<{user_id:number;active:number}[]>,
      db.query('SELECT id,role,email FROM users ORDER BY id') as Promise<{id:number;role:string;email:string}[]>,
      db.query('SELECT id,version,status,assignee_id,reviewer_id FROM tasks WHERE project_id=? ORDER BY id',[projectId]) as Promise<{id:number;version:number;status:string;assignee_id:number|null;reviewer_id:number|null}[]>,
      db.query('SELECT team_id,user_id FROM activity_team_leaders WHERE project_id=? AND user_id IS NOT NULL ORDER BY team_id',[projectId]) as Promise<{team_id:number;user_id:number}[]>,
    ]);
    const current=(await db.query(`SELECT workspace_version FROM projects WHERE id=? AND ${adminSql}`,[projectId,...adminParams(actor,projectId)]) as {workspace_version:number}[])[0];
    if(!current||Number(current.workspace_version)!==Number(header.workspace_version))continue;
    const active=new Set(members.filter(row=>Number(row.active)===1).map(row=>Number(row.user_id)));
    const allowed=new Set(users.filter(user=>user.email.toLowerCase()===(getRuntimeEnv().auth.superuserEmail??'')||active.has(Number(user.id))).map(user=>Number(user.id)));
    const open=tasks.filter(task=>task.status!=='done'&&task.assignee_id!==null&&!allowed.has(Number(task.assignee_id))).length;
    const reviewing=tasks.filter(task=>task.status==='review_pending'&&task.reviewer_id!==null&&!allowed.has(Number(task.reviewer_id))).length;
    const inactiveLeaders=leaders.filter(leader=>!active.has(Number(leader.user_id))).length;
    const warnings:string[]=[];
    if(!active.size)warnings.push('활성 소속이 없어 전환 후 슈퍼관리자만 접근합니다. 자동으로 회원을 배정하지 않습니다.');
    if(users.length>allowed.size)warnings.push(`전환 후 현재 사용자 ${users.length-allowed.size}명이 이 프로젝트의 공개 자료와 본인 과거 기록에도 접근할 수 없습니다. 기록은 보존합니다.`);
    if(open||reviewing||inactiveLeaders)warnings.push('접근을 잃는 진행 담당자·검토자 또는 활성 소속이 없는 팀장을 먼저 재배정·해임해 주세요.');
    const impactHash=createHash('sha256').update(JSON.stringify({projectId,mode:header.access_mode,version:Number(header.workspace_version),members:members.map(m=>[Number(m.user_id),Number(m.active)]),users:users.map(u=>[Number(u.id),u.role,u.email.toLowerCase()]),tasks:tasks.map(t=>[Number(t.id),Number(t.version),t.status,t.assignee_id===null?null:Number(t.assignee_id),t.reviewer_id===null?null:Number(t.reviewer_id)]),leaders:leaders.map(l=>[Number(l.team_id),Number(l.user_id)])})).digest('hex');
    return {projectId,accessMode:header.access_mode,version:Number(header.workspace_version),impactHash,activeMemberCount:active.size,visibleUserCount:allowed.size,blockedUserCount:users.length-allowed.size,unboundOpenTaskCount:open,unboundReviewerCount:reviewing,leaderCount:leaders.length,canRestrict:!open&&!reviewing&&!inactiveLeaders,warnings};
  }
  throw new Error('프로젝트 명단이 변경되었습니다. 화면을 새로고침해 주세요.');
}

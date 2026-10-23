import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";

/** Server-resolved identity only. Never populate this from request parameters. */
export type ProjectViewer = { userId?: number | null; email?: string | null; isSuperuser?: boolean };
export type ProjectAccessMode = "legacy_authenticated" | "members_only";
export type ProjectSqlGuard = { sql: string; params: unknown[] };
export function projectVisibilityViewer(filter: {viewerUserId?:number|null;viewerEmail?:string|null;canSeeAll:boolean}):ProjectViewer {
  return {userId:filter.viewerUserId,email:filter.viewerEmail,isSuperuser:filter.canSeeAll};
}
function expression(value:string){
  if(!/^(?:[a-z_]+\.)?[a-z_]+$/.test(value))throw new Error("Invalid fixed project scope expression.");
  return value;
}
/** SQL intersection with resource visibility; legacy access is deliberately unchanged. */
export function projectAccessGuard(viewer:ProjectViewer,project="tasks.project_id"):ProjectSqlGuard {
  const id=typeof viewer.userId==='number'&&Number.isSafeInteger(viewer.userId)&&viewer.userId>0?viewer.userId:null;
  const email=typeof viewer.email==='string'?viewer.email.trim().toLowerCase():null;
  return {sql:`EXISTS(SELECT 1 FROM projects access_project WHERE access_project.id=${expression(project)} AND (
    access_project.access_mode='legacy_authenticated' OR EXISTS(SELECT 1 FROM users access_viewer
      WHERE (access_viewer.id=? OR (? IS NOT NULL AND LOWER(access_viewer.email)=?))
      AND ((?=1 AND LOWER(access_viewer.email)=?)
        OR EXISTS(SELECT 1 FROM project_members access_member WHERE access_member.project_id=access_project.id AND access_member.user_id=access_viewer.id AND access_member.active=1))
    )))`,params:[id,email,email,viewer.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??""]};
}
export async function assertProjectAccess(projectId:number,viewer:ProjectViewer){
  if(!Number.isSafeInteger(projectId)||projectId<1)throw new Error("프로젝트를 찾을 수 없습니다.");
  const guard=projectAccessGuard(viewer,"p.id");
  const rows=await getDatabasePool().query(`SELECT p.id FROM projects p WHERE p.id=? AND ${guard.sql}`,[projectId,...guard.params]) as {id:number}[];
  if(!rows.length)throw new Error("프로젝트를 찾을 수 없거나 접근 권한이 없습니다.");
}
export function projectTaskAccessGuard(viewer:ProjectViewer,task="submissions.task_id"):ProjectSqlGuard {
  const guard=projectAccessGuard(viewer,"access_task.project_id");
  return {sql:`EXISTS(SELECT 1 FROM tasks access_task WHERE access_task.id=${expression(task)} AND ${guard.sql})`,params:guard.params};
}
/** Current administrator privileges are scoped even on a legacy-readable project. */
export function projectManagementGuard(viewer:ProjectViewer,project="tasks.project_id"):ProjectSqlGuard {
  const id=typeof viewer.userId==='number'&&Number.isSafeInteger(viewer.userId)&&viewer.userId>0?viewer.userId:null;
  const email=typeof viewer.email==='string'?viewer.email.trim().toLowerCase():null;
  return {sql:`EXISTS(SELECT 1 FROM projects manage_project JOIN users manage_viewer ON (manage_viewer.id=? OR (? IS NOT NULL AND LOWER(manage_viewer.email)=?))
    WHERE manage_project.id=${expression(project)} AND ((?=1 AND LOWER(manage_viewer.email)=?) OR (manage_viewer.role='admin' AND EXISTS(SELECT 1 FROM project_members manage_member WHERE manage_member.project_id=manage_project.id AND manage_member.user_id=manage_viewer.id AND manage_member.active=1))))`,params:[id,email,email,viewer.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??""]};
}
export async function assertProjectManagement(projectId:number,viewer:ProjectViewer){
  const guard=projectManagementGuard(viewer,"p.id");
  if(!(await getDatabasePool().query(`SELECT p.id FROM projects p WHERE p.id=? AND ${guard.sql}`,[projectId,...guard.params]) as {id:number}[]).length)throw new Error('지정된 프로젝트 관리자 또는 슈퍼관리자 권한이 필요합니다.');
}
export async function assertProjectSuperuser(viewer:ProjectViewer){
  const email=typeof viewer.email==='string'?viewer.email.trim().toLowerCase():null;
  const rows=await getDatabasePool().query('SELECT id FROM users WHERE (id=? OR (? IS NOT NULL AND LOWER(email)=?)) AND ?=1 AND LOWER(email)=?',[viewer.userId??null,email,email,viewer.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??'']) as {id:number}[];
  if(!rows.length)throw new Error('프로젝트 소속과 접근 정책은 슈퍼관리자만 관리할 수 있습니다.');
}
/** The project gate and resource ownership/visibility remain separate intersections. */
export function projectPrivateReadGuard(viewer:ProjectViewer,task="submissions.task_id"):ProjectSqlGuard {
  const guard=projectManagementGuard(viewer,"private_task.project_id");
  return {sql:`EXISTS(SELECT 1 FROM tasks private_task WHERE private_task.id=${expression(task)} AND ${guard.sql})`,params:guard.params};
}
/** Embed where a current users alias is already joined. No extra identity parameters. */
export function projectAccessForCurrentUser(project:string,user:string,superuserSql:string):string {
  return `EXISTS(SELECT 1 FROM projects member_project WHERE member_project.id=${expression(project)} AND (member_project.access_mode='legacy_authenticated' OR (${superuserSql}) OR EXISTS(SELECT 1 FROM project_members member_binding WHERE member_binding.project_id=member_project.id AND member_binding.user_id=${expression(user)} AND member_binding.active=1)))`;
}

export function projectManagementForCurrentUser(project:string,user:string,superuserSql:string):string {
  return `((${superuserSql}) OR EXISTS(SELECT 1 FROM users manager_account JOIN project_members manager_binding ON manager_binding.user_id=manager_account.id WHERE manager_account.id=${expression(user)} AND manager_account.role='admin' AND manager_binding.project_id=${expression(project)} AND manager_binding.active=1))`;
}

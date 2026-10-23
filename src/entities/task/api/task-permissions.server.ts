import {projectAccessGuard} from "@/src/shared/server/project-scope/index.server";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { taskExecutionGuard, taskManagementGuard, currentTeamLeaderSql } from "@/src/shared/server/task-scope/index.server";
import type { TaskActor } from "../model/workflow";

export type TaskScope = { projectType: "collaboration" | "volunteering"; canManageAll: boolean; canManageUnassigned: boolean; leaderTeamIds: number[] };
export async function getTaskScope(projectId: number, actor: TaskActor): Promise<TaskScope> {
  const manage = taskManagementGuard(actor,"p.id","NULL");
  const binding=projectAccessGuard(actor,"p.id");
  const rows = await getDatabasePool().query(`SELECT p.project_type,CASE WHEN ${manage.sql} THEN 1 ELSE 0 END AS manage_all FROM projects p WHERE p.id=? AND ${binding.sql}`, [...manage.params,projectId,...binding.params]) as {project_type:TaskScope["projectType"];manage_all:number}[];
  if (!rows[0]) throw new Error("프로젝트를 찾을 수 없습니다.");
  const teams = await getDatabasePool().query(`SELECT team.id FROM activity_teams team JOIN users scope_actor ON scope_actor.id=? AND scope_actor.role IN ('member','admin') WHERE team.project_id=? AND ${currentTeamLeaderSql("team.project_id","team.id","scope_actor.id")}`, [actor.userId,projectId]) as {id:number}[];
  return {projectType:rows[0].project_type,canManageAll:!!Number(rows[0].manage_all),canManageUnassigned:!!Number(rows[0].manage_all),leaderTeamIds:teams.map(row=>Number(row.id))};
}
export async function assertTaskScope(taskId:number,actor:TaskActor,execution=false) {
  const scope = execution ? taskExecutionGuard(actor) : taskManagementGuard(actor);
  const rows = await getDatabasePool().query(`SELECT tasks.id FROM tasks WHERE tasks.id=? AND ${scope.sql}`,[taskId,...scope.params]) as {id:number}[];
  if (!rows.length) throw new Error("현재 담당자·해당 팀장 또는 관리자 권한이 필요합니다.");
}

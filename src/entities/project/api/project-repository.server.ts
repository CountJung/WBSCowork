import {getRuntimeEnv} from "@/src/shared/server/runtime-env/index.server";
import { projectAccessGuard,projectManagementGuard, type ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { normalizeWorkGoal } from "@/src/shared/lib/work-goals";
import { validateDateRange } from "@/src/shared/lib/date";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { mapProjectRow, type Project, type ProjectRow } from "../model/project";
import {projectTypes,type ProjectType,type WorkspaceActor} from "../model/workspace";

export type CreateProjectInput = {
  name: string;
  actor?:WorkspaceActor;
  projectType?: ProjectType;
  goal?: string;
  successCriteria?: string;
  startDate: Date | string;
  endDate: Date | string;
};


export async function getProjectById(id: number): Promise<Project | null> {
  const rows = (await getDatabasePool().query(
    "SELECT id, name, project_type, access_mode, goal, success_criteria, start_date, end_date, created_at FROM projects WHERE id = ? LIMIT 1",
    [id],
  )) as ProjectRow[];

  const row = rows[0];

  return row ? mapProjectRow(row) : null;
}

export async function listProjects(limit = 10): Promise<Project[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, name, project_type, access_mode, goal, success_criteria, start_date, end_date, created_at FROM projects ORDER BY created_at DESC LIMIT ?",
    [limit],
  )) as ProjectRow[];

  return rows.map(mapProjectRow);
}

export async function listAllProjects(): Promise<Project[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, name, project_type, access_mode, goal, success_criteria, start_date, end_date, created_at FROM projects ORDER BY created_at DESC, id DESC",
  )) as ProjectRow[];

  return rows.map(mapProjectRow);
}

export async function getProjectCount(): Promise<number> {
  const rows = (await getDatabasePool().query("SELECT COUNT(*) AS count FROM projects")) as Array<{
    count: number;
  }>;

  return Number(rows[0]?.count ?? 0);
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const projectType = input.projectType ?? "collaboration";
  if(!projectTypes.includes(projectType))throw new Error("프로젝트 유형이 올바르지 않습니다.");
  const { startDate, endDate } = validateDateRange(input.startDate, input.endDate);
  const createGuard=input.actor?{sql:"EXISTS(SELECT 1 FROM users creator WHERE creator.id=? AND ?=1 AND LOWER(creator.email)=?)",params:[input.actor.userId,input.actor.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??'']}:{sql:"1=1",params:[]};
  const result = (await getDatabasePool().query(
    `INSERT INTO projects (name, project_type, goal, success_criteria, start_date, end_date) SELECT ?, ?, ?, ?, ?, ? WHERE ${createGuard.sql}`,
    [input.name.trim(), projectType, normalizeWorkGoal(input.goal, "프로젝트 목표"), normalizeWorkGoal(input.successCriteria, "성공 기준"), startDate, endDate,...createGuard.params],
  )) as {
    insertId: number;affectedRows:number;
  };
  if(Number(result.affectedRows)!==1)throw new Error("프로젝트 생성 권한이 변경되었습니다.");

  const project = await getProjectById(Number(result.insertId));

  if (!project) {
    throw new Error("Project insert completed but the project row could not be loaded.");
  }

  return project;
}

export async function deleteProject(projectId: number,actor?:WorkspaceActor): Promise<Project> {
  const existingProject = await getProjectById(projectId);

  if (!existingProject) {
    throw new Error("삭제할 프로젝트를 찾을 수 없습니다.");
  }

  const guard=actor?projectManagementGuard(actor,"projects.id"):{sql:"access_mode='legacy_authenticated'",params:[]};
  const result=await getDatabasePool().query(`DELETE FROM projects WHERE id=? AND ${guard.sql} RETURNING id`,[projectId,...guard.params]) as {id:number}[];
  if(result.length!==1||Number(result[0].id)!==projectId)throw new Error("프로젝트가 없거나 관리 권한이 변경되었습니다.");

  return existingProject;
}

export type UpdateProjectInput = {
  id: number;
  actor?:WorkspaceActor;
  name: string;
  goal?: string;
  successCriteria?: string;
  startDate: Date | string;
  endDate: Date | string;
};

export async function updateProject(input: UpdateProjectInput): Promise<Project> {
  const { startDate, endDate } = validateDateRange(input.startDate, input.endDate);
  const existingProject = await getProjectById(input.id);

  if (!existingProject) {
    throw new Error("수정할 프로젝트를 찾을 수 없습니다.");
  }

  const guard=input.actor?projectManagementGuard(input.actor,"projects.id"):{sql:"access_mode='legacy_authenticated'",params:[]};
  const result=await getDatabasePool().query(
    `UPDATE projects SET name = ?, goal = ?, success_criteria = ?, start_date = ?, end_date = ? WHERE id = ? AND ${guard.sql}`,
    [input.name.trim(), normalizeWorkGoal(input.goal ?? existingProject.goal, "프로젝트 목표"), normalizeWorkGoal(input.successCriteria ?? existingProject.successCriteria, "성공 기준"), startDate, endDate, input.id,...guard.params],
  ) as {affectedRows:number};
  if(Number(result.affectedRows)!==1)throw new Error("프로젝트가 없거나 관리 권한이 변경되었습니다.");

  const updated = await getProjectById(input.id);

  if (!updated) {
    throw new Error("프로젝트 수정 후 데이터를 불러오지 못했습니다.");
  }

  return updated;
}

/** Viewer APIs apply the same scope before limits, counts and selected-project fallback. */
export async function listAllProjectsForViewer(viewer:ProjectViewer):Promise<Project[]> {
  const guard=projectAccessGuard(viewer,"projects.id");
  const rows=await getDatabasePool().query(`SELECT id,name,project_type,access_mode,goal,success_criteria,start_date,end_date,created_at FROM projects WHERE ${guard.sql} ORDER BY created_at DESC,id DESC`,guard.params) as ProjectRow[];
  return rows.map(mapProjectRow);
}
export async function listProjectsForViewer(viewer:ProjectViewer,limit=10):Promise<Project[]> {
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error("프로젝트 조회 범위가 올바르지 않습니다.");
  const guard=projectAccessGuard(viewer,"projects.id");
  const rows=await getDatabasePool().query(`SELECT id,name,project_type,access_mode,goal,success_criteria,start_date,end_date,created_at FROM projects WHERE ${guard.sql} ORDER BY created_at DESC,id DESC LIMIT ?`,[...guard.params,limit]) as ProjectRow[];
  return rows.map(mapProjectRow);
}
export async function getProjectByIdForViewer(id:number,viewer:ProjectViewer):Promise<Project|null> {
  const guard=projectAccessGuard(viewer,"projects.id");
  const rows=await getDatabasePool().query(`SELECT id,name,project_type,access_mode,goal,success_criteria,start_date,end_date,created_at FROM projects WHERE id=? AND ${guard.sql} LIMIT 1`,[id,...guard.params]) as ProjectRow[];
  return rows[0]?mapProjectRow(rows[0]):null;
}
export async function getProjectCountForViewer(viewer:ProjectViewer):Promise<number> {
  const guard=projectAccessGuard(viewer,"projects.id");
  return Number((await getDatabasePool().query(`SELECT COUNT(*) AS count FROM projects WHERE ${guard.sql}`,guard.params) as {count:number}[])[0]?.count??0);
}

export async function listManagedProjectsForViewer(viewer:ProjectViewer):Promise<Project[]> {
  const guard=projectManagementGuard(viewer,"projects.id");
  const rows=await getDatabasePool().query(`SELECT id,name,project_type,access_mode,goal,success_criteria,start_date,end_date,created_at FROM projects WHERE ${guard.sql} ORDER BY created_at DESC,id DESC`,guard.params) as ProjectRow[];
  return rows.map(mapProjectRow);
}

export async function getManagedProjectCountForViewer(viewer:ProjectViewer):Promise<number> {
  const guard=projectManagementGuard(viewer,"projects.id");
  return Number((await getDatabasePool().query(`SELECT COUNT(*) AS count FROM projects WHERE ${guard.sql}`,guard.params) as {count:number}[])[0]?.count??0);
}

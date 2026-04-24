import { getDatabasePool } from "@/lib/db";
import { mapProjectRow, type Project, type ProjectRow } from "@/models/project";

export type CreateProjectInput = {
  name: string;
  startDate: Date | string;
  endDate: Date | string;
};

function toSqlDate(value: Date | string) {
  if (typeof value === "string") {
    return value;
  }

  return value.toISOString().slice(0, 10);
}

export async function getProjectById(id: number): Promise<Project | null> {
  const rows = (await getDatabasePool().query(
    "SELECT id, name, start_date, end_date, created_at FROM projects WHERE id = ? LIMIT 1",
    [id],
  )) as ProjectRow[];

  const row = rows[0];

  return row ? mapProjectRow(row) : null;
}

export async function listProjects(limit = 10): Promise<Project[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, name, start_date, end_date, created_at FROM projects ORDER BY created_at DESC LIMIT ?",
    [limit],
  )) as ProjectRow[];

  return rows.map(mapProjectRow);
}

export async function listAllProjects(): Promise<Project[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, name, start_date, end_date, created_at FROM projects ORDER BY created_at DESC, id DESC",
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
  const result = (await getDatabasePool().query(
    "INSERT INTO projects (name, start_date, end_date) VALUES (?, ?, ?)",
    [input.name.trim(), toSqlDate(input.startDate), toSqlDate(input.endDate)],
  )) as {
    insertId: number;
  };

  const project = await getProjectById(Number(result.insertId));

  if (!project) {
    throw new Error("Project insert completed but the project row could not be loaded.");
  }

  return project;
}

export async function deleteProject(projectId: number): Promise<Project> {
  const existingProject = await getProjectById(projectId);

  if (!existingProject) {
    throw new Error("삭제할 프로젝트를 찾을 수 없습니다.");
  }

  await getDatabasePool().query("DELETE FROM projects WHERE id = ?", [projectId]);

  return existingProject;
}

export type UpdateProjectInput = {
  id: number;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
};

export async function updateProject(input: UpdateProjectInput): Promise<Project> {
  const existingProject = await getProjectById(input.id);

  if (!existingProject) {
    throw new Error("수정할 프로젝트를 찾을 수 없습니다.");
  }

  await getDatabasePool().query(
    "UPDATE projects SET name = ?, start_date = ?, end_date = ? WHERE id = ?",
    [input.name.trim(), toSqlDate(input.startDate), toSqlDate(input.endDate), input.id],
  );

  const updated = await getProjectById(input.id);

  if (!updated) {
    throw new Error("프로젝트 수정 후 데이터를 불러오지 못했습니다.");
  }

  return updated;
}
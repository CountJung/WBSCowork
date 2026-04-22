"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { logError, logInfo, serializeError } from "@/lib/logger";
import { createProject } from "@/lib/repositories/project-repository";
import { createTask, deleteTask, updateTask } from "@/lib/repositories/task-repository";
import { canWriteTaskContent } from "@/models/user";

function buildTasksPath(status: "success" | "error", message: string, projectId?: number) {
  const searchParams = new URLSearchParams({
    status,
    message,
  });

  if (projectId) {
    searchParams.set("projectId", String(projectId));
  }

  return `/tasks?${searchParams.toString()}`;
}

function getSingleValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function parseRequiredPositiveInteger(value: FormDataEntryValue | null, label: string) {
  const normalizedValue = Number(getSingleValue(value));

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${label} 값이 올바르지 않습니다.`);
  }

  return normalizedValue;
}

function parseOptionalPositiveInteger(value: FormDataEntryValue | null, label: string) {
  const rawValue = getSingleValue(value).trim();

  if (!rawValue) {
    return null;
  }

  const normalizedValue = Number(rawValue);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${label} 값이 올바르지 않습니다.`);
  }

  return normalizedValue;
}

function parseRequiredDate(value: FormDataEntryValue | null, label: string) {
  const normalizedValue = getSingleValue(value).trim();

  if (!normalizedValue) {
    throw new Error(`${label}를 입력해야 합니다.`);
  }

  return normalizedValue;
}

function assertValidDateRange(startDate: string, endDate: string) {
  if (startDate > endDate) {
    throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
  }
}

async function requireWritableSession(projectId?: number) {
  const session = await getAuthSession();

  if (!session?.user) {
    const callbackPath = projectId ? `/tasks?projectId=${projectId}` : "/tasks";
    redirect(getSignInPath(callbackPath));
  }

  if (!canWriteTaskContent(session.user.role, session.user.isSuperuser)) {
    redirect(buildTasksPath("error", "게스트 계정은 작업과 프로젝트를 수정할 수 없습니다.", projectId));
  }

  return session;
}

export async function createProjectAction(formData: FormData) {
  const session = await requireWritableSession();

  let redirectPath: string;

  try {
    const name = getSingleValue(formData.get("name")).trim();
    const startDate = parseRequiredDate(formData.get("startDate"), "프로젝트 시작일");
    const endDate = parseRequiredDate(formData.get("endDate"), "프로젝트 종료일");

    if (!name) {
      throw new Error("프로젝트 이름은 비워 둘 수 없습니다.");
    }

    assertValidDateRange(startDate, endDate);

    const project = await createProject({
      name,
      startDate,
      endDate,
    });

    revalidatePath("/admin");
    revalidatePath("/tasks");

    await logInfo("tasks", "Project created", {
      actorEmail: session.user.email ?? null,
      projectId: project.id,
      projectName: project.name,
    });

    redirectPath = buildTasksPath("success", `${project.name} 프로젝트를 생성했습니다.`, project.id);
  } catch (error) {
    await logError("tasks", "Project creation failed", {
      actorEmail: session.user.email ?? null,
      error: serializeError(error),
    });

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "프로젝트 생성 중 알 수 없는 오류가 발생했습니다.",
    );
  }

  redirect(redirectPath);
}

export async function createTaskAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const startDate = parseRequiredDate(formData.get("startDate"), "작업 시작일");
    const endDate = parseRequiredDate(formData.get("endDate"), "작업 종료일");

    assertValidDateRange(startDate, endDate);

    const task = await createTask({
      projectId,
      parentId: parseOptionalPositiveInteger(formData.get("parentId"), "상위 작업"),
      title: getSingleValue(formData.get("title")),
      description: getSingleValue(formData.get("description")),
      startDate,
      endDate,
      assigneeId: parseOptionalPositiveInteger(formData.get("assigneeId"), "담당자"),
    });

    revalidatePath("/tasks");

    await logInfo("tasks", "Task created", {
      actorEmail: session.user.email ?? null,
      projectId,
      taskId: task.id,
      taskTitle: task.title,
    });

    redirectPath = buildTasksPath("success", `${task.title} 작업을 생성했습니다.`, projectId);
  } catch (error) {
    await logError("tasks", "Task creation failed", {
      actorEmail: session.user.email ?? null,
      projectId,
      error: serializeError(error),
    });

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "작업 생성 중 알 수 없는 오류가 발생했습니다.",
      projectId,
    );
  }

  redirect(redirectPath);
}

export async function updateTaskAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const startDate = parseRequiredDate(formData.get("startDate"), "작업 시작일");
    const endDate = parseRequiredDate(formData.get("endDate"), "작업 종료일");

    assertValidDateRange(startDate, endDate);

    const task = await updateTask({
      id: parseRequiredPositiveInteger(formData.get("taskId"), "작업"),
      parentId: parseOptionalPositiveInteger(formData.get("parentId"), "상위 작업"),
      title: getSingleValue(formData.get("title")),
      description: getSingleValue(formData.get("description")),
      startDate,
      endDate,
      assigneeId: parseOptionalPositiveInteger(formData.get("assigneeId"), "담당자"),
    });

    revalidatePath("/tasks");

    await logInfo("tasks", "Task updated", {
      actorEmail: session.user.email ?? null,
      projectId,
      taskId: task.id,
      taskTitle: task.title,
    });

    redirectPath = buildTasksPath("success", `${task.title} 작업을 수정했습니다.`, projectId);
  } catch (error) {
    await logError("tasks", "Task update failed", {
      actorEmail: session.user.email ?? null,
      projectId,
      error: serializeError(error),
    });

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "작업 수정 중 알 수 없는 오류가 발생했습니다.",
      projectId,
    );
  }

  redirect(redirectPath);
}

export async function deleteTaskAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const task = await deleteTask(parseRequiredPositiveInteger(formData.get("taskId"), "작업"));

    revalidatePath("/tasks");

    await logInfo("tasks", "Task deleted", {
      actorEmail: session.user.email ?? null,
      projectId,
      taskId: task.id,
      taskTitle: task.title,
    });

    redirectPath = buildTasksPath("success", `${task.title} 작업을 삭제했습니다.`, projectId);
  } catch (error) {
    await logError("tasks", "Task deletion failed", {
      actorEmail: session.user.email ?? null,
      projectId,
      error: serializeError(error),
    });

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "작업 삭제 중 알 수 없는 오류가 발생했습니다.",
      projectId,
    );
  }

  redirect(redirectPath);
}
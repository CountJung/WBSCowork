"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { logUserAction, logUserActionFailure } from "@/lib/logger";
import { createProject, deleteProject, updateProject } from "@/lib/repositories/project-repository";
import { canAccessAdminPanel } from "@/models/user";

function buildProjectsPath(status: "success" | "error", message: string) {
  const searchParams = new URLSearchParams({ status, message });
  return `/admin/projects?${searchParams.toString()}`;
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

async function requireAdminSession() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect(getSignInPath("/admin/projects"));
  }
  if (!canAccessAdminPanel(session.user.role, session.user.isSuperuser)) {
    redirect(buildProjectsPath("error", "프로젝트 관리는 관리자 이상만 접근할 수 있습니다."));
  }
  return session;
}

export async function createProjectAdminAction(formData: FormData) {
  const session = await requireAdminSession();
  let redirectPath: string;

  try {
    const name = getSingleValue(formData.get("name")).trim();
    const startDate = parseRequiredDate(formData.get("startDate"), "프로젝트 시작일");
    const endDate = parseRequiredDate(formData.get("endDate"), "프로젝트 종료일");

    if (!name) {
      throw new Error("프로젝트 이름은 비워 둘 수 없습니다.");
    }

    assertValidDateRange(startDate, endDate);

    const project = await createProject({ name, startDate, endDate });

    revalidatePath("/admin/projects");
    revalidatePath("/tasks");
    revalidatePath("/");

    await logUserAction("admin.projects", {
      actorEmail: session.user.email ?? null,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      entityLabel: project.name,
      projectId: project.id,
    });

    redirectPath = buildProjectsPath("success", `${project.name} 프로젝트를 생성했습니다.`);
  } catch (error) {
    await logUserActionFailure(
      "admin.projects",
      { actorEmail: session.user.email ?? null, action: "project.create", entityType: "project" },
      error,
    );
    redirectPath = buildProjectsPath(
      "error",
      error instanceof Error ? error.message : "프로젝트 생성 중 알 수 없는 오류가 발생했습니다.",
    );
  }

  redirect(redirectPath);
}

export async function updateProjectAdminAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireAdminSession();
  let redirectPath: string;

  try {
    const name = getSingleValue(formData.get("name")).trim();
    const startDate = parseRequiredDate(formData.get("startDate"), "프로젝트 시작일");
    const endDate = parseRequiredDate(formData.get("endDate"), "프로젝트 종료일");

    if (!name) {
      throw new Error("프로젝트 이름은 비워 둘 수 없습니다.");
    }

    assertValidDateRange(startDate, endDate);

    const project = await updateProject({ id: projectId, name, startDate, endDate });

    revalidatePath("/admin/projects");
    revalidatePath("/tasks");
    revalidatePath("/");

    await logUserAction("admin.projects", {
      actorEmail: session.user.email ?? null,
      action: "project.update",
      entityType: "project",
      entityId: project.id,
      entityLabel: project.name,
      projectId: project.id,
    });

    redirectPath = buildProjectsPath("success", `${project.name} 프로젝트를 수정했습니다.`);
  } catch (error) {
    await logUserActionFailure(
      "admin.projects",
      { actorEmail: session.user.email ?? null, action: "project.update", entityType: "project", entityId: projectId },
      error,
    );
    redirectPath = buildProjectsPath(
      "error",
      error instanceof Error ? error.message : "프로젝트 수정 중 알 수 없는 오류가 발생했습니다.",
    );
  }

  redirect(redirectPath);
}

export async function deleteProjectAdminAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireAdminSession();
  let redirectPath: string;

  try {
    await deleteProject(projectId);

    revalidatePath("/admin/projects");
    revalidatePath("/tasks");
    revalidatePath("/");

    await logUserAction("admin.projects", {
      actorEmail: session.user.email ?? null,
      action: "project.delete",
      entityType: "project",
      entityId: projectId,
      projectId: projectId,
    });

    redirectPath = buildProjectsPath("success", "프로젝트를 삭제했습니다.");
  } catch (error) {
    await logUserActionFailure(
      "admin.projects",
      { actorEmail: session.user.email ?? null, action: "project.delete", entityType: "project", entityId: projectId },
      error,
    );
    redirectPath = buildProjectsPath(
      "error",
      error instanceof Error ? error.message : "프로젝트 삭제 중 알 수 없는 오류가 발생했습니다.",
    );
  }

  redirect(redirectPath);
}

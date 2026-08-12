"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/src/entities/user/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";
import { createProject, deleteProject, updateProject } from "@/src/entities/project/index.server";
import { listAttachmentsByProject, listSubmissionsByProject } from "@/src/entities/submission/index.server";
import { listTasksByProject } from "@/src/entities/task/index.server";
import {
  deleteProjectUploadDirectories,
  deleteStoredSubmissionAttachment,
} from "@/src/entities/submission/index.server";
import { canAccessAdminPanel } from "@/src/entities/user";

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
    if (getSingleValue(formData.get("confirmDestruction")) !== "yes") {
      throw new Error("프로젝트 종료 및 개인정보 파기에 동의해야 합니다.");
    }

    const [submissionsToClean, attachmentsToClean, tasksToClean] = await Promise.all([
      listSubmissionsByProject(projectId),
      listAttachmentsByProject(projectId),
      listTasksByProject(projectId),
    ]);
    const project = await deleteProject(projectId);

    const storedFilePaths = new Set([
      ...submissionsToClean
        .map((submission) => submission.filePath)
        .filter((filePath): filePath is string => Boolean(filePath)),
      ...attachmentsToClean.map((attachment) => attachment.filePath),
    ]);

    let cleanupFailureCount = 0;

    for (const filePath of storedFilePaths) {
      await deleteStoredSubmissionAttachment(filePath).catch(async (cleanupError) => {
        cleanupFailureCount += 1;
        await logUserActionFailure(
          "admin.projects",
          {
            actorEmail: session.user.email ?? null,
            action: "project.delete.file.cleanup",
            entityType: "project",
            entityId: projectId,
            projectId,
            metadata: { storedFileCleanupFailed: true },
          },
          cleanupError,
        );
      });
    }

    await deleteProjectUploadDirectories(tasksToClean.map((task) => task.id)).catch(async (cleanupError) => {
      cleanupFailureCount += 1;
      await logUserActionFailure(
        "admin.projects",
        {
          actorEmail: session.user.email ?? null,
          action: "project.delete.directory.cleanup",
          entityType: "project",
          entityId: projectId,
          projectId,
        },
        cleanupError,
      );
    });

    revalidatePath("/admin/projects");
    revalidatePath("/tasks");
    revalidatePath("/");

    if (cleanupFailureCount > 0) {
      redirectPath = buildProjectsPath(
        "error",
        `${project.name} 프로젝트 DB는 삭제했지만 저장 파일 정리 ${cleanupFailureCount}건이 실패했습니다. 관리자 로그와 업로드 저장소를 확인해 주세요.`,
      );
    } else {
      await logUserAction("admin.projects", {
        actorEmail: session.user.email ?? null,
        action: "project.delete",
        entityType: "project",
        entityId: projectId,
        entityLabel: project.name,
        projectId: projectId,
      });

      redirectPath = buildProjectsPath("success", `${project.name} 프로젝트와 관련 데이터를 파기했습니다.`);
    }
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

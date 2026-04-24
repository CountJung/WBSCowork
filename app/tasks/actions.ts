"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { logUserAction, logUserActionFailure } from "@/lib/logger";
import { createSubmissionAttachment, deleteSubmissionAttachment, getSubmissionAttachmentById, listAttachmentsBySubmission, listAttachmentsByTask, listAttachmentsByProject } from "@/lib/repositories/submission-attachment-repository";
import { createComment, deleteComment, getCommentById, updateComment } from "@/lib/repositories/comment-repository";
import { createProject, deleteProject, updateProject } from "@/lib/repositories/project-repository";
import { createSubmission, deleteSubmission, getSubmissionById, updateSubmission, listSubmissionsByProject, listSubmissionsByTask } from "@/lib/repositories/submission-repository";
import { createTask, deleteTask, listTasksByProject, updateTask } from "@/lib/repositories/task-repository";
import { getUserByEmail } from "@/lib/repositories/user-repository";
import { deleteStoredSubmissionAttachment, saveUploadedSubmissionAttachment, cleanupTaskUploadDirectory, cleanupProjectUploadDirectories, type StoredSubmissionAttachment } from "@/lib/submission-files";
import { canWriteTaskContent } from "@/models/user";
import type { SubmissionVisibility } from "@/models/submission";

function buildTasksPath(
  status: "success" | "error",
  message: string,
  options?: { projectId?: number; taskId?: number },
) {
  const searchParams = new URLSearchParams({
    status,
    message,
  });

  if (options?.projectId) {
    searchParams.set("projectId", String(options.projectId));
  }

  if (options?.taskId) {
    searchParams.set("taskId", String(options.taskId));
  }

  return `/tasks?${searchParams.toString()}`;
}

function getSingleValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function isChecked(value: FormDataEntryValue | null) {
  return getSingleValue(value) === "on";
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

function parseVisibility(value: FormDataEntryValue | null): SubmissionVisibility {
  return getSingleValue(value) === "private" ? "private" : "public";
}

async function requireWritableSession(projectId?: number) {
  const session = await getAuthSession();

  if (!session?.user) {
    const callbackPath = projectId ? `/tasks?projectId=${projectId}` : "/tasks";
    redirect(getSignInPath(callbackPath));
  }

  if (!canWriteTaskContent(session.user.role, session.user.isSuperuser)) {
    redirect(buildTasksPath("error", "게스트 계정은 작업과 프로젝트를 수정할 수 없습니다.", { projectId }));
  }

  return session;
}

async function requirePersistedUser(projectId?: number) {
  const session = await requireWritableSession(projectId);
  const email = session.user.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("현재 로그인 사용자의 이메일을 확인할 수 없습니다.");
  }

  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("쓰기 기능을 사용하려면 현재 로그인 사용자가 DB 사용자 테이블에 존재해야 합니다.");
  }

  return {
    session,
    user,
  };
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

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "project.create",
      entityType: "project",
      entityId: project.id,
      entityLabel: project.name,
      projectId: project.id,
    });

    redirectPath = buildTasksPath("success", `${project.name} 프로젝트를 생성했습니다.`, { projectId: project.id });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "project.create",
        entityType: "project",
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "프로젝트 생성 중 알 수 없는 오류가 발생했습니다.",
    );
  }

  redirect(redirectPath);
}

export async function updateProjectAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireWritableSession(projectId);

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

    revalidatePath("/admin");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "project.update",
      entityType: "project",
      entityId: project.id,
      entityLabel: project.name,
      projectId: project.id,
    });

    redirectPath = buildTasksPath("success", `${project.name} 프로젝트를 수정했습니다.`, { projectId: project.id });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "project.update",
        entityType: "project",
        projectId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "프로젝트 수정 중 알 수 없는 오류가 발생했습니다.",
      { projectId },
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

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "task.create",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      projectId,
      taskId: task.id,
    });

    redirectPath = buildTasksPath("success", `${task.title} 작업을 생성했습니다.`, { projectId, taskId: task.id });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "task.create",
        entityType: "task",
        projectId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "작업 생성 중 알 수 없는 오류가 발생했습니다.",
      { projectId },
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

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "task.update",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      projectId,
      taskId: task.id,
    });

    redirectPath = buildTasksPath("success", `${task.title} 작업을 수정했습니다.`, { projectId, taskId: task.id });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "task.update",
        entityType: "task",
        projectId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "작업 수정 중 알 수 없는 오류가 발생했습니다.",
      { projectId },
    );
  }

  redirect(redirectPath);
}

export async function deleteTaskAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");

    // 삭제 전에 해당 작업의 제출물과 첨부파일 목록 조회 (DB CASCADE 이전)
    const [submissionsToClean, attachmentsToClean] = await Promise.all([
      listSubmissionsByTask(taskId),
      listAttachmentsByTask(taskId),
    ]);

    const task = await deleteTask(taskId);

    // 레거시 단일 파일 정리
    for (const sub of submissionsToClean) {
      if (sub.filePath) {
        await deleteStoredSubmissionAttachment(sub.filePath).catch(async (cleanupError) => {
          await logUserActionFailure(
            "tasks",
            {
              actorEmail: session.user.email ?? null,
              action: "task.delete.file.cleanup",
              entityType: "task",
              entityId: taskId,
              projectId,
              taskId,
              metadata: { filePath: sub.filePath },
            },
            cleanupError,
          );
        });
      }
    }

    // submission_attachments 파일 정리 (DB 레코드는 CASCADE로 이미 삭제됨)
    for (const attachment of attachmentsToClean) {
      await deleteStoredSubmissionAttachment(attachment.filePath).catch(async (cleanupError) => {
        await logUserActionFailure(
          "tasks",
          {
            actorEmail: session.user.email ?? null,
            action: "task.delete.file.cleanup",
            entityType: "task",
            entityId: taskId,
            projectId,
            taskId,
            metadata: { filePath: attachment.filePath },
          },
          cleanupError,
        );
      });
    }

    // 빈 폴더 정리
    await cleanupTaskUploadDirectory(taskId).catch(() => undefined);

    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "task.delete",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      projectId,
      taskId: task.id,
    });

    redirectPath = buildTasksPath("success", `${task.title} 작업을 삭제했습니다.`, { projectId });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "task.delete",
        entityType: "task",
        projectId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "작업 삭제 중 알 수 없는 오류가 발생했습니다.",
      { projectId },
    );
  }

  redirect(redirectPath);
}

export async function deleteProjectAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const session = await requireWritableSession(projectId);

  let redirectPath = "/tasks";

  try {
    // 삭제 전에 프로젝트 전체 제출물, 첨부파일, 태스크 목록 조회 (DB CASCADE 이전)
    const [submissionsToClean, attachmentsToClean, tasksToClean] = await Promise.all([
      listSubmissionsByProject(projectId),
      listAttachmentsByProject(projectId),
      listTasksByProject(projectId),
    ]);

    const project = await deleteProject(projectId);

    // 레거시 단일 파일 정리
    for (const sub of submissionsToClean) {
      if (sub.filePath) {
        await deleteStoredSubmissionAttachment(sub.filePath).catch(async (cleanupError) => {
          await logUserActionFailure(
            "tasks",
            {
              actorEmail: session.user.email ?? null,
              action: "project.delete.file.cleanup",
              entityType: "project",
              entityId: projectId,
              projectId,
              metadata: { filePath: sub.filePath },
            },
            cleanupError,
          );
        });
      }
    }

    // submission_attachments 파일 정리 (DB 레코드는 CASCADE로 이미 삭제됨)
    for (const attachment of attachmentsToClean) {
      await deleteStoredSubmissionAttachment(attachment.filePath).catch(async (cleanupError) => {
        await logUserActionFailure(
          "tasks",
          {
            actorEmail: session.user.email ?? null,
            action: "project.delete.file.cleanup",
            entityType: "project",
            entityId: projectId,
            projectId,
            metadata: { filePath: attachment.filePath },
          },
          cleanupError,
        );
      });
    }

    // 빈 폴더 정리
    const taskIds = tasksToClean.map((t) => t.id);
    await cleanupProjectUploadDirectories(taskIds).catch(() => undefined);

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "project.delete",
      entityType: "project",
      entityId: project.id,
      entityLabel: project.name,
      projectId: project.id,
    });

    redirectPath = buildTasksPath("success", `${project.name} 프로젝트를 삭제했습니다.`);
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "project.delete",
        entityType: "project",
        entityId: projectId,
        projectId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "프로젝트 삭제 중 알 수 없는 오류가 발생했습니다.",
      { projectId },
    );
  }

  redirect(redirectPath);
}

export async function createSubmissionAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const { session, user } = await requirePersistedUser(projectId);
  const savedAttachments: StoredSubmissionAttachment[] = [];

  let redirectPath: string;

  try {
    const uploadedFiles = (formData.getAll("attachments") as (File | string)[]).filter(
      (v): v is File => v instanceof File && v.size > 0,
    );

    const submission = await createSubmission({
      taskId,
      authorId: user.id,
      content: getSingleValue(formData.get("content")),
      visibility: parseVisibility(formData.get("visibility")),
      filePath: null,
      fileName: null,
      fileMimeType: null,
      fileSizeBytes: null,
    });

    for (const file of uploadedFiles) {
      const stored = await saveUploadedSubmissionAttachment(file, { authorId: user.id, taskId });
      savedAttachments.push(stored);
      await createSubmissionAttachment({
        submissionId: submission.id,
        filePath: stored.filePath,
        fileName: stored.fileName,
        fileMimeType: stored.fileMimeType,
        fileSizeBytes: stored.fileSizeBytes,
      });
    }

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "submission.create",
      entityType: "submission",
      entityId: submission.id,
      projectId,
      taskId,
      submissionId: submission.id,
      metadata: {
        attachmentCount: uploadedFiles.length,
      },
    });

    redirectPath = buildTasksPath("success", "제출물을 등록했습니다.", { projectId, taskId });
  } catch (error) {
    for (const saved of savedAttachments) {
      await deleteStoredSubmissionAttachment(saved.filePath).catch(() => undefined);
    }

    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "submission.create",
        entityType: "submission",
        projectId,
        taskId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "제출물 등록 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}

export async function updateSubmissionAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const session = await requireWritableSession(projectId);
  const savedAttachments: StoredSubmissionAttachment[] = [];

  let redirectPath: string;

  try {
    const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
    const existingSubmission = await getSubmissionById(submissionId);

    if (!existingSubmission) {
      throw new Error("수정할 제출물을 찾을 수 없습니다.");
    }

    const clearAttachment = isChecked(formData.get("clearAttachment"));
    const uploadedFiles = (formData.getAll("attachments") as (File | string)[]).filter(
      (v): v is File => v instanceof File && v.size > 0,
    );

    const submission = await updateSubmission({
      id: submissionId,
      content: getSingleValue(formData.get("content")),
      visibility: parseVisibility(formData.get("visibility")),
      replaceAttachment: clearAttachment,
      filePath: null,
      fileName: null,
      fileMimeType: null,
      fileSizeBytes: null,
    });

    if (clearAttachment && existingSubmission.filePath) {
      await deleteStoredSubmissionAttachment(existingSubmission.filePath).catch(async (cleanupError) => {
        await logUserActionFailure(
          "tasks",
          {
            actorEmail: session.user.email ?? null,
            action: "submission.attachment.cleanup",
            entityType: "submission",
            entityId: submissionId,
            projectId,
            taskId,
            submissionId,
            metadata: { filePath: existingSubmission.filePath },
          },
          cleanupError,
        );
      });
    }

    for (const file of uploadedFiles) {
      const stored = await saveUploadedSubmissionAttachment(file, {
        authorId: existingSubmission.authorId,
        taskId,
      });
      savedAttachments.push(stored);
      await createSubmissionAttachment({
        submissionId,
        filePath: stored.filePath,
        fileName: stored.fileName,
        fileMimeType: stored.fileMimeType,
        fileSizeBytes: stored.fileSizeBytes,
      });
    }

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "submission.update",
      entityType: "submission",
      entityId: submission.id,
      projectId,
      taskId,
      submissionId: submission.id,
      metadata: {
        addedAttachmentCount: uploadedFiles.length,
      },
    });

    redirectPath = buildTasksPath("success", "제출물을 수정했습니다.", { projectId, taskId });
  } catch (error) {
    for (const saved of savedAttachments) {
      await deleteStoredSubmissionAttachment(saved.filePath).catch(() => undefined);
    }

    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "submission.update",
        entityType: "submission",
        projectId,
        taskId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "제출물 수정 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}

export async function deleteSubmissionAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
    const existingSubmission = await getSubmissionById(submissionId);

    if (!existingSubmission) {
      throw new Error("삭제할 제출물을 찾을 수 없습니다.");
    }

    // 삭제 전에 첨부파일 목록을 먼저 조회 (DB CASCADE 이전)
    const attachmentsToClean = await listAttachmentsBySubmission(submissionId);

    const submission = await deleteSubmission(submissionId);

    // 레거시 단일 파일 정리
    if (existingSubmission.filePath) {
      await deleteStoredSubmissionAttachment(existingSubmission.filePath).catch(async (cleanupError) => {
        await logUserActionFailure(
          "tasks",
          {
            actorEmail: session.user.email ?? null,
            action: "submission.attachment.delete",
            entityType: "submission",
            entityId: submissionId,
            projectId,
            taskId,
            submissionId,
            metadata: {
              filePath: existingSubmission.filePath,
            },
          },
          cleanupError,
        );
      });
    }

    // submission_attachments 파일 정리 (DB 레코드는 CASCADE로 이미 삭제됨)
    for (const attachment of attachmentsToClean) {
      await deleteStoredSubmissionAttachment(attachment.filePath).catch(async (cleanupError) => {
        await logUserActionFailure(
          "tasks",
          {
            actorEmail: session.user.email ?? null,
            action: "submission.attachment.delete",
            entityType: "submission",
            entityId: submissionId,
            projectId,
            taskId,
            submissionId,
            metadata: { filePath: attachment.filePath },
          },
          cleanupError,
        );
      });
    }

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "submission.delete",
      entityType: "submission",
      entityId: submission.id,
      projectId,
      taskId,
      submissionId: submission.id,
      targetEmail: existingSubmission.authorEmail,
      metadata: {
        fileName: existingSubmission.fileName,
      },
    });

    redirectPath = buildTasksPath("success", "제출물을 삭제했습니다.", { projectId, taskId });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "submission.delete",
        entityType: "submission",
        projectId,
        taskId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "제출물 삭제 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}

export async function deleteSubmissionAttachmentAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const attachmentId = parseRequiredPositiveInteger(formData.get("attachmentId"), "첨부파일");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
    const attachment = await getSubmissionAttachmentById(attachmentId);

    if (!attachment || attachment.submissionId !== submissionId) {
      throw new Error("삭제할 첨부파일을 찾을 수 없습니다.");
    }

    await deleteSubmissionAttachment(attachmentId);
    await deleteStoredSubmissionAttachment(attachment.filePath).catch(async (cleanupError) => {
      await logUserActionFailure(
        "tasks",
        {
          actorEmail: session.user.email ?? null,
          action: "submission.attachment.delete.file",
          entityType: "submission",
          entityId: submissionId,
          projectId,
          taskId,
          submissionId,
          metadata: { filePath: attachment.filePath },
        },
        cleanupError,
      );
    });

    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "submission.attachment.delete",
      entityType: "submission",
      entityId: submissionId,
      projectId,
      taskId,
      submissionId,
      metadata: { fileName: attachment.fileName },
    });

    redirectPath = buildTasksPath("success", "첨부파일을 삭제했습니다.", { projectId, taskId });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "submission.attachment.delete",
        entityType: "submission",
        projectId,
        taskId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "첨부파일 삭제 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}

export async function createCommentAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
  const { session, user } = await requirePersistedUser(projectId);

  let redirectPath: string;

  try {
    const comment = await createComment({
      submissionId,
      authorId: user.id,
      content: getSingleValue(formData.get("content")),
    });

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "comment.create",
      entityType: "comment",
      entityId: comment.id,
      projectId,
      taskId,
      submissionId,
      commentId: comment.id,
    });

    redirectPath = buildTasksPath("success", "댓글을 등록했습니다.", { projectId, taskId });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "comment.create",
        entityType: "comment",
        projectId,
        taskId,
        submissionId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "댓글 등록 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}

export async function updateCommentAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const comment = await updateComment({
      id: parseRequiredPositiveInteger(formData.get("commentId"), "댓글"),
      content: getSingleValue(formData.get("content")),
    });

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "comment.update",
      entityType: "comment",
      entityId: comment.id,
      projectId,
      taskId,
      submissionId,
      commentId: comment.id,
    });

    redirectPath = buildTasksPath("success", "댓글을 수정했습니다.", { projectId, taskId });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "comment.update",
        entityType: "comment",
        projectId,
        taskId,
        submissionId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "댓글 수정 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}

export async function deleteCommentAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
  const session = await requireWritableSession(projectId);

  let redirectPath: string;

  try {
    const commentId = parseRequiredPositiveInteger(formData.get("commentId"), "댓글");
    const existingComment = await getCommentById(commentId);

    if (!existingComment) {
      throw new Error("삭제할 댓글을 찾을 수 없습니다.");
    }

    const comment = await deleteComment(commentId);

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "comment.delete",
      entityType: "comment",
      entityId: comment.id,
      projectId,
      taskId,
      submissionId,
      commentId: comment.id,
      targetEmail: existingComment.authorEmail,
    });

    redirectPath = buildTasksPath("success", "댓글을 삭제했습니다.", { projectId, taskId });
  } catch (error) {
    await logUserActionFailure(
      "tasks",
      {
        actorEmail: session.user.email ?? null,
        action: "comment.delete",
        entityType: "comment",
        projectId,
        taskId,
        submissionId,
      },
      error,
    );

    redirectPath = buildTasksPath(
      "error",
      error instanceof Error ? error.message : "댓글 삭제 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}
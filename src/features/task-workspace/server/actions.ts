"use server";

import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath, getUserByEmail } from "@/src/entities/user/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";
import {
  deleteSubmissionAttachment,
  getSubmissionAttachmentById,
  listAttachmentsBySubmission,
  listAttachmentsByTask,
  createSubmissionWithAttachments,
  deleteSubmission,
  getSubmissionByIdForViewer,
  updateSubmissionWithAttachments,
  listSubmissionsByTask,
  deleteStoredSubmissionAttachment,
  saveUploadedSubmissionAttachment,
  cleanupTaskUploadDirectory,
  type StoredSubmissionAttachment,
} from "@/src/entities/submission/index.server";
import { createComment, deleteComment, getCommentById, updateComment } from "@/src/entities/comment/index.server";
import { createTask, deleteTask, getTaskById, updateTask } from "@/src/entities/task/index.server";
import { canManageAllSubmissions, canWriteTaskContent } from "@/src/entities/user";
import type { Submission, SubmissionVisibility } from "@/src/entities/submission";
import type { User } from "@/src/entities/user";

function validateUploadBatch(files: File[]) {
  const maximum = getRuntimeEnv().uploadMaxFileSizeMb * 1024 * 1024;
  if (files.length > 20 || files.some((file) => file.size > maximum) || files.reduce((total, file) => total + file.size, 0) > maximum) {
    throw new Error(`첨부파일 합계는 ${getRuntimeEnv().uploadMaxFileSizeMb}MB 이하, 최대 20개여야 합니다.`);
  }
}

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

type WritableSession = Awaited<ReturnType<typeof requireWritableSession>>;

/** 세션 이메일에 대응하는 DB 사용자. 소유권 판정은 항상 DB 사용자 id로 한다. */
async function resolvePersistedUser(session: WritableSession): Promise<User> {
  const email = session.user.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("현재 로그인 사용자의 이메일을 확인할 수 없습니다.");
  }

  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("쓰기 기능을 사용하려면 현재 로그인 사용자가 DB 사용자 테이블에 존재해야 합니다.");
  }

  return user;
}

async function requirePersistedUser(projectId?: number) {
  const session = await requireWritableSession(projectId);

  return {
    session,
    user: await resolvePersistedUser(session),
  };
}

/** 폼이 주장한 project → task 관계를 서버에서 다시 확인한다. */
async function requireProjectTask(projectId: number, taskId: number) {
  const task = await getTaskById(taskId);

  if (!task || task.projectId !== projectId) {
    throw new Error("대상 작업을 찾을 수 없습니다.");
  }

  return task;
}

/**
 * 폼이 주장한 project → task → submission 관계를 서버에서 다시 확인하고, 뷰어 공개 범위도 함께 적용한다.
 *
 * 볼 수 없는 제출물은 존재하지 않는 제출물과 같은 오류로 처리해 id 열거로 자원 존재를 알아내지 못하게 한다.
 */
async function requireVisibleSubmission(
  session: WritableSession,
  options: { projectId: number; taskId: number; submissionId: number },
): Promise<{ submission: Submission; user: User; canManageAll: boolean }> {
  const user = await resolvePersistedUser(session);
  const canManageAll = canManageAllSubmissions(session.user.role, session.user.isSuperuser);
  const submission = await getSubmissionByIdForViewer(options.submissionId, {
    canSeeAll: canManageAll,
    viewerUserId: user.id,
  });

  if (!submission || submission.taskId !== options.taskId) {
    throw new Error("대상 제출물을 찾을 수 없습니다.");
  }

  await requireProjectTask(options.projectId, submission.taskId);

  return { submission, user, canManageAll };
}

/** 제출물 수정·삭제·첨부 정리는 작성자 본인 또는 모든 제출물 관리 권한을 가진 actor만 가능하다. */
async function requireOwnedSubmission(
  session: WritableSession,
  options: { projectId: number; taskId: number; submissionId: number },
) {
  const owned = await requireVisibleSubmission(session, options);

  if (!owned.canManageAll && owned.submission.authorId !== owned.user.id) {
    throw new Error("본인이 작성한 제출물만 수정하거나 삭제할 수 있습니다.");
  }

  return owned;
}

/** 댓글 수정·삭제는 작성자 본인 또는 모든 제출물 관리 권한을 가진 actor만 가능하다. */
async function requireOwnedComment(
  session: WritableSession,
  options: { projectId: number; taskId: number; submissionId: number; commentId: number },
) {
  const { submission, user, canManageAll } = await requireVisibleSubmission(session, options);
  const comment = await getCommentById(options.commentId);

  if (!comment || comment.submissionId !== submission.id) {
    throw new Error("대상 댓글을 찾을 수 없습니다.");
  }

  if (!canManageAll && comment.authorId !== user.id) {
    throw new Error("본인이 작성한 댓글만 수정하거나 삭제할 수 있습니다.");
  }

  return { comment, submission, user, canManageAll };
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

  let cleanupFailed = false;
  let redirectPath: string;

  try {
    const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");

    await requireProjectTask(projectId, taskId);

    // 삭제 전에 해당 작업의 제출물과 첨부파일 목록 조회 (DB CASCADE 이전)
    const [submissionsToClean, attachmentsToClean] = await Promise.all([
      // 작업 삭제도 하위 저장 파일 전체를 정리해야 한다.
      listSubmissionsByTask(taskId, { canSeeAll: true }),
      listAttachmentsByTask(taskId),
    ]);

    const task = await deleteTask(taskId);

    // 레거시 단일 파일 정리
    for (const sub of submissionsToClean) {
      if (sub.filePath) {
        await deleteStoredSubmissionAttachment(sub.filePath).catch(async (cleanupError) => {
        cleanupFailed = true;
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
        cleanupFailed = true;
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

    redirectPath = buildTasksPath(cleanupFailed ? "error" : "success", cleanupFailed ? `${task.title} 작업 DB는 삭제됐고 파일 정리는 재시도 대기 중입니다.` : `${task.title} 작업을 삭제했습니다.`, { projectId });
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

export async function createSubmissionAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const { session, user } = await requirePersistedUser(projectId);
  const savedAttachments: StoredSubmissionAttachment[] = [];
  let metadataCommitted = false;

  let redirectPath: string;

  try {
    await requireProjectTask(projectId, taskId);

    const uploadedFiles = (formData.getAll("attachments") as (File | string)[]).filter(
      (v): v is File => v instanceof File && v.size > 0,
    );

    validateUploadBatch(uploadedFiles);
    for (const file of uploadedFiles) savedAttachments.push(await saveUploadedSubmissionAttachment(file, { authorId: user.id, taskId }));
    const submissionId = await createSubmissionWithAttachments({ taskId, authorId: user.id,
      content: getSingleValue(formData.get("content")), visibility: parseVisibility(formData.get("visibility")) }, savedAttachments);
    metadataCommitted = true;

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "submission.create",
      entityType: "submission",
      entityId: submissionId,
      projectId,
      taskId,
      submissionId,
      metadata: {
        attachmentCount: uploadedFiles.length,
      },
    });

    redirectPath = buildTasksPath("success", "제출물을 등록했습니다.", { projectId, taskId });
  } catch (error) {
    for (const saved of metadataCommitted ? [] : savedAttachments) {
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
      metadataCommitted ? "제출물은 저장됐지만 화면 갱신 중 오류가 발생했습니다. 다시 등록하지 말고 목록을 확인해 주세요." : error instanceof Error ? error.message : "제출물 등록 중 알 수 없는 오류가 발생했습니다.",
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
  let metadataCommitted = false;

  let cleanupFailed = false;
  let redirectPath: string;

  try {
    const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
    const { submission: existingSubmission } = await requireOwnedSubmission(session, {
      projectId,
      taskId,
      submissionId,
    });

    const clearAttachment = isChecked(formData.get("clearAttachment"));
    const uploadedFiles = (formData.getAll("attachments") as (File | string)[]).filter(
      (v): v is File => v instanceof File && v.size > 0,
    );

    validateUploadBatch(uploadedFiles);
    for (const file of uploadedFiles) savedAttachments.push(await saveUploadedSubmissionAttachment(file, { authorId: existingSubmission.authorId, taskId }));
    await updateSubmissionWithAttachments({
      id: submissionId,
      content: getSingleValue(formData.get("content")),
      visibility: parseVisibility(formData.get("visibility")),
      replaceAttachment: clearAttachment,
      filePath: null,
      fileName: null,
      fileMimeType: null,
      fileSizeBytes: null,
    }, savedAttachments);
    metadataCommitted = true;

    if (clearAttachment && existingSubmission.filePath) {
      await deleteStoredSubmissionAttachment(existingSubmission.filePath).catch(async (cleanupError) => {
        cleanupFailed = true;
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

    revalidatePath("/");
    revalidatePath("/tasks");

    await logUserAction("tasks", {
      actorEmail: session.user.email ?? null,
      action: "submission.update",
      entityType: "submission",
      entityId: submissionId,
      projectId,
      taskId,
      submissionId,
      metadata: {
        addedAttachmentCount: uploadedFiles.length,
      },
    });

    redirectPath = buildTasksPath(cleanupFailed ? "error" : "success", cleanupFailed ? "제출물 변경은 저장됐고 이전 파일 정리는 재시도 대기 중입니다." : "제출물을 수정했습니다.", { projectId, taskId });
  } catch (error) {
    for (const saved of metadataCommitted ? [] : savedAttachments) {
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
      metadataCommitted ? "변경은 저장됐지만 화면 갱신 중 오류가 발생했습니다. 목록을 확인해 주세요." : error instanceof Error ? error.message : "제출물 수정 중 알 수 없는 오류가 발생했습니다.",
      { projectId, taskId },
    );
  }

  redirect(redirectPath);
}

export async function deleteSubmissionAction(formData: FormData) {
  const projectId = parseRequiredPositiveInteger(formData.get("projectId"), "프로젝트");
  const taskId = parseRequiredPositiveInteger(formData.get("taskId"), "작업");
  const session = await requireWritableSession(projectId);

  let cleanupFailed = false;
  let redirectPath: string;

  try {
    const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");
    const { submission: existingSubmission } = await requireOwnedSubmission(session, {
      projectId,
      taskId,
      submissionId,
    });

    // 삭제 전에 첨부파일 목록을 먼저 조회 (DB CASCADE 이전)
    const attachmentsToClean = await listAttachmentsBySubmission(submissionId);

    const submission = await deleteSubmission(submissionId);

    // 레거시 단일 파일 정리
    if (existingSubmission.filePath) {
      await deleteStoredSubmissionAttachment(existingSubmission.filePath).catch(async (cleanupError) => {
        cleanupFailed = true;
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
        cleanupFailed = true;
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

    redirectPath = buildTasksPath(cleanupFailed ? "error" : "success", cleanupFailed ? "제출물 DB는 삭제됐고 파일 정리는 재시도 대기 중입니다." : "제출물을 삭제했습니다.", { projectId, taskId });
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

  let cleanupFailed = false;
  let redirectPath: string;

  try {
    const submissionId = parseRequiredPositiveInteger(formData.get("submissionId"), "제출물");

    await requireOwnedSubmission(session, { projectId, taskId, submissionId });

    const attachment = await getSubmissionAttachmentById(attachmentId);

    if (!attachment || attachment.submissionId !== submissionId) {
      throw new Error("삭제할 첨부파일을 찾을 수 없습니다.");
    }

    await deleteSubmissionAttachment(attachmentId);
    await deleteStoredSubmissionAttachment(attachment.filePath).catch(async (cleanupError) => {
        cleanupFailed = true;
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

    redirectPath = buildTasksPath(cleanupFailed ? "error" : "success", cleanupFailed ? "첨부 정보는 삭제됐고 파일 정리는 재시도 대기 중입니다." : "첨부파일을 삭제했습니다.", { projectId, taskId });
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
    await requireVisibleSubmission(session, { projectId, taskId, submissionId });

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
    const commentId = parseRequiredPositiveInteger(formData.get("commentId"), "댓글");

    await requireOwnedComment(session, { projectId, taskId, submissionId, commentId });

    const comment = await updateComment({
      id: commentId,
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
    const { comment: existingComment } = await requireOwnedComment(session, {
      projectId,
      taskId,
      submissionId,
      commentId,
    });

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

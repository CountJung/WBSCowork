"use server";

import {
  changeTaskStatusAction as changeTaskStatusActionImpl,
  createCommentAction as createCommentActionImpl,
  createSubmissionAction as createSubmissionActionImpl,
  createTaskAction as createTaskActionImpl,
  deleteCommentAction as deleteCommentActionImpl,
  deleteSubmissionAction as deleteSubmissionActionImpl,
  deleteSubmissionAttachmentAction as deleteSubmissionAttachmentActionImpl,
  deleteTaskAction as deleteTaskActionImpl,
  updateCommentAction as updateCommentActionImpl,
  updateSubmissionAction as updateSubmissionActionImpl,
  updateTaskAction as updateTaskActionImpl,
} from "@/src/features/task-workspace/index.server";

export async function createTaskAction(formData: FormData) {
  return createTaskActionImpl(formData);
}

export async function updateTaskAction(formData: FormData) {
  return updateTaskActionImpl(formData);
}

export async function deleteTaskAction(formData: FormData) {
  return deleteTaskActionImpl(formData);
}

export async function createSubmissionAction(formData: FormData) {
  return createSubmissionActionImpl(formData);
}

export async function updateSubmissionAction(formData: FormData) {
  return updateSubmissionActionImpl(formData);
}

export async function deleteSubmissionAction(formData: FormData) {
  return deleteSubmissionActionImpl(formData);
}

export async function deleteSubmissionAttachmentAction(formData: FormData) {
  return deleteSubmissionAttachmentActionImpl(formData);
}

export async function createCommentAction(formData: FormData) {
  return createCommentActionImpl(formData);
}

export async function updateCommentAction(formData: FormData) {
  return updateCommentActionImpl(formData);
}

export async function deleteCommentAction(formData: FormData) {
  return deleteCommentActionImpl(formData);
}

export async function changeTaskStatusAction(formData: FormData) { return changeTaskStatusActionImpl(formData); }

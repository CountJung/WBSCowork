"use server";

import {
  createCommentAction as createCommentActionImpl,
  createProjectAction as createProjectActionImpl,
  createSubmissionAction as createSubmissionActionImpl,
  createTaskAction as createTaskActionImpl,
  deleteCommentAction as deleteCommentActionImpl,
  deleteProjectAction as deleteProjectActionImpl,
  deleteSubmissionAction as deleteSubmissionActionImpl,
  deleteSubmissionAttachmentAction as deleteSubmissionAttachmentActionImpl,
  deleteTaskAction as deleteTaskActionImpl,
  updateCommentAction as updateCommentActionImpl,
  updateProjectAction as updateProjectActionImpl,
  updateSubmissionAction as updateSubmissionActionImpl,
  updateTaskAction as updateTaskActionImpl,
} from "@/src/features/task-workspace/index.server";

export async function createProjectAction(formData: FormData) {
  return createProjectActionImpl(formData);
}

export async function updateProjectAction(formData: FormData) {
  return updateProjectActionImpl(formData);
}

export async function deleteProjectAction(formData: FormData) {
  return deleteProjectActionImpl(formData);
}

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

"use server";

import {
  createProjectAdminAction as createProjectAdminActionImpl,
  deleteProjectAdminAction as deleteProjectAdminActionImpl,
  updateProjectAdminAction as updateProjectAdminActionImpl,
  changeProjectWorkspaceAction as changeProjectWorkspaceActionImpl,
} from "@/src/features/project-manage/index.server";

export async function createProjectAdminAction(formData: FormData) {
  return createProjectAdminActionImpl(formData);
}

export async function updateProjectAdminAction(formData: FormData) {
  return updateProjectAdminActionImpl(formData);
}

export async function deleteProjectAdminAction(formData: FormData) {
  return deleteProjectAdminActionImpl(formData);
}
export async function changeProjectWorkspaceAction(formData:FormData){return changeProjectWorkspaceActionImpl(formData);}

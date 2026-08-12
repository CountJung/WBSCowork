"use server";

import { updateUserRoleAction as updateUserRoleActionImpl } from "@/src/features/user-role-change/index.server";

export async function updateUserRoleAction(formData: FormData) {
  return updateUserRoleActionImpl(formData);
}

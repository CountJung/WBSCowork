"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperuserSession } from "@/lib/auth";
import { logError, logInfo, serializeError } from "@/lib/logger";
import { updateUserRole } from "@/lib/repositories/user-repository";
import { manageableUserRoles, type ManageableUserRole } from "@/models/user";

function buildRedirectPath(status: "success" | "error", message: string) {
  const searchParams = new URLSearchParams({
    status,
    message,
  });

  return `/admin/users?${searchParams.toString()}`;
}

function getSingleValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function updateUserRoleAction(formData: FormData) {
  const session = await requireSuperuserSession();

  if (!session) {
    redirect(buildRedirectPath("error", "슈퍼유저만 사용자 권한을 변경할 수 있습니다."));
  }

  const userIdValue = Number(getSingleValue(formData.get("userId")));
  const roleValue = getSingleValue(formData.get("role"));

  if (!Number.isInteger(userIdValue) || userIdValue <= 0) {
    redirect(buildRedirectPath("error", "올바른 사용자 식별자가 전달되지 않았습니다."));
  }

  if (!manageableUserRoles.includes(roleValue as ManageableUserRole)) {
    redirect(buildRedirectPath("error", "변경 가능한 권한은 일반사용자 또는 게스트뿐입니다."));
  }

  let redirectPath: string;

  try {
    const updatedUser = await updateUserRole(userIdValue, roleValue as ManageableUserRole);

    revalidatePath("/admin");
    revalidatePath("/admin/users");

    await logInfo("admin.users", "User role updated", {
      actorEmail: session.user.email ?? null,
      userId: updatedUser.id,
      targetEmail: updatedUser.email,
      nextRole: roleValue,
    });

    redirectPath = buildRedirectPath(
      "success",
      `${updatedUser.name} 계정의 권한을 ${roleValue === "member" ? "일반사용자" : "게스트"}로 변경했습니다.`,
    );
  } catch (error) {
    await logError("admin.users", "User role update failed", {
      actorEmail: session.user.email ?? null,
      targetUserId: userIdValue,
      requestedRole: roleValue,
      error: serializeError(error),
    });

    redirectPath = buildRedirectPath(
      "error",
      error instanceof Error ? error.message : "사용자 권한 변경 중 알 수 없는 오류가 발생했습니다.",
    );
  }

  redirect(redirectPath);
}
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath } from "@/lib/auth";
import { logUserAction, logUserActionFailure } from "@/lib/logger";
import { updateUserRole } from "@/lib/repositories/user-repository";
import { canAccessAdminPanel, adminAssignableRoles, manageableUserRoles, type ManageableUserRole } from "@/models/user";

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
  const session = await getAuthSession();

  if (!session?.user || !canAccessAdminPanel(session.user.role, session.user.isSuperuser)) {
    redirect(getSignInPath("/admin/users"));
  }

  const userIdValue = Number(getSingleValue(formData.get("userId")));
  const roleValue = getSingleValue(formData.get("role"));

  if (!Number.isInteger(userIdValue) || userIdValue <= 0) {
    redirect(buildRedirectPath("error", "올바른 사용자 식별자가 전달되지 않았습니다."));
  }

  // 슈퍼관리자는 admin 포함 전체 역할 부여 가능, 관리자는 guest/member만 부여 가능
  const isSuperuserActor = session.user.isSuperuser;
  const allowedRoles = isSuperuserActor ? manageableUserRoles : adminAssignableRoles;

  if (!(allowedRoles as readonly string[]).includes(roleValue)) {
    const msg = isSuperuserActor
      ? "변경 가능한 권한은 관리자, 일반사용자, 게스트뿐입니다."
      : "관리자는 일반사용자 또는 게스트로만 권한을 변경할 수 있습니다.";
    redirect(buildRedirectPath("error", msg));
  }

  let redirectPath: string;

  try {
    const updatedUser = await updateUserRole(userIdValue, roleValue as ManageableUserRole);

    revalidatePath("/admin");
    revalidatePath("/admin/users");

    await logUserAction("admin.users", {
      actorEmail: session.user.email ?? null,
      action: "user.role.update",
      entityType: "user",
      entityId: updatedUser.id,
      entityLabel: updatedUser.name,
      targetEmail: updatedUser.email,
      metadata: {
        nextRole: roleValue,
      },
    });

    const roleLabel = roleValue === "admin" ? "관리자" : roleValue === "member" ? "일반사용자" : "게스트";
    redirectPath = buildRedirectPath(
      "success",
      `${updatedUser.name} 계정의 권한을 ${roleLabel}로 변경했습니다.`,
    );
  } catch (error) {
    await logUserActionFailure(
      "admin.users",
      {
        actorEmail: session.user.email ?? null,
        action: "user.role.update",
        entityType: "user",
        entityId: userIdValue,
        metadata: {
          requestedRole: roleValue,
        },
      },
      error,
    );

    redirectPath = buildRedirectPath(
      "error",
      error instanceof Error ? error.message : "사용자 권한 변경 중 알 수 없는 오류가 발생했습니다.",
    );
  }

  redirect(redirectPath);
}
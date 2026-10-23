"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthSession, getSignInPath, getUserByEmail, isSuperuserEmail, updateUserRole } from "@/src/entities/user/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";
import { manageableUserRoles, type ManageableUserRole } from "@/src/entities/user";

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

  if (!session?.user?.email) {
    redirect(getSignInPath("/admin/users"));
  }

  const actor=await getUserByEmail(session.user.email).catch(()=>null);
  if(!actor||!session.user.isSuperuser||!isSuperuserEmail(actor.email)) redirect(buildRedirectPath("error","사용자 권한 변경은 슈퍼관리자만 할 수 있습니다."));

  const userIdValue = Number(getSingleValue(formData.get("userId")));
  const roleValue = getSingleValue(formData.get("role"));

  if (!Number.isInteger(userIdValue) || userIdValue <= 0) {
    redirect(buildRedirectPath("error", "올바른 사용자 식별자가 전달되지 않았습니다."));
  }

  if (!(manageableUserRoles as readonly string[]).includes(roleValue)) {
    redirect(buildRedirectPath("error", "변경 가능한 권한은 관리자, 일반사용자, 게스트뿐입니다."));
  }

  let redirectPath: string;

  try {
    const updatedUser = await updateUserRole(userIdValue, roleValue as ManageableUserRole,{userId:actor.id,email:actor.email,isSuperuser:session.user.isSuperuser});

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

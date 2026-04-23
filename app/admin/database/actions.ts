"use server";

import { revalidatePath } from "next/cache";
import { requireSuperuserSession } from "@/lib/auth";
import { getDatabaseAdminStatus, initializeDatabaseSchema, type DatabaseAdminStatus } from "@/lib/database-admin";
import { logUserAction, logUserActionFailure } from "@/lib/logger";
import { upsertUser } from "@/lib/repositories/user-repository";

export type DatabaseAdminActionState = {
  success: boolean | null;
  message: string;
  status: DatabaseAdminStatus;
};

export async function initializeDatabaseAction(
  previousState: DatabaseAdminActionState,
): Promise<DatabaseAdminActionState> {
  const session = await requireSuperuserSession();

  if (!session) {
    return {
      ...previousState,
      success: false,
      message: "슈퍼유저만 DB 생성 작업을 실행할 수 있습니다.",
    };
  }

  try {
    const status = await initializeDatabaseSchema();

    if (session.user.email) {
      await upsertUser({
        email: session.user.email,
        name: session.user.name ?? session.user.email,
        role: session.user.role,
      });
    }

    revalidatePath("/admin/database");
    revalidatePath("/admin");

    await logUserAction("admin.database", {
      actorEmail: session.user.email ?? null,
      action: "database.initialize",
      entityType: "database",
      entityLabel: status.databaseName,
      metadata: {
        tableCount: status.existingTableCount,
      },
    });

    return {
      success: true,
      message: "DB 및 기본 테이블 생성 작업이 완료되었고 현재 슈퍼유저 계정도 users 테이블에 동기화했습니다.",
      status,
    };
  } catch (error) {
    await logUserActionFailure(
      "admin.database",
      {
        actorEmail: session.user.email ?? null,
        action: "database.initialize",
        entityType: "database",
      },
      error,
    );

    return {
      ...previousState,
      success: false,
      message: error instanceof Error ? error.message : "DB 생성 작업 중 알 수 없는 오류가 발생했습니다.",
    };
  }
}

export async function refreshDatabaseStatusAction(
  previousState: DatabaseAdminActionState,
): Promise<DatabaseAdminActionState> {
  const session = await requireSuperuserSession();

  if (!session) {
    return {
      ...previousState,
      success: false,
      message: "슈퍼유저만 DB 상태를 조회할 수 있습니다.",
    };
  }

  try {
    const status = await getDatabaseAdminStatus();

    await logUserAction("admin.database", {
      actorEmail: session.user.email ?? null,
      action: "database.status.refresh",
      entityType: "database",
      entityLabel: status.databaseName,
      metadata: {
        databaseExists: status.databaseExists,
      },
    });

    return {
      success: true,
      message: "DB 상태를 새로고침했습니다.",
      status,
    };
  } catch (error) {
    await logUserActionFailure(
      "admin.database",
      {
        actorEmail: session.user.email ?? null,
        action: "database.status.refresh",
        entityType: "database",
      },
      error,
    );

    return {
      ...previousState,
      success: false,
      message: error instanceof Error ? error.message : "DB 상태 조회 중 알 수 없는 오류가 발생했습니다.",
    };
  }
}
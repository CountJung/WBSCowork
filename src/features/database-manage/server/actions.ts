"use server";

import { retryObjectCleanup } from "@/src/shared/server/object-cleanup/index.server";
import {retryNativeBugFileCleanup} from "@/src/shared/server/native-bug-cleanup/index.server";
import {isHostedRuntime} from "@/src/shared/server/hosted-runtime/index.server";
import { revalidatePath } from "next/cache";
import { requireSuperuserSession, upsertUser } from "@/src/entities/user/index.server";
import { getDatabaseAdminStatus, initializeDatabaseSchema, type DatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { logUserAction, logUserActionFailure } from "@/src/shared/server/logging/index.server";

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
      message: "슈퍼유저만 DB migration을 실행할 수 있습니다.",
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
      message: "Native migration 검증/적용을 마쳤고 현재 슈퍼유저 계정도 users 테이블에 동기화했습니다.",
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

export async function retryStorageCleanupAction(previousState: DatabaseAdminActionState): Promise<DatabaseAdminActionState> {
  const session = await requireSuperuserSession();
  if (!session) return { ...previousState, success: false, message: "슈퍼유저만 저장 파일 정리를 실행할 수 있습니다." };
  if(!isHostedRuntime()){
    let result:Awaited<ReturnType<typeof retryNativeBugFileCleanup>>;
    try{result=await retryNativeBugFileCleanup(100);}
    catch{return {...previousState,success:false,message:"버그 스크린샷 격리 중 오류가 발생했습니다. 이미 이동한 파일도 보존됩니다. 상태를 새로고침하고 운영자에게 확인해 주세요."};}
    const message=`${result.quarantined}개 격리, ${result.protectedFiles}개 참조 보호, ${result.remaining}개 대기, ${result.failed}개 실패입니다. 파일은 영구 삭제하지 않습니다.`;
    try{
      await logUserAction("admin.storage",{actorEmail:session.user.email??null,action:"storage.native_bug_quarantine.retry",entityType:"storage",metadata:result});
      return {success:result.failed===0,message,status:await getDatabaseAdminStatus()};
    }catch{return {...previousState,success:false,message:message+" 처리 후 감사 또는 상태 갱신에 실패했습니다. 실행을 반복하기 전에 상태를 새로고침해 주세요."};}
  }
  try {
    const result = await retryObjectCleanup(100);
    await logUserAction("admin.storage", { actorEmail: session.user.email ?? null, action: "storage.cleanup.retry", entityType: "storage", metadata: result });
    return { success: result.failed === 0, message: `${result.removed}개 정리 완료, ${result.remaining}개 대기, ${result.failed}개 실패(지연 후 재시도)입니다.`, status: await getDatabaseAdminStatus() };
  } catch (error) {
    return { ...previousState, success: false, message: error instanceof Error ? error.message : "저장 파일 정리를 완료하지 못했습니다." };
  }
}

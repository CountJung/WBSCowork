"use server";

import { revalidatePath } from "next/cache";
import { requireSuperuserSession } from "@/lib/auth";
import { saveAdminSettings, type AdminSettingsSnapshot } from "@/lib/admin-settings";
import { logError, logInfo, serializeError } from "@/lib/logger";

export type SettingsActionState = {
  success: boolean | null;
  message: string;
  snapshot: AdminSettingsSnapshot;
};

function getSingleValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function parsePositiveInteger(value: string, label: string) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }

  return parsedValue;
}

function extractEnvEntries(formData: FormData) {
  const entries: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("env:")) {
      continue;
    }

    entries[key.slice(4)] = getSingleValue(value);
  }

  return entries;
}

export async function saveSettingsAction(
  previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await requireSuperuserSession();

  if (!session) {
    return {
      ...previousState,
      success: false,
      message: "슈퍼유저만 세팅을 수정할 수 있습니다.",
    };
  }

  try {
    const entries = extractEnvEntries(formData);

    if (!entries.LOG_DIR?.trim()) {
      throw new Error("로그 디렉터리 경로는 비워 둘 수 없습니다.");
    }

    parsePositiveInteger(entries.UPLOAD_MAX_FILE_SIZE_MB, "첨부파일 최대 용량");
    parsePositiveInteger(entries.LOG_RETENTION_DAYS, "로그 보관 기간");
    parsePositiveInteger(entries.LOG_MAX_FILE_SIZE_MB, "파일당 최대 용량");

    const snapshot = await saveAdminSettings(entries);

    await logInfo("settings", "Admin settings updated", {
      editorEmail: session.user.email ?? null,
      envFilePath: snapshot.envFilePath,
      logDirectoryPath: snapshot.logDirectoryPath,
      logRetentionDays: snapshot.logRetentionDays,
      logMaxFileSizeMb: snapshot.logMaxFileSizeMb,
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/tasks");

    return {
      success: true,
      message: "세팅을 저장했습니다. 인증 공급자와 일부 서버 설정은 즉시 반영되지 않을 수 있어 필요하면 서버를 다시 시작해야 합니다.",
      snapshot,
    };
  } catch (error) {
    await logError("settings", "Admin settings update failed", {
      editorEmail: session.user.email ?? null,
      error: serializeError(error),
    });

    return {
      ...previousState,
      success: false,
      message: error instanceof Error ? error.message : "세팅 저장 중 알 수 없는 오류가 발생했습니다.",
    };
  }
}
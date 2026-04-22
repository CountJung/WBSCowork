import { getRuntimeEnv } from "@/lib/env";
import { getEditableEnvEntries, getEditableEnvFilePath, getEditableEnvGroups, saveEditableEnvEntries, type EditableEnvEntry } from "@/lib/env-file";
import { getAbsoluteLogDirectory, listRecentLogFiles, type LogFileSummary } from "@/lib/logger";

export type AdminSettingsSnapshot = {
  revision: string;
  envEntries: EditableEnvEntry[];
  envFilePath: string;
  envGroups: ReturnType<typeof getEditableEnvGroups>;
  logDirectoryPath: string;
  logRetentionDays: number;
  logMaxFileSizeMb: number;
  logFiles: LogFileSummary[];
};

export async function getAdminSettingsSnapshot(): Promise<AdminSettingsSnapshot> {
  const runtimeEnv = getRuntimeEnv();

  return {
    revision: new Date().toISOString(),
    envEntries: await getEditableEnvEntries(),
    envFilePath: getEditableEnvFilePath(),
    envGroups: getEditableEnvGroups(),
    logDirectoryPath: getAbsoluteLogDirectory(),
    logRetentionDays: runtimeEnv.logging.retentionDays,
    logMaxFileSizeMb: runtimeEnv.logging.maxFileSizeMb,
    logFiles: await listRecentLogFiles(10),
  };
}

export async function saveAdminSettings(entries: Record<string, string>) {
  await saveEditableEnvEntries(entries);

  return getAdminSettingsSnapshot();
}
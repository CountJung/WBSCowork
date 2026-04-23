import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants as fsConstants } from "node:fs";
import { resetRuntimeEnvCache } from "@/lib/env";
import { initializeServerLogging } from "@/lib/logger";

export type EditableEnvEntry = {
  key: string;
  value: string;
  source: "file" | "process" | "default";
};

export type EditableEnvGroup = {
  title: string;
  description: string;
  keys: string[];
};

const editableEnvGroups: EditableEnvGroup[] = [
  {
    title: "앱 설정",
    description: "기본 앱 이름, 런타임 포트, 공개적으로 사용되는 클라이언트 설정입니다.",
    keys: ["NEXT_PUBLIC_APP_NAME", "APP_PORT", "NEXTAUTH_URL"],
  },
  {
    title: "인증 설정",
    description: "Google OAuth와 관리자 계정 관련 설정입니다.",
    keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEXTAUTH_SECRET", "SUPERUSER_EMAIL"],
  },
  {
    title: "데이터베이스 설정",
    description: "MariaDB 연결과 풀 설정입니다.",
    keys: ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_CONNECTION_LIMIT", "DB_CONNECT_TIMEOUT_MS"],
  },
  {
    title: "파일 및 로그 설정",
    description: "업로드 경로와 파일 로그 롤링 설정입니다.",
    keys: ["UPLOAD_DIR", "UPLOAD_MAX_FILE_SIZE_MB", "LOG_DIR", "LOG_RETENTION_DAYS", "LOG_MAX_FILE_SIZE_MB"],
  },
];

const defaultEnvValues: Record<string, string> = {
  NEXT_PUBLIC_APP_NAME: "WBS Task",
  APP_PORT: "3000",
  DB_HOST: "localhost",
  DB_PORT: "3306",
  DB_USER: "root",
  DB_PASSWORD: "password",
  DB_NAME: "wbs_app",
  DB_CONNECTION_LIMIT: "5",
  DB_CONNECT_TIMEOUT_MS: "10000",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  NEXTAUTH_SECRET: "",
  NEXTAUTH_URL: "http://localhost:3000",
  SUPERUSER_EMAIL: "admin@example.com",
  UPLOAD_DIR: "./uploads",
  UPLOAD_MAX_FILE_SIZE_MB: "200",
  LOG_DIR: "./logs",
  LOG_RETENTION_DAYS: "5",
  LOG_MAX_FILE_SIZE_MB: "100",
};

const knownEnvKeys = editableEnvGroups.flatMap((group) => group.keys);

function getWorkspaceRoot() {
  return process.cwd();
}

export function getEditableEnvGroups() {
  return editableEnvGroups;
}

export function getManagedEnvKeys() {
  return knownEnvKeys;
}

export function getEditableEnvFilePath() {
  return path.join(getWorkspaceRoot(), ".env");
}

function getLegacyOverrideEnvFilePath() {
  return path.join(getWorkspaceRoot(), ".env.local");
}

function parseEnvFileContent(fileContent: string) {
  const entries = new Map<string, string>();

  for (const line of fileContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const rawKey = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);

    if (!rawKey) {
      continue;
    }

    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      entries.set(rawKey, rawValue.slice(1, -1).replace(/\\n/g, "\n"));
      continue;
    }

    entries.set(rawKey, rawValue);
  }

  return entries;
}

function serializeEnvValue(value: string) {
  if (value.length === 0) {
    return '""';
  }

  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value).replace(/\n/g, "\\n");
}

async function readEnvFileMap() {
  const envFilePath = getEditableEnvFilePath();

  try {
    await access(envFilePath, fsConstants.F_OK);
  } catch {
    return new Map<string, string>();
  }

  const fileContent = await readFile(envFilePath, "utf8");

  return parseEnvFileContent(fileContent);
}

export async function getLegacyOverrideKeys() {
  const legacyOverrideFilePath = getLegacyOverrideEnvFilePath();

  try {
    await access(legacyOverrideFilePath, fsConstants.F_OK);
  } catch {
    return [];
  }

  const fileContent = await readFile(legacyOverrideFilePath, "utf8");

  return [...parseEnvFileContent(fileContent).keys()].filter((key) => knownEnvKeys.includes(key)).sort();
}

export function getLegacyOverrideEnvPath() {
  return getLegacyOverrideEnvFilePath();
}

async function syncLegacyOverrideFile() {
  const legacyOverrideFilePath = getLegacyOverrideEnvFilePath();

  try {
    await access(legacyOverrideFilePath, fsConstants.F_OK);
  } catch {
    return;
  }

  const fileContent = await readFile(legacyOverrideFilePath, "utf8");
  const legacyEntries = parseEnvFileContent(fileContent);

  for (const key of knownEnvKeys) {
    legacyEntries.delete(key);
  }

  if (legacyEntries.size === 0) {
    await rm(legacyOverrideFilePath, { force: true });
    return;
  }

  const lines = [
    "# Legacy Local Overrides",
    ...[...legacyEntries.entries()].map(([key, value]) => `${key}=${serializeEnvValue(value)}`),
    "",
  ];

  await writeFile(legacyOverrideFilePath, `${lines.join("\n").trim()}\n`, "utf8");
}

export async function getEditableEnvEntries(): Promise<EditableEnvEntry[]> {
  const fileEntries = await readEnvFileMap();
  const extraKeys = [...fileEntries.keys()].filter((key) => !knownEnvKeys.includes(key)).sort();
  const orderedKeys = [...knownEnvKeys, ...extraKeys];

  return orderedKeys.map((key) => {
    if (fileEntries.has(key)) {
      return {
        key,
        value: fileEntries.get(key) ?? "",
        source: "file",
      } satisfies EditableEnvEntry;
    }

    if (typeof process.env[key] === "string") {
      return {
        key,
        value: process.env[key] ?? "",
        source: "process",
      } satisfies EditableEnvEntry;
    }

    return {
      key,
      value: defaultEnvValues[key] ?? "",
      source: "default",
    } satisfies EditableEnvEntry;
  });
}

export async function saveEditableEnvEntries(entries: Record<string, string>) {
  const normalizedEntries = Object.entries(entries)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => key.length > 0);

  const extraKeys = normalizedEntries
    .map(([key]) => key)
    .filter((key) => !knownEnvKeys.includes(key))
    .sort();

  const orderedKeys = [...knownEnvKeys, ...extraKeys].filter((key, index, array) => array.indexOf(key) === index);
  const entryMap = new Map(normalizedEntries);
  const sections = editableEnvGroups.map((group) => ({
    ...group,
    lines: group.keys.map((key) => `${key}=${serializeEnvValue(entryMap.get(key) ?? defaultEnvValues[key] ?? "")}`),
  }));
  const extraLines = extraKeys.map((key) => `${key}=${serializeEnvValue(entryMap.get(key) ?? "")}`);
  const fileLines: string[] = [];

  for (const section of sections) {
    fileLines.push(`# ${section.title}`);
    fileLines.push(...section.lines);
    fileLines.push("");
  }

  if (extraLines.length > 0) {
    fileLines.push("# Additional Settings");
    fileLines.push(...extraLines);
    fileLines.push("");
  }

  await writeFile(getEditableEnvFilePath(), `${fileLines.join("\n").trim()}\n`, "utf8");
  await syncLegacyOverrideFile();

  for (const key of orderedKeys) {
    process.env[key] = entryMap.get(key) ?? defaultEnvValues[key] ?? "";
  }

  resetRuntimeEnvCache();
  await initializeServerLogging();
}
import "server-only";

import { appendFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { inspect } from "node:util";
import { getRuntimeEnv } from "@/lib/env";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFileSummary = {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
};

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: Record<string, unknown>;
};

type LoggerGlobals = typeof globalThis & {
  __wbsLogWriteQueue?: Promise<void>;
  __wbsLoggerInitialized?: boolean;
  __wbsLoggerProcessHandlers?: boolean;
  __wbsBaseConsole?: Pick<typeof console, "debug" | "info" | "warn" | "error" | "log">;
};

const globalForLogger = globalThis as LoggerGlobals;
const logFilePrefix = "application";

function getBaseConsole() {
  if (!globalForLogger.__wbsBaseConsole) {
    globalForLogger.__wbsBaseConsole = {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      log: console.log.bind(console),
    };
  }

  return globalForLogger.__wbsBaseConsole;
}

function getLogConfig() {
  return getRuntimeEnv().logging;
}

function getWorkspaceRoot() {
  return process.cwd();
}

export function getAbsoluteLogDirectory() {
  const logDirectory = getLogConfig().directory;

  return path.isAbsolute(logDirectory)
    ? logDirectory
    : path.join(/* turbopackIgnore: true */ getWorkspaceRoot(), logDirectory);
}

async function ensureLogDirectory() {
  await mkdir(getAbsoluteLogDirectory(), { recursive: true });
}

function formatLogDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildLogFileName(date: Date, index: number) {
  return `${logFilePrefix}-${formatLogDate(date)}-${index}.log`;
}

async function cleanupExpiredLogs() {
  const retentionDays = getLogConfig().retentionDays;
  const expirationTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const logDirectory = getAbsoluteLogDirectory();
  const fileNames = await readdir(logDirectory);

  await Promise.all(
    fileNames.map(async (fileName) => {
      if (!fileName.startsWith(`${logFilePrefix}-`) || !fileName.endsWith(".log")) {
        return;
      }

      const filePath = path.join(logDirectory, fileName);
      const fileStats = await stat(filePath);

      if (fileStats.mtimeMs < expirationTime) {
        await rm(filePath, { force: true });
      }
    }),
  );
}

async function resolveActiveLogFilePath(date: Date) {
  const logDirectory = getAbsoluteLogDirectory();
  const logDate = formatLogDate(date);
  const maxFileSizeBytes = getLogConfig().maxFileSizeMb * 1024 * 1024;
  const fileNames = await readdir(logDirectory);
  const matchingFileNames = fileNames
    .filter((fileName) => fileName.startsWith(`${logFilePrefix}-${logDate}-`) && fileName.endsWith(".log"))
    .sort((leftFileName, rightFileName) => leftFileName.localeCompare(rightFileName, undefined, { numeric: true }));

  if (matchingFileNames.length === 0) {
    return path.join(logDirectory, buildLogFileName(date, 1));
  }

  const lastFileName = matchingFileNames.at(-1)!;
  const lastFilePath = path.join(logDirectory, lastFileName);
  const lastFileStats = await stat(lastFilePath);

  if (lastFileStats.size < maxFileSizeBytes) {
    return lastFilePath;
  }

  const lastFileMatch = lastFileName.match(/-(\d+)\.log$/);
  const nextFileIndex = lastFileMatch ? Number(lastFileMatch[1]) + 1 : matchingFileNames.length + 1;

  return path.join(logDirectory, buildLogFileName(date, nextFileIndex));
}

function queueLogWrite(task: () => Promise<void>) {
  const currentQueue = globalForLogger.__wbsLogWriteQueue ?? Promise.resolve();
  const nextQueue = currentQueue
    .catch(() => undefined)
    .then(task)
    .catch((error) => {
      getBaseConsole().error("[logger] failed to write log entry", error);
    });

  globalForLogger.__wbsLogWriteQueue = nextQueue;

  return nextQueue;
}

function normalizeDetails(details?: Record<string, unknown>) {
  if (!details || Object.keys(details).length === 0) {
    return undefined;
  }

  return details;
}

async function appendLogEntry(entry: LogEntry) {
  await ensureLogDirectory();
  await cleanupExpiredLogs();
  const filePath = await resolveActiveLogFilePath(new Date(entry.timestamp));

  await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
}

function formatConsoleMessage(args: unknown[]) {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }

      return inspect(arg, {
        depth: 5,
        breakLength: 120,
      });
    })
    .join(" ");
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: (error as Error & { digest?: string }).digest,
    };
  }

  return {
    value: inspect(error, { depth: 5, breakLength: 120 }),
  };
}

export async function logEvent(level: LogLevel, source: string, message: string, details?: Record<string, unknown>) {
  await queueLogWrite(() =>
    appendLogEntry({
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details: normalizeDetails(details),
    }),
  );
}

export async function logInfo(source: string, message: string, details?: Record<string, unknown>) {
  await logEvent("info", source, message, details);
}

export async function logWarn(source: string, message: string, details?: Record<string, unknown>) {
  await logEvent("warn", source, message, details);
}

export async function logError(source: string, message: string, details?: Record<string, unknown>) {
  await logEvent("error", source, message, details);
}

export async function listRecentLogFiles(limit = 10): Promise<LogFileSummary[]> {
  await ensureLogDirectory();
  const logDirectory = getAbsoluteLogDirectory();
  const fileNames = await readdir(logDirectory);
  const fileSummaries = await Promise.all(
    fileNames
      .filter((fileName) => fileName.startsWith(`${logFilePrefix}-`) && fileName.endsWith(".log"))
      .map(async (fileName) => {
        const filePath = path.join(logDirectory, fileName);
        const fileStats = await stat(filePath);

        return {
          name: fileName,
          path: filePath,
          sizeBytes: fileStats.size,
          modifiedAt: fileStats.mtime.toISOString(),
        } satisfies LogFileSummary;
      }),
  );

  return fileSummaries
    .sort((leftFile, rightFile) => rightFile.modifiedAt.localeCompare(leftFile.modifiedAt))
    .slice(0, limit);
}

export async function initializeServerLogging() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  await ensureLogDirectory();

  if (!globalForLogger.__wbsLoggerInitialized) {
    const baseConsole = getBaseConsole();
    const consoleMethodMap: Array<[keyof Pick<typeof console, "debug" | "info" | "warn" | "error" | "log">, LogLevel]> = [
      ["debug", "debug"],
      ["info", "info"],
      ["warn", "warn"],
      ["error", "error"],
      ["log", "info"],
    ];

    for (const [methodName, level] of consoleMethodMap) {
      console[methodName] = (...args: unknown[]) => {
        baseConsole[methodName](...args);
        void logEvent(level, "console", formatConsoleMessage(args));
      };
    }

    globalForLogger.__wbsLoggerInitialized = true;
  }

  if (!globalForLogger.__wbsLoggerProcessHandlers) {
    process.on("uncaughtException", (error) => {
      void logError("process", "Uncaught exception", {
        error: serializeError(error),
      });
    });

    process.on("unhandledRejection", (reason) => {
      void logError("process", "Unhandled promise rejection", {
        error: serializeError(reason),
      });
    });

    globalForLogger.__wbsLoggerProcessHandlers = true;
  }

  await logInfo("logger", "Server file logging initialized", {
    directory: getAbsoluteLogDirectory(),
    retentionDays: getLogConfig().retentionDays,
    maxFileSizeMb: getLogConfig().maxFileSizeMb,
  });
}
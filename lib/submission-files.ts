import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeEnv } from "@/lib/env";

export type StoredSubmissionAttachment = {
  absolutePath: string;
  fileMimeType: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
};

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || "attachment";
  const normalizedName = baseName.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+/, "");

  return normalizedName.length > 0 ? normalizedName.slice(0, 120) : "attachment";
}

function assertPathWithinRoot(rootPath: string, targetPath: string) {
  const normalizedRoot = path.resolve(rootPath);
  const normalizedTarget = path.resolve(targetPath);

  if (normalizedTarget !== normalizedRoot && !normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error("업로드 파일 경로가 유효하지 않습니다.");
  }

  return normalizedTarget;
}

export function getAbsoluteUploadDirectory() {
  const uploadDirectory = getRuntimeEnv().uploadDir;

  if (path.isAbsolute(uploadDirectory)) {
    return uploadDirectory;
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), uploadDirectory);
}

export async function saveUploadedSubmissionAttachment(
  file: File,
  input: {
    authorId: number;
    taskId: number;
  },
): Promise<StoredSubmissionAttachment> {
  if (file.size <= 0) {
    throw new Error("첨부파일이 비어 있습니다.");
  }

  const runtimeEnv = getRuntimeEnv();
  const maxFileSizeBytes = runtimeEnv.uploadMaxFileSizeMb * 1024 * 1024;

  if (file.size > maxFileSizeBytes) {
    throw new Error(`첨부파일은 ${runtimeEnv.uploadMaxFileSizeMb}MB 이하만 업로드할 수 있습니다.`);
  }

  const uploadRoot = getAbsoluteUploadDirectory();
  const relativeDirectory = path.join("submissions", String(input.taskId), String(input.authorId));
  const absoluteDirectory = assertPathWithinRoot(uploadRoot, path.join(uploadRoot, relativeDirectory));
  const safeFileName = sanitizeFileName(file.name || "attachment");
  const storedFileName = `${Date.now()}-${randomUUID()}-${safeFileName}`;
  const absolutePath = assertPathWithinRoot(absoluteDirectory, path.join(absoluteDirectory, storedFileName));
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, fileBuffer);

  return {
    absolutePath,
    fileMimeType: file.type || "application/octet-stream",
    fileName: safeFileName,
    filePath: path.relative(uploadRoot, absolutePath).split(path.sep).join("/"),
    fileSizeBytes: file.size,
  };
}

export async function deleteStoredSubmissionAttachment(filePath: string | null | undefined) {
  if (!filePath) {
    return;
  }

  await rm(resolveStoredSubmissionAttachmentPath(filePath), { force: true });
}

export function resolveStoredSubmissionAttachmentPath(filePath: string) {
  const uploadRoot = getAbsoluteUploadDirectory();

  return assertPathWithinRoot(uploadRoot, path.join(uploadRoot, filePath));
}

export async function readStoredSubmissionAttachment(filePath: string) {
  const absolutePath = resolveStoredSubmissionAttachmentPath(filePath);
  const [buffer, fileStats] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);

  return {
    absolutePath,
    buffer,
    fileSizeBytes: fileStats.size,
  };
}
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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

/**
 * 지정된 디렉터리가 비어 있으면 삭제합니다.
 * 업로드 루트 밖으로는 절대 벗어나지 않습니다.
 */
async function removeEmptyDirectory(absoluteDir: string, uploadRoot: string) {
  const normalizedRoot = path.resolve(uploadRoot);
  const normalizedDir = path.resolve(absoluteDir);

  if (normalizedDir === normalizedRoot || !normalizedDir.startsWith(`${normalizedRoot}${path.sep}`)) {
    return;
  }

  try {
    const entries = await readdir(normalizedDir);

    if (entries.length === 0) {
      await rm(normalizedDir, { recursive: true, force: true });
    }
  } catch {
    // 존재하지 않거나 접근 불가한 경우 무시
  }
}

/**
 * 태스크 삭제 후 빈 폴더를 정리합니다.
 * 경로: submissions/{taskId}/
 * 내부에 남은 하위 폴더가 없으면 taskId 디렉터리를 삭제합니다.
 */
export async function cleanupTaskUploadDirectory(taskId: number) {
  const uploadRoot = getAbsoluteUploadDirectory();
  const taskDir = assertPathWithinRoot(uploadRoot, path.join(uploadRoot, "submissions", String(taskId)));

  try {
    const entries = await readdir(taskDir);

    // 하위 authorId 디렉터리도 비어 있으면 순서대로 제거
    for (const entry of entries) {
      const authorDir = path.join(taskDir, entry);
      await removeEmptyDirectory(authorDir, uploadRoot);
    }

    await removeEmptyDirectory(taskDir, uploadRoot);
  } catch {
    // 디렉터리가 없거나 접근 불가한 경우 무시
  }
}

/**
 * 프로젝트 삭제 후 해당 태스크들의 빈 폴더를 정리합니다.
 * taskIds: 프로젝트에 속했던 태스크 ID 목록
 */
export async function cleanupProjectUploadDirectories(taskIds: number[]) {
  for (const taskId of taskIds) {
    await cleanupTaskUploadDirectory(taskId);
  }
}
import { getHostedAttachments, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { queueObjectCleanup, deleteUnreferencedObject, retryObjectCleanup, validateObjectKey } from "@/src/shared/server/object-cleanup/index.server";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";

export type StoredSubmissionAttachment = {
  absolutePath: string;
  fileMimeType: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
};

/**
 * 파일 시스템 저장 경로용 — ASCII 안전 문자만 허용
 */
function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || "attachment";
  const normalizedName = baseName.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+/, "");

  return normalizedName.length > 0 ? normalizedName.slice(0, 120) : "attachment";
}

/**
 * DB 저장·화면 표시용 파일명 — 한글·유니코드 글자/숫자/일반 문장부호 보존
 * 제어 문자, 경로 구분자, OS 예약 문자만 제거한다
 */
function sanitizeDisplayFileName(fileName: string) {
  const baseName = path.basename(fileName).trim() || "attachment";
  // 제어문자(\x00-\x1F, \x7F), 경로 구분자(/\\), OS 예약 문자(:*?"<>|) 제거
  const normalizedName = baseName.replace(/[\x00-\x1F\x7F/\\:*?"<>|]+/g, "_").replace(/^_+/, "");

  return normalizedName.length > 0 ? normalizedName.slice(0, 255) : "attachment";
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

  if (isHostedRuntime()) {
    if (!Number.isSafeInteger(input.taskId) || input.taskId <= 0 || !Number.isSafeInteger(input.authorId) || input.authorId <= 0) throw new Error("Invalid attachment owner or task.");
    const filePath = `submissions/${input.taskId}/${input.authorId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
    await queueObjectCleanup(filePath, 60 * 60 * 1000);
    try {
      // R2 requires a known length. File/Blob retains that length and streams
      // without allocating a second full-file Buffer or ArrayBuffer.
      await getHostedAttachments().put(filePath, file as unknown as import("@cloudflare/workers-types").Blob, {
        httpMetadata: { contentType: "application/octet-stream" },
      });
    } catch (error) {
      await deleteUnreferencedObject(filePath).catch(() => undefined);
      throw error;
    }
    return { absolutePath: filePath, filePath, fileMimeType: file.type || "application/octet-stream", fileName: sanitizeDisplayFileName(file.name), fileSizeBytes: file.size };
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
    // 화면 표시·다운로드용 파일명은 한글·유니코드를 그대로 보존한다
    fileName: sanitizeDisplayFileName(file.name || "attachment"),
    filePath: path.relative(uploadRoot, absolutePath).split(path.sep).join("/"),
    fileSizeBytes: file.size,
  };
}

export async function deleteStoredSubmissionAttachment(filePath: string | null | undefined) {
  if (!filePath) {
    return;
  }

  if (isHostedRuntime()) {
    await deleteUnreferencedObject(filePath);
    return;
  }

  await rm(resolveStoredSubmissionAttachmentPath(filePath), { force: true });
}

export function resolveStoredSubmissionAttachmentPath(filePath: string) {
  const uploadRoot = getAbsoluteUploadDirectory();

  return assertPathWithinRoot(uploadRoot, path.join(uploadRoot, filePath));
}

export async function readStoredSubmissionAttachment(filePath: string) {
  if (isHostedRuntime()) {
    const object = await getHostedAttachments().get(validateObjectKey(filePath));
    if (!object) throw new Error("Attachment object not found.");
    return { absolutePath: filePath, buffer: object.body as unknown as ReadableStream<Uint8Array>, fileSizeBytes: object.size };
  }
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
  if (isHostedRuntime()) { await retryObjectCleanup(); return; }
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

export async function deleteProjectUploadDirectories(taskIds: number[]) {
  if (isHostedRuntime()) {
    for (const taskId of taskIds) {
      if (!Number.isSafeInteger(taskId) || taskId <= 0) throw new Error("Invalid cleanup task.");
      let cursor: string | undefined;
      do {
        const page = await getHostedAttachments().list({ prefix: `submissions/${taskId}/`, limit: 100, cursor });
        for (const object of page.objects) await deleteUnreferencedObject(object.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    }
    return;
  }
  const uploadRoot = getAbsoluteUploadDirectory();

  for (const taskId of taskIds) {
    const taskDirectory = assertPathWithinRoot(uploadRoot, path.join(uploadRoot, "submissions", String(taskId)));
    await rm(taskDirectory, { recursive: true, force: true });
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

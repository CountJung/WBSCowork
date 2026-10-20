import { getHostedAttachments, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { deleteUnreferencedObject, retryObjectCleanup, validateObjectKey } from "@/src/shared/server/object-cleanup/index.server";
import { storePrivateFile, readPrivateFile } from "@/src/shared/server/private-files/index.server";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";

export type StoredSubmissionAttachment = {
  contentHash: string;
  absolutePath: string;
  fileMimeType: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
};

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

  if (!Number.isSafeInteger(input.taskId) || input.taskId <= 0 || !Number.isSafeInteger(input.authorId) || input.authorId <= 0) throw new Error("Invalid attachment owner or task.");

  return storePrivateFile(file, `submissions/${input.taskId}/${input.authorId}`);
}

export async function deleteStoredSubmissionAttachment(filePath: string | null | undefined) {
  if (!filePath) {
    return;
  }

  if (isHostedRuntime()) {
    await deleteUnreferencedObject(filePath);
    return;
  }

  const referenced=await getDatabasePool().query("SELECT EXISTS(SELECT 1 FROM submission_attachments WHERE file_path=? UNION ALL SELECT 1 FROM submissions WHERE file_path=? UNION ALL SELECT 1 FROM submission_revisions WHERE file_path=? UNION ALL SELECT 1 FROM bug_report_screenshots WHERE file_path=?) AS live",[filePath,filePath,filePath,filePath]) as {live:number}[];
  if(!referenced[0]||Number(referenced[0].live))throw new Error("Attachment reference cannot be cleared; native cleanup refused.");
  await rm(resolveStoredSubmissionAttachmentPath(filePath), { force: true });
}

export function resolveStoredSubmissionAttachmentPath(filePath: string) {
  const uploadRoot = getAbsoluteUploadDirectory();

  validateObjectKey(filePath);
  return assertPathWithinRoot(uploadRoot, path.join(uploadRoot, filePath));
}

export const readStoredSubmissionAttachment = readPrivateFile;

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
    if(!Number.isSafeInteger(taskId)||taskId<=0)throw new Error("Invalid cleanup task.");
    const taskDirectory = assertPathWithinRoot(uploadRoot, path.join(uploadRoot, "submissions", String(taskId)));
    const visit=async(directory:string):Promise<void>=>{
      let entries;
      try{entries=await readdir(directory,{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
      for(const entry of entries){
        const target=assertPathWithinRoot(uploadRoot,path.join(directory,entry.name));
        if(entry.isSymbolicLink())throw new Error("Symbolic upload paths cannot be cleaned automatically.");
        if(entry.isDirectory())await visit(target);
        else await deleteStoredSubmissionAttachment(path.relative(uploadRoot,target).split(path.sep).join('/'));
      }
      await removeEmptyDirectory(directory,uploadRoot);
    };
    await visit(taskDirectory);
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

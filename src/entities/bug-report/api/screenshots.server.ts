import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { deleteUnreferencedObject } from "@/src/shared/server/object-cleanup/index.server";
import {stageNativeBugFile,queueNativeBugFileCleanup,quarantineNativeBugFile,NativeBugCleanupError} from "@/src/shared/server/native-bug-cleanup/index.server";
import { storePrivateFile, readPrivateFile, type StoredPrivateFile } from "@/src/shared/server/private-files/index.server";
import { validateScreenshotBytes, type BugScreenshot } from "../model/screenshots";
import type { BugViewer } from "../model/bug-report";
export type StoredBugScreenshot = StoredPrivateFile;
export async function discardBugScreenshot(filePath: string) {
  if (!filePath.startsWith("bugs/")) throw new Error("Invalid screenshot key.");
  if (isHostedRuntime()) return deleteUnreferencedObject(filePath);
  await queueNativeBugFileCleanup(filePath);
  if((await quarantineNativeBugFile(filePath)).state==="referenced")throw new NativeBugCleanupError("referenced");
}
export async function storeBugScreenshots(files: File[], viewer: BugViewer) {
  await validateScreenshotBytes(files);
  const stored: StoredBugScreenshot[] = [];
  try {
    for (const file of files) stored.push(await storePrivateFile(file, `bugs/${viewer.userId}`,isHostedRuntime()?undefined:{beforeWrite:stageNativeBugFile,onWriteFailure:discardBugScreenshot}));
    return stored;
  } catch (error) {
    // Hosted cleanup and native reversible quarantine both retain their durable
    // staging rows if immediate recovery fails. No native file is unlinked here.
    for (const file of stored) await discardBugScreenshot(file.filePath).catch(()=>undefined);
    throw error;
  }
}
export async function listBugScreenshots(reportId: number, viewer: BugViewer, trash = false) {
  return await getDatabasePool().query(`SELECT s.id,s.report_id,s.file_name,s.file_mime_type,s.file_size_bytes FROM bug_report_screenshots s JOIN bug_reports b ON b.id=s.report_id WHERE b.id=? AND ${trash ? "b.trashed_at IS NOT NULL" : "b.trashed_at IS NULL"} AND (?=1 OR b.reporter_id=?) AND (?=0 OR ?=1) ORDER BY s.ordinal`,[reportId, viewer.canReview?1:0,viewer.userId,trash?1:0,viewer.canReview?1:0]) as BugScreenshot[];
}
export async function getBugScreenshot(id: number, viewer: BugViewer) {
  const rows = await getDatabasePool().query(`SELECT s.* FROM bug_report_screenshots s JOIN bug_reports b ON b.id=s.report_id WHERE s.id=? AND (?=1 OR (b.reporter_id=? AND b.trashed_at IS NULL)) LIMIT 1`,[id,viewer.canReview?1:0,viewer.userId]) as (BugScreenshot & {file_path:string;content_hash:string})[];
  return rows[0] ?? null;
}
export const readBugScreenshot = readPrivateFile;

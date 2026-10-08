import { getHostedAttachments, getHostedDatabase, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";

export function validateObjectKey(key: string) {
  if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some((part) => !part || part === "." || part === "..") || /[\x00-\x1f\x7f]/.test(key)) throw new Error("Invalid private attachment key.");
  return key;
}
export async function queueObjectCleanup(key: string, delayMs = 0) {
  validateObjectKey(key);
  await getHostedDatabase().prepare("INSERT INTO file_cleanup_jobs (object_key, not_before) VALUES (?, ?) ON CONFLICT(object_key) DO UPDATE SET not_before = MIN(file_cleanup_jobs.not_before, excluded.not_before)")
    .bind(key, new Date(Date.now() + delayMs).toISOString()).run();
}
export async function objectIsReferenced(key: string) {
  const row = await getHostedDatabase().prepare("SELECT EXISTS(SELECT 1 FROM submission_attachments WHERE file_path = ? UNION ALL SELECT 1 FROM submissions WHERE file_path = ?) AS live").bind(key, key).first<{live:number}>();
  return Boolean(row?.live);
}
export async function deleteUnreferencedObject(key: string) {
  validateObjectKey(key);
  // A response failure after DB commit must never delete a referenced object.
  if (await objectIsReferenced(key)) throw new Error("Attachment is still referenced; storage cleanup refused.");
  await queueObjectCleanup(key);
  await getHostedAttachments().delete(key);
  await getHostedDatabase().prepare("DELETE FROM file_cleanup_jobs WHERE object_key = ?").bind(key).run();
}
export async function retryObjectCleanup(limit = 20) {
  if (!isHostedRuntime()) return { remaining: 0, removed: 0, failed: 0 };
  const db = getHostedDatabase();
  const due = await db.prepare("SELECT object_key, attempts FROM file_cleanup_jobs WHERE not_before <= ? ORDER BY not_before LIMIT ?")
    .bind(new Date().toISOString(), Math.min(100, Math.max(1, limit))).all<{object_key:string; attempts:number}>();
  let removed = 0;
  let failed = 0;
  for (const {object_key:key, attempts} of due.results) {
    try {
      if (await objectIsReferenced(key)) {
        await db.prepare("DELETE FROM file_cleanup_jobs WHERE object_key = ?").bind(key).run();
        continue;
      }
      await deleteUnreferencedObject(key);
      removed++;
    } catch {
      failed++;
      const retryAt = new Date(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(attempts, 8))).toISOString();
      await db.prepare("UPDATE file_cleanup_jobs SET attempts = attempts + 1, not_before = ? WHERE object_key = ?").bind(retryAt, key).run();
    }
  }
  const remaining = await db.prepare("SELECT COUNT(*) AS n FROM file_cleanup_jobs").first<{n:number}>();
  return { remaining: remaining?.n ?? 0, removed, failed };
}
export async function pendingObjectCleanupCount() {
  if (!isHostedRuntime()) return 0;
  return (await getHostedDatabase().prepare("SELECT COUNT(*) AS n FROM file_cleanup_jobs").first<{n:number}>())?.n ?? 0;
}

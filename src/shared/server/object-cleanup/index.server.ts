import { getHostedAttachments, getHostedDatabase, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";

export function validateObjectKey(key: string) {
  if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some((part) => !part || part === "." || part === "..") || /[\x00-\x1f\x7f]/.test(key)) throw new Error("Invalid private attachment key.");
  return key;
}
export async function queueObjectCleanup(key: string, delayMs = 0) {
  validateObjectKey(key);
  const scheduled=new Date(Date.now()+delayMs).toISOString();
  // Retry scheduling never creates, extends, or revives a staging lease.
  await getHostedDatabase().prepare("INSERT INTO file_cleanup_jobs (object_key,not_before,staging_expires_at) VALUES(?,?,?) ON CONFLICT(object_key) DO UPDATE SET not_before=MIN(file_cleanup_jobs.not_before,excluded.not_before),staging_expires_at=CASE WHEN excluded.staging_expires_at IS NULL THEN NULL ELSE file_cleanup_jobs.staging_expires_at END")
    .bind(key,scheduled,delayMs>0?scheduled:null).run();
}
export async function objectIsReferenced(key: string) {
  const row = await getHostedDatabase().prepare("SELECT EXISTS(SELECT 1 FROM submission_attachments WHERE file_path = ? UNION ALL SELECT 1 FROM submissions WHERE file_path = ? UNION ALL SELECT 1 FROM submission_revisions WHERE file_path = ?) AS live").bind(key, key, key).first<{live:number}>();
  if(!row)throw new Error("Attachment reference status unavailable.");
  return Boolean(row.live);
}
export async function deleteUnreferencedObject(key: string) {
  validateObjectKey(key);
  const db=getHostedDatabase();
  // Revoke commit eligibility first. A metadata batch either won already (then it
  // is protected by its live refs), or it can no longer attach this staged key.
  await db.prepare("UPDATE file_cleanup_jobs SET staging_expires_at=NULL WHERE object_key=?").bind(key).run();
  if (await objectIsReferenced(key)) throw new Error("Attachment is still referenced; storage cleanup refused.");
  await queueObjectCleanup(key);
  // If a metadata commit won immediately before the revocation, its references
  // must be checked after the revoked cleanup row is established as well.
  if (await objectIsReferenced(key)) throw new Error("Attachment is still referenced; storage cleanup refused.");
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
      const claimed=await db.prepare("UPDATE file_cleanup_jobs SET staging_expires_at=NULL WHERE object_key=? AND not_before<=? AND (staging_expires_at IS NULL OR staging_expires_at<=?)").bind(key,new Date().toISOString(),new Date().toISOString()).run();
      if(!claimed.meta.changes)continue;
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

import {createHash} from "node:crypto";
import {lstat,mkdir,realpath,rename} from "node:fs/promises";
import path from "node:path";
import type {PoolConnection} from "mariadb";
import {getDatabasePool} from "../database/index.server";
import {isHostedRuntime} from "../hosted-runtime/index.server";
import {privateFilePath,privateUploadRoot,readPrivateFilePrefix} from "../private-files/index.server";
import {validateObjectKey} from "../object-cleanup/index.server";

type Job={object_key:string;quarantine_key:string;content_hash:string;file_size_bytes:number;state:"staged"|"queued"|"quarantined"|"restored";leased:number;due:number};
type CleanupCode="untracked"|"referenced"|"not_due"|"file_missing"|"path_conflict"|"hash_mismatch"|"io_failed";
export class NativeBugCleanupError extends Error {
  constructor(public readonly code:CleanupCode){super("Native screenshot cleanup requires review ("+code+").");this.name="NativeBugCleanupError";}
}
function nativeKey(key:string){
  if(isHostedRuntime())throw new Error("Native screenshot quarantine is unavailable in hosted mode.");
  validateObjectKey(key);
  if(key.length>512||!/^bugs\/[1-9]\d*\/[^/]+$/.test(key))throw new Error("Invalid native screenshot key.");
  return key;
}
const quarantineKey=(key:string)=>"native-bug-quarantine/"+createHash("sha256").update(key).digest("hex")+".file";
const referencesSql="SELECT EXISTS(SELECT 1 FROM bug_report_screenshots WHERE file_path=? UNION ALL SELECT 1 FROM submission_attachments WHERE file_path=? UNION ALL SELECT 1 FROM submissions WHERE file_path=? UNION ALL SELECT 1 FROM submission_revisions WHERE file_path=?) AS live";
async function referenced(connection:PoolConnection,key:string){
  const rows=await connection.query(referencesSql,[key,key,key,key]) as {live:number}[];
  if(!rows[0])throw new NativeBugCleanupError("io_failed");
  return Boolean(Number(rows[0].live));
}
/** No automatic deadlock retry: the callback may have renamed a file before a DB failure. */
async function withJob<T>(key:string,callback:(connection:PoolConnection,job:Job)=>Promise<T>):Promise<T>{
  nativeKey(key);
  const connection=await getDatabasePool().getConnection();
  try{
    await connection.beginTransaction();
    const rows=await connection.query("SELECT *,CASE WHEN staging_expires_at>CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS leased,CASE WHEN not_before<=CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS due FROM native_bug_file_cleanup_jobs WHERE object_key=? FOR UPDATE",[key]) as Job[];
    if(!rows[0])throw new NativeBugCleanupError("untracked");
    if(rows[0].quarantine_key!==quarantineKey(key))throw new NativeBugCleanupError("path_conflict");
    const result=await callback(connection,rows[0]);
    await connection.commit();return result;
  }catch(error){await connection.rollback();throw error;}
  finally{connection.release();}
}
async function fileInfo(key:string){
  const target=privateFilePath(key),root=await realpath(privateUploadRoot());
  // The configured root can itself be a mount/symlink. Child directories cannot
  // redirect quarantine operations outside that resolved root or to another key.
  const parent=await realpath(path.dirname(target));
  const expected=path.join(root,path.dirname(key));
  if(parent!==expected)throw new NativeBugCleanupError("path_conflict");
  try{const info=await lstat(target);if(!info.isFile()||info.isSymbolicLink())throw new NativeBugCleanupError("path_conflict");return {target,info};}
  catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
}
async function matchingFile(key:string,job:Job){
  const file=await fileInfo(key);
  if(!file)return null;
  if(file.info.size!==Number(job.file_size_bytes)||file.info.size>2097152)throw new NativeBugCleanupError("hash_mismatch");
  const stored=await readPrivateFilePrefix(key,2097152,true);
  if(stored.fileSize!==Number(job.file_size_bytes)||stored.bytes.length!==Number(job.file_size_bytes))throw new NativeBugCleanupError("hash_mismatch");
  const hash=createHash("sha256").update(stored.bytes).digest("hex");
  if(hash!==job.content_hash)throw new NativeBugCleanupError("hash_mismatch");
  return file;
}
/** Commit the recovery destination and a one-hour staging lease before native bytes are written. */
export async function stageNativeBugFile(key:string,size:number,hash:string){
  nativeKey(key);
  if(!Number.isSafeInteger(size)||size<1||size>2097152||!/[a-f0-9]{64}/.test(hash)||hash.length!==64)throw new Error("Invalid native screenshot staging metadata.");
  await getDatabasePool().query("INSERT INTO native_bug_file_cleanup_jobs(object_key,quarantine_key,content_hash,file_size_bytes,not_before,staging_expires_at) VALUES(?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 1 HOUR),DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 1 HOUR)) ON DUPLICATE KEY UPDATE object_key=native_bug_file_cleanup_jobs.object_key",[key,quarantineKey(key),hash,size]);
  await withJob(key,async(_connection,job)=>{if(job.state!=="staged"||!Number(job.leased)||job.content_hash!==hash||Number(job.file_size_bytes)!==size)throw new NativeBugCleanupError("not_due");});
}
/** Revoke eligibility permanently; retry/backoff never revives a staging lease. */
export async function queueNativeBugFileCleanup(key:string){
  return withJob(key,async(connection,job)=>{
    if(job.state==="restored")throw new NativeBugCleanupError("path_conflict");
    if(job.state!=="quarantined")await connection.query("UPDATE native_bug_file_cleanup_jobs SET staging_expires_at=NULL,state='queued',not_before=CURRENT_TIMESTAMP WHERE object_key=?",[key]);
  });
}
/** Reversible move only. No unlink/rm or TTL deletion exists in this module. */
export async function quarantineNativeBugFile(key:string):Promise<{state:"quarantined"|"referenced";replayed:boolean}>{
  return withJob(key,async(connection,job)=>{
    if(job.state==="restored")throw new NativeBugCleanupError("path_conflict");
    if(job.state!=="quarantined"&&(!Number(job.due)||Number(job.leased)))throw new NativeBugCleanupError("not_due");
    if(await referenced(connection,key)){
      await connection.query("UPDATE native_bug_file_cleanup_jobs SET staging_expires_at=NULL,state='staged',last_error='referenced' WHERE object_key=?",[key]);
      return {state:"referenced",replayed:false};
    }
    await connection.query("UPDATE native_bug_file_cleanup_jobs SET staging_expires_at=NULL WHERE object_key=?",[key]);
    await mkdir(path.dirname(privateFilePath(job.quarantine_key)),{recursive:true});
    const original=await matchingFile(key,job),quarantined=await matchingFile(job.quarantine_key,job);
    if(original&&quarantined)throw new NativeBugCleanupError("path_conflict");
    if(!original&&!quarantined)throw new NativeBugCleanupError("file_missing");
    if(original){
      // The same job row remains locked during the rename; a second caller cannot
      // overwrite another destination. A retry reconciles the fixed hash/path.
      await rename(original.target,privateFilePath(job.quarantine_key));
      await matchingFile(job.quarantine_key,job);
    }
    await connection.query("UPDATE native_bug_file_cleanup_jobs SET state='quarantined',quarantined_at=COALESCE(quarantined_at,CURRENT_TIMESTAMP),last_error='' WHERE object_key=?",[key]);
    return {state:"quarantined",replayed:!original};
  });
}
/** Explicit internal recovery tool, not an HTTP endpoint or automatic reattachment. */
export async function restoreNativeBugFile(key:string){
  return withJob(key,async(connection,job)=>{
    if(job.state!=="quarantined"&&job.state!=="restored")throw new NativeBugCleanupError("path_conflict");
    if(await referenced(connection,key))throw new NativeBugCleanupError("referenced");
    await mkdir(path.dirname(privateFilePath(key)),{recursive:true});
    const original=await matchingFile(key,job),quarantined=await matchingFile(job.quarantine_key,job);
    if(original&&quarantined)throw new NativeBugCleanupError("path_conflict");
    if(!original&&!quarantined)throw new NativeBugCleanupError("file_missing");
    if(quarantined)await rename(quarantined.target,privateFilePath(key));
    await connection.query("UPDATE native_bug_file_cleanup_jobs SET state='restored',staging_expires_at=NULL,restored_at=COALESCE(restored_at,CURRENT_TIMESTAMP),last_error='' WHERE object_key=?",[key]);
    return {restored:true,replayed:!quarantined};
  });
}
/** Sequential bounded retry. Never expires/removes quarantine copies or restores automatically. */
export async function retryNativeBugFileCleanup(limit=20){
  if(isHostedRuntime())throw new Error("Native screenshot quarantine is unavailable in hosted mode.");
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error("Invalid native cleanup retry limit.");
  const db=getDatabasePool();
  const due=await db.query("SELECT object_key FROM native_bug_file_cleanup_jobs WHERE not_before<=CURRENT_TIMESTAMP AND (state='queued' OR (state='staged' AND staging_expires_at<=CURRENT_TIMESTAMP)) ORDER BY not_before,object_key LIMIT ?",[limit]) as {object_key:string}[];
  let quarantined=0,protectedFiles=0,failed=0;
  for(const {object_key:key} of due){
    try{const result=await quarantineNativeBugFile(key);if(result.state==="quarantined")quarantined++;else protectedFiles++;}
    catch(error){
      failed++;
      const code=error instanceof NativeBugCleanupError?error.code:"io_failed";
      await db.query("UPDATE native_bug_file_cleanup_jobs SET attempts=attempts+1,last_error=?,not_before=DATE_ADD(CURRENT_TIMESTAMP,INTERVAL LEAST(300,POW(2,LEAST(attempts,8))) SECOND) WHERE object_key=? AND state IN ('staged','queued')",[code,key]);
    }
  }
  const rows=await db.query("SELECT COUNT(*) AS n FROM native_bug_file_cleanup_jobs WHERE state='queued' OR (state='staged' AND staging_expires_at IS NOT NULL)") as {n:number}[];
  return {quarantined,protectedFiles,failed,remaining:Number(rows[0]?.n??0)};
}

import { createHash, randomUUID } from "node:crypto";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { projectManagementGuard, type ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { canonicalSnapshotJson, createDigestPeriod, hashDigestSnapshot, type DigestSnapshot, type ReportAudience, type ReportFormat, type ReportPeriod } from "../model/snapshot";

export type ReportRunStatus = "queued" | "running" | "rendered" | "failed" | "skipped";
export type ReportArtifactState = "staged" | "ready" | "quarantining" | "quarantined";
export type ReportRun = { id:number; projectId:number; requestedById:number; scheduleId:number|null; idempotencyKey:string; requestFingerprint:string; status:ReportRunStatus; dryRun:boolean; formats:ReportFormat[]; audienceMode:ReportAudience; period:ReportPeriod; snapshot:DigestSnapshot|null; snapshotHash:string|null;  leaseUntil:string|null; heartbeatAt:string|null; attempts:number; errorCode:string; expiresAt:string; createdAt:string };
export type ReportArtifact = {id:number;runId:number;format:ReportFormat;storageKey:string;sha256:string;sizeBytes:number;state:ReportArtifactState;expiresAt:string;createdAt:string};
export type ReportSchedule = {id:number;projectId:number;createdBy:number;enabled:boolean;timeZone:string;lookbackHours:number;formats:ReportFormat[];audienceMode:"public_only";deliveryMode:"none";version:number;createdAt:string};
export type ClaimReportRunInput = {projectId:number;idempotencyKey:string;fingerprint:string;formats:ReportFormat[];audienceMode:ReportAudience;dryRun:boolean;period:ReportPeriod;expiresAt:string;scheduleId?:number|null};
export type ReportArtifactInput = {format:ReportFormat;storageKey:string;sha256:string;sizeBytes:number;expiresAt:string};
export class ReportLedgerError extends Error {
  constructor(public readonly code:"INVALID_INPUT"|"NOT_FOUND"|"CONFLICT"|"LEASE_LOST"|"MAX_ATTEMPTS"|"UNAVAILABLE") { super(`Report operation failed (${code}).`); this.name="ReportLedgerError"; }
  get status(){return this.code==='NOT_FOUND'?404:this.code==='INVALID_INPUT'?400:this.code==='UNAVAILABLE'?503:409;}
}
const LEASE_MS=120_000,MAX_SNAPSHOT_BYTES=512*1024;
type Row=Record<string,unknown>;
const now=()=>new Date().toISOString();
const leaseDate=(value:string)=>new Date(Date.parse(value)+LEASE_MS).toISOString();
function invalid():never{throw new ReportLedgerError('INVALID_INPUT');}
function positive(value:number){if(!Number.isSafeInteger(value)||value<1)invalid();return value;}
function instant(value:string){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)invalid();return value;}
function digest(value:string){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))invalid();return value;}
function formats(value:ReportFormat[]){if(!Array.isArray(value)||value.length<1||value.length>2||value.some(v=>v!=='docx'&&v!=='pptx')||new Set(value).size!==value.length)invalid();return [...value].sort() as ReportFormat[];}
function identity(viewer:ProjectViewer){const userId=positive(viewer.userId??0),email=typeof viewer.email==='string'?viewer.email.trim().toLowerCase():'';if(!email||email.length>255)throw new ReportLedgerError('NOT_FOUND');return {userId,email,isSuperuser:!!viewer.isSuperuser};}
function scope(viewer:ProjectViewer,alias='r',owner='requested_by'){
  const v=identity(viewer),manage=projectManagementGuard(v,`${alias}.project_id`);
  return {sql:`${manage.sql} AND EXISTS(SELECT 1 FROM users report_identity WHERE report_identity.id=? AND LOWER(report_identity.email)=? AND (${alias}.${owner}=report_identity.id OR (?=1 AND LOWER(report_identity.email)=?)))`,params:[...manage.params,v.userId,v.email,v.isSuperuser?1:0,getRuntimeEnv().auth.superuserEmail??'']};
}
async function query<T=Row[]>(sql:string,params:unknown[]=[]):Promise<T>{
  try{return await getDatabasePool().query(sql,params) as T;}
  catch(error){const code=(error as {code?:string})?.code,message=error instanceof Error?error.message:'';if(code==='ER_DUP_ENTRY'||/UNIQUE constraint failed/.test(message))throw new ReportLedgerError('CONFLICT');throw new ReportLedgerError('UNAVAILABLE');}
}
function parsedFormats(value:unknown){try{return formats(JSON.parse(String(value)) as ReportFormat[]);}catch{throw new ReportLedgerError('UNAVAILABLE');}}
function mapRun(row:Row):ReportRun{
 let snapshot:DigestSnapshot|null=null;
 if(row.snapshot_json!==null){try{const parsed=JSON.parse(String(row.snapshot_json));const json=canonicalSnapshotJson(parsed);if(createHash('sha256').update(json).digest('hex')!==row.snapshot_hash)throw new Error('Invalid snapshot integrity');snapshot=parsed;}catch{throw new ReportLedgerError('UNAVAILABLE');}}
 return {id:Number(row.id),projectId:Number(row.project_id),requestedById:Number(row.requested_by),scheduleId:row.schedule_id===null?null:Number(row.schedule_id),idempotencyKey:String(row.idempotency_key),requestFingerprint:String(row.request_fingerprint),status:row.status as ReportRunStatus,dryRun:!!Number(row.dry_run),formats:parsedFormats(row.formats_json),audienceMode:row.audience_mode as ReportAudience,period:createDigestPeriod(String(row.period_start),String(row.period_end),String(row.snapshot_at),String(row.time_zone)),snapshot,snapshotHash:row.snapshot_hash===null?null:String(row.snapshot_hash),leaseUntil:row.lease_until===null?null:String(row.lease_until),heartbeatAt:row.heartbeat_at===null?null:String(row.heartbeat_at),attempts:Number(row.attempts),errorCode:String(row.error_code),expiresAt:String(row.expires_at),createdAt:String(row.created_at)};
}
function mapArtifact(row:Row):ReportArtifact{return {id:Number(row.id),runId:Number(row.run_id),format:row.format as ReportFormat,storageKey:String(row.storage_key),sha256:String(row.sha256),sizeBytes:Number(row.size_bytes),state:row.state as ReportArtifactState,expiresAt:String(row.expires_at),createdAt:String(row.created_at)};}
function mapSchedule(row:Row):ReportSchedule{return {id:Number(row.id),projectId:Number(row.project_id),createdBy:Number(row.created_by),enabled:!!Number(row.enabled),timeZone:String(row.time_zone),lookbackHours:Number(row.lookback_hours),formats:parsedFormats(row.formats_json),audienceMode:'public_only',deliveryMode:'none',version:Number(row.version),createdAt:String(row.created_at)};}
export async function getRunForViewer(viewer:ProjectViewer,id:number):Promise<ReportRun|null>{const s=scope(viewer);const rows=await query(`SELECT r.* FROM project_report_runs r WHERE r.id=? AND ${s.sql} LIMIT 1`,[positive(id),...s.params]);return rows[0]?mapRun(rows[0]):null;}
export async function listRunsForViewer(viewer:ProjectViewer,projectId:number,limit=20){const s=scope(viewer);if(!Number.isSafeInteger(limit)||limit<1||limit>20)invalid();return (await query(`SELECT r.* FROM project_report_runs r WHERE r.project_id=? AND ${s.sql} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`,[positive(projectId),...s.params,limit])).map(mapRun);}
export async function listArtifactsForRun(viewer:ProjectViewer,runId:number){const s=scope(viewer);return (await query(`SELECT a.* FROM project_report_artifacts a JOIN project_report_runs r ON r.id=a.run_id WHERE r.id=? AND ${s.sql} ORDER BY a.id`,[positive(runId),...s.params])).map(mapArtifact);}
export async function getArtifactForViewer(viewer:ProjectViewer,id:number):Promise<ReportArtifact|null>{const s=scope(viewer),at=now();const rows=await query(`SELECT a.* FROM project_report_artifacts a JOIN project_report_runs r ON r.id=a.run_id WHERE a.id=? AND a.state='ready' AND a.expires_at>? AND r.expires_at>? AND r.status='rendered' AND ${s.sql} LIMIT 1`,[positive(id),at,at,...s.params]);return rows[0]?mapArtifact(rows[0]):null;}
/** One atomic unique INSERT wins. A duplicate returns stored work without rerendering. */
export async function claimReportRun(viewer:ProjectViewer,input:ClaimReportRunInput):Promise<{run:ReportRun;deduplicated:boolean;leaseToken?:string}>{
 const v=identity(viewer),projectId=positive(input.projectId),key=digest(input.idempotencyKey),fingerprint=digest(input.fingerprint),at=now(),token=randomUUID();
 const period=createDigestPeriod(input.period.start,input.period.end,input.period.snapshotAt,input.period.timeZone),expires=instant(input.expiresAt),fmts=formats(input.formats);
 if(!['public_only','requester_scope'].includes(input.audienceMode)||typeof input.dryRun!=='boolean'||expires<=at||expires<=period.snapshotAt)invalid();
 const scheduleId=input.scheduleId==null?null:positive(input.scheduleId),manage=projectManagementGuard(v,'p.id');
 if(scheduleId!==null){const schedule=await getReportScheduleForTrigger(scheduleId);if(!schedule||schedule.schedule.projectId!==projectId||schedule.schedule.createdBy!==v.userId||input.audienceMode!=='public_only')throw new ReportLedgerError('NOT_FOUND');}
 let inserted=false;
 try{const result=await query<{affectedRows?:number}>(`INSERT INTO project_report_runs(project_id,requested_by,schedule_id,idempotency_key,request_fingerprint,status,dry_run,formats_json,audience_mode,time_zone,period_start,period_end,snapshot_at,lease_token,lease_until,heartbeat_at,attempts,expires_at,created_at)
 SELECT p.id,?,?,?,?, 'running',?,?,?,?,?,?,?,?,?,?,1,?,? FROM projects p JOIN users creator ON creator.id=? AND LOWER(creator.email)=? WHERE p.id=? AND ${manage.sql}`,[v.userId,scheduleId,key,fingerprint,input.dryRun?1:0,JSON.stringify(fmts),input.audienceMode,period.timeZone,period.start,period.end,period.snapshotAt,token,leaseDate(at),at,expires,at,v.userId,v.email,projectId,...manage.params]);inserted=Number(result.affectedRows)===1;}catch(error){if(!(error instanceof ReportLedgerError)||error.code!=='CONFLICT')throw error;}
 const s=scope(v),rows=await query(`SELECT r.* FROM project_report_runs r WHERE r.idempotency_key=? AND ${s.sql} LIMIT 1`,[key,...s.params]);if(!rows[0])throw new ReportLedgerError('NOT_FOUND');const run=mapRun(rows[0]);if(run.requestFingerprint!==fingerprint)throw new ReportLedgerError('CONFLICT');return {run,deduplicated:!inserted,...(inserted?{leaseToken:token}:{})};
}
async function leasedUpdate(runId:number,leaseToken:string,viewer:ProjectViewer,setSql:string,setParams:unknown[],conditionSql='',conditionParams:unknown[]=[]){
 if(typeof leaseToken!=='string'||!/^[0-9a-f-]{36}$/.test(leaseToken))invalid();const s=scope(viewer,'project_report_runs'),at=now();
 const result=await query<{affectedRows?:number}>(`UPDATE project_report_runs SET ${setSql} WHERE id=? AND status='running' AND lease_token=? AND lease_until>? AND expires_at>? AND ${s.sql} ${conditionSql}`,[...setParams,positive(runId),leaseToken,at,at,...s.params,...conditionParams]);
 if(Number(result.affectedRows)!==1){const rows=await query(`SELECT id FROM project_report_runs WHERE id=? AND status='running' AND lease_token=? AND lease_until>? AND expires_at>? AND ${s.sql} ${conditionSql}`,[runId,leaseToken,at,at,...s.params,...conditionParams]);if(!rows.length)throw new ReportLedgerError('LEASE_LOST');}
}
export async function heartbeatRun(runId:number,leaseToken:string,viewer:ProjectViewer){const at=now();await leasedUpdate(runId,leaseToken,viewer,'heartbeat_at=?,lease_until=?',[at,leaseDate(at)]);}
export async function storeRunSnapshot(runId:number,leaseToken:string,snapshot:DigestSnapshot,hash:string,viewer:ProjectViewer){
 const json=canonicalSnapshotJson(snapshot);if(new TextEncoder().encode(json).byteLength>MAX_SNAPSHOT_BYTES||await hashDigestSnapshot(snapshot)!==digest(hash))invalid();
 const run=await getRunForViewer(viewer,runId);if(!run)throw new ReportLedgerError('NOT_FOUND');if(run.projectId!==snapshot.project.id||run.requestedById!==snapshot.requestedById||run.audienceMode!==snapshot.audienceMode||run.period.start!==snapshot.period.start||run.period.end!==snapshot.period.end||run.period.snapshotAt!==snapshot.period.snapshotAt||run.period.timeZone!==snapshot.period.timeZone)invalid();
 await leasedUpdate(runId,leaseToken,viewer,'snapshot_json=?,snapshot_hash=?',[json,hash],'AND (snapshot_hash IS NULL OR snapshot_hash=?)',[hash]);
}
function artifactWriteInput(runId:number,leaseToken:string,input:ReportArtifactInput,viewer:ProjectViewer){
 const id=positive(runId),s=scope(viewer),at=now(),expires=instant(input.expiresAt);
 if(typeof leaseToken!=='string'||!/^[0-9a-f-]{36}$/.test(leaseToken)||!['docx','pptx'].includes(input.format)||!Number.isSafeInteger(input.sizeBytes)||input.sizeBytes<1||input.sizeBytes>8*1024*1024||expires<=at||typeof input.storageKey!=='string')invalid();
 const keyPattern=new RegExp(`^reports/v1/${id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.${input.format}$`);
 if(keyPattern.exec(input.storageKey)?.[0]!==input.storageKey||typeof input.sha256!=='string'||input.sha256.length!==64)invalid();digest(input.sha256);
 const sql=`r.id=? AND r.status='running' AND r.dry_run=0 AND r.snapshot_hash IS NOT NULL AND r.lease_token=? AND r.lease_until>? AND r.expires_at>=? AND (r.formats_json=? OR r.formats_json='["docx","pptx"]') AND ${s.sql}`;
 return {at,expires,sql,params:[id,leaseToken,at,expires,JSON.stringify([input.format]),...s.params]};
}
async function artifactWriteResult(runId:number,input:ReportArtifactInput,guard:ReturnType<typeof artifactWriteInput>,readyOnly:boolean){
 const rows=await query(`SELECT a.* FROM project_report_artifacts a JOIN project_report_runs r ON r.id=a.run_id WHERE ${guard.sql} AND a.format=? LIMIT 1`,[...guard.params,input.format]);
 const row=rows[0]?mapArtifact(rows[0]):null;
 if(!row)throw new ReportLedgerError('LEASE_LOST');
 if(row.runId!==runId||row.storageKey!==input.storageKey||row.sha256!==input.sha256||row.sizeBytes!==input.sizeBytes||row.expiresAt!==guard.expires||!(readyOnly?row.state==='ready':row.state==='staged'||row.state==='ready'))throw new ReportLedgerError('CONFLICT');
 return row;
}
/** Durable intent precedes file I/O. An uncertain write keeps its exact key and fingerprint discoverable. */
export async function reserveReportArtifact(runId:number,leaseToken:string,input:ReportArtifactInput,viewer:ProjectViewer):Promise<ReportArtifact>{
 const guard=artifactWriteInput(runId,leaseToken,input,viewer);
 try{await query(`INSERT INTO project_report_artifacts(run_id,format,storage_key,sha256,size_bytes,state,expires_at,created_at) SELECT r.id,?,?,?,?,'staged',?,? FROM project_report_runs r WHERE ${guard.sql}`,[input.format,input.storageKey,input.sha256,input.sizeBytes,guard.expires,guard.at,...guard.params]);}
 catch(error){if(!(error instanceof ReportLedgerError)||error.code!=='CONFLICT')throw error;}
 return artifactWriteResult(runId,input,guard,false);
}
/** Finalize only the reserved bytes; never inserts an untracked ready artifact. */
export async function recordReportArtifact(runId:number,leaseToken:string,input:ReportArtifactInput,viewer:ProjectViewer):Promise<ReportArtifact>{
 const guard=artifactWriteInput(runId,leaseToken,input,viewer);
 await query(`UPDATE project_report_artifacts SET state='ready' WHERE run_id=? AND format=? AND storage_key=? AND sha256=? AND size_bytes=? AND expires_at=? AND state='staged' AND EXISTS(SELECT 1 FROM project_report_runs r WHERE r.id=project_report_artifacts.run_id AND ${guard.sql})`,[runId,input.format,input.storageKey,input.sha256,input.sizeBytes,guard.expires,...guard.params]);
 return artifactWriteResult(runId,input,guard,true);
}
export async function completeRun(runId:number,leaseToken:string,viewer:ProjectViewer){
 await leasedUpdate(runId,leaseToken,viewer,"status='rendered',lease_token=NULL,lease_until=NULL,error_code=''",[],"AND snapshot_hash IS NOT NULL AND (dry_run=1 OR ((formats_json='[\"pptx\"]' OR EXISTS(SELECT 1 FROM project_report_artifacts a WHERE a.run_id=project_report_runs.id AND a.format='docx' AND a.state='ready')) AND (formats_json='[\"docx\"]' OR EXISTS(SELECT 1 FROM project_report_artifacts a WHERE a.run_id=project_report_runs.id AND a.format='pptx' AND a.state='ready'))))");
}
export async function failRun(runId:number,leaseToken:string,errorCode:string,viewer:ProjectViewer){if(typeof errorCode!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(errorCode))invalid();await leasedUpdate(runId,leaseToken,viewer,"status='failed',lease_token=NULL,lease_until=NULL,error_code=?",[errorCode]);}
export async function recoverRunForViewer(viewer:ProjectViewer,runId:number):Promise<{run:ReportRun;deduplicated:boolean;leaseToken?:string}>{
 const s=scope(viewer,'project_report_runs'),at=now(),token=randomUUID();
 const updated=await query<{affectedRows?:number}>(`UPDATE project_report_runs SET status='running',lease_token=?,lease_until=?,heartbeat_at=?,attempts=attempts+1,error_code='' WHERE id=? AND (status='failed' OR (status='running' AND lease_until<=?)) AND expires_at>? AND attempts<3 AND ${s.sql}`,[token,leaseDate(at),at,positive(runId),at,at,...s.params]);
 if(Number(updated.affectedRows)===1){const run=await getRunForViewer(viewer,runId);if(!run)throw new ReportLedgerError('NOT_FOUND');return {run,deduplicated:false,leaseToken:token};}
 await query(`UPDATE project_report_runs SET status='failed',lease_token=NULL,lease_until=NULL,error_code='MAX_ATTEMPTS' WHERE id=? AND (status='failed' OR (status='running' AND lease_until<=?)) AND attempts>=3 AND ${s.sql}`,[runId,at,...s.params]);
 const run=await getRunForViewer(viewer,runId);if(!run)throw new ReportLedgerError('NOT_FOUND');return {run,deduplicated:true};
}
export async function listExpiringArtifactsForViewer(viewer:ProjectViewer,projectId:number,limit=20){if(!Number.isSafeInteger(limit)||limit<1||limit>20)invalid();const s=scope(viewer);return (await query(`SELECT a.* FROM project_report_artifacts a JOIN project_report_runs r ON r.id=a.run_id WHERE r.project_id=? AND a.state IN ('staged','ready','quarantining') AND a.expires_at<=? AND ${s.sql} ORDER BY a.expires_at,a.id LIMIT ?`,[positive(projectId),now(),...s.params,limit])).map(mapArtifact);}
async function artifactState(viewer:ProjectViewer,artifactId:number,from:ReportArtifactState,to:ReportArtifactState){
 const s=scope(viewer),at=now();const result=await query<{affectedRows?:number}>(`UPDATE project_report_artifacts SET state=? WHERE id=? AND state=? AND expires_at<=? AND EXISTS(SELECT 1 FROM project_report_runs r WHERE r.id=project_report_artifacts.run_id AND ${s.sql})`,[to,positive(artifactId),from,at,...s.params]);
 if(Number(result.affectedRows)!==1)throw new ReportLedgerError('CONFLICT');
}
export const markArtifactQuarantining=(viewer:ProjectViewer,id:number,from:'ready'|'staged'='ready')=>artifactState(viewer,id,from,'quarantining');
export const markArtifactQuarantined=(viewer:ProjectViewer,id:number)=>artifactState(viewer,id,'quarantining','quarantined');
export async function createReportSchedule(viewer:ProjectViewer,input:{projectId:number;timeZone:string;lookbackHours:number;formats:ReportFormat[]}):Promise<ReportSchedule>{
 const v=identity(viewer),at=now(),projectId=positive(input.projectId),manage=projectManagementGuard(v,'p.id');if(!Number.isSafeInteger(input.lookbackHours)||input.lookbackHours<1||input.lookbackHours>744)invalid();const period=createDigestPeriod(new Date(Date.parse(at)-3600000),at,at,input.timeZone),fmts=formats(input.formats);
 const result=await query<{insertId?:number}>(`INSERT INTO project_report_schedules(project_id,created_by,enabled,time_zone,lookback_hours,formats_json,audience_mode,delivery_mode,version,created_at) SELECT p.id,?,0,?,?,?,'public_only','none',1,? FROM projects p JOIN users creator ON creator.id=? AND LOWER(creator.email)=? WHERE p.id=? AND ${manage.sql}`,[v.userId,period.timeZone,input.lookbackHours,JSON.stringify(fmts),at,v.userId,v.email,projectId,...manage.params]);
 const schedules=await listReportSchedules(viewer,projectId);const schedule=schedules.find(s=>s.id===Number(result.insertId));if(!schedule)throw new ReportLedgerError('NOT_FOUND');return schedule;
}
export async function listReportSchedules(viewer:ProjectViewer,projectId:number){const s=scope(viewer,'s','created_by');return (await query(`SELECT s.* FROM project_report_schedules s WHERE s.project_id=? AND ${s.sql} ORDER BY s.id DESC LIMIT 20`,[positive(projectId),...s.params])).map(mapSchedule);}
/** Token authorization belongs to the trigger adapter. No API here enables a schedule. */
export async function getReportScheduleForTrigger(scheduleId:number):Promise<{schedule:ReportSchedule;viewer:ProjectViewer}|null>{
 const rows=await query(`SELECT s.*,u.email AS creator_email FROM project_report_schedules s JOIN users u ON u.id=s.created_by WHERE s.id=? AND s.enabled=1 AND s.audience_mode='public_only' AND s.delivery_mode='none' LIMIT 1`,[positive(scheduleId)]);if(!rows[0])return null;
 const row=rows[0],email=String(row.creator_email).trim().toLowerCase(),viewer={userId:Number(row.created_by),email,isSuperuser:email===(getRuntimeEnv().auth.superuserEmail??'').trim().toLowerCase()},s=scope(viewer,'s','created_by');
 const valid=await query(`SELECT s.id FROM project_report_schedules s WHERE s.id=? AND ${s.sql} LIMIT 1`,[scheduleId,...s.params]);return valid.length?{schedule:mapSchedule(row),viewer}:null;
}

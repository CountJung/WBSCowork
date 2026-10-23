/** Report schema/ledger regression. Ephemeral D1 and fresh retained loopback *_test MariaDB only. */
import '../tests/helpers/bootstrap';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare,Log,LogLevel} from 'miniflare';
import {createConnection} from 'mariadb';
import {assertTestDatabaseName,testDatabaseEnv} from '../tests/helpers/test-env';
import {runNativeMigrations,verifyNativeSchema,migrationChecksum,nativeMigrationManifest} from '../src/shared/server/database-admin/native-migrations.server';
import {runWithHostedBindings} from '../src/shared/server/hosted-runtime/index.server';
import {closeDatabasePool} from '../src/shared/server/database/index.server';
import {createDigestSnapshot,hashDigestSnapshot} from '../src/entities/project-report';
import {reportFixture} from '../tests/helpers/project-report-fixture';
import * as ledger from '../src/entities/project-report/api/ledger.server';

type Row=Record<string,unknown>;
type Query=(sql:string,params?:unknown[])=>Promise<Row[]>;
let checks=0;
function check(value:unknown,label:string){assert.ok(value,label);checks++;console.log('PASS '+label);}
async function denies(run:()=>Promise<unknown>,label:string){await assert.rejects(run);checks++;console.log('PASS '+label);}
const args=process.argv.slice(2);if(args.length>1||args.some(a=>!['--d1','--maria'].includes(a)))throw new Error('Use --d1 or --maria, or no argument.');
const su={userId:901,email:'superuser@example.test',isSuperuser:true},a={userId:902,email:'report-admin-a@example.test',isSuperuser:false},b={userId:903,email:'report-admin-b@example.test',isSuperuser:false},member={userId:904,email:'report-member@example.test',isSuperuser:false},other={userId:905,email:'report-admin-c@example.test',isSuperuser:false};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const expiry=()=>new Date(Date.now()+7*86400000).toISOString();
async function seed(q:Query){
 await q("INSERT INTO users(id,email,name,role) VALUES(901,'superuser@example.test','Synthetic SU','guest'),(902,'report-admin-a@example.test','Synthetic admin A','admin'),(903,'report-admin-b@example.test','Synthetic admin B','admin'),(904,'report-member@example.test','Synthetic member','member'),(905,'report-admin-c@example.test','Synthetic admin C','admin')");
 await q("INSERT INTO projects(id,name,start_date,end_date,access_mode) VALUES(101,'Preserved project A','2026-10-01','2026-12-01','members_only'),(102,'Preserved project B','2026-10-01','2026-12-01','members_only')");
 await q('INSERT INTO project_members(project_id,user_id) VALUES(101,902),(102,903),(101,904),(101,905)');
 await q("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(201,101,'Preserved task','2026-10-01','2026-12-01')");
 await q("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(301,201,904,'PRESERVED_PRIVATE_REPORT_SOURCE','private')");
}
async function baseline(q:Query){return JSON.stringify(await Promise.all(['SELECT id,email,role FROM users ORDER BY id','SELECT id,name,access_mode FROM projects ORDER BY id','SELECT id,project_id,title FROM tasks ORDER BY id','SELECT id,task_id,content,visibility FROM submissions ORDER BY id','SELECT project_id,user_id,active FROM project_members ORDER BY project_id,user_id'].map(sql=>q(sql))));}
function input(label:string,dryRun=false,formats:('docx'|'pptx')[]=['docx']):ledger.ClaimReportRunInput{const period=createDigestSnapshot(reportFixture()).period;return {projectId:101,idempotencyKey:hash(randomUUID()+label),fingerprint:hash(label),formats,audienceMode:'public_only',dryRun,period,expiresAt:expiry()};}
async function snapshot(runId:number,token:string){const fixture=reportFixture();fixture.requestedById=a.userId;const value=createDigestSnapshot(fixture),digest=await hashDigestSnapshot(value);await ledger.storeRunSnapshot(runId,token,value,digest,a);return {value,digest};}
function artifact(runId:number,format:'docx'|'pptx',expiresAt:string){return {format,storageKey:`reports/v1/${runId}/${randomUUID()}.${format}`,sha256:hash('synthetic-'+format),sizeBytes:120,expiresAt};}
async function commitArtifact(...args:Parameters<typeof ledger.recordReportArtifact>){await ledger.reserveReportArtifact(...args);return ledger.recordReportArtifact(...args);}
async function suite(q:Query,label:string){
 const before=await baseline(q),claimInput=input(label),parallel=await Promise.all(Array.from({length:8},()=>ledger.claimReportRun(a,claimInput))),winner=parallel.find(r=>!r.deduplicated)!;
 check(parallel.filter(r=>!r.deduplicated).length===1&&new Set(parallel.map(r=>r.run.id)).size===1,label+': parallel duplicate claim creates one run and one lease');
 check(winner.run.attempts===1&&!!winner.leaseToken&&!('leaseToken' in winner.run),label+': server lease is returned only to the claim winner');
 const id=winner.run.id,token=winner.leaseToken!;
 await denies(()=>ledger.claimReportRun(a,{...claimInput,fingerprint:hash('conflict')}),label+': same key with different fingerprint rejected');
 check(await ledger.getRunForViewer(other,id)===null,label+': another administrator in the same project cannot read requester report');
 check(await ledger.getRunForViewer(b,id)===null,label+': cross-project administrator denied');
 check(await ledger.getRunForViewer({...member,isSuperuser:true},id)===null,label+': forged superuser flag without configured identity denied');
 check(await ledger.getRunForViewer({...a,email:su.email,isSuperuser:true},id)===null,label+': inconsistent id/email cannot borrow configured superuser scope');
 check((await ledger.getRunForViewer(su,id))?.id===id,label+': configured SU retains access with guest DB role and no roster');
 await q("UPDATE users SET role='guest' WHERE id=902");check(await ledger.getRunForViewer(a,id)===null,label+': current DB administrator downgrade is immediate');await q("UPDATE users SET role='admin' WHERE id=902");
 await q('UPDATE project_members SET active=0 WHERE project_id=101 AND user_id=902');check(await ledger.getRunForViewer(a,id)===null,label+': project membership revocation is immediate');await q('UPDATE project_members SET active=1 WHERE project_id=101 AND user_id=902');
 const snap=await snapshot(id,token);await ledger.storeRunSnapshot(id,token,snap.value,snap.digest,a);check((await ledger.getRunForViewer(a,id))?.snapshotHash===snap.digest,label+': canonical snapshot stored and repeated without mutation');
 await denies(()=>ledger.storeRunSnapshot(id,token,snap.value,hash('wrong'),a),label+': snapshot hash mismatch rejected');
 await ledger.heartbeatRun(id,token,a);check((await ledger.getRunForViewer(a,id))?.status==='running',label+': owner lease heartbeat retains running claim');
 await denies(()=>ledger.reserveReportArtifact(id,token,artifact(id,'pptx',claimInput.expiresAt),a),label+': unrequested artifact reservation rejected');
 const artInput=artifact(id,'docx',claimInput.expiresAt);
 await denies(()=>ledger.recordReportArtifact(id,token,artInput,a),label+': finalization cannot insert an unreserved artifact');
 const staged=await ledger.reserveReportArtifact(id,token,artInput,a);
 check(staged.state==='staged'&&await ledger.getArtifactForViewer(a,staged.id)===null,label+': reservation tracks bytes before storage and staged artifact is not downloadable');
 await denies(()=>ledger.completeRun(id,token,a),label+': staged artifact cannot complete a run');
 await denies(()=>ledger.reserveReportArtifact(id,token,{...artInput,sha256:hash('changed-fingerprint')},a),label+': staged reservation fingerprint cannot be replaced');
 check((await ledger.reserveReportArtifact(id,token,artInput,a)).id===staged.id,label+': identical staged reservation is idempotent');
 const art=await ledger.recordReportArtifact(id,token,artInput,a);await commitArtifact(id,token,artInput,a);
 check((await ledger.listArtifactsForRun(a,id)).length===1,label+': run and format artifact insert is idempotent');
 check(await ledger.getArtifactForViewer(a,art.id)===null,label+': incomplete run artifact is not downloadable');
 await ledger.completeRun(id,token,a);check((await ledger.getRunForViewer(a,id))?.status==='rendered'&&(await ledger.getArtifactForViewer(a,art.id))?.sha256===artInput.sha256,label+': completed run exposes exact original integrity metadata');
 check(await ledger.getArtifactForViewer(other,art.id)===null&&await ledger.getArtifactForViewer(b,art.id)===null,label+': artifact requester and cross-project scope both enforced');
 await q('UPDATE project_members SET active=0 WHERE project_id=101 AND user_id=902');check(await ledger.getArtifactForViewer(a,art.id)===null,label+': artifact re-request after scope revocation denied');await q('UPDATE project_members SET active=1 WHERE project_id=101 AND user_id=902');
 await q('UPDATE project_report_artifacts SET expires_at=? WHERE id=?',['2026-01-01T00:00:00.000Z',art.id]);check(await ledger.getArtifactForViewer(a,art.id)===null,label+': expired artifact denied');
 check((await ledger.listExpiringArtifactsForViewer(a,101)).some(r=>r.id===art.id),label+': bounded retention selection uses current scope');
 await ledger.markArtifactQuarantining(a,art.id);await ledger.markArtifactQuarantined(a,art.id);check((await ledger.listArtifactsForRun(a,id))[0].state==='quarantined'&&Number((await q('SELECT COUNT(*) AS n FROM project_report_artifacts WHERE id=?',[art.id]))[0].n)===1,label+': quarantine CAS preserves artifact metadata rather than deleting');
 const partial=await ledger.claimReportRun(a,input(label+'partial',false,['docx','pptx'])),partialId=partial.run.id,partialToken=partial.leaseToken!;const partialSnapshot=await snapshot(partialId,partialToken);const partialArt=await commitArtifact(partialId,partialToken,artifact(partialId,'docx',partial.run.expiresAt),a);
 await denies(()=>ledger.completeRun(partialId,partialToken,a),label+': all requested formats are required before completion');
 await ledger.failRun(partialId,partialToken,'SYNTHETIC_RENDER_FAILURE',a);
 const retries=await Promise.all(Array.from({length:6},()=>ledger.recoverRunForViewer(a,partialId))),retry=retries.find(r=>!r.deduplicated)!;
 check(retries.filter(r=>!r.deduplicated).length===1&&retry.run.attempts===2&&retry.run.snapshotHash===partialSnapshot.digest,label+': explicit failed recovery CAS has one winner and reuses immutable snapshot');
 check((await ledger.listArtifactsForRun(a,partialId))[0].id===partialArt.id,label+': partial artifact retained for recovery');
 await denies(()=>ledger.reserveReportArtifact(partialId,partialToken,{format:partialArt.format,storageKey:partialArt.storageKey,sha256:partialArt.sha256,sizeBytes:partialArt.sizeBytes,expiresAt:partialArt.expiresAt},a),label+': stale owner cannot replay artifact reservation');await denies(()=>ledger.heartbeatRun(partialId,partialToken,a),label+': stale owner heartbeat rejected');await denies(()=>ledger.completeRun(partialId,partialToken,a),label+': stale owner completion rejected');
 await commitArtifact(partialId,retry.leaseToken!,artifact(partialId,'pptx',retry.run.expiresAt),a);await ledger.completeRun(partialId,retry.leaseToken!,a);check((await ledger.getRunForViewer(a,partialId))?.status==='rendered',label+': recovered run completes after missing format only');
 const stale=await ledger.claimReportRun(a,input(label+'stale'));await q('UPDATE project_report_runs SET lease_until=? WHERE id=?',['2026-01-01T00:00:00.000Z',stale.run.id]);const second=await ledger.recoverRunForViewer(a,stale.run.id);check(second.run.attempts===2&&!!second.leaseToken,label+': expired lease can be reclaimed explicitly');
 await q('UPDATE project_report_runs SET lease_until=? WHERE id=?',['2026-01-01T00:00:00.000Z',stale.run.id]);const third=await ledger.recoverRunForViewer(a,stale.run.id);check(third.run.attempts===3,label+': third attempt is bounded');await q('UPDATE project_report_runs SET lease_until=? WHERE id=?',['2026-01-01T00:00:00.000Z',stale.run.id]);const exhausted=await ledger.recoverRunForViewer(a,stale.run.id);check(exhausted.run.status==='failed'&&exhausted.run.attempts===3&&exhausted.run.errorCode==='MAX_ATTEMPTS',label+': maximum attempts fails closed without a new lease');
 const dry=await ledger.claimReportRun(a,input(label+'dry',true));await snapshot(dry.run.id,dry.leaseToken!);await denies(()=>ledger.reserveReportArtifact(dry.run.id,dry.leaseToken!,artifact(dry.run.id,'docx',dry.run.expiresAt),a),label+': dry-run rejects artifact reservation');await ledger.completeRun(dry.run.id,dry.leaseToken!,a);check((await ledger.getRunForViewer(a,dry.run.id))?.status==='rendered'&&(await ledger.listArtifactsForRun(a,dry.run.id)).length===0,label+': successful dry-run renders snapshot with zero files');
 const schedule=await ledger.createReportSchedule(a,{projectId:101,timeZone:'Asia/Seoul',lookbackHours:24,formats:['docx']});check(!schedule.enabled&&schedule.audienceMode==='public_only'&&schedule.deliveryMode==='none',label+': schedule creation is disabled public-only download-only');check(await ledger.getReportScheduleForTrigger(schedule.id)===null,label+': disabled schedule cannot be triggered');
 await q('UPDATE project_report_schedules SET enabled=1 WHERE id=?',[schedule.id]);check((await ledger.getReportScheduleForTrigger(schedule.id))?.viewer.userId===a.userId,label+': synthetic enabled schedule resolves current creator');
 await q('UPDATE project_members SET active=0 WHERE project_id=101 AND user_id=902');check(await ledger.getReportScheduleForTrigger(schedule.id)===null,label+': schedule trigger rechecks creator project scope');await q('UPDATE project_members SET active=1 WHERE project_id=101 AND user_id=902');
 await denies(()=>ledger.createReportSchedule(b,{projectId:101,timeZone:'UTC',lookbackHours:24,formats:['docx']}),label+': schedule cross-project write denied');
 await denies(()=>q('UPDATE project_report_runs SET schedule_id=?,project_id=102 WHERE id=?',[schedule.id,dry.run.id]),label+': composite schedule/project foreign key enforced');
 await denies(()=>q('UPDATE project_report_runs SET attempts=4 WHERE id=?',[dry.run.id]),label+': schema attempt cap enforced');
 await denies(()=>q("UPDATE project_report_artifacts SET size_bytes=8388609 WHERE id=?",[art.id]),label+': schema artifact size cap enforced');
 await denies(()=>q("UPDATE project_report_schedules SET delivery_mode='email' WHERE id=?",[schedule.id]),label+': schema external delivery forbidden');
 check(await baseline(q)===before,label+': existing projects, private source, users and memberships unchanged');
}
const sqlFiles=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort(),reportIndex=sqlFiles.findIndex(f=>f.startsWith('0017_'));
check(reportIndex===sqlFiles.length-1,'D1 report migration appends after current schema');
const sql=await Promise.all(sqlFiles.map(async f=>(await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)));
check(!sql[reportIndex].some(s=>/DROP TABLE|DELETE FROM|PRAGMA foreign_keys=OFF/i.test(s)),'report migration changes no source rows or FK enforcement');
async function d1(){
 const mf=new Miniflare({cf:false,modules:true,script:'export default {fetch(){return new Response("synthetic")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'report-ledger-existing',FRESH:'report-ledger-fresh'},log:new Log(LogLevel.ERROR)});
 try{const db=await mf.getD1Database('DB');const q:Query=async(s,p=[])=>{const r=await db.prepare(s).bind(...p).all<Row>();return r.results;};for(const group of sql.slice(0,reportIndex))for(const s of group)await q(s);await seed(q);const before=await baseline(q);for(const s of sql[reportIndex])await q(s);check(await baseline(q)===before,'D1 existing migration preserves source rows');
 await runWithHostedBindings({DB:db as never},()=>suite(q,'D1'));
 const fresh=await mf.getD1Database('FRESH');for(const group of sql)for(const s of group)await fresh.prepare(s).run();check((await fresh.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_report_%'").all()).results.length===3,'D1 fresh creates all report tables');check((await db.prepare('PRAGMA foreign_key_check').all()).results.length===0,'D1 report FK consistency');
 }finally{await mf.dispose();}
}
async function maria(){
 if(!['127.0.0.1','localhost','::1'].includes(testDatabaseEnv.host)||Number(testDatabaseEnv.port)!==3307)throw new Error('Requires loopback MariaDB:3307');
 const db=await createConnection({host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,connectTimeout:5000,bigIntAsNumber:true});
 try{const name=`wbs_report_ledger_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(name);await db.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await db.query(`USE \`${name}\``);process.env.DB_NAME=name;console.log('Retained synthetic MariaDB '+name);
 await assert.rejects(runNativeMigrations({query:async(s,p)=>{if(s.startsWith('CREATE TABLE IF NOT EXISTS project_report_schedules ('))throw new Error('synthetic before report v14');return db.query(s,p);}},name),/synthetic before report v14/);checks++;
 const q:Query=(s,p=[])=>db.query(s,p);await seed(q);const before=await baseline(q);await runNativeMigrations(db,name);check(await baseline(q)===before,'MariaDB populated v13 to v14 source rows preserved');await verifyNativeSchema(db,name);const ledgerBefore=JSON.stringify(await db.query('SELECT version,name,checksum FROM schema_migrations ORDER BY version'));await runNativeMigrations(db,name);check(JSON.stringify(await db.query('SELECT version,name,checksum FROM schema_migrations ORDER BY version'))===ledgerBefore,'MariaDB repeat migration verifies immutable ledger');
 check(nativeMigrationManifest.at(-1)?.version===14&&!!migrationChecksum(nativeMigrationManifest.at(-1)),'Native manifest appends v14');await suite(q,'MariaDB');
 const fresh=`wbs_report_fresh_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}_test`;assertTestDatabaseName(fresh);await db.query(`CREATE DATABASE \`${fresh}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await db.query(`USE \`${fresh}\``);await runNativeMigrations(db,fresh);await verifyNativeSchema(db,fresh);check(Number((await db.query('SELECT MAX(version) AS n FROM schema_migrations'))[0].n)===14,'MariaDB fresh reaches v14');console.log('Retained synthetic MariaDB '+fresh);
 }finally{await closeDatabasePool();await db.end();}
}
// Native sets its dedicated DB name before runtime-env can cache it during D1 tests.
if(!args.includes('--d1'))await maria();if(!args.includes('--maria'))await d1();
console.log(`Report ledger checks passed: ${checks}. Synthetic only; no permanent cleanup or production schedule.`);

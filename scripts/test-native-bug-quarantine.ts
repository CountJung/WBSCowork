/** New retained loopback-only fixture. No purge, unlink/rm, old DB cleanup or race runner. */
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import {randomBytes,createHash,randomUUID} from "node:crypto";
import {readFile,mkdir,writeFile,stat,rename} from "node:fs/promises";
import path from "node:path";
import {createConnection,createPool,type Pool} from "mariadb";
import {testDatabaseEnv,assertTestDatabaseName} from "../tests/helpers/test-env";
import {runNativeMigrations} from "../src/shared/server/database-admin/native-migrations.server";
import {storeBugScreenshots,discardBugScreenshot,createBugReport,getBugReport} from "../src/entities/bug-report/index.server";
import {queueNativeBugFileCleanup,quarantineNativeBugFile,restoreNativeBugFile,retryNativeBugFileCleanup} from "../src/shared/server/native-bug-cleanup/index.server";
import {privateFilePath,storePrivateFile} from "../src/shared/server/private-files/index.server";
import {stageNativeBugFile} from "../src/shared/server/native-bug-cleanup/index.server";

let checks=0;
function check(value:unknown,label:string){assert.ok(value,label);checks++;console.log(`PASS ${label}`);}
if(!["127.0.0.1","localhost","::1"].includes(testDatabaseEnv.host)||Number(testDatabaseEnv.port)!==3307)throw new Error("Requires retained loopback MariaDB:3307 test fixture.");
const database=`wbs_bug_quarantine_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}_test`;
assertTestDatabaseName(database);
const options={host:testDatabaseEnv.host,port:3307,user:testDatabaseEnv.user,password:testDatabaseEnv.password,bigIntAsNumber:true,insertIdAsNumber:true,connectTimeout:5000};
const connection=await createConnection(options),globalDb=globalThis as typeof globalThis&{__wbsMariaDbPool?:Pool};
try{
  await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${database}\``);
  await runNativeMigrations(connection,database);
  check(Number((await connection.query("SELECT MAX(version) AS v FROM schema_migrations"))[0].v)>=13,"native v13 creates the reversible ledger and both lease triggers");
  const ledger=JSON.stringify(await connection.query("SELECT * FROM schema_migrations ORDER BY version"));
  await runNativeMigrations(connection,database);
  check(JSON.stringify(await connection.query("SELECT * FROM schema_migrations ORDER BY version"))===ledger,"repeat migration verifies without rewriting applied checksums");
  globalDb.__wbsMariaDbPool=createPool({...options,database,connectionLimit:5});
  // The remaining tests below use only this newly created synthetic database.
  await connection.query("INSERT INTO users(id,email,name,role) VALUES(1,'native-quarantine@example.test','Synthetic quarantine reporter','guest')");
  const viewer={userId:1,canReview:false},input={title:"Synthetic native quarantine",reproduction:"steps",expected:"expected",actual:"actual",page_path:"/bugs"};
  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf9sAAAAASUVORK5CYII=","base64");
  const upload=async()=> (await storeBugScreenshots([new File([png],"synthetic.png",{type:"image/png"})],viewer))[0];
  const fileHash=async(key:string)=>createHash("sha256").update(await readFile(privateFilePath(key))).digest("hex");
  const exists=async(key:string)=>stat(privateFilePath(key)).then(()=>true,error=>{if((error as NodeJS.ErrnoException).code==="ENOENT")return false;throw error;});
  const job=async(key:string)=>(await connection.query("SELECT * FROM native_bug_file_cleanup_jobs WHERE object_key=?",[key]))[0];
  const live=await upload(),reportId=await createBugReport(viewer,randomUUID(),input,[live]);
  check(Boolean(await getBugReport(reportId,viewer)),"report and screenshot metadata commit behind the native lease trigger");
  await assert.rejects(discardBugScreenshot(live.filePath));checks++;
  check(await fileHash(live.filePath)===live.contentHash&&(await job(live.filePath)).staging_expires_at===null,"referenced screenshot is preserved and discarded staging eligibility is never revived");
  const untouched=await upload();
  await assert.rejects(quarantineNativeBugFile(untouched.filePath));checks++;
  check(await exists(untouched.filePath),"an unexpired staging lease cannot be moved");
  await discardBugScreenshot(untouched.filePath);
  const quarantined=await job(untouched.filePath);
  check(quarantined.state==="quarantined"&&!await exists(untouched.filePath)&&await fileHash(quarantined.quarantine_key)===untouched.contentHash,"discard moves only an unreferenced screenshot into a durable hash-matching quarantine");
  check((await quarantineNativeBugFile(untouched.filePath)).replayed,"repeated quarantine reconciles the same preserved destination");
  await restoreNativeBugFile(untouched.filePath);
  check(await fileHash(untouched.filePath)===untouched.contentHash&&!await exists(quarantined.quarantine_key),"explicit recovery restores exact bytes and original key without metadata reattachment");
  check((await restoreNativeBugFile(untouched.filePath)).replayed,"repeated recovery does not overwrite any file");
  await retryNativeBugFileCleanup();
  check(await exists(untouched.filePath)&&(await job(untouched.filePath)).state==="restored","ordinary retry leaves explicitly restored files alone");
  const expired=await upload(),expiredToken=randomUUID();
  await connection.query("UPDATE native_bug_file_cleanup_jobs SET staging_expires_at=DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 SECOND),not_before=CURRENT_TIMESTAMP WHERE object_key=?",[expired.filePath]);
  await assert.rejects(createBugReport(viewer,expiredToken,input,[expired]));checks++;
  check((await connection.query("SELECT id FROM bug_reports WHERE creation_token=?",[`1:create:${expiredToken}`])).length===0,"an expired native lease rolls back report, history and metadata without partial creation");
  await retryNativeBugFileCleanup();
  check((await job(expired.filePath)).state==="quarantined"&&(await job(expired.filePath)).staging_expires_at===null,"sequential retry quarantines expired unreferenced bytes without renewing a lease");
  const stagedMismatch=await upload(),mismatchToken=randomUUID();
  await assert.rejects(createBugReport(viewer,mismatchToken,input,[{...stagedMismatch,contentHash:"0".repeat(64)}]));checks++;
  check((await connection.query("SELECT id FROM bug_reports WHERE creation_token=?",[`1:create:${mismatchToken}`])).length===0,"a screenshot hash mismatch aborts metadata and the enclosing report transaction");
  await discardBugScreenshot(stagedMismatch.filePath);
  const liveMetadata=(await connection.query("SELECT id,file_path FROM bug_report_screenshots WHERE report_id=?",[reportId]))[0];
  await assert.rejects(connection.query("UPDATE bug_report_screenshots SET file_path=? WHERE id=?",[expired.filePath,liveMetadata.id]));checks++;
  check((await connection.query("SELECT file_path FROM bug_report_screenshots WHERE id=?",[liveMetadata.id]))[0].file_path===live.filePath,"path-update lease enforcement preserves the original screenshot link");
  await connection.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(50,'Synthetic reference protection','2026-01-01','2026-12-31')");
  await connection.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(70,50,'Synthetic reference target','2026-01-01','2026-12-31')");
  for(const source of ["submissions","submission_revisions","submission_attachments"]){
    const protectedFile=await upload();
    const inserted=await connection.query("INSERT INTO submissions(task_id,author_id,content,visibility,file_path) VALUES(70,1,'Synthetic preserved private body','private',?)",[source==="submissions"?protectedFile.filePath:null]);
    if(source==="submission_revisions")await connection.query("INSERT INTO submission_revisions(submission_id,revision_number,editor_id,content,visibility,file_path) VALUES(?,1,1,'Synthetic old revision','private',?)",[inserted.insertId,protectedFile.filePath]);
    if(source==="submission_attachments")await connection.query("INSERT INTO submission_attachments(submission_id,revision_number,file_path,file_name,file_mime_type,file_size_bytes) VALUES(?,1,?,'synthetic.png','image/png',?)",[inserted.insertId,protectedFile.filePath,png.length]);
    await assert.rejects(discardBugScreenshot(protectedFile.filePath));checks++;
    check(await fileHash(protectedFile.filePath)===protectedFile.contentHash,`all-source reference protection preserves a bug key referenced by ${source}`);
  }
  const fault=await upload();await queueNativeBugFileCleanup(fault.filePath);
  await connection.query("CREATE TABLE native_quarantine_synthetic_faults(object_key VARCHAR(512) PRIMARY KEY,active INT NOT NULL)");
  await connection.query("INSERT INTO native_quarantine_synthetic_faults VALUES(?,1)",[fault.filePath]);
  await connection.query("CREATE TRIGGER synthetic_quarantine_final_state_failure BEFORE UPDATE ON native_bug_file_cleanup_jobs FOR EACH ROW BEGIN IF NEW.state='quarantined' AND EXISTS(SELECT 1 FROM native_quarantine_synthetic_faults WHERE object_key=NEW.object_key AND active=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic quarantine state failure'; END IF; END");
  const failed=await retryNativeBugFileCleanup();
  const afterFault=await job(fault.filePath);
  check(failed.failed===1&&afterFault.state==="queued"&&Number(afterFault.attempts)===1&&afterFault.staging_expires_at===null,"a post-rename database failure remains durable, revoked and retryable with a safe error code");
  check(!await exists(fault.filePath)&&await fileHash(afterFault.quarantine_key)===fault.contentHash,"DB rollback never loses already quarantined bytes");
  await connection.query("UPDATE native_quarantine_synthetic_faults SET active=0 WHERE object_key=?",[fault.filePath]);
  await connection.query("UPDATE native_bug_file_cleanup_jobs SET not_before=CURRENT_TIMESTAMP WHERE object_key=?",[fault.filePath]);
  check((await retryNativeBugFileCleanup()).quarantined===1&&(await job(fault.filePath)).state==="quarantined","sequential retry reconciles a prior filesystem move after its database failure");
  await connection.query("UPDATE native_quarantine_synthetic_faults SET active=1 WHERE object_key=?",[fault.filePath]);
  await connection.query("CREATE TRIGGER synthetic_quarantine_restore_state_failure BEFORE UPDATE ON native_bug_file_cleanup_jobs FOR EACH ROW BEGIN IF NEW.state='restored' AND EXISTS(SELECT 1 FROM native_quarantine_synthetic_faults WHERE object_key=NEW.object_key AND active=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic recovery state failure'; END IF; END");
  await assert.rejects(restoreNativeBugFile(fault.filePath));checks++;
  check((await job(fault.filePath)).state==="quarantined"&&await fileHash(fault.filePath)===fault.contentHash,"a recovery database failure preserves restored bytes without claiming a committed state");
  await connection.query("UPDATE native_quarantine_synthetic_faults SET active=0 WHERE object_key=?",[fault.filePath]);
  check((await restoreNativeBugFile(fault.filePath)).replayed&&(await job(fault.filePath)).state==="restored","explicit recovery reconciles its earlier completed filesystem move");
  const conflict=await upload();await queueNativeBugFileCleanup(conflict.filePath);
  const conflictJob=await job(conflict.filePath);
  await mkdir(path.dirname(privateFilePath(conflictJob.quarantine_key)),{recursive:true});
  await writeFile(privateFilePath(conflictJob.quarantine_key),"synthetic conflicting destination preserved");
  check((await retryNativeBugFileCleanup()).failed===1&&await fileHash(conflict.filePath)===conflict.contentHash,"an existing mismatching destination is never overwritten");
  const conflictHold="native-bug-quarantine/synthetic-conflict-"+randomUUID()+".file";
  await rename(privateFilePath(conflictJob.quarantine_key),privateFilePath(conflictHold));
  await connection.query("UPDATE native_bug_file_cleanup_jobs SET not_before=CURRENT_TIMESTAMP WHERE object_key=?",[conflict.filePath]);
  check((await retryNativeBugFileCleanup()).quarantined===1&&await exists(conflictHold),"correcting a reversible destination conflict allows retry while preserving the conflicting file too");
  await restoreNativeBugFile(conflict.filePath);
  check(await fileHash(conflict.filePath)===conflict.contentHash,"recovery after a failed retry preserves the original exact bytes");
  let failedWriteKey="";
  await assert.rejects(storePrivateFile(new File([png],"synthetic-write-failure.png",{type:"image/png"}),"bugs/1",{
    beforeWrite:async(key,size,hash)=>{failedWriteKey=key;await stageNativeBugFile(key,size,hash);await mkdir(privateFilePath(key),{recursive:true});},
    onWriteFailure:discardBugScreenshot,
  }));checks++;
  check(Boolean(failedWriteKey)&&(await job(failedWriteKey)).state==="queued"&&(await stat(privateFilePath(failedWriteKey))).isDirectory(),"native write failure preserves its durable revoked job and conflicting filesystem entry");

  const upgradeDatabase=database.replace("_test","_upgrade_test");assertTestDatabaseName(upgradeDatabase);
  await connection.query(`CREATE DATABASE \`${upgradeDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.query(`USE \`${upgradeDatabase}\``);
  await assert.rejects(runNativeMigrations({query:async(sql,params)=>{if(sql.includes("CREATE TABLE IF NOT EXISTS native_bug_file_cleanup_jobs ("))throw new Error("synthetic pre-v13 boundary");return connection.query(sql,params);}},upgradeDatabase),/synthetic pre-v13/);
  const legacyFile=await storePrivateFile(new File([png],"synthetic-legacy-preserved.png",{type:"image/png"}),"bugs/99");
  await connection.query("INSERT INTO users(id,email,name,role) VALUES(1,'legacy-native@example.test','Synthetic legacy role','member')");
  await connection.query("INSERT INTO bug_reports(id,reporter_id,creation_token,last_operation_token,title,reproduction,expected,actual,page_path) VALUES(1,1,'synthetic-v12-report','synthetic-v12-report','Synthetic legacy report','immutable body','expected','actual','/bugs')");
  await connection.query("INSERT INTO bug_report_screenshots(report_id,ordinal,file_path,file_name,file_mime_type,file_size_bytes,content_hash) VALUES(1,0,?,'synthetic-legacy.png','image/png',?,?)",[legacyFile.filePath,png.length,legacyFile.contentHash]);
  const snapshot=async()=>JSON.stringify([await connection.query("SELECT * FROM users ORDER BY id"),await connection.query("SELECT * FROM bug_reports ORDER BY id"),await connection.query("SELECT * FROM bug_report_screenshots ORDER BY id")]);
  const before=await snapshot();
  await runNativeMigrations(connection,upgradeDatabase);
  check(await snapshot()===before&&await fileHash(legacyFile.filePath)===legacyFile.contentHash,"existing v12 roles, report, immutable screenshot metadata and bytes survive additive v13");
  check(Number((await connection.query("SELECT COUNT(*) AS n FROM native_bug_file_cleanup_jobs"))[0].n)===0,"migration never guesses cleanup ownership or leases for legacy files");
  await assert.rejects(discardBugScreenshot(legacyFile.filePath));checks++;
  check(await fileHash(legacyFile.filePath)===legacyFile.contentHash,"an untracked legacy screenshot remains fail-closed and physically preserved");
  console.log(`Retained additive-upgrade fixture ${upgradeDatabase}`);
  console.log(`Retained synthetic database ${database}; checks ${checks}`);
}finally{
  await globalDb.__wbsMariaDbPool?.end();globalDb.__wbsMariaDbPool=undefined;
  await connection.end();
}

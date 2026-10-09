/** Additive-only isolated MariaDB validation. Retains every new DB/row; never deletes or purges. */
import "../tests/helpers/bootstrap";
import { verifyNativeTaskWorkflow } from "./verify-native-task-workflow";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createConnection } from "mariadb";
import { testDatabaseEnv, assertTestDatabaseName } from "../tests/helpers/test-env";
import { nativeSchemaV1 } from "../src/shared/server/database-admin/native-migration-v1";
import { migrationChecksum, nativeMigrationManifest, runNativeMigrations, readNativeMigrationStatus, verifyNativeSchema, type MigrationConnection } from "../src/shared/server/database-admin/native-migrations.server";

const options = { host: testDatabaseEnv.host, port: Number(testDatabaseEnv.port), user: process.env.TEST_DB_SCHEMA_USER ?? testDatabaseEnv.user, password: process.env.TEST_DB_SCHEMA_PASSWORD ?? testDatabaseEnv.password, connectTimeout: 5000 };
// Hard guard: this harness is for the explicitly isolated test listener only.
if (!['127.0.0.1','localhost','::1'].includes(options.host) || options.port !== 3307) throw new Error('Native migration test requires loopback:3307. No operating DB is permitted.');
const prefix=`wbs_mig_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
const databases: string[]=[];
let checks=0;
function check(value: unknown, label: string) { assert.ok(value,label);checks++;console.log(`PASS ${label}`); }
async function connect(database?:string) { return createConnection({...options,...(database?{database}:{})}); }
async function fresh(label:string) {
  const name=`${prefix}_${label}_test`;assertTestDatabaseName(name);databases.push(name);
  const connection=await connect();
  await connection.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${name}\``);
  return {name,connection};
}
try {
  const install=await fresh('fresh');
  try {
    const result=await runNativeMigrations(install.connection,install.name);
    check(result.appliedVersions.join(',')===nativeMigrationManifest.map(m=>m.version).join(',')&&result.pendingVersions.length===0,'fresh installation has all verified migrations');
    await install.connection.query("INSERT INTO users(id,email,name,role) VALUES(9001,'fixture@example.test','합성 사용자','member')");
    await install.connection.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(9001,'합성 프로젝트','2026-01-01','2026-12-31')");
    await install.connection.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(9001,9001,'보존 작업','2026-01-01','2026-12-31')");
    await install.connection.query("INSERT INTO submissions(id,task_id,author_id,content,visibility) VALUES(9001,9001,9001,'보존 비공개','private')");
    await install.connection.query("INSERT INTO bug_reports(id,reporter_id,creation_token,last_operation_token,title,reproduction,expected,actual) VALUES(9001,9001,'migration-create','migration-create','보존 제보','재현','기대','실제')");
    await install.connection.query("INSERT INTO bug_report_events(report_id,actor_id,operation_token,kind,status,priority,report_version) VALUES(9001,9001,'migration-create','created','new','normal',1)");
    const before=JSON.stringify(await install.connection.query("SELECT version,name,checksum,applied_at FROM schema_migrations"));
    await runNativeMigrations(install.connection,install.name);
    check(JSON.stringify(await install.connection.query("SELECT version,name,checksum,applied_at FROM schema_migrations"))===before,'repeat does not rewrite ledger/timestamps');
    check((await install.connection.query("SELECT role FROM users WHERE id=9001"))[0].role==='member'&&(await install.connection.query("SELECT content,visibility FROM submissions WHERE id=9001"))[0].visibility==='private'&&(await install.connection.query("SELECT content FROM submissions WHERE id=9001"))[0].content==='보존 비공개','repeat preserves roles and private content');
    check(Number((await install.connection.query('SELECT COUNT(*) AS n FROM bug_report_events WHERE report_id=9001'))[0].n)===1,'repeat preserves original report history');
  } finally { await install.connection.end(); }

  const version1=await fresh('version1');
  try {
    for(const sql of nativeSchemaV1)await version1.connection.query(sql);
    await version1.connection.query("CREATE TABLE schema_migrations (version INT NOT NULL PRIMARY KEY, name VARCHAR(128) NOT NULL, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    await version1.connection.query("INSERT INTO schema_migrations(version,name,checksum,applied_at) VALUES(1,?,?,'2026-01-01 00:00:00')",[nativeMigrationManifest[0].name,migrationChecksum(nativeMigrationManifest[0])]);
    await version1.connection.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(9401,'기존 v1 주제','2026-01-01','2026-12-31')");
    await version1.connection.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(9401,9401,'기존 v1 카드','2026-01-01','2026-12-31')");
    const originalLedger=JSON.stringify(await version1.connection.query('SELECT * FROM schema_migrations WHERE version=1'));
    await runNativeMigrations(version1.connection,version1.name);
    check(JSON.stringify(await version1.connection.query('SELECT * FROM schema_migrations WHERE version=1'))===originalLedger,'new versions preserve released v1 ledger and timestamp');
    check((await version1.connection.query('SELECT goal,success_criteria FROM projects WHERE id=9401'))[0].goal===''&&(await version1.connection.query('SELECT deliverable,definition_of_done,review_required FROM tasks WHERE id=9401'))[0].review_required===0,'existing v1 rows remain blank drafts without fabricated goals or review');
    await version1.connection.query("UPDATE projects SET goal='보존 목표',success_criteria='보존 기준' WHERE id=9401");
    await version1.connection.query("UPDATE tasks SET deliverable='보존 결과',definition_of_done='보존 완료',review_required=1 WHERE id=9401");
    await runNativeMigrations(version1.connection,version1.name);
    check((await version1.connection.query("SELECT kind,note FROM task_events WHERE task_id=9401"))[0].kind==='baseline','legacy task history records an explicitly labeled current-state baseline');
    check((await version1.connection.query('SELECT goal FROM projects WHERE id=9401'))[0].goal==='보존 목표'&&(await version1.connection.query('SELECT definition_of_done FROM tasks WHERE id=9401'))[0].definition_of_done==='보존 완료','repeat retains configured work goals');
  } finally {await version1.connection.end();}

  for(const scenario of ['resume_v2','drift_v2']) {
    const fixture=await fresh(scenario);
    try {
      for(const sql of nativeSchemaV1)await fixture.connection.query(sql);
      await fixture.connection.query("CREATE TABLE schema_migrations (version INT NOT NULL PRIMARY KEY, name VARCHAR(128) NOT NULL, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
      await fixture.connection.query("INSERT INTO schema_migrations(version,name,checksum) VALUES(1,?,?)",[nativeMigrationManifest[0].name,migrationChecksum(nativeMigrationManifest[0])]);
      if(scenario==='resume_v2') {
        let interrupted=false;
        const proxy:MigrationConnection={query:async(sql,values)=>{
          const result=await fixture.connection.query(sql,values);
          if(!interrupted&&sql.includes('ADD COLUMN goal ')){interrupted=true;throw new Error('synthetic interrupted v2');}
          return result;
        }};
        await assert.rejects(runNativeMigrations(proxy,fixture.name),/interrupted v2/);checks++;
        check(Number((await fixture.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===1,'interrupted v2 leaves only the released v1 ledger');
        await runNativeMigrations(fixture.connection,fixture.name);
        check(Number((await fixture.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===nativeMigrationManifest.length,'partial v2 resumes without duplicate columns');
      } else {
        await fixture.connection.query("ALTER TABLE projects ADD COLUMN goal VARCHAR(20) NOT NULL DEFAULT ''");
        await assert.rejects(runNativeMigrations(fixture.connection,fixture.name),/projects.goal/);checks++;
        check(Number((await fixture.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===1,'incompatible v2 goal never gets a successful ledger');
      }
    } finally {await fixture.connection.end();}
  }

  const resumeV3=await fresh('resume_v3');
  try {
    let interrupted=false;
    const proxy:MigrationConnection={query:async(sql,params)=>{
      const result=await resumeV3.connection.query(sql,params);
      if(!interrupted&&sql.includes('ADD COLUMN creation_token ')){interrupted=true;throw new Error('synthetic interrupted v3');}
      return result;
    }};
    await assert.rejects(runNativeMigrations(proxy,resumeV3.name),/interrupted v3/);checks++;
    check(Number((await resumeV3.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===2,'interrupted v3 retains successful v1/v2 ledger only');
    await resumeV3.connection.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Resume','2026-01-01','2026-12-31')");
    await resumeV3.connection.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(1,1,'Retain interrupted card','2026-01-01','2026-12-31')");
    await runNativeMigrations(resumeV3.connection,resumeV3.name);
    check((await resumeV3.connection.query('SELECT title FROM tasks WHERE id=1'))[0].title==='Retain interrupted card'&&(await resumeV3.connection.query('SELECT kind FROM task_events WHERE task_id=1'))[0].kind==='baseline','v3 resumes and snapshots current legacy task exactly once');
    await runNativeMigrations(resumeV3.connection,resumeV3.name);
    check(Number((await resumeV3.connection.query('SELECT COUNT(*) AS n FROM task_events WHERE task_id=1'))[0].n)===1,'v3 replay preserves one baseline');
  }finally{await resumeV3.connection.end();}

  const resumeV5=await fresh('resume_v5');
  try {
    let interrupted=false;
    const proxy={query:async(sql:string,params?:unknown[])=>{
      const result=await resumeV5.connection.query(sql,params);
      if(!interrupted&&sql.includes('ADD COLUMN review_submission_id')){interrupted=true;throw new Error('synthetic interrupted v5');}
      return result;
    }};
    await assert.rejects(runNativeMigrations(proxy,resumeV5.name),/interrupted v5/);checks++;
    check(Number((await resumeV5.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===4,'interrupted v5 retains all four released ledgers');
    await runNativeMigrations(resumeV5.connection,resumeV5.name);
    check((await readNativeMigrationStatus(resumeV5.connection,resumeV5.name)).pendingVersions.length===0,'v5 additive selection columns resume without rebuilding tasks');
  }finally{await resumeV5.connection.end();}
  const resumeV4=await fresh('resume_v4');
  try {
    let interrupted=false;
    const proxy:MigrationConnection={query:async(sql,params)=>{
      const result=await resumeV4.connection.query(sql,params);
      if(!interrupted&&sql.includes('ADD COLUMN current_revision ')){interrupted=true;throw new Error('synthetic interrupted v4');}
      return result;
    }};
    await assert.rejects(runNativeMigrations(proxy,resumeV4.name),/interrupted v4/);checks++;
    check(Number((await resumeV4.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===3,'interrupted v4 retains released ledgers only');
    await resumeV4.connection.query("INSERT INTO users(id,email,name,role) VALUES(1,'legacy@revision.test','Legacy','member')");
    await resumeV4.connection.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(1,'Legacy','2026-01-01','2026-12-31')");
    await resumeV4.connection.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(1,1,'Legacy','2026-01-01','2026-12-31')");
    await resumeV4.connection.query("INSERT INTO submissions(id,task_id,author_id,content,visibility,file_path,file_name,file_mime_type,file_size_bytes) VALUES(1,1,1,'Preserved private body','private','legacy/file.txt','file.txt','text/plain',14)");
    await resumeV4.connection.query("INSERT INTO comments(id,submission_id,author_id,content) VALUES(1,1,1,'Legacy comment')");
    await runNativeMigrations(resumeV4.connection,resumeV4.name);
    const row=(await resumeV4.connection.query('SELECT * FROM submission_revisions WHERE submission_id=1'))[0];
    check(row.content==='Preserved private body'&&row.visibility==='private'&&row.file_path==='legacy/file.txt'&&row.editor_id===null&&row.source==='legacy','v4 resumes and preserves surviving private body/file as labeled snapshot');
    await runNativeMigrations(resumeV4.connection,resumeV4.name);
    check(Number((await resumeV4.connection.query('SELECT COUNT(*) AS n FROM submission_revisions WHERE submission_id=1'))[0].n)===1&&(await resumeV4.connection.query('SELECT revision_number FROM comments WHERE id=1'))[0].revision_number===null,'v4 repeat retains one snapshot and unknown legacy comment revision');
  }finally{await resumeV4.connection.end();}

  const resumeV6=await fresh('resume_v6');
  try {
    let interrupted=false;
    const proxy:MigrationConnection={query:async(sql,params)=>{
      const result=await resumeV6.connection.query(sql,params);
      if(!interrupted&&sql.includes('ADD COLUMN dependency_token ')){interrupted=true;throw new Error('synthetic interrupted v6');}
      return result;
    }};
    await assert.rejects(runNativeMigrations(proxy,resumeV6.name),/interrupted v6/);checks++;
    check(Number((await resumeV6.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===5,'interrupted v6 retains previous ledgers');
    await runNativeMigrations(resumeV6.connection,resumeV6.name);
    check((await readNativeMigrationStatus(resumeV6.connection,resumeV6.name)).pendingVersions.length===0,'v6 resumes additive dependency graph without table rebuild');
  }finally{await resumeV6.connection.end();}

  const execution=await fresh('execution');
  try {
    await runNativeMigrations(execution.connection,execution.name);
    await verifyNativeTaskWorkflow(execution.name,check);
  }finally{await execution.connection.end();}

  const concurrent=await fresh('concurrent');
  const concurrentOther=await connect(concurrent.name);
  try {
    let began!:()=>void;
    const firstEnteredDDL=new Promise<void>(resolve=>{began=resolve;});
    let delayed=false;
    const firstConnection:MigrationConnection={query:async(sql,values)=>{
      if(!delayed&&sql.startsWith('CREATE TABLE IF NOT EXISTS users')) { delayed=true; began(); await new Promise(resolve=>setTimeout(resolve,250)); }
      return concurrent.connection.query(sql,values);
    }};
    const first=runNativeMigrations(firstConnection,concurrent.name);
    await Promise.race([firstEnteredDDL, first.then(() => { throw new Error("Fresh concurrent test did not enter DDL."); })]);
    await Promise.all([first,runNativeMigrations(concurrentOther,concurrent.name)]);
    check(Number((await concurrent.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===nativeMigrationManifest.length,'overlapping fresh migration runners serialize to one row per version');
  } finally { await concurrent.connection.end(); await concurrentOther.end(); }

  const legacy=await fresh('legacy');
  try {
    // Previous supported core schema: missing only documented additive user/submission fields.
    for(const sql of nativeSchemaV1.slice(0,6)) {
      const old=sql.replace(/    (google_id|avatar_url|last_login_at|last_synced_at|visibility|file_name|file_mime_type|file_size_bytes)[^\n]*\n/g,match=>sql.includes('CREATE TABLE IF NOT EXISTS submission_attachments')?match:'').replace("ENUM('admin', 'member', 'guest') NOT NULL DEFAULT 'guest'","ENUM('admin', 'member') NOT NULL DEFAULT 'member'");
      await legacy.connection.query(old);
    }
    await legacy.connection.query("INSERT INTO users(id,email,name,role) VALUES(9101,'legacy@example.test','기존 합성','member'),(9102,'legacy-admin@example.test','기존 관리자','admin')");
    await legacy.connection.query("INSERT INTO projects(id,name,start_date,end_date) VALUES(9101,'기존 프로젝트','2026-01-01','2026-12-31')");
    await legacy.connection.query("INSERT INTO tasks(id,project_id,title,start_date,end_date) VALUES(9101,9101,'기존 작업','2026-01-01','2026-12-31')");
    await legacy.connection.query("INSERT INTO submissions(id,task_id,author_id,content) VALUES(9101,9101,9101,'기존 본문')");
    await runNativeMigrations(legacy.connection,legacy.name);
    const row=(await legacy.connection.query('SELECT content,visibility FROM submissions WHERE id=9101'))[0];
    check(row.content==='기존 본문'&&row.visibility==='public','legacy upgrade keeps body and documented public default');
    check((await legacy.connection.query('SELECT role FROM users WHERE id=9101'))[0].role==='member'&&(await legacy.connection.query('SELECT role FROM users WHERE id=9102'))[0].role==='admin','legacy enum expansion preserves member and admin roles');
  } finally { await legacy.connection.end(); }

  const preLifecycle=await fresh('prelife');
  try {
    for(const sql of nativeSchemaV1.slice(0,8)) {
      const old=sql.replace(/    verified_at DATETIME NULL, verified_by BIGINT NULL, verification_note TEXT NOT NULL DEFAULT '',\n/,'').replace(/    trashed_at DATETIME NULL, trashed_by BIGINT NULL,\n/,'').replace(/    CONSTRAINT bug_reports_(verified_by|trashed_by)_fk[^\n]*\n/g,'').replace(/    lifecycle_action VARCHAR\(16\) NOT NULL DEFAULT '',\n/,'');
      await preLifecycle.connection.query(old);
    }
    await preLifecycle.connection.query("INSERT INTO users(id,email,name,role) VALUES(9201,'buglegacy@example.test','합성','guest')");
    await preLifecycle.connection.query("INSERT INTO bug_reports(id,reporter_id,creation_token,last_operation_token,title,reproduction,expected,actual) VALUES(9201,9201,'legacy-bug','legacy-bug','제보 원문','재현','기대','실제')");
    await preLifecycle.connection.query("INSERT INTO bug_report_events(report_id,actor_id,operation_token,kind,status,priority,report_version) VALUES(9201,9201,'legacy-bug','created','new','normal',1)");
    await runNativeMigrations(preLifecycle.connection,preLifecycle.name);
    const row=(await preLifecycle.connection.query('SELECT title,version,verified_at,trashed_at FROM bug_reports WHERE id=9201'))[0];
    check(row.title==='제보 원문'&&row.version===1&&row.verified_at===null&&row.trashed_at===null,'pre-lifecycle upgrade retains original/unverified state');
    check(Number((await preLifecycle.connection.query('SELECT COUNT(*) AS n FROM bug_report_events WHERE report_id=9201'))[0].n)===1,'pre-lifecycle history remains unchanged');
  } finally { await preLifecycle.connection.end(); }

  const interrupted=await fresh('resume');
  try {
    let fail=true;
    const proxy:MigrationConnection={query:async(sql,values)=>{if(fail&&sql.startsWith('INSERT INTO schema_migrations')){fail=false;throw new Error('synthetic failure after DDL before ledger');}return interrupted.connection.query(sql,values);}};
    await assert.rejects(runNativeMigrations(proxy,interrupted.name),/synthetic failure/);checks++;
    check(Number((await interrupted.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===0,'DDL interruption does not claim success');
    await runNativeMigrations(interrupted.connection,interrupted.name);
    check(Number((await interrupted.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===nativeMigrationManifest.length,'interrupted DDL resumes safely');
  } finally { await interrupted.connection.end(); }

  const manualCommit=await fresh('commit');
  try {await manualCommit.connection.query('SET autocommit=0');await runNativeMigrations(manualCommit.connection,manualCommit.name);}
  finally {await manualCommit.connection.end();}
  const persisted=await connect(manualCommit.name);
  try {check(Number((await persisted.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===nativeMigrationManifest.length,'ledger is durable with inherited autocommit0');}
  finally {await persisted.end();}

  for(const [label,change,role]of[
    ['upper',(sql:string)=>sql.replace("ENUM('admin', 'member', 'guest')","VARCHAR(32)"),'ADMIN'],
    ['space',(sql:string)=>sql.replace("ENUM('admin', 'member', 'guest')","VARCHAR(32)"),'admin '],
    ['prefix',(sql:string)=>sql.replace('users_email_unique (email)','users_email_unique (email(10))'),'member'],
    ['charset',(sql:string)=>sql.replace('utf8mb4 COLLATE=utf8mb4_unicode_ci','latin1 COLLATE=latin1_swedish_ci'),'member'],
  ] as const) {
    const invalid=await fresh(label);
    try {
      await invalid.connection.query(change(nativeSchemaV1[0]));
      await invalid.connection.query('INSERT INTO users(id,email,name,role) VALUES(9301,?,?,?)',[`${label}@example.test`,'fixture',role]);
      await assert.rejects(runNativeMigrations(invalid.connection,invalid.name));checks++;
      check((await invalid.connection.query('SELECT role FROM users WHERE id=9301'))[0].role===role,`${label}: incompatible schema never coerces role`);
      check(Number((await invalid.connection.query('SELECT COUNT(*) AS n FROM schema_migrations'))[0].n)===0,`${label}: incompatible baseline gets no ledger success`);
    } finally {await invalid.connection.end();}
  }
  const drift=await connect(install.name);
  try {
    await verifyNativeSchema(drift,install.name);
    await drift.query("UPDATE schema_migrations SET checksum=? WHERE version=1",['f'.repeat(64)]);
    await assert.rejects(runNativeMigrations(drift,install.name),/checksum/);checks++;
    check((await drift.query('SELECT title FROM bug_reports WHERE id=9001'))[0].title==='보존 제보','checksum rejection leaves domain records intact');
  } finally {await drift.end();}
  console.log(`Native additive migration checks passed: ${checks}. Retained synthetic databases: ${databases.join(', ')}. No account grants, credential changes, delete, purge, DROP or TRUNCATE performed.`);
} catch(error) {
  console.error(`Native additive migration verification failed. Retained databases: ${databases.join(', ')}`);
  throw error;
}

import type { StoredSubmissionAttachment } from "../src/entities/submission/index.server";
import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { runWithHostedBindings } from "../src/shared/server/hosted-runtime/index.server";

const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('test'); } };", compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], d1Databases: { DB: "wbscowork-test" }, r2Buckets: { ATTACHMENTS: "wbscowork-test-files" } });
let checks = 0;
function check(value: unknown, message: string) { assert.ok(value, message); checks++; console.log(`PASS ${message}`); }
try {
  const DB = await mf.getD1Database("DB") as unknown as D1Database;
  const ATTACHMENTS = await mf.getR2Bucket("ATTACHMENTS") as unknown as R2Bucket;
  for (const file of (await readdir("drizzle")).filter((file) => file.endsWith(".sql")).sort()) {
    for (const sql of (await readFile(`drizzle/${file}`, "utf8")).split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean)) await DB.prepare(sql).run();
  }
  await runWithHostedBindings({ DB, ATTACHMENTS }, async () => {
    const { getDatabasePool, databaseBatch } = await import("../src/shared/server/database/index.server");
    const { getDatabaseAdminStatus, initializeDatabaseSchema } = await import("../src/shared/server/database-admin/index.server");
    const { getRuntimeEnv, resetRuntimeEnvCache } = await import("../src/shared/server/runtime-env/index.server");
    resetRuntimeEnvCache();
    const { upsertUser, getUserByEmail, resolveUserRoleForSession } = await import("../src/entities/user/api/user-repository.server");
    const { createProject } = await import("../src/entities/project/index.server");
    const { createTask } = await import("../src/entities/task/index.server");
    const { createSubmission, getSubmissionByIdForViewer, listSubmissionsByProject, createSubmissionAttachment, listAttachmentsByProject } = await import("../src/entities/submission/index.server");
    const { createComment, listCommentsByProject } = await import("../src/entities/comment/index.server");
    const { getAdminSettingsSnapshot, saveAdminSettings } = await import("../src/features/settings-manage/index.server");
    const { logUserAction, listRecentUserActionEntries } = await import("../src/shared/server/logging/index.server");
    check(getRuntimeEnv().database.configured, "D1 binding configures database without MariaDB credentials");
    const status = await getDatabaseAdminStatus();
    check(status.managedMigrations && status.existingTableCount === status.managedTableCount && status.tables.every((t) => !t.missingColumns.length), "all managed domain tables migrated");
    await assert.rejects(initializeDatabaseSchema(), /migration/i); checks++;
    const guest = await upsertUser({ email: "guest@example.test", name: "Guest", role: "guest" });
    const member = await upsertUser({ email: "member1@example.test", name: "Member", role: "member" });
    const other = await upsertUser({ email: "member2@example.test", name: "Other", role: "member" });
    const admin = await upsertUser({ email: "admin@example.test", name: "Admin", role: "admin" });
    await upsertUser({ email: member.email.toUpperCase(), name: "Refreshed", role: "guest" });
    check((await getUserByEmail(member.email))?.role === "member", "repeat Google sync preserves member role and case normalization");
    await upsertUser({ email: admin.email, name: "Admin", role: "guest" });
    check((await getUserByEmail(admin.email))?.role === "admin", "repeat Google sync preserves admin role");
    const project = await createProject({ name: "Synthetic", startDate: "2026-01-01", endDate: "2026-12-31" });
    const task = await createTask({ projectId: project.id, title: "Task", startDate: "2026-01-01", endDate: "2026-12-31" });
    const visible = await createSubmission({ taskId: task.id, authorId: member.id, content: "Public", visibility: "public" });
    const hidden = await createSubmission({ taskId: task.id, authorId: member.id, content: "Private", visibility: "private" });
    for (const [name, email, canSeeAll, count] of [["guest", guest.email, false, 1], ["owner", member.email, false, 2], ["other member", other.email, false, 1], ["admin", admin.email, true, 2], ["superuser", "superuser@example.test", true, 2]] as const) {
      check((await listSubmissionsByProject(project.id, { viewerEmail: email, canSeeAll })).length === count, `${name}: exact submission visibility`);
    }
    check(await getSubmissionByIdForViewer(hidden.id, { viewerEmail: other.email, canSeeAll: false }) === null, "direct private submission lookup denies another member");
    check(member.createdAt.toISOString().endsWith("Z") && Number.isFinite(member.createdAt.getTime()), "SQLite timestamps serialize as UTC");
    await assert.rejects(databaseBatch([
      { sql: "INSERT INTO projects (name,start_date,end_date) VALUES ('rollback','2026-01-01','2026-12-31')" },
      { sql: "INSERT INTO comments (submission_id,author_id,content) VALUES (999999,999999,'invalid')" },
    ]));
    check((await DB.prepare("SELECT count(*) AS n FROM projects WHERE name='rollback'").first<{n:number}>())?.n === 0, "failed D1 batch rolls back all writes and enforces foreign keys");
    await assert.rejects(getDatabasePool().query(`SELECT ${Array.from({length:101},()=>"?").join(",")}`, Array(101).fill(1)), /100 parameters/); checks++;
    const ids = [visible.id];
    for (let index=0;index<104;index++) {
      const item = await createSubmission({taskId:task.id,authorId:member.id,content:`Visible ${index}`});
      ids.push(item.id);
      await createComment({submissionId:item.id,authorId:member.id,content:`Comment ${index}`});
      await createSubmissionAttachment({submissionId:item.id,filePath:`synthetic/${index}`,fileName:"test.txt",fileMimeType:"text/plain",fileSizeBytes:1});
    }
    check((await listCommentsByProject(project.id,{ids})).length===104,"comment scopes over100 IDs are bounded without lost rows");
    check((await listAttachmentsByProject(project.id,{ids})).length===104,"attachment scopes over100 IDs are bounded without lost rows");
    check((await listCommentsByProject(project.id,{ids:[]})).length===0,"empty scope never widens access");
    await getDatabasePool().query("UPDATE users SET role='guest' WHERE id=?",[member.id]);
    check(await resolveUserRoleForSession(member.email)==="guest","session role refresh observes downgrade");
    await logUserAction("test",{actorEmail:member.email,action:"synthetic.write",entityType:"submission",metadata:{filePath:"private/secret.pdf"}});
    const logs=await listRecentUserActionEntries();
    check(logs.some((row)=>row.message.includes("synthetic.write")) && !JSON.stringify(logs).includes("private/secret.pdf"),"durable audit read preserves path redaction");
    const settings=await getAdminSettingsSnapshot();
    check(settings.managedRuntime && settings.envEntries.every((entry)=>entry.value==="설정됨"||entry.value.startsWith("미설정")),"hosted settings expose presence only");
    await assert.rejects(saveAdminSettings({SUPERUSER_EMAIL:"attacker@example.test"}),/Sites/);checks++;
    const { saveUploadedSubmissionAttachment, readStoredSubmissionAttachment, deleteStoredSubmissionAttachment, createSubmissionWithAttachments, updateSubmissionWithAttachments, listAttachmentsBySubmission, deleteSubmission } = await import("../src/entities/submission/index.server");
    const { retryObjectCleanup, pendingObjectCleanupCount } = await import("../src/shared/server/object-cleanup/index.server");
    const { setSession } = await import("../tests/helpers/bootstrap");
    const { testActors, sessionFor } = await import("../tests/helpers/session");
    const { GET: download } = await import("../app/api/submission-attachments/[attachmentId]/route");
    const { GET: downloadLegacy } = await import("../app/api/submissions/[submissionId]/attachment/route");
    const upload = await saveUploadedSubmissionAttachment(new File(["private contents"], "비공개.txt", {type:"text/plain"}), {authorId:member.id,taskId:task.id});
    check((await pendingObjectCleanupCount()) === 1, "R2 upload creates durable staging cleanup intent");
    const withFile = await createSubmissionWithAttachments({taskId:task.id,authorId:member.id,content:"private with file",visibility:"private"},[upload]);
    check((await pendingObjectCleanupCount()) === 0, "atomic metadata commit clears staging intent");
    const attachments = await listAttachmentsBySubmission(withFile);
    check(attachments.length === 1 && (await new Response((await readStoredSubmissionAttachment(upload.filePath)).buffer).text()) === "private contents", "private R2 object streams exact bytes");
    await assert.rejects(deleteStoredSubmissionAttachment(upload.filePath),/referenced/);checks++;
    for (const [name,actor,allowed] of [["guest",testActors.guest,false],["owner",testActors.member1,true],["other member",testActors.member2,false],["admin",testActors.admin,true],["superuser",testActors.superuser,true]] as const) {
      setSession(sessionFor(actor));
      const response = await download(new Request("https://test.invalid/api/submission-attachments/"+attachments[0].id),{params:Promise.resolve({attachmentId:String(attachments[0].id)})});
      check(response.status === (allowed ? 200 : 404),`${name}: private R2 download ${allowed ? "allowed" : "denied"}`);
      check(response.headers.get("Cache-Control") === "private, no-store",`${name}: attachment never publicly cacheable`);
      if (allowed) check((await response.text()) === "private contents",`${name}: authorized download matches bytes`);
    }
    setSession(null);
    check((await download(new Request("https://test.invalid/file"),{params:Promise.resolve({attachmentId:String(attachments[0].id)})})).status===401,"anonymous R2 download denied");
    const legacy = await createSubmission({taskId:task.id,authorId:member.id,content:"legacy",visibility:"private",filePath:upload.filePath,fileName:"private.txt",fileMimeType:"text/plain",fileSizeBytes:16});
    setSession(sessionFor(testActors.member2));
    check((await downloadLegacy(new Request("https://test.invalid/file"),{params:Promise.resolve({submissionId:String(legacy.id)})})).status===404,"legacy attachment denies cross-user access");
    setSession(sessionFor(testActors.member1));
    check((await downloadLegacy(new Request("https://test.invalid/file"),{params:Promise.resolve({submissionId:String(legacy.id)})})).status===200,"legacy attachment preserves owner access");
    const staged1=await saveUploadedSubmissionAttachment(new File(["one"],"same.txt"),{taskId:task.id,authorId:member.id});
    const staged2=await saveUploadedSubmissionAttachment(new File(["two"],"same.txt"),{taskId:task.id,authorId:member.id});
    check(staged1.filePath!==staged2.filePath,"repeated filenames never overwrite another upload");
    const beforeCount=await DB.prepare("SELECT COUNT(*) AS n FROM submissions").first<{n:number}>();
    await assert.rejects(createSubmissionWithAttachments({taskId:task.id,authorId:member.id,content:"must rollback"},[staged1,{...staged2,filePath:null} as unknown as StoredSubmissionAttachment]));checks++;
    check((await DB.prepare("SELECT COUNT(*) AS n FROM submissions").first<{n:number}>())?.n===beforeCount?.n,"second metadata failure rolls back parent and every attachment");
    check(await ATTACHMENTS.head(staged1.filePath),"uncommitted bytes remain tracked for cleanup");
    await deleteStoredSubmissionAttachment(staged1.filePath);await deleteStoredSubmissionAttachment(staged2.filePath);
    const failingBucket=new Proxy(ATTACHMENTS,{get(target,key){if(key==="delete")return async()=>{throw new Error("synthetic R2 delete failure");};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});
    await deleteSubmission(legacy.id);
    await deleteSubmission(withFile);
    check((await pendingObjectCleanupCount())>0,"cascade deletion retains private object cleanup keys");
    await runWithHostedBindings({DB,ATTACHMENTS:failingBucket},()=>retryObjectCleanup());
    check(await ATTACHMENTS.head(upload.filePath) && (await pendingObjectCleanupCount())>0,"R2 delete failure preserves durable retry work");
    await new Promise((resolve)=>setTimeout(resolve,1100));
    await retryObjectCleanup();await retryObjectCleanup();
    check(await ATTACHMENTS.head(upload.filePath)===null && await pendingObjectCleanupCount()===0,"repeated cleanup is safe and completes after storage recovery");
    const failPut=new Proxy(ATTACHMENTS,{get(target,key){if(key==="put"||key==="delete")return async()=>{throw new Error("synthetic interrupted upload");};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});
    await assert.rejects(runWithHostedBindings({DB,ATTACHMENTS:failPut},()=>saveUploadedSubmissionAttachment(new File(["broken"],"interrupted.txt"),{taskId:task.id,authorId:member.id})));checks++;
    check(await pendingObjectCleanupCount()>0,"interrupted upload with failed compensation remains recoverable");
    await retryObjectCleanup();check(await pendingObjectCleanupCount()===0,"interrupted upload retry clears stale intent");
    await DB.prepare("INSERT INTO file_cleanup_jobs(object_key,not_before) VALUES('poisoned/key','2000-01-01T00:00:00.000Z'),('healthy/key','2000-01-02T00:00:00.000Z')").run();
    await ATTACHMENTS.put("healthy/key","healthy");
    const poisonedBucket=new Proxy(ATTACHMENTS,{get(target,key){if(key==="delete")return async(objectKey: string)=>{if(objectKey==="poisoned/key")throw new Error("synthetic poisoned key");return target.delete(objectKey);};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});
    const poisonedResult=await runWithHostedBindings({DB,ATTACHMENTS:poisonedBucket},()=>retryObjectCleanup(1));
    check(poisonedResult.failed===1,"poisoned cleanup failure is reported");
    await runWithHostedBindings({DB,ATTACHMENTS:poisonedBucket},()=>retryObjectCleanup(1));
    check(await ATTACHMENTS.head("healthy/key")===null,"backoff prevents poisoned job from starving newer cleanup");
    await DB.prepare("DELETE FROM file_cleanup_jobs WHERE object_key='poisoned/key'").run();
    await assert.rejects(readStoredSubmissionAttachment("../outside"),/Invalid/);checks++;
    const oversized=new File([new Uint8Array(20*1024*1024+1)],"too-large.bin");
    await assert.rejects(saveUploadedSubmissionAttachment(oversized,{taskId:task.id,authorId:member.id}),/20MB/);checks++;
    const unchanged = await getSubmissionByIdForViewer(hidden.id,{canSeeAll:true});
    await assert.rejects(updateSubmissionWithAttachments({id:hidden.id,content:"should not apply",visibility:"public"},[{...upload,filePath:null} as unknown as StoredSubmissionAttachment]));checks++;
    check((await getSubmissionByIdForViewer(hidden.id,{canSeeAll:true}))?.content===unchanged?.content,"failed edit/attachment batch retains old text and visibility");
    console.log(`D1/R2 contract checks passed: ${checks}. Synthetic local data and mocked app sessions only; actual Google login is separate.`);

  });
} finally { await mf.dispose(); }

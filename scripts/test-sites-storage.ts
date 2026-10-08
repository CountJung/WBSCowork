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
    check(status.managedMigrations && status.existingTableCount === 6 && status.tables.every((t) => !t.missingColumns.length), "all six domain tables migrated");
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
    console.log(`D1 contract checks passed: ${checks}. Synthetic local data only.`);
  });
} finally { await mf.dispose(); }

/** Real ephemeral D1/R2 and route/repository tests. Native execution remains a separately reported gate. */
import { setSession } from "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Miniflare, Log, LogLevel } from "miniflare";
import { TEST_SUPERUSER_EMAIL } from "../tests/helpers/test-env";

const out = path.resolve(".test-artifacts/project-media-d1"); await mkdir(out, { recursive: true });
const mf = new Miniflare({ cf: false, modules: true, script: "export default {fetch(){return new Response('synthetic media storage');}}", d1Databases: { DB: "project-media-tests" }, r2Buckets: { ATTACHMENTS: "project-media-tests" }, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], log: new Log(LogLevel.ERROR) });
const people = [
  { id: 1, email: TEST_SUPERUSER_EMAIL, role: "guest" }, { id: 2, email: "media-admin@example.test", role: "admin" }, { id: 3, email: "media-other-admin@example.test", role: "admin" },
  { id: 4, email: "media-leader@example.test", role: "member" }, { id: 5, email: "media-member@example.test", role: "member" }, { id: 6, email: "media-other-team@example.test", role: "member" },
  { id: 7, email: "media-guest@example.test", role: "guest" }, { id: 8, email: "media-outsider@example.test", role: "member" }, { id: 9, email: "media-replacement@example.test", role: "member" },
] as const;
const view = (id: number, forged = false) => ({ userId: id, email: people.find(person => person.id === id)!.email, isSuperuser: id === 1 || forged });
function session(id: number | null, forged = false) { const user = people.find(person => person.id === id); setSession(user ? { user: { ...user, isSuperuser: id === 1 || forged }, expires: "2099-01-01T00:00:00.000Z" } : null); }
const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const repo = await import("../src/entities/project-media/index.server");
const routes = await import("../src/features/project-media/index.server");
const { runWithHostedBindings } = await import("../src/shared/server/hosted-runtime/index.server");
const { objectIsReferenced, deleteUnreferencedObject } = await import("../src/shared/server/object-cleanup/index.server");
const assertions: string[] = [];
const check = (value: unknown, label: string) => { assert.ok(value, label); assertions.push(label); console.log("PASS " + label); };
const rejected = async (work: Promise<unknown>, code: string, label: string) => { await assert.rejects(work, error => (error as { code?: string }).code === code); check(true, label); };
const context = (mediaId?: number, projectId = 1001, teamId = 1101) => ({ params: Promise.resolve({ projectId: String(projectId), teamId: String(teamId), ...(mediaId ? { mediaId: String(mediaId) } : {}) }) });
const origin = "http://127.0.0.1:3000";
try {
  const db = await mf.getD1Database("DB"), bucket = await mf.getR2Bucket("ATTACHMENTS");
  for (const file of (await readdir("drizzle")).filter(name => name.endsWith(".sql")).sort()) for (const sql of (await readFile("drizzle/" + file, "utf8")).split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) await db.prepare(sql).run();
  const query = async (sql: string, params: (string | number | null)[] = []) => (await db.prepare(sql).bind(...params).all()).results as Record<string, unknown>[];
  for (const user of people) await query("INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)", [user.id, user.email, "Synthetic " + user.id, user.role]);
  for (const id of [1001, 1002, 1003]) await query("INSERT INTO projects(id,name,project_type,access_mode,start_date,end_date) VALUES(?,?,'volunteering',?,'2026-10-01','2026-12-01')", [id, "Synthetic media " + id, id === 1003 ? "legacy_authenticated" : "members_only"]);
  for (const id of [2, 4, 5, 6, 7, 9]) await query("INSERT INTO project_members(project_id,user_id) VALUES(1001,?)", [id]);
  await query("INSERT INTO project_members(project_id,user_id) VALUES(1002,3)");
  for (const [id, project] of [[1101, 1001], [1102, 1001], [2101, 1002]]) await query("INSERT INTO activity_teams(id,project_id,activity_kind,name) VALUES(?,?,'media',?)", [id, project, "Synthetic media team " + id]);
  for (const [team, id, role] of [[1101, 4, "leader"], [1101, 5, "member"], [1101, 9, "member"], [1102, 6, "leader"]] as const) await query("INSERT INTO activity_team_members(project_id,team_id,user_id,role) VALUES(1001,?,?,?)", [team, id, role]);
  await query("INSERT INTO activity_team_leaders(project_id,team_id,user_id) VALUES(1001,1101,4),(1001,1102,6)");
  await runWithHostedBindings({ DB: db, ATTACHMENTS: bucket } as unknown as Parameters<typeof runWithHostedBindings>[0], async () => {
    check((await repo.listMediaTeams(view(4), 1001)).length === 2, "team metadata does not multiply by unrelated users");
    await rejected(repo.listMediaTeams(view(8), 1003), "NOT_FOUND", "legacy project portal still rejects nonmembers");
    await rejected(repo.listMediaTeams(view(3), 1001), "NOT_FOUND", "administrator of another project cannot list media");
    await rejected(repo.listMediaTeams(view(8, true), 1001), "NOT_FOUND", "forged superuser flag cannot grant portal access");
    check((await repo.listMediaTeams(view(1), 1001)).every(team => team.canUpload), "configured superuser retains management with guest database role and no assignment");
    const input = { file: new File([pngBytes], "합성-사진.png", { type: "image/png" }), title: "합성 사진", caption: "합성 내용만 사용", visibility: "team_private" as const, mutationKey: randomUUID() };
    await rejected(repo.createProjectMedia(view(5), 1001, 1101, input), "NOT_FOUND", "ordinary team member cannot upload");
    await rejected(repo.createProjectMedia(view(6), 1001, 1101, input), "NOT_FOUND", "leader of another team cannot upload");
    const created = await repo.createProjectMedia(view(4), 1001, 1101, input);
    check(created.version === 1 && created.visibility === "team_private", "upload starts private with persisted version1");
    check((await repo.createProjectMedia(view(4), 1001, 1101, input)).id === created.id, "same upload retry resolves to same metadata and bytes");
    await rejected(repo.createProjectMedia(view(4), 1001, 1101, { ...input, caption: "changed" }), "CONFLICT", "token reuse with different upload content is rejected");
    const stored = await repo.getProjectMediaFileForViewer(view(4), 1001, 1101, created.id);
    check(await objectIsReferenced(stored.filePath), "new media protects its live object from existing cleanup");
    await assert.rejects(deleteUnreferencedObject(stored.filePath)); check(!!await bucket.get(stored.filePath), "cleanup refuses to delete referenced media bytes");
    check((await repo.getProjectMediaForViewer(view(5), 1001, 1101, created.id)).id === created.id, "current own team member can read team-private media");
    await rejected(repo.getProjectMediaForViewer(view(6), 1001, 1101, created.id), "NOT_FOUND", "other team cannot read private media");
    await rejected(repo.getProjectMediaForViewer(view(7), 1001, 1101, created.id), "NOT_FOUND", "guest membership alone does not add private team access");
    await rejected(repo.getProjectMediaForViewer(view(3), 1002, 2101, created.id), "NOT_FOUND", "cross-project media and team IDs cannot be combined");
    const change = { title: "공유할 합성 사진", caption: "공유 동의를 확인한 합성 자료", visibility: "project" as const, version: 1, mutationKey: randomUUID() };
    const shared = await repo.updateProjectMedia(view(4), 1001, 1101, created.id, change);
    check(shared.version === 2 && (await repo.getProjectMediaForViewer(view(7), 1001, 1101, created.id)).id === created.id, "explicit project visibility grants current project members including guests");
    check((await repo.updateProjectMedia(view(4), 1001, 1101, created.id, change)).version === 2, "metadata retry is idempotent");
    check((await repo.createProjectMedia(view(4), 1001, 1101, input)).id === created.id, "upload receipt survives later caption and visibility changes");
    await rejected(repo.updateProjectMedia(view(4), 1001, 1101, created.id, { ...change, version: 1, mutationKey: randomUUID() }), "CONFLICT", "stale version cannot overwrite a newer visibility");
    check((await query("SELECT * FROM project_media_revisions WHERE media_id=?", [created.id])).length === 2, "both private baseline and explicit sharing revision remain immutable");
    session(null); check((await routes.serveMedia(new Request(origin + created.fileUrl), context(created.id))).status === 401, "anonymous direct media requests require login");
    session(7); const full = await routes.serveMedia(new Request(origin + created.fileUrl), context(created.id)); check(full.status === 200 && Buffer.from(await full.arrayBuffer()).equals(pngBytes) && full.headers.get("Cache-Control") === "private, no-store" && full.headers.get("X-Content-Type-Options") === "nosniff", "authorized file bytes match and cannot enter shared caches");
    const range = await routes.serveMedia(new Request(origin + created.fileUrl, { headers: { Range: "bytes=1-3" } }), context(created.id)); check(range.status === 206 && Buffer.from(await range.arrayBuffer()).equals(pngBytes.subarray(1, 4)) && range.headers.get("Content-Range") === `bytes 1-3/${pngBytes.length}`, "protected byte-range requests return exact bounded bytes");
    check((await routes.serveMedia(new Request(origin + created.fileUrl, { headers: { Range: "bytes=999999-" } }), context(created.id))).status === 416, "out-of-range requests fail with416");
    await query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=7");
    check((await routes.serveMedia(new Request(origin + created.fileUrl), context(created.id))).status === 404, "revoked member's open file URL fails on next request");
    await query("UPDATE activity_team_leaders SET user_id=9 WHERE project_id=1001 AND team_id=1101"); await query("UPDATE activity_team_members SET role='member' WHERE team_id=1101 AND user_id=4"); await query("UPDATE activity_team_members SET role='leader' WHERE team_id=1101 AND user_id=9");
    await rejected(repo.createProjectMedia(view(4), 1001, 1101, { ...input, mutationKey: randomUUID() }), "NOT_FOUND", "old leader loses edit rights immediately");
    check((await repo.updateProjectMedia(view(9), 1001, 1101, created.id, { title: "새 팀장 확인", caption: "", visibility: "team_private", version: 2, mutationKey: randomUUID() })).version === 3, "replacement leader edits only the current own team");
    session(6); check((await routes.serveMedia(new Request(origin + created.fileUrl), context(created.id))).status === 404, "private visibility change immediately closes other-team file URLs");
    await query("UPDATE activity_team_members SET active=0 WHERE project_id=1001 AND team_id=1101 AND user_id=4");
    check((await repo.getProjectMediaForViewer(view(4), 1001, 1101, created.id)).id === created.id, "author may read own private media while project membership remains");
    await query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=4"); await rejected(repo.getProjectMediaForViewer(view(4), 1001, 1101, created.id), "NOT_FOUND", "author access is revoked with project membership");
    session(9); const form = new FormData(); form.set("file", new File([pngBytes], "실제-합성.png", { type: "image/png" })); form.set("title", "Multipart 합성 사진"); form.set("caption", ""); form.set("visibility", "team_private"); form.set("mutationKey", randomUUID());
    const upload = await routes.uploadMedia(new Request(origin + "/api/media", { method: "POST", headers: { Origin: origin }, body: form }), context());
    check(upload.status === 201 && Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === 2, "real multipart File route creates one protected item");
    const denied = await routes.uploadMedia(new Request(origin + "/api/media", { method: "POST", headers: { Origin: "https://wrong.example.test" }, body: form }), context()); check(denied.status === 403, "cross-origin upload is rejected");
    const bad = new FormData(); bad.set("file", new File(["<svg onload='alert(1)'>"], "image.png", { type: "image/png" })); for (const key of ["title", "caption", "visibility", "mutationKey"]) bad.set(key, String(form.get(key))); bad.set("mutationKey", randomUUID());
    const failed = await routes.uploadMedia(new Request(origin + "/api/media", { method: "POST", headers: { Origin: origin }, body: bad }), context()); check(failed.status === 400 && Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === 2, "spoofed image upload fails without partial metadata");
    const failedStorage = { put: async () => { throw new Error("Synthetic storage failure"); }, delete: (key: string) => bucket.delete(key), get: (key: string) => bucket.get(key) };
    await assert.rejects(runWithHostedBindings({ DB: db, ATTACHMENTS: failedStorage } as unknown as Parameters<typeof runWithHostedBindings>[0], () => repo.createProjectMedia(view(9), 1001, 1101, { ...input, mutationKey: randomUUID() })));
    check(Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === 2, "storage upload failure cannot create partial metadata");
    const revokedLeaseStorage = { put: async (key: string, value: unknown, options: unknown) => { const result = await bucket.put(key, value as never, options as never); await query("UPDATE file_cleanup_jobs SET staging_expires_at=NULL WHERE object_key=?", [key]); return result; }, delete: (key: string) => bucket.delete(key), get: (key: string) => bucket.get(key) };
    await rejected(runWithHostedBindings({ DB: db, ATTACHMENTS: revokedLeaseStorage } as unknown as Parameters<typeof runWithHostedBindings>[0], () => repo.createProjectMedia(view(9), 1001, 1101, { ...input, mutationKey: randomUUID() })), "CONFLICT", "cleanup lease revocation wins over a delayed metadata commit");
    check(Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === 2 && (await query("SELECT object_key FROM project_media_upload_staging WHERE state='failed'")).length === 1, "revoked staging retains durable failure evidence without exposing an item");
    let injectFailure = true;
    const uncertainDatabase = { prepare: (sql: string) => db.prepare(sql), batch: async (statements: Parameters<typeof db.batch>[0]) => { const result = await db.batch(statements); if (injectFailure) { injectFailure = false; throw new Error("Synthetic response loss after commit"); } return result; } };
    const recovered = await runWithHostedBindings({ DB: uncertainDatabase, ATTACHMENTS: bucket } as unknown as Parameters<typeof runWithHostedBindings>[0], () => repo.createProjectMedia(view(9), 1001, 1101, { ...input, mutationKey: randomUUID() }));
    check(recovered.version === 1 && Number((await query("SELECT COUNT(*) n FROM project_media_items"))[0].n) === 3, "uncertain committed metadata result is resolved by receipt before cleanup");
    const recoveredStorage = await repo.getProjectMediaFileForViewer(view(9), 1001, 1101, recovered.id); check(!!await bucket.get(recoveredStorage.filePath), "uncertain commit recovery preserves the attached media bytes");
    const videoFile = path.join(out, "synthetic.mp4"), ffmpeg = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=16x16:d=0.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoFile], { encoding: "utf8" });
    assert.equal(ffmpeg.status, 0, ffmpeg.stderr); const video = await readFile(videoFile);
    const uploadedVideo = await repo.createProjectMedia(view(9), 1001, 1101, { file: new File([video], "합성 영상.mp4", { type: "video/mp4" }), title: "합성 영상", caption: "", visibility: "project", mutationKey: randomUUID() });
    check(uploadedVideo.mimeType === "video/mp4" && uploadedVideo.sizeBytes === video.length, "valid synthetic encoded MP4 uploads with bounded verified container");
    const webmFile = path.join(out, "synthetic.webm"), webmResult = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=16x16:d=0.2", "-c:v", "libvpx", webmFile], { encoding: "utf8" });
    assert.equal(webmResult.status, 0, webmResult.stderr); const webm = await readFile(webmFile);
    const uploadedWebm = await repo.createProjectMedia(view(9), 1001, 1101, { file: new File([webm], "합성 영상.webm", { type: "video/webm" }), title: "WebM 합성 영상", caption: "", visibility: "team_private", mutationKey: randomUUID() });
    check(uploadedWebm.mimeType === "video/webm" && uploadedWebm.sizeBytes === webm.length, "valid synthetic encoded WebM uploads without external conversion");
    let canceled = false;
    const revokeDuringGet = (mutate: () => Promise<unknown>) => ({ get: async (key: string) => {
      const object = await bucket.get(key); if (!object) return null; const data = new Uint8Array(await object.arrayBuffer()); await mutate();
      return { size: data.length, body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(data); }, cancel() { canceled = true; } }) };
    } });
    session(6); const revokedWhileReading = await runWithHostedBindings({ DB: db, ATTACHMENTS: revokeDuringGet(() => query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=6")) } as unknown as Parameters<typeof runWithHostedBindings>[0], () => routes.serveMedia(new Request(origin + uploadedVideo.fileUrl), context(uploadedVideo.id)));
    check(revokedWhileReading.status === 404 && canceled, "membership revoked during async object I/O returns404 and cancels private bytes");
    await query("UPDATE project_members SET active=1 WHERE project_id=1001 AND user_id=6"); canceled = false;
    const privateWhileReading = await runWithHostedBindings({ DB: db, ATTACHMENTS: revokeDuringGet(() => query("UPDATE project_media_items SET visibility='team_private' WHERE id=?", [uploadedVideo.id])) } as unknown as Parameters<typeof runWithHostedBindings>[0], () => routes.serveMedia(new Request(origin + uploadedVideo.fileUrl), context(uploadedVideo.id)));
    check(privateWhileReading.status === 404 && canceled, "visibility tightened during object I/O returns404 and cancels the old public response");
    session(1); canceled = false;
    const suDuringChange = await runWithHostedBindings({ DB: db, ATTACHMENTS: revokeDuringGet(() => query("UPDATE project_members SET active=0 WHERE project_id=1001 AND user_id=9")) } as unknown as Parameters<typeof runWithHostedBindings>[0], () => routes.serveMedia(new Request(origin + uploadedVideo.fileUrl), context(uploadedVideo.id)));
    check(suDuringChange.status === 200 && Buffer.from(await suDuringChange.arrayBuffer()).equals(video), "configured superuser is reauthorized without assignment while ordinary membership changes");
    const broken = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("Synthetic media stream failure")); } });
    await assert.rejects(new Response(routes.mediaRangeStream(broken, 0, 10)).arrayBuffer()); check(!broken.locked, "failed range stream releases its source reader lock");
    let consumerCanceled = false;
    const endless = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array([1])); }, cancel() { consumerCanceled = true; } });
    const consumer = routes.mediaRangeStream(endless, 0, 100).getReader(); await consumer.read(); await consumer.cancel();
    check(consumerCanceled && !endless.locked, "consumer cancellation cancels storage and releases the reader once");

  });
  await writeFile(path.join(out, "result.json"), JSON.stringify({ complete: true, runtime: "d1-r2", checks: assertions.length, assertions, nativeExecuted: false, nativeBlocker: "Selected environment has no MariaDB binary/service; unsupported install paths are not retried.", browserExecuted: false, productionChanged: false }, null, 2));
  console.log(JSON.stringify({ complete: true, checks: assertions.length, runtime: "d1-r2", nativeExecuted: false }));
} finally { session(null); await mf.dispose(); }

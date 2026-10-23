/** Only the action orchestration is mocked here; real DB semantics have their own dual-runtime harness. */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { applyTestEnv } from "./helpers/test-env";
import { formDataFrom, runAction } from "./helpers/redirect";
import { mockModuleExports } from "./helpers/mock-module";
import type { UserActionLogPayload } from "../src/shared/server/logging/index.server";

applyTestEnv();
let deleted = false;
let fault: "none" | "database" | "cleanup" | "refresh" | "audit" | "cleanup-refresh" = "none";
let authorId = 2;
let cleanupCalls: string[] = [];
let failures: UserActionLogPayload[] = [];
let audits: UserActionLogPayload[] = [];
function replace(specifier: string, exports: Record<string, unknown>) {
  mockModuleExports(specifier.startsWith(".") ? new URL(specifier, import.meta.url).href : specifier, exports);
}
replace("server-only", {});
replace("next/cache", { revalidatePath() { if (fault === "refresh" || fault === "cleanup-refresh") throw new Error("synthetic refresh failure"); } });
replace("../src/entities/user/index.server.ts", {
  getAuthSession: async () => ({ user: { email: "owner@example.test", role: "member", isSuperuser: false } }),
  getSignInPath: () => "/api/auth/signin",
  getUserByEmail: async () => ({ id: 2, email: "owner@example.test", role: "member" }),
});
const unused = () => { throw new Error("Unexpected repository call in deletion action"); };
replace("../src/entities/task/index.server.ts", {
  getTaskById: async () => ({ id: 11, projectId: 1 }),
  createTask: unused, deleteTask: unused, updateTask: unused, changeTaskStatus: unused,assertTaskScope:unused,
});
replace("../src/shared/server/logging/index.server.ts", {
  logUserAction: async (_source: string, payload: UserActionLogPayload) => { if (fault === "audit") throw new Error("synthetic audit failure"); audits.push(payload); },
  logUserActionFailure: async (_source: string, payload: UserActionLogPayload) => { failures.push(payload); },
});
replace("../src/entities/submission/index.server.ts", {
  getSubmissionAttachmentById: unused, listAttachmentsByTask: unused,
  createSubmissionWithAttachments: unused, updateSubmissionWithAttachments: unused,
  listSubmissionsByTask: unused, listRevisionFilePathsByTask: unused,
  getSubmissionRevisionForViewer: unused, saveUploadedSubmissionAttachment: unused,
  deleteProjectUploadDirectories: unused,
  getSubmissionByIdForViewer: async () => ({ id: 21, taskId: 11, authorId, filePath: null }),
  listAttachmentsBySubmission: async () => [{ filePath: "synthetic/attachment" }],
  listRevisionFilePathsBySubmission: async () => ["synthetic/revision"],
  deleteSubmission: async () => { if (fault === "database") throw new Error("synthetic transaction rollback"); deleted = true; return { id: 21 }; },
  deleteStoredSubmissionAttachment: async (path: string) => { cleanupCalls.push(path); if (fault === "cleanup" || fault === "cleanup-refresh") throw new Error("synthetic storage failure"); },
});
const { deleteSubmissionAction } = await import("../src/features/task-workspace/server/actions");
const form = () => formDataFrom({ projectId: 1, taskId: 11, submissionId: 21, confirmRevisionDeletion: "yes" });
beforeEach(() => { deleted = false; fault = "none"; authorId = 2; cleanupCalls = []; failures = []; audits = []; });

test("committed delete reports success and cleans all known files", async () => {
  const outcome = await runAction(() => deleteSubmissionAction(form()));
  assert.equal(outcome.status, "success"); assert.equal(outcome.message, "제출물을 삭제했습니다.");
  assert.equal(deleted, true); assert.deepEqual(cleanupCalls, ["synthetic/revision", "synthetic/attachment"]);
  assert.deepEqual(audits.map(row => row.action), ["submission.delete"]); assert.deepEqual(failures, []);
});
test("transaction failure reports failure without file cleanup or success audit", async () => {
  fault = "database";
  const outcome = await runAction(() => deleteSubmissionAction(form()));
  assert.equal(outcome.status, "error"); assert.equal(outcome.message, "synthetic transaction rollback");
  assert.equal(deleted, false); assert.deepEqual(cleanupCalls, []); assert.deepEqual(audits, []);
  assert.deepEqual(failures.map(row => row.action), ["submission.delete"]);
});
test("ownership denial never reaches deletion or storage cleanup", async () => {
  authorId = 3;
  const outcome = await runAction(() => deleteSubmissionAction(form()));
  assert.equal(outcome.status, "error"); assert.match(outcome.message!, /본인이 작성한/);
  assert.equal(deleted, false); assert.deepEqual(cleanupCalls, []); assert.deepEqual(audits, []);
});
test("missing permanent-delete confirmation preserves data", async () => {
  const input = form(); input.delete("confirmRevisionDeletion");
  const outcome = await runAction(() => deleteSubmissionAction(input));
  assert.equal(outcome.status, "error"); assert.equal(deleted, false); assert.deepEqual(cleanupCalls, []);
});
test("storage failure reports committed DB deletion and pending cleanup", async () => {
  fault = "cleanup";
  const outcome = await runAction(() => deleteSubmissionAction(form()));
  assert.equal(deleted, true); assert.equal(outcome.status, "error");
  assert.match(outcome.message!, /DB는 삭제됐고 파일 정리는 재시도 대기/);
  assert.equal(failures.some(row => row.action === "submission.delete"), false);
});
test("refresh failure preserves the earlier pending-file-cleanup result", async () => {
  fault = "cleanup-refresh";
  const outcome = await runAction(() => deleteSubmissionAction(form()));
  assert.equal(deleted, true); assert.equal(outcome.status, "error");
  assert.match(outcome.message!, /DB는 삭제됐고 파일 정리는 재시도 대기/);
  assert.equal(failures.at(-1)?.action, "submission.delete.followup");
  assert.equal(failures.at(-1)?.metadata?.cleanupFailed, true);
});
for (const phase of ["refresh", "audit"] as const) test(`${phase} exception after commit never reports a failed DB deletion`, async () => {
  fault = phase;
  const outcome = await runAction(() => deleteSubmissionAction(form()));
  assert.equal(deleted, true); assert.equal(outcome.status, "error");
  assert.match(outcome.message!, /삭제됐지만 후속 처리/);
  assert.deepEqual(failures.map(row => row.action), ["submission.delete.followup"]);
  assert.equal(failures[0].metadata?.metadataDeleted, true);
});

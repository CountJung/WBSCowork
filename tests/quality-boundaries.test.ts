import "./helpers/bootstrap";
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDateRange, toCalendarDate } from "@/src/shared/lib/date";
import { attachmentResponseHeaders } from "@/src/shared/lib/attachment-response";
import { validateObjectKey } from "@/src/shared/server/object-cleanup/index.server";
import { resolveStoredSubmissionAttachmentPath, saveUploadedSubmissionAttachment } from "@/src/entities/submission/index.server";
import { createProject, updateProject } from "@/src/entities/project/index.server";
import { createTask, updateTask } from "@/src/entities/task/index.server";

for (const date of ["", "0000-01-01", "0000-invalid", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-1-01", "2026-01-01T00:00:00Z"]) {
  test(`invalid calendar date rejected: ${JSON.stringify(date)}`, () => assert.throws(() => toCalendarDate(date)));
}
test("leap/same-day dates stay canonical without timezone rollover", () => {
  assert.deepEqual(validateDateRange("2024-02-29", "2024-02-29"), { startDate: "2024-02-29", endDate: "2024-02-29" });
  assert.equal(toCalendarDate(new Date("2026-01-02T01:00:00Z")), "2026-01-02");
  assert.throws(() => toCalendarDate(new Date(NaN)));
  assert.throws(() => validateDateRange("2026-03-01", "2026-02-28"), /늦을 수/);
});
test("all task/project repository writes reject bad ranges before DB access", async () => {
  const dates = { startDate: "2026-02-02", endDate: "2026-01-01" };
  await assert.rejects(createProject({ name: "fixture", ...dates }), /늦을 수/);
  await assert.rejects(updateProject({ id: 1, name: "fixture", ...dates }), /늦을 수/);
  await assert.rejects(createTask({ projectId: 1, title: "fixture", ...dates }), /늦을 수/);
  await assert.rejects(updateTask({ id: 1, title: "fixture", ...dates }), /늦을 수/);
});
for (const key of ["../outside", "../uploads-sibling/file", "/absolute", "a\\b", "", ".", "a/../b", "a//b", "a/./b", "a/\u0000b", "a/\nb"]) {
  test(`native/R2 path rejected: ${JSON.stringify(key)}`, () => {
    assert.throws(() => validateObjectKey(key));
    assert.throws(() => resolveStoredSubmissionAttachmentPath(key));
  });
}
test("legitimate relative attachment path is retained", () => {
  assert.equal(validateObjectKey("submissions/1/2/file.txt"), "submissions/1/2/file.txt");
  assert.match(resolveStoredSubmissionAttachmentPath("submissions/1/2/file.txt"), /submissions\/1\/2\/file\.txt$/);
});
test("download filename uses RFC5987 escaping and safe MIME fallback", () => {
  const name = "한글'\"\r\nfile(1)*!.txt";
  const headers = attachmentResponseHeaders({ fileName: name, mimeType: "text/plain\r\nX-Evil: yes", size: 3, inlineRequested: true });
  assert.equal(headers["Content-Type"], "application/octet-stream");
  assert.equal(headers["Content-Length"], "3");
  assert.match(headers["Content-Disposition"], /^attachment;/);
  assert.equal(decodeURIComponent(headers["Content-Disposition"].split("UTF-8''")[1]), name);
  assert.doesNotMatch(headers["Content-Disposition"].split("UTF-8''")[1], /['"\r\n()*!]/);
});


test("native upload sanitizes hostile filename while retaining exact small bytes", async () => {
  const saved = await saveUploadedSubmissionAttachment(new File(["x"], "../../한글\\evil\r\nname'().txt", { type: "text/plain" }), { taskId: 777, authorId: 888 });
  assert.doesNotMatch(saved.fileName, /[\x00-\x1f\x7f/\\]/);
  assert.match(saved.fileName, /한글/);
  assert.match(saved.filePath, /^submissions\/777\/888\/[^/]+$/);
  assert.equal(saved.fileSizeBytes, 1);
  assert.equal(validateObjectKey(saved.filePath), saved.filePath);
});
test("empty/oversized upload and invalid synthetic IDs fail before write", async () => {
  await assert.rejects(saveUploadedSubmissionAttachment(new File([], "empty"), { taskId: 777, authorId: 888 }), /비어/);
  await assert.rejects(saveUploadedSubmissionAttachment(new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large"), { taskId: 777, authorId: 888 }), /이하/);
  await assert.rejects(saveUploadedSubmissionAttachment(new File(["x"], "small"), { taskId: -1, authorId: 888 }), /Invalid/);
});

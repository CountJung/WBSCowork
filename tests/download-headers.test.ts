import "./helpers/bootstrap";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mockModuleExports } from "./helpers/mock-module";
import { setSession } from "./helpers/bootstrap";
import { sessionFor, testActors } from "./helpers/session";

// Header behavior only. Authorization/SQL/R2 bytes are exercised by the actual Worker suite.
mockModuleExports("@/src/entities/submission/index.server", {
  getSubmissionByIdForViewer: async () => ({ id: 1, taskId: 1, filePath: "synthetic/file", fileName: "file.txt", fileMimeType: "text/plain", fileSizeBytes: 999 }),
  getSubmissionAttachmentById: async () => ({ id: 1, submissionId: 1, filePath: "synthetic/file", fileName: "file.txt", fileMimeType: "text/plain", fileSizeBytes: 999 }),
  readStoredSubmissionAttachment: async () => ({ buffer: Buffer.from("abc"), fileSizeBytes: 3 }),
});
const legacy = await import("@/app/api/submissions/[submissionId]/attachment/route");
const multiple = await import("@/app/api/submission-attachments/[attachmentId]/route");
for (const name of ["legacy", "multiple"] as const) {
  test(`${name} route uses stored bytes length even when DB metadata is stale`, async () => {
    setSession(sessionFor(testActors.member1));
    const req = new Request("https://example.test/file");
    const response = name === "legacy" ? await legacy.GET(req, { params: Promise.resolve({ submissionId: "1" }) }) : await multiple.GET(req, { params: Promise.resolve({ attachmentId: "1" }) });
    assert.equal(response.headers.get("Content-Length"), "3");
    assert.equal(await response.text(), "abc");
  });
}

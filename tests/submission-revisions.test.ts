import "./helpers/bootstrap";
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeSubmissionMaterialUrl, submissionOperationToken, submissionRevisionNumber } from "../src/entities/submission/model/submission-revision";
import { buildSubmissionVisibilityWhere, submissionAttachmentFingerprint } from "../src/entities/submission/api/submission-revision.server";
import type { StoredSubmissionAttachment } from "../src/entities/submission/api/submission-files.server";

describe("submission material links", () => {
  test("normalizes absolute HTTP links without fetching them", () => {
    assert.equal(normalizeSubmissionMaterialUrl(undefined), "");
    assert.equal(normalizeSubmissionMaterialUrl("   "), "");
    assert.equal(normalizeSubmissionMaterialUrl(" HTTPS://Example.TEST/report "), "https://example.test/report");
    assert.equal(normalizeSubmissionMaterialUrl("http://example.test"), "http://example.test/");
  });

  test("rejects executable, relative, credentialed, control-character, and overlong URLs", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "/report", "//example.test", "https://user:secret@example.test", "https://example.test\n/report", "https://example.test/\u0000", `https://example.test/${"a".repeat(2048)}`]) {
      assert.throws(() => normalizeSubmissionMaterialUrl(value), value);
    }
  });
});

describe("submission request identity", () => {
  const upload: StoredSubmissionAttachment = {
    absolutePath: "/staging/a", filePath: "submissions/1/2/a", fileName: "proof.txt",
    fileMimeType: "text/plain", fileSizeBytes: 3, contentHash: "a".repeat(64),
  };

  test("retrying identical bytes under a new storage key has the same semantic identity", () => {
    assert.deepEqual(submissionAttachmentFingerprint([upload]), submissionAttachmentFingerprint([{ ...upload, absolutePath: "/staging/b", filePath: "submissions/1/2/b" }]));
    assert.notDeepEqual(submissionAttachmentFingerprint([upload]), submissionAttachmentFingerprint([{ ...upload, contentHash: "b".repeat(64) }]));
    assert.notDeepEqual(submissionAttachmentFingerprint([upload]), submissionAttachmentFingerprint([{ ...upload, fileName: "renamed.txt" }]));
    assert.deepEqual(submissionAttachmentFingerprint([upload]), submissionAttachmentFingerprint([{ ...upload, contentHash: "A".repeat(64) }]));
  });

  test("rejects missing digests, impossible sizes, unsafe paths, and batches over20 files", () => {
    for (const file of [{ ...upload, contentHash: "" }, { ...upload, contentHash: "z".repeat(64) }, { ...upload, fileSizeBytes: 0 }, { ...upload, filePath: "../secret" }]) {
      assert.throws(() => submissionAttachmentFingerprint([file]));
    }
    assert.throws(() => submissionAttachmentFingerprint(Array.from({ length: 21 }, () => upload)));
  });

  test("requires valid stable tokens and positive revision numbers", () => {
    assert.equal(submissionOperationToken("12345678-1234-4ABC-8ABC-123456789012"), "12345678-1234-4abc-8abc-123456789012");
    for (const value of [undefined, "", "request-1"]) assert.throws(() => submissionOperationToken(value));
    for (const value of [undefined, 0, -1, 1.5, Infinity]) assert.throws(() => submissionRevisionNumber(value));
    assert.equal(submissionRevisionNumber("2"), 2);
  });
});

describe("submission history visibility predicates", () => {
  const aliases = { submissionAlias: "s", userAlias: "u", revisionAlias: "r" };

  test("anonymous/other viewers need both current and historical public visibility", () => {
    const scope = buildSubmissionVisibilityWhere({ canSeeAll: false }, aliases);
    assert.equal(scope.clause, "AND ((s.visibility='public' AND r.visibility='public'))");
    assert.deepEqual(scope.params, []);
  });

  test("only original author identity or administrator access bypasses the dual public check", () => {
    const scope = buildSubmissionVisibilityWhere({ canSeeAll: false, viewerUserId: 42, viewerEmail: " Owner@Example.TEST " }, aliases);
    assert.match(scope.clause, /s\.author_id=\?/);
    assert.match(scope.clause, /LOWER\(u\.email\)=\?/);
    assert.doesNotMatch(scope.clause, /editor|assignee|reviewer/);
    assert.deepEqual(scope.params, [42, "owner@example.test"]);
    assert.deepEqual(buildSubmissionVisibilityWhere({ canSeeAll: true }, aliases), { clause: "", params: [] });
  });

  test("binds viewer identity and rejects SQL aliases outside the constant identifier grammar", () => {
    const email = "x' OR 1=1 --";
    const scope = buildSubmissionVisibilityWhere({ canSeeAll: false, viewerEmail: email }, aliases);
    assert.equal(scope.clause.includes(email), false);
    assert.deepEqual(scope.params, [email.toLowerCase()]);
    assert.throws(() => buildSubmissionVisibilityWhere({ canSeeAll: true }, { revisionAlias: "r; DROP TABLE users" }));
  });
});

import "./helpers/bootstrap";

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  getAbsoluteLogDirectory,
  logUserAction,
  logUserActionFailure,
} from "@/src/shared/server/logging/index.server";

/** 기록된 로그 파일에서 마지막 항목을 읽는다. redaction 이 "기록 시점"에 일어나는지 확인하기 위함이다. */
async function readLastLoggedEntry() {
  const directory = getAbsoluteLogDirectory();
  const files = (await readdir(directory)).filter((name) => name.endsWith(".log")).sort();
  const lines = (await readFile(join(directory, files[files.length - 1]), "utf8"))
    .split("\n")
    .filter(Boolean);

  return JSON.parse(lines[lines.length - 1]) as {
    details?: { metadata?: Record<string, unknown> };
  };
}

describe("action log — 저장 경로가 로그에 남지 않는다", () => {
  before(async () => {
    await rm(getAbsoluteLogDirectory(), { recursive: true, force: true });
  });

  test("filePath 는 확장자만 남기고 축약된다", async () => {
    await logUserAction("test", {
      actorEmail: "member1@example.test",
      action: "submission.attachment.cleanup",
      entityType: "submission",
      metadata: { filePath: "/srv/uploads/12/secret-quarterly-report.pdf", fileName: "보고서.pdf" },
    });

    const entry = await readLastLoggedEntry();

    assert.equal(entry.details?.metadata?.filePath, "[redacted]:pdf");
    assert.equal(
      entry.details?.metadata?.fileName,
      "보고서.pdf",
      "파일명은 기존 감사 목적상 유지된다",
    );
  });

  test("경로성 키 전체가 축약되고 나머지 metadata 는 보존된다", async () => {
    await logUserActionFailure(
      "test",
      {
        actorEmail: "member1@example.test",
        action: "submission.delete",
        entityType: "submission",
        metadata: {
          filePath: "/srv/uploads/1/a.txt",
          storedFilePath: "/srv/uploads/1/b",
          absolutePath: "/srv/uploads/1/c.docx",
          uploadDir: "/srv/uploads",
          path: "/srv/uploads/1",
          attachmentCount: 2,
        },
      },
      new Error("cleanup failed"),
    );

    const metadata = (await readLastLoggedEntry()).details?.metadata ?? {};

    assert.equal(metadata.filePath, "[redacted]:txt");
    assert.equal(metadata.storedFilePath, "[redacted]", "확장자가 없으면 표식만 남는다");
    assert.equal(metadata.absolutePath, "[redacted]:docx");
    assert.equal(metadata.uploadDir, "[redacted]");
    assert.equal(metadata.path, "[redacted]");
    assert.equal(metadata.attachmentCount, 2, "경로가 아닌 metadata 는 그대로 남는다");
  });

  test("축약된 값에 원본 경로 조각이 남지 않는다", async () => {
    await logUserAction("test", {
      actorEmail: null,
      action: "submission.attachment.delete.file",
      entityType: "submission",
      metadata: { filePath: "/srv/uploads/99/개인정보-원본.xlsx" },
    });

    const serialized = JSON.stringify((await readLastLoggedEntry()).details?.metadata);

    assert.ok(!serialized.includes("uploads"), "디렉터리 구조가 노출되면 안 된다");
    assert.ok(!serialized.includes("개인정보-원본"), "파일 본명이 노출되면 안 된다");
  });
});

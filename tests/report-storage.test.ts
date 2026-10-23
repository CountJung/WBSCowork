import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { access, link, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { R2Bucket } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { runWithHostedBindings } from "../src/shared/server/hosted-runtime/index.server";
import {
  MAX_REPORT_BYTES, getReportStoreStatus, quarantineReportArtifact, readReportArtifact,
  restoreReportArtifact, storeReportArtifact,
} from "../src/shared/server/report-storage/index.server";

const bytes = new TextEncoder().encode("합성 보고서 bytes — 사용자 파일 아님");
const integrity = (value: Uint8Array) => ({ sha256: createHash("sha256").update(value).digest("hex"), sizeBytes: value.length });
const key = (format = "docx") => `reports/v1/run-${randomUUID()}/${randomUUID()}.${format}`;
async function fixture() {
  // Retain all synthetic files, including quarantine copies; no test performs artifact deletion.
  const base = await mkdtemp(path.join(tmpdir(), "wbs-report-storage-"));
  const root = path.join(base, "reports"), uploads = path.join(base, "uploads");
  await mkdir(root); await mkdir(uploads);
  process.env.REPORT_DIR = root;
  process.env.UPLOAD_DIR = uploads;
  return { base, root, uploads };
}
async function absent(target: string) { await assert.rejects(access(target), { code: "ENOENT" }); }

test("Native reports fail closed for missing/relative/nonexistent/overlapping configuration", async () => {
  const { root, uploads } = await fixture();
  assert.deepEqual(await getReportStoreStatus(), { configured: true });
  for (const config of [undefined, "", "relative/reports", path.join(root, "missing"), uploads, path.join(uploads, "nested"), path.dirname(root)]) {
    if (config === undefined) delete process.env.REPORT_DIR; else process.env.REPORT_DIR = config;
    assert.deepEqual(await getReportStoreStatus(), { configured: false });
    await assert.rejects(storeReportArtifact(key(), bytes), error => {
      assert.ok(error instanceof Error); assert.ok(!error.message.includes(root)); return true;
    });
  }
});

test("Native bounded atomic store verifies bytes, is idempotent and never overwrites a different artifact", async () => {
  const { root } = await fixture(), storageKey = key(), expected = integrity(bytes);
  const stored = await storeReportArtifact(storageKey, bytes);
  assert.deepEqual(stored, { storageKey, ...expected });
  assert.deepEqual(await readReportArtifact(storageKey, expected), bytes);
  assert.deepEqual(await storeReportArtifact(storageKey, bytes), stored);
  await assert.rejects(storeReportArtifact(storageKey, new Uint8Array([1, 2, 3])));
  assert.deepEqual(await readFile(path.join(root, storageKey)), Buffer.from(bytes));
  assert.deepEqual(await readdir(path.dirname(path.join(root, storageKey))), [path.basename(storageKey)]);
  const pptx = await storeReportArtifact(key("pptx"), bytes);
  assert.deepEqual(await readReportArtifact(pptx.storageKey, pptx), bytes);
  const maximum = new Uint8Array(MAX_REPORT_BYTES).fill(71), large = await storeReportArtifact(key(), maximum);
  assert.equal((await readReportArtifact(large.storageKey, large)).length, MAX_REPORT_BYTES);
  await assert.rejects(storeReportArtifact(key(), new Uint8Array(MAX_REPORT_BYTES + 1)));
  await assert.rejects(storeReportArtifact(key(), new Uint8Array()));
});

test("Native read rejects bad metadata, altered content and size without modifying the file", async () => {
  const { root } = await fixture(), stored = await storeReportArtifact(key(), bytes), target = path.join(root, stored.storageKey);
  for (const expected of [
    { ...stored, sha256: "0".repeat(64) }, { ...stored, sha256: stored.sha256 + "\n" },
    { ...stored, sizeBytes: stored.sizeBytes - 1 }, { ...stored, sizeBytes: MAX_REPORT_BYTES + 1 },
    { ...stored, sizeBytes: 0 }, { ...stored, sizeBytes: 1.5 },
  ]) await assert.rejects(readReportArtifact(stored.storageKey, expected));
  const changed = new Uint8Array(bytes).fill(65);
  await writeFile(target, changed);
  await assert.rejects(readReportArtifact(stored.storageKey, stored), /integrity/);
  assert.deepEqual(await readFile(target), Buffer.from(changed));
});

test("Every report operation rejects traversal, attachment keys, malformed IDs, suffixes and quarantine namespace confusion", async () => {
  const { root } = await fixture(), valid = key(), expected = integrity(bytes);
  const invalid = ["../outside.docx", "/reports/v1/a/a.docx", "uploads/a.docx", "reports/v1/../a.docx", valid + "\n", valid + "?x=1", valid.replace(".docx", ".txt"), valid.replace("reports/v1/", "reports/v2/"), valid.replace("run-", "run/"), valid.replace(/\/[^/]+$/, "/not-a-uuid.docx"), valid.replace("reports/v1/", "reports/quarantine/v1/")];
  for (const invalidKey of invalid) {
    await assert.rejects(storeReportArtifact(invalidKey, bytes), /key/);
    await assert.rejects(readReportArtifact(invalidKey, expected), /key/);
    await assert.rejects(quarantineReportArtifact(invalidKey, expected), /key/);
  }
  await assert.rejects(restoreReportArtifact(valid, expected), /key/);
  assert.deepEqual(await readdir(root), []);
});

test("Native rejects symlinked root/ancestors/parents/files and hard links; outside files remain unchanged", async () => {
  const { base, root } = await fixture(), outside = path.join(base, "outside");
  await mkdir(outside); const marker = path.join(outside, "original.docx"); await writeFile(marker, bytes);
  const alias = path.join(base, "alias"); await symlink(root, alias, "dir");
  process.env.REPORT_DIR = alias;
  assert.deepEqual(await getReportStoreStatus(), { configured: false });
  await assert.rejects(storeReportArtifact(key(), bytes));
  const ancestor = path.join(base, "ancestor"); await symlink(base, ancestor, "dir");
  process.env.REPORT_DIR = path.join(ancestor, "reports");
  assert.deepEqual(await getReportStoreStatus(), { configured: false });
  process.env.REPORT_DIR = root;
  await symlink(outside, path.join(root, "reports"), "dir");
  await assert.rejects(storeReportArtifact(key(), bytes));
  assert.deepEqual(await readdir(outside), ["original.docx"]);
  assert.deepEqual(await readFile(marker), Buffer.from(bytes));
  const second = await fixture(), fileKey = key();
  await mkdir(path.dirname(path.join(second.root, fileKey)), { recursive: true });
  await symlink(marker, path.join(second.root, fileKey));
  await assert.rejects(readReportArtifact(fileKey, integrity(bytes)));
  await assert.rejects(storeReportArtifact(fileKey, bytes));
  await assert.rejects(quarantineReportArtifact(fileKey, integrity(bytes)));
  const hardKey = key(); await mkdir(path.dirname(path.join(second.root, hardKey)), { recursive: true });
  await link(marker, path.join(second.root, hardKey));
  await assert.rejects(readReportArtifact(hardKey, integrity(bytes)));
  assert.deepEqual(await readFile(marker), Buffer.from(bytes));
});

test("Native rejects an UPLOAD_DIR alias into the report root", async () => {
  const { base, root } = await fixture(), alias = path.join(base, "upload-alias");
  await symlink(root, alias, "dir"); process.env.UPLOAD_DIR = path.join(alias, "future");
  assert.deepEqual(await getReportStoreStatus(), { configured: false });
  await assert.rejects(storeReportArtifact(key(), bytes));
});

test("Native quarantine is verified, repeatable and reversible without deleting artifact bytes", async () => {
  const { root } = await fixture(), stored = await storeReportArtifact(key(), bytes);
  await assert.rejects(quarantineReportArtifact(stored.storageKey, { ...stored, sha256: "0".repeat(64) }));
  assert.deepEqual(await readReportArtifact(stored.storageKey, stored), bytes);
  const result = await quarantineReportArtifact(stored.storageKey, stored);
  assert.ok(result.quarantineKey.startsWith("reports/quarantine/v1/"));
  await absent(path.join(root, stored.storageKey));
  assert.deepEqual(await readFile(path.join(root, result.quarantineKey)), Buffer.from(bytes));
  assert.deepEqual(await quarantineReportArtifact(stored.storageKey, stored), result);
  await assert.rejects(readReportArtifact(result.quarantineKey, stored), /key/);
  assert.deepEqual(await restoreReportArtifact(result.quarantineKey, stored), { storageKey: stored.storageKey });
  assert.deepEqual(await readReportArtifact(stored.storageKey, stored), bytes);
  assert.deepEqual(await restoreReportArtifact(result.quarantineKey, stored), { storageKey: stored.storageKey });
});

test("Native restore refuses conflicting destination and preserves both copies", async () => {
  const { root } = await fixture(), stored = await storeReportArtifact(key(), bytes);
  const { quarantineKey } = await quarantineReportArtifact(stored.storageKey, stored);
  const changed = new Uint8Array([1, 2, 3]); await storeReportArtifact(stored.storageKey, changed);
  await assert.rejects(restoreReportArtifact(quarantineKey, stored));
  assert.deepEqual(await readFile(path.join(root, stored.storageKey)), Buffer.from(changed));
  assert.deepEqual(await readFile(path.join(root, quarantineKey)), Buffer.from(bytes));
});

test("Native existing crash lock fails closed and is never auto-removed", async () => {
  const { root } = await fixture(), stored = await storeReportArtifact(key(), bytes), lock = path.join(root, stored.storageKey) + ".lock";
  await writeFile(lock, "synthetic-crash-lock");
  await assert.rejects(quarantineReportArtifact(stored.storageKey, stored));
  await assert.rejects(storeReportArtifact(stored.storageKey, bytes));
  assert.equal(await readFile(lock, "utf8"), "synthetic-crash-lock");
  assert.deepEqual(await readReportArtifact(stored.storageKey, stored), bytes);
});

test("Actual isolated Miniflare R2 verifies conditional writes, quarantine copy and restoration; attachment object untouched", async () => {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('synthetic'); } };", compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], r2Buckets: { ATTACHMENTS: "synthetic-reports" } });
  try {
    const bucket = await mf.getR2Bucket("ATTACHMENTS") as unknown as R2Bucket;
    await bucket.put("submissions/original.txt", bytes);
    await runWithHostedBindings({ ATTACHMENTS: bucket }, async () => {
      assert.deepEqual(await getReportStoreStatus(), { configured: true });
      const stored = await storeReportArtifact(key(), bytes);
      assert.deepEqual(await readReportArtifact(stored.storageKey, stored), bytes);
      assert.deepEqual(await storeReportArtifact(stored.storageKey, bytes), stored);
      await assert.rejects(storeReportArtifact(stored.storageKey, new Uint8Array([1])));
      const { quarantineKey } = await quarantineReportArtifact(stored.storageKey, stored);
      assert.deepEqual(new Uint8Array(await (await bucket.get(quarantineKey))!.arrayBuffer()), bytes);
      assert.deepEqual(await readReportArtifact(stored.storageKey, stored), bytes);
      assert.deepEqual(await restoreReportArtifact(quarantineKey, stored), { storageKey: stored.storageKey });
      assert.deepEqual(await readReportArtifact(stored.storageKey, stored), bytes);
      await assert.rejects(readReportArtifact("submissions/original.txt", integrity(bytes)), /key/);
      assert.equal((await bucket.list()).objects.length, 3);
      assert.deepEqual(new Uint8Array(await (await bucket.get("submissions/original.txt"))!.arrayBuffer()), bytes);
      const corrupted = new Uint8Array(bytes).fill(65); await bucket.put(stored.storageKey, corrupted);
      await assert.rejects(readReportArtifact(stored.storageKey, stored), /integrity/);
      await assert.rejects(restoreReportArtifact(quarantineKey, stored), /integrity/);
      assert.deepEqual(new Uint8Array(await (await bucket.get(stored.storageKey))!.arrayBuffer()), corrupted);
    });
  } finally { await mf.dispose(); }
});

test("R2 bounded reads cancel oversized/short/long/error bodies, verify SHA, and fail closed without binding", async () => {
  await runWithHostedBindings({}, async () => {
    assert.deepEqual(await getReportStoreStatus(), { configured: false });
    await assert.rejects(storeReportArtifact(key(), bytes));
  });
  for (const mode of ["oversized", "short", "long", "hash", "error"] as const) {
    let canceled = false, reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads++;
        if (mode === "error") { controller.error(new Error("synthetic stream failure")); return; }
        if (reads > 1 && mode !== "long" && mode !== "oversized") { controller.close(); return; }
        controller.enqueue(mode === "long" ? new Uint8Array(bytes.length + 1) : mode === "short" ? bytes.subarray(0, 1) : new Uint8Array(bytes.length).fill(65));
      }, cancel() { canceled = true; },
    });
    const bucket = { get: async () => ({ size: mode === "oversized" ? MAX_REPORT_BYTES + 1 : bytes.length, body }) } as unknown as R2Bucket;
    await assert.rejects(runWithHostedBindings({ ATTACHMENTS: bucket }, () => readReportArtifact(key(), integrity(bytes))));
    assert.equal(body.locked, false);
    if (mode === "oversized" || mode === "long") assert.equal(canceled, true, mode);
    assert.ok(reads <= 3);
  }
});

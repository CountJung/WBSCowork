import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { getHostedAttachments, isHostedRuntime } from "../hosted-runtime/index.server";

export const MAX_REPORT_BYTES = 8 * 1024 * 1024;
export type ReportIntegrity = { sha256: string; sizeBytes: number };
export type StoredReportArtifact = ReportIntegrity & { storageKey: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const artifactPattern = new RegExp(`^reports/v1/([A-Za-z0-9][A-Za-z0-9_-]{0,79})/(${UUID}\\.(?:docx|pptx))$`);
const quarantinePattern = new RegExp(`^reports/quarantine/v1/([A-Za-z0-9][A-Za-z0-9_-]{0,79})/(${UUID}\\.(?:docx|pptx))$`);
class ReportStorageError extends Error {}
function fail(message: string): never { throw new ReportStorageError(message); }
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function validateKey(key: string, quarantine = false) {
  if (typeof key !== "string" || (quarantine ? quarantinePattern : artifactPattern).exec(key)?.[0] !== key) fail("Invalid report storage key.");
  return key;
}
function validateIntegrity(expected: ReportIntegrity) {
  if (!expected || typeof expected.sha256 !== "string" || expected.sha256.length !== 64 || !/^[0-9a-f]{64}$/.test(expected.sha256) || !Number.isSafeInteger(expected.sizeBytes) || expected.sizeBytes < 1 || expected.sizeBytes > MAX_REPORT_BYTES) fail("Invalid report integrity metadata.");
}
function verify(bytes: Uint8Array, expected: ReportIntegrity) {
  if (bytes.byteLength !== expected.sizeBytes || sha256(bytes) !== expected.sha256) fail("Report integrity verification failed.");
  return bytes;
}
function errorCode(error: unknown) { return (error as NodeJS.ErrnoException)?.code; }
async function safe<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    // Filesystem errors contain absolute paths; never expose them to callers.
    if (error instanceof ReportStorageError) throw error;
    throw new ReportStorageError("Report storage operation failed.");
  }
}
const within = (root: string, target: string) => target === root || target.startsWith(root + path.sep);

/** Reject symlinks in every existing component, including REPORT_DIR's ancestors. */
async function checkDirectory(directory: string) {
  const root = path.parse(directory).root;
  let current = root;
  for (const part of directory.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(current) !== current) fail("Unsafe report storage directory.");
  }
}
async function canonicalPotentialPath(target: string): Promise<string> {
  try { return await realpath(target); }
  catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
    const parent = path.dirname(target);
    if (parent === target) throw error;
    return path.join(await canonicalPotentialPath(parent), path.basename(target));
  }
}
async function nativeRoot() {
  // Read only at runtime; do not cache a path across requests/config changes.
  const configured = process.env["REPORT_DIR"]?.trim();
  if (!configured || !path.isAbsolute(configured)) fail("Report storage is not configured.");
  const root = path.resolve(configured);
  await checkDirectory(root);
  const upload = await canonicalPotentialPath(path.resolve(process.env["UPLOAD_DIR"]?.trim() || "./uploads"));
  if (within(root, upload) || within(upload, root)) fail("Report storage must be separate from uploads.");
  return root;
}
async function nativePath(root: string, key: string, createDirectories = false) {
  const target = path.resolve(root, key);
  if (!within(root, target) || target === root) fail("Invalid report storage path.");
  await checkDirectory(root);
  let parent = root;
  for (const part of key.split("/").slice(0, -1)) {
    parent = path.join(parent, part);
    if (createDirectories) {
      try { await mkdir(parent, { mode: 0o700 }); }
      catch (error) { if (errorCode(error) !== "EEXIST") throw error; }
    }
    await checkDirectory(parent);
  }
  return target;
}
async function maybeLstat(target: string) {
  try { return await lstat(target); }
  catch (error) { if (errorCode(error) === "ENOENT") return null; throw error; }
}
async function nativeRead(root: string, key: string, expected: ReportIntegrity) {
  const target = await nativePath(root, key);
  const before = await lstat(target);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) fail("Unsafe report artifact file.");
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.ino !== before.ino || info.dev !== before.dev || info.size !== expected.sizeBytes) fail("Report integrity verification failed.");
    // Allocate from validated bounded metadata, never from an untrusted stat size.
    const bytes = new Uint8Array(expected.sizeBytes);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!result.bytesRead) fail("Report integrity verification failed.");
      offset += result.bytesRead;
    }
    const extra = new Uint8Array(1);
    if ((await handle.read(extra, 0, 1, offset)).bytesRead) fail("Report integrity verification failed.");
    const after = await handle.stat(), current = await lstat(target);
    await nativePath(root, key);
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs || current.ino !== info.ino || current.dev !== info.dev || current.isSymbolicLink() || current.nlink !== 1) fail("Report artifact changed during reading.");
    return verify(bytes, expected);
  } finally { await handle.close(); }
}

/** Exclusive per-artifact lock also covers cooperating processes. Crash locks fail closed. */
async function withNativeLock<T>(root: string, key: string, run: () => Promise<T>) {
  const target = await nativePath(root, key, true), lock = `${target}.lock`;
  const handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  const info = await handle.stat();
  try { return await run(); }
  finally {
    await handle.close();
    await nativePath(root, key);
    const current = await lstat(lock);
    if (current.isSymbolicLink() || current.ino !== info.ino || current.dev !== info.dev) fail("Report storage lock changed.");
    // Only this call's transient lock, never an artifact or quarantine object.
    await unlink(lock);
  }
}
async function nativeStore(root: string, key: string, bytes: Uint8Array, expected: ReportIntegrity) {
  return withNativeLock(root, key, async () => {
    const target = await nativePath(root, key, true), existing = await maybeLstat(target);
    if (existing) { await nativeRead(root, key, expected); return; }
    const temporary = `${target}.${randomUUID()}.tmp`;
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const info = await handle.stat();
    let renamed = false;
    try {
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      await nativePath(root, key);
      if (await maybeLstat(target)) fail("Report artifact already exists.");
      const current = await lstat(temporary);
      if (current.isSymbolicLink() || current.ino !== info.ino || current.dev !== info.dev || current.nlink !== 1) fail("Unsafe report temporary file.");
      await rename(temporary, target);
      renamed = true;
      await nativeRead(root, key, expected);
    } finally {
      await handle.close();
      if (!renamed) {
        await nativePath(root, key);
        const current = await maybeLstat(temporary);
        if (current && !current.isSymbolicLink() && current.ino === info.ino && current.dev === info.dev) await unlink(temporary);
      }
    }
  });
}
async function hostedRead(key: string, expected: ReportIntegrity) {
  const object = await getHostedAttachments().get(key);
  if (!object) fail("Report artifact is unavailable.");
  const reader = object.body.getReader();
  try {
    if (object.size !== expected.sizeBytes) fail("Report integrity verification failed.");
    const bytes = new Uint8Array(expected.sizeBytes);
    let offset = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value.byteLength > bytes.length - offset) fail("Report integrity verification failed.");
      bytes.set(chunk.value, offset); offset += chunk.value.byteLength;
    }
    if (offset !== bytes.length) fail("Report integrity verification failed.");
    return verify(bytes, expected);
  } finally { try { await reader.cancel(); } finally { reader.releaseLock(); } }
}
async function hostedStore(key: string, bytes: Uint8Array, expected: ReportIntegrity) {
  const bucket = getHostedAttachments();
  const result = await bucket.put(key, bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    sha256: expected.sha256,
    httpMetadata: { contentType: "application/octet-stream" },
  });
  // A duplicate key is accepted only if the complete stored bytes match.
  if (!result && !await bucket.head(key)) fail("Report artifact could not be stored.");
  await hostedRead(key, expected);
}

/** Configuration presence and path safety only; never discloses paths or secret values. */
export async function getReportStoreStatus(): Promise<{ configured: boolean }> {
  try {
    if (isHostedRuntime()) getHostedAttachments(); else await nativeRoot();
    return { configured: true };
  } catch { return { configured: false }; }
}
export async function storeReportArtifact(key: string, input: Uint8Array): Promise<StoredReportArtifact> {
  return safe(async () => {
    validateKey(key);
    if (!(input instanceof Uint8Array) || input.byteLength < 1 || input.byteLength > MAX_REPORT_BYTES) fail("Invalid report artifact size.");
    // Own a bounded copy so a caller cannot mutate bytes across awaited I/O.
    const bytes = new Uint8Array(input), expected = { sha256: sha256(bytes), sizeBytes: bytes.length };
    if (isHostedRuntime()) await hostedStore(key, bytes, expected); else await nativeStore(await nativeRoot(), key, bytes, expected);
    return { storageKey: key, ...expected };
  });
}
export async function readReportArtifact(key: string, expected: ReportIntegrity): Promise<Uint8Array> {
  return safe(async () => {
    validateKey(key); validateIntegrity(expected);
    const fingerprint = { ...expected };
    return isHostedRuntime() ? hostedRead(key, fingerprint) : nativeRead(await nativeRoot(), key, fingerprint);
  });
}
/** Caller must first claim an expired artifact in its ledger. This function never deletes bytes. */
export async function quarantineReportArtifact(key: string, expected: ReportIntegrity): Promise<{ quarantineKey: string }> {
  return safe(async () => {
    validateKey(key); validateIntegrity(expected); expected = { ...expected };
    const quarantineKey = key.replace("reports/v1/", "reports/quarantine/v1/");
    if (isHostedRuntime()) {
      const bytes = await hostedRead(key, expected);
      await hostedStore(quarantineKey, bytes, expected);
      await hostedRead(key, expected);
      // R2 has no atomic rename: keep the original and gate downloads in the ledger.
    } else {
      const root = await nativeRoot();
      await withNativeLock(root, key, async () => {
        const source = await nativePath(root, key, true), target = await nativePath(root, quarantineKey, true);
        if (!await maybeLstat(source)) { await nativeRead(root, quarantineKey, expected); return; }
        await nativeRead(root, key, expected);
        if (await maybeLstat(target)) { await nativeRead(root, quarantineKey, expected); return; }
        await rename(source, target);
        await nativeRead(root, quarantineKey, expected);
      });
    }
    return { quarantineKey };
  });
}
export async function restoreReportArtifact(quarantineKey: string, expected: ReportIntegrity): Promise<{ storageKey: string }> {
  return safe(async () => {
    validateKey(quarantineKey, true); validateIntegrity(expected); expected = { ...expected };
    const storageKey = quarantineKey.replace("reports/quarantine/v1/", "reports/v1/");
    if (isHostedRuntime()) {
      await hostedStore(storageKey, await hostedRead(quarantineKey, expected), expected);
    } else {
      const root = await nativeRoot();
      await withNativeLock(root, storageKey, async () => {
        const source = await nativePath(root, quarantineKey, true), target = await nativePath(root, storageKey, true);
        if (!await maybeLstat(source)) { await nativeRead(root, storageKey, expected); return; }
        await nativeRead(root, quarantineKey, expected);
        if (await maybeLstat(target)) { await nativeRead(root, storageKey, expected); return; }
        await rename(source, target);
        await nativeRead(root, storageKey, expected);
      });
    }
    return { storageKey };
  });
}

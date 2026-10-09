import "./helpers/bootstrap";
import { test } from "node:test";
import assert from "node:assert/strict";
import { nativeMigrationManifest, migrationChecksum, validateMigrationLedger, splitSchemaEntries, runNativeMigrations, readNativeMigrationStatus } from "@/src/shared/server/database-admin/native-migrations.server";
const v1 = nativeMigrationManifest[0];
const ledger = [{ version: v1.version, name: v1.name, checksum: migrationChecksum(v1) }];
test("immutable work-goals specification is pinned", () => {
  assert.equal(migrationChecksum(nativeMigrationManifest[1]), "c010a7e166ece374ab7b8046086fa67011225cebca5f5435928f5289e8ca8549");
});
test("immutable native baseline ledger is repeatable", () => {
  assert.equal(migrationChecksum(v1), "8dea300dc59fc6a4d7c0fcb0a54b4a4fdec2db9d2681b303be9c1208d7007092", "released version1 specification must not change");
  assert.deepEqual(validateMigrationLedger([]), [...nativeMigrationManifest]);
  assert.deepEqual(validateMigrationLedger(ledger), [...nativeMigrationManifest.slice(1)]);
  assert.throws(() => validateMigrationLedger([...ledger, ...ledger]), /ledger/);
});
for (const patch of [{ version: 0 }, { version: 2 }, { name: "edited" }, { checksum: "f".repeat(64) }]) {
  test(`ledger rejects drift: ${JSON.stringify(patch)}`, () => assert.throws(() => validateMigrationLedger([{ ...ledger[0], ...patch }]), /ledger/));
}
test("schema parser respects ENUM, CHECK and quoted commas", () => {
  assert.deepEqual(splitSchemaEntries("role ENUM('a','b') NOT NULL, label TEXT DEFAULT 'x,y', CONSTRAINT c CHECK(role IN ('a','b'))"), ["role ENUM('a','b') NOT NULL", "label TEXT DEFAULT 'x,y'", "CONSTRAINT c CHECK(role IN ('a','b'))"]);
});
test("unavailable migration lock causes no DDL", async () => {
  const calls: string[] = [];
  await assert.rejects(runNativeMigrations({ query: async sql => { calls.push(sql); return [{ acquired: 0 }]; } }, "wbs_lock_test"), /lock/);
  assert.equal(calls.length, 1); assert.match(calls[0], /GET_LOCK/);
});
test("ledger mismatch stops before domain DDL and releases advisory lock", async () => {
  const calls: string[] = [];
  await assert.rejects(runNativeMigrations({ query: async sql => {
    calls.push(sql);
    if (sql.includes("GET_LOCK")) return [{ acquired: 1 }];
    if (sql.startsWith("SELECT version")) return [{ ...ledger[0], checksum: "bad" }];
    if (sql.includes("RELEASE_LOCK")) return [{ released: 1 }];
    return [];
  } }, "wbs_ledger_test"), /checksum/);
  assert.ok(!calls.some(sql => /CREATE TABLE IF NOT EXISTS users/.test(sql)));
  assert.match(calls.at(-1)!, /RELEASE_LOCK/);
});
test("DDL interruption never writes success ledger and always releases the lock", async () => {
  const calls: string[] = [];
  await assert.rejects(runNativeMigrations({ query: async sql => {
    calls.push(sql);
    if (sql.includes("GET_LOCK")) return [{ acquired: 1 }];
    if (sql.includes("RELEASE_LOCK")) return [{ released: 1 }];
    if (/CREATE TABLE IF NOT EXISTS projects/.test(sql)) throw new Error("synthetic DDL interruption");
    return [];
  } }, "wbs_resume_test"), /synthetic DDL/);
  assert.ok(!calls.some(sql => sql.startsWith("INSERT INTO schema_migrations")));
  assert.match(calls.at(-1)!, /RELEASE_LOCK/);
});
test("missing ledger status is read-only and pending", async () => {
  const calls: string[] = [];
  const status = await readNativeMigrationStatus({ query: async sql => { calls.push(sql); return []; } }, "wbs_status_test");
  assert.equal(status.ledgerExists, false); assert.deepEqual(status.pendingVersions, nativeMigrationManifest.map(migration => migration.version));
  assert.ok(calls.every(sql => sql.startsWith("SELECT")));
});
test("invalid schema identifier fails before connection queries", async () => {
  await assert.rejects(runNativeMigrations({ query: async () => { assert.fail("must not query"); } }, "bad;DROP"), /identifier/);
});

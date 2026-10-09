import "./helpers/bootstrap";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mockModuleExports } from "./helpers/mock-module";
import { requireDatabaseEnv, requireDatabaseSchemaEnv, isDatabaseSchemaConfigured, resetRuntimeEnvCache } from "@/src/shared/server/runtime-env/index.server";
const identities: string[] = [];
mockModuleExports("mariadb", {
  createConnection: async (options: { user: string }) => {
    identities.push(options.user);
    return { query: async (sql: string) => sql.includes("INFORMATION_SCHEMA.SCHEMATA") ? [{ schemaName: "wbs_app_test" }] : [], end: async () => undefined };
  },
  createPool: () => { throw new Error("Unexpected runtime pool access in schema test"); },
});
const { getDatabaseAdminStatus, initializeDatabaseSchema } = await import("@/src/shared/server/database-admin/index.server");
beforeEach(() => {
  process.env.DB_USER = "synthetic_runtime";
  process.env.DB_PASSWORD = "synthetic_runtime_password";
  delete process.env.DB_SCHEMA_USER; delete process.env.DB_SCHEMA_PASSWORD;
  resetRuntimeEnvCache(); identities.length = 0;
});
test("missing/partial schema identity never falls back to runtime credentials", () => {
  assert.equal(requireDatabaseEnv().user, "synthetic_runtime");
  assert.equal(isDatabaseSchemaConfigured(), false);
  assert.throws(requireDatabaseSchemaEnv, /DB_SCHEMA_USER/);
  process.env.DB_SCHEMA_USER = "synthetic_schema";
  assert.equal(isDatabaseSchemaConfigured(), false);
  assert.throws(requireDatabaseSchemaEnv, /DB_SCHEMA_PASSWORD/);
});
test("native read-only readiness uses runtime identity without schema configuration", async () => {
  const status = await getDatabaseAdminStatus();
  assert.equal(status.schemaConfigured, false);
  assert.deepEqual(identities, ["synthetic_runtime", "synthetic_runtime"]);
});
test("schema credential accessor is separate and absent from serialized status", async () => {
  process.env.DB_SCHEMA_USER = "synthetic_schema";
  process.env.DB_SCHEMA_PASSWORD = "synthetic_schema_password";
  assert.equal(requireDatabaseSchemaEnv().user, "synthetic_schema");
  assert.equal(requireDatabaseSchemaEnv().password, "synthetic_schema_password");
  const status = await getDatabaseAdminStatus();
  assert.equal(status.schemaConfigured, true);
  assert.doesNotMatch(JSON.stringify(status), /synthetic_schema/);
  assert.deepEqual(identities, ["synthetic_runtime", "synthetic_runtime"]);
});
test("missing schema credentials stop initialization before any database connection", async () => {
  await assert.rejects(initializeDatabaseSchema(), /DB_SCHEMA_USER/);
  assert.deepEqual(identities, []);
});

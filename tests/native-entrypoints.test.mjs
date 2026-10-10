import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = mkdtempSync(path.join(tmpdir(), "wbs-native-cli-"));
function run(script, args, extraEnv = {}) {
  return spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), path.join(root, "scripts", script), ...args], {
    cwd: fixture, encoding: "utf8", timeout: 15000,
    env: { PATH: process.env.PATH, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json"), NEXT_TELEMETRY_DISABLED: "1", ...extraEnv },
  });
}
for (const command of ["dev", "build", "start"]) {
  test(`native ${command} help resolves the real Next CLI without starting a server`, () => {
    const result = run("run-next.ts", [command, "--help"], { APP_PORT: "3210" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /APP_PORT=3210/);
    assert.match(result.stdout, /Usage: next/);
  });
}
test("database CLI help and invalid flags finish before configuration or connections", () => {
  for (const script of ["check-db.ts", "migrate-database.ts"]) {
    const result = run(script, ["--help"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
    const invalid = run(script, ["--invalid"]);
    assert.equal(invalid.status, 1);
    assert.doesNotMatch(invalid.stderr, /ECONNREFUSED|Missing required database/);
  }
  assert.equal(run("migrate-database.ts", ["--status", "--apply"]).status, 1);
});
test("configuration-only DB check and production CLI dependencies", () => {
  const result = run("check-db.ts", ["--validate-only"], {
    DB_HOST: "127.0.0.1", DB_PORT: "1", DB_NAME: "synthetic", DB_USER: "synthetic", DB_PASSWORD: "synthetic_not_a_credential",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validation passed/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic_not_a_credential/);
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.dependencies.tsx && pkg.dependencies["@next/env"]);
  assert.ok(!pkg.devDependencies.tsx);
});

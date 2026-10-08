import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("ordered preload links auth-dependent test modules before any SQL", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      new URL("./helpers/preload.mjs", import.meta.url).href,
      "--experimental-test-module-mocks",
      "--input-type=module",
      "--eval",
      'await import("./src/features/bug-report-manage/index.server.ts"); console.log("ordered-preload-ok")',
    ],
    { cwd: process.cwd(), encoding: "utf8", timeout: 30000 },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /ordered-preload-ok/);
});

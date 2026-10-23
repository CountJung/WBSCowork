import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { formatAppDateTime } from "../src/shared/lib/date";

test("Korean timestamps name their display zone and preserve the same instant", () => {
  const value = formatAppDateTime(new Date("2026-10-22T12:12:00.000Z"));
  assert.match(value, /2026.*10.*22/);
  assert.match(value, /09:12.*KST$/);
  assert.match(formatAppDateTime(new Date("2026-12-31T18:05:00.000Z")), /2027.*01.*01.*03:05.*KST$/);
  assert.throws(() => formatAppDateTime(new Date("invalid")), RangeError);
});

test("server process timezone cannot change a submission timestamp", () => {
  const script = "import { formatAppDateTime } from './src/shared/lib/date/index.ts';process.stdout.write(formatAppDateTime(new Date('2026-10-22T12:12:00.000Z')));";
  const values = ["UTC", "Asia/Seoul", "America/New_York"].map(TZ => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { cwd: process.cwd(), env: { ...process.env, TZ }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(new Set(values).size, 1);
});

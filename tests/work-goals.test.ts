import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkGoal } from "../src/shared/lib/work-goals";
test("draft work goals retain blanks and exact bounded plain text", () => {
  assert.equal(normalizeWorkGoal(undefined, "goal"), "");
  assert.equal(normalizeWorkGoal("  목표\n완료 조건  ", "goal"), "목표\n완료 조건");
  assert.equal(normalizeWorkGoal("x".repeat(2000), "goal").length, 2000);
  assert.equal(normalizeWorkGoal("<script>alert(1)</script>", "goal"), "<script>alert(1)</script>");
});
test("work goals reject oversized and control-character input", () => {
  assert.throws(() => normalizeWorkGoal("x".repeat(2001), "goal"), /2000/);
  assert.throws(() => normalizeWorkGoal("bad\0field", "goal"), /제어문자/);
});

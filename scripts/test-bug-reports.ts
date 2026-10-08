import "../tests/helpers/bootstrap";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { runWithHostedBindings } from "../src/shared/server/hosted-runtime/index.server";
import {
  createBugReport,
  appendBugEvent,
  getBugReport,
  listBugReports,
  listBugEvents,
} from "../src/entities/bug-report/index.server";
import {
  parseBugInput,
  parseBugReview,
  bugToken,
  bugText,
} from "../src/entities/bug-report";
const mf = new Miniflare({
  modules: true,
  script: "export default {fetch(){return new Response('test')}}",
  compatibilityDate: "2026-05-15",
  d1Databases: { DB: "bug-report-test" },
});
let checks = 0;
function check(value: unknown, message: string) {
  assert.ok(value, message);
  checks++;
  console.log(`PASS ${message}`);
}
try {
  const db = await mf.getD1Database("DB");
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const sql of (await readFile(`drizzle/${file}`, "utf8"))
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  await db
    .prepare(
      "INSERT INTO users(id,email,name,role) VALUES(1,'guest1@example.test','Guest1','guest'),(2,'guest2@example.test','Guest2','guest'),(3,'admin@example.test','Admin','admin')",
    )
    .run();
  await runWithHostedBindings({ DB: db as unknown as D1Database }, async () => {
    const own = { userId: 1, canReview: false },
      other = { userId: 2, canReview: false },
      admin = { userId: 3, canReview: true };
    const input = {
      title: "PRIVATE_BUG_MARKER",
      reproduction: "Synthetic steps",
      expected: "Expected",
      actual: "Actual",
      page_path: "/tasks",
    };
    const token = randomUUID();
    const ids = await Promise.all([
      createBugReport(own, token, input),
      createBugReport(own, token, input),
    ]);
    const id = ids[0];
    check(
      ids.every((v) => v === id),
      "repeated create token returns same report",
    );
    check(
      (await listBugEvents(id, own)).length === 1,
      "repeated create produces one initial history event",
    );
    check(
      (await listBugReports(own)).count === 1 &&
        (await listBugReports(other)).count === 0,
      "report list and count scope before serialization",
    );
    check(
      (await listBugReports(other, { query: "PRIVATE_BUG_MARKER" })).count ===
        0,
      "search cannot reveal another user's report count",
    );
    check(
      (await getBugReport(id, other)) === null &&
        (await listBugEvents(id, other)).length === 0,
      "detail and history deny cross-user reads",
    );
    check(
      (await listBugReports(admin)).count === 1,
      "administrator sees all reports",
    );
    await assert.rejects(
      appendBugEvent(id, other, randomUUID(), 1, {
        kind: "addendum",
        body: "forbidden",
      }),
    );
    checks++;
    await assert.rejects(
      appendBugEvent(id, own, randomUUID(), 1, {
        kind: "review",
        body: "forbidden",
        status: "resolved",
        priority: "high",
        resolution: "forged",
        fix_commit: "",
      }),
    );
    checks++;
    const noteToken = randomUUID();
    await appendBugEvent(id, own, noteToken, 1, {
      kind: "addendum",
      body: "Correction without overwriting original",
    });
    await appendBugEvent(id, own, noteToken, 1, {
      kind: "addendum",
      body: "Replay ignored",
    });
    check(
      (await getBugReport(id, own))?.version === 2 &&
        (await listBugEvents(id, own)).length === 2,
      "repeated note is idempotent and original preserved",
    );
    await appendBugEvent(id, admin, randomUUID(), 2, {
      kind: "review",
      body: "Triaged",
      status: "in_progress",
      priority: "high",
      resolution: "",
      fix_commit: "",
    });
    check(
      (await getBugReport(id, own))?.title === input.title &&
        (await getBugReport(id, own))?.reproduction === input.reproduction,
      "administrator cannot overwrite original report fields",
    );
    await db
      .prepare(
        "CREATE TRIGGER reject_bug_event BEFORE INSERT ON bug_report_events WHEN NEW.body='FAIL_HISTORY' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END",
      )
      .run();
    await assert.rejects(
      appendBugEvent(id, admin, randomUUID(), 3, {
        kind: "review",
        body: "FAIL_HISTORY",
        status: "resolved",
        priority: "low",
        resolution: "done",
        fix_commit: "abcdef1",
      }),
    );
    checks++;
    check(
      (await getBugReport(id, own))?.version === 3 &&
        (await getBugReport(id, own))?.status === "in_progress" &&
        (await listBugEvents(id, own)).length === 3,
      "history insertion failure rolls back state atomically",
    );
    const race = await Promise.allSettled([
      appendBugEvent(id, admin, randomUUID(), 3, {
        kind: "review",
        body: "first",
        status: "resolved",
        priority: "normal",
        resolution: "fixed",
        fix_commit: "abcdef1",
      }),
      appendBugEvent(id, admin, randomUUID(), 3, {
        kind: "review",
        body: "second",
        status: "closed",
        priority: "low",
        resolution: "closed",
        fix_commit: "",
      }),
    ]);
    check(
      race.filter((r) => r.status === "fulfilled").length === 1 &&
        race.filter((r) => r.status === "rejected").length === 1,
      "concurrent reviews accept one version and reject stale write",
    );
    check(
      (await listBugEvents(id, own)).length === 4,
      "one winning review creates exactly one event",
    );
    const sameToken = randomUUID();
    const beforeSame = (await getBugReport(id, own))!.version;
    await Promise.allSettled([
      appendBugEvent(id, admin, sameToken, beforeSame, {
        kind: "review",
        body: "same token first",
        status: "in_progress",
        priority: "normal",
        resolution: "",
        fix_commit: "",
      }),
      appendBugEvent(id, admin, sameToken, beforeSame + 1, {
        kind: "review",
        body: "same token second",
        status: "closed",
        priority: "high",
        resolution: "must not apply twice",
        fix_commit: "",
      }),
    ]);
    check(
      (await getBugReport(id, own))?.version === beforeSame + 1 &&
        (await listBugEvents(id, own)).length === 5,
      "concurrent same token with different versions cannot mutate without history",
    );
    const data = new FormData();
    for (const [k, v] of Object.entries({
      title: "title",
      reproduction: "steps",
      expected: "expected",
      actual: "actual",
      pagePath: "/tasks?secret=omit#fragment",
    }))
      data.set(k, v);
    check(
      parseBugInput(data).page_path === "/tasks",
      "page path discards query and fragment",
    );
    for (const path of ["https://evil.test/", "//evil.test/", "/\\evil"]) {
      data.set("pagePath", path);
      assert.throws(() => parseBugInput(data));
      checks++;
    }
    assert.throws(() => bugText("x".repeat(161), "title", 160));
    checks++;
    assert.throws(() => bugToken("not-uuid"));
    checks++;
    data.set("status", "resolved");
    data.set("priority", "normal");
    data.set("resolution", "");
    assert.throws(() => parseBugReview(data));
    checks++;
    data.set("resolution", "fixed");
    data.set("fixCommit", "javascript:alert(1)");
    assert.throws(() => parseBugReview(data));
    checks++;
    await db
      .prepare(
        "INSERT INTO projects(id,name,start_date,end_date) VALUES(99,'synthetic','2026-01-01','2026-01-02')",
      )
      .run();
    await db.prepare("DELETE FROM projects WHERE id=99").run();
    check(
      Boolean(await getBugReport(id, admin)),
      "project deletion cannot erase independent bug archive",
    );
    await db.prepare("DELETE FROM users WHERE id=1").run();
    check(
      (await getBugReport(id, admin))?.reporter_id === null &&
        (await getBugReport(id, own)) === null,
      "account removal unlinks reporter and denies orphan author access",
    );
    check(
      (await listBugEvents(id, admin)).length === 5,
      "history survives account removal without identity cascade",
    );
  });
  console.log(
    `Bug report D1 contracts passed: ${checks}. Synthetic local data only.`,
  );
} finally {
  await mf.dispose();
}

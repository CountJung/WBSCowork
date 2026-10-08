import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createBugReport,
  appendBugEvent,
  changeBugLifecycle,
  getBugPurgeSnapshot,
  purgeBugReport,
  getBugReport,
  listBugEvents,
  listBugReports,
} from "../src/entities/bug-report/index.server";
import { getDatabasePool } from "../src/shared/server/database/index.server";
import type { BugPurgeSnapshot } from "../src/entities/bug-report/index.server";
export async function verifyBugLifecycle(
  check: (value: unknown, message: string) => void,
  dialect: "sqlite" | "mariadb" = "sqlite",
) {
  const own = { userId: 1, canReview: false },
    other = { userId: 2, canReview: false },
    admin = { userId: 3, canReview: true },
    su = { ...admin, canPurge: true };
  const input = {
    title: "SYNTHETIC_LIFECYCLE",
    reproduction: "steps",
    expected: "expected",
    actual: "actual",
    page_path: "/bugs",
  };
  const q = (sql: string, params: unknown[] = []) =>
    getDatabasePool().query(sql, params);
  const row = async (id: number) =>
    (
      (await q("SELECT * FROM bug_reports WHERE id=?", [id])) as Array<
        Record<string, unknown>
      >
    )[0];
  const id = await createBugReport(own, randomUUID(), input);
  const deny = async (work: () => Promise<unknown>, message: string) => {
    await assert.rejects(work);
    check(true, message);
  };
  await deny(
    () => changeBugLifecycle(id, own, randomUUID(), 1, "verify", "test"),
    "author cannot verify own report",
  );
  await deny(
    () => changeBugLifecycle(id, other, randomUUID(), 1, "trash", "test"),
    "other user cannot trash report",
  );
  await deny(
    () => changeBugLifecycle(id, admin, randomUUID(), 1, "verify", "test"),
    "unresolved report cannot be verified",
  );
  await deny(
    () => changeBugLifecycle(id, admin, randomUUID(), 1, "trash", "test"),
    "unverified report cannot enter trash",
  );
  await appendBugEvent(id, admin, randomUUID(), 1, {
    kind: "review",
    body: "fixed",
    status: "resolved",
    priority: "normal",
    resolution: "done",
    fix_commit: "",
  });
  const verifyToken = randomUUID();
  await Promise.all(
    [1, 2].map(() =>
      changeBugLifecycle(id, admin, verifyToken, 2, "verify", "checked"),
    ),
  );
  check(
    (await row(id)).version === 3 &&
      (await listBugEvents(id, admin)).length === 3,
    "concurrent verification replay creates exactly one history event",
  );
  await appendBugEvent(id, own, randomUUID(), 3, {
    kind: "addendum",
    body: "new evidence",
  });
  check(
    (await row(id)).verified_at === null &&
      (await row(id)).verification_note === "",
    "new author evidence atomically invalidates verification",
  );
  await changeBugLifecycle(
    id,
    admin,
    randomUUID(),
    4,
    "verify",
    "checked again",
  );
  await appendBugEvent(id, admin, randomUUID(), 5, {
    kind: "review",
    body: "review",
    status: "closed",
    priority: "normal",
    resolution: "done",
    fix_commit: "",
  });
  check(
    (await row(id)).verified_at === null,
    "review change invalidates verification",
  );
  await changeBugLifecycle(
    id,
    admin,
    randomUUID(),
    6,
    "verify",
    "final verification",
  );
  await deny(
    () => changeBugLifecycle(id, admin, randomUUID(), 6, "trash", "stale"),
    "stale trash version rejected",
  );
  const trashToken = randomUUID();
  await Promise.all(
    [1, 2].map(() =>
      changeBugLifecycle(id, admin, trashToken, 7, "trash", "approved archive"),
    ),
  );
  check((await row(id)).version === 8, "concurrent trash replay applies once");
  check(
    (await getBugReport(id, own)) === null &&
      (await getBugReport(id, admin)) === null &&
      (await getBugReport(id, own, true)) === null,
    "trash hidden from active detail and author trash detail",
  );
  check(
    (await listBugEvents(id, own)).length === 0 &&
      (await listBugEvents(id, own, 1, true)).length === 0 &&
      (await listBugEvents(id, admin)).length === 0,
    "trash history cannot leak through ordinary queries",
  );
  check(
    (await listBugReports(own, { query: input.title })).count === 0 &&
      (await listBugReports(admin, { query: input.title })).count === 0 &&
      (await listBugReports(own, { trash: true })).count === 0,
    "trash excluded from list/search/count including forged author trash mode",
  );
  check(
    (await listBugReports(admin, { trash: true, query: input.title })).count ===
      1 && (await listBugEvents(id, admin, 1, true)).length === 8,
    "admin trash list and complete scoped history available",
  );
  await deny(
    () =>
      appendBugEvent(id, own, randomUUID(), 8, {
        kind: "addendum",
        body: "blocked",
      }),
    "author cannot append to trashed record",
  );
  await deny(
    () =>
      appendBugEvent(id, admin, randomUUID(), 8, {
        kind: "review",
        body: "blocked",
        status: "new",
        priority: "normal",
        resolution: "",
        fix_commit: "",
      }),
    "admin cannot edit record while trashed",
  );
  check(
    (await getBugPurgeSnapshot(id, admin)) === null,
    "ordinary admin cannot obtain purge snapshot",
  );
  const original = await getBugPurgeSnapshot(id, su);
  assert.ok(original);
  const purge = (snapshot: BugPurgeSnapshot, token = randomUUID()) =>
    purgeBugReport(
      id,
      su,
      token,
      snapshot.report.version,
      snapshot.fingerprint,
      snapshot.report.title,
      snapshot.eventCount,
      snapshot.lastEventId,
    );
  await deny(
    () =>
      purgeBugReport(
        id,
        admin,
        randomUUID(),
        8,
        original.fingerprint,
        input.title,
        8,
        original.lastEventId,
      ),
    "ordinary admin direct purge denied",
  );
  await deny(
    () =>
      purgeBugReport(
        id,
        su,
        randomUUID(),
        8,
        original.fingerprint,
        "wrong",
        8,
        original.lastEventId,
      ),
    "exact typed title required",
  );
  await deny(
    () =>
      purgeBugReport(
        id,
        su,
        randomUUID(),
        8,
        "0".repeat(64),
        input.title,
        8,
        original.lastEventId,
      ),
    "forged fingerprint rejected",
  );
  await changeBugLifecycle(
    id,
    admin,
    randomUUID(),
    8,
    "restore",
    "restore original",
  );
  check(
    (await getBugReport(id, own))?.reproduction === input.reproduction &&
      (await listBugEvents(id, own)).length === 9 &&
      (await row(id)).verified_at !== null,
    "restore recovers unchanged original and all history with verification",
  );
  await deny(
    () => purge(original),
    "old purge snapshot rejected after restore",
  );
  // More than one UI page: fingerprint must cover the first event too.
  for (let n = 0; n < 32; n++) {
    const r = await row(id);
    await appendBugEvent(id, own, randomUUID(), Number(r.version), {
      kind: "addendum",
      body: `ordinary note ${n}`,
    });
  }
  let r = await row(id);
  await changeBugLifecycle(
    id,
    admin,
    randomUUID(),
    Number(r.version),
    "verify",
    "large history checked",
  );
  r = await row(id);
  await changeBugLifecycle(
    id,
    admin,
    randomUUID(),
    Number(r.version),
    "trash",
    "large history approved",
  );
  let snapshot = await getBugPurgeSnapshot(id, su);
  assert.ok(snapshot);
  check(
    snapshot.eventCount === 43 &&
      (await listBugEvents(id, admin, 1, true)).length === 30,
    "purge snapshot counts history beyond first UI page",
  );
  await q(
    "UPDATE bug_report_events SET body='changed first event' WHERE report_id=? AND report_version=1",
    [id],
  );
  await deny(
    () => purge(snapshot!),
    "full-history fingerprint detects old event change beyond current UI page",
  );
  snapshot = await getBugPurgeSnapshot(id, su);
  assert.ok(snapshot);
  // SQLite fault injection only in synthetic fixture: the entire receipt+history+report batch must roll back.
  await q(
    dialect === "sqlite"
      ? "CREATE TRIGGER test_purge_failure BEFORE DELETE ON bug_reports BEGIN SELECT RAISE(ABORT,'synthetic delete failure'); END"
      : "CREATE TRIGGER test_purge_failure BEFORE DELETE ON bug_reports FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic delete failure'",
  );
  await deny(
    () => purge(snapshot!),
    "report deletion failure rolls back history deletion and receipt",
  );
  check(
    (await row(id)) !== undefined &&
      (
        (await q("SELECT id FROM bug_report_events WHERE report_id=?", [
          id,
        ])) as unknown[]
      ).length === 43 &&
      (
        (await q(
          "SELECT report_id FROM bug_report_purge_receipts WHERE report_id=?",
          [id],
        )) as unknown[]
      ).length === 0,
    "failed purge preserves original, every event and zero receipt",
  );
  await q("DROP TRIGGER test_purge_failure");
  await q(
    dialect === "sqlite"
      ? "CREATE TRIGGER test_receipt_failure BEFORE INSERT ON bug_report_purge_receipts BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END"
      : "CREATE TRIGGER test_receipt_failure BEFORE INSERT ON bug_report_purge_receipts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic receipt failure'",
  );
  await deny(
    () => purge(snapshot!),
    "receipt failure prevents any destructive statement",
  );
  await q("DROP TRIGGER test_receipt_failure");
  const token = randomUUID();
  await Promise.all([purge(snapshot, token), purge(snapshot, token)]);
  await purge(snapshot, token);
  check(
    (await row(id)) === undefined &&
      (
        (await q("SELECT id FROM bug_report_events WHERE report_id=?", [
          id,
        ])) as unknown[]
      ).length === 0,
    "SU purge removes exact synthetic report and complete history",
  );
  const receipts = (await q(
    "SELECT * FROM bug_report_purge_receipts WHERE report_id=?",
    [id],
  )) as Array<Record<string, unknown>>;
  check(
    receipts.length === 1 &&
      Number(receipts[0].event_count) === 43 &&
      !JSON.stringify(receipts).includes(input.title),
    "same-token purge replay preserves one minimal receipt without private body/title",
  );
  await deny(
    () => purge(snapshot!, randomUUID()),
    "different-token purge replay cannot claim a second successful deletion",
  );
  // Restore and purge compete on the same current version; exactly one can commit.
  const raceId = await createBugReport(own, randomUUID(), {
    ...input,
    title: "SYNTHETIC_RACE",
  });
  await appendBugEvent(raceId, admin, randomUUID(), 1, {
    kind: "review",
    body: "done",
    status: "resolved",
    priority: "normal",
    resolution: "done",
    fix_commit: "",
  });
  await changeBugLifecycle(raceId, admin, randomUUID(), 2, "verify", "checked");
  await changeBugLifecycle(raceId, admin, randomUUID(), 3, "trash", "approved");
  const race = await getBugPurgeSnapshot(raceId, su);
  assert.ok(race);
  const results = await Promise.allSettled([
    changeBugLifecycle(raceId, admin, randomUUID(), 4, "restore", "restore"),
    purgeBugReport(
      raceId,
      su,
      randomUUID(),
      4,
      race.fingerprint,
      race.report.title,
      race.eventCount,
      race.lastEventId,
    ),
  ]);
  check(
    results.filter((r) => r.status === "fulfilled").length === 1,
    "restore versus purge race has exactly one committed winner",
  );
  const remain = await row(raceId),
    receipt = (await q(
      "SELECT report_id FROM bug_report_purge_receipts WHERE report_id=?",
      [raceId],
    )) as unknown[];
  check(
    remain
      ? remain.trashed_at === null &&
          remain.version === 5 &&
          (
            (await q("SELECT id FROM bug_report_events WHERE report_id=?", [
              raceId,
            ])) as unknown[]
          ).length === 5 &&
          receipt.length === 0
      : receipt.length === 1,
    "race cannot leave partially deleted history or restored report with purge receipt",
  );
  await q(
    "INSERT INTO users(id,email,name,role) VALUES(99,'lifecycle-actor@example.test','Synthetic actor','admin')",
  );
  const formerAdmin = { userId: 99, canReview: true };
  const unlinkId = await createBugReport(own, randomUUID(), {
    ...input,
    title: "SYNTHETIC_UNLINK",
  });
  await appendBugEvent(unlinkId, formerAdmin, randomUUID(), 1, {
    kind: "review",
    body: "done",
    status: "resolved",
    priority: "normal",
    resolution: "done",
    fix_commit: "",
  });
  await changeBugLifecycle(
    unlinkId,
    formerAdmin,
    randomUUID(),
    2,
    "verify",
    "checked",
  );
  await changeBugLifecycle(
    unlinkId,
    formerAdmin,
    randomUUID(),
    3,
    "trash",
    "archive",
  );
  const beforeUnlink = await getBugPurgeSnapshot(unlinkId, su);
  await q("DELETE FROM users WHERE id=99");
  const afterUnlink = await getBugPurgeSnapshot(unlinkId, su);
  check(
    Boolean(afterUnlink) &&
      afterUnlink!.report.verified_by === null &&
      afterUnlink!.report.trashed_by === null &&
      beforeUnlink?.fingerprint === afterUnlink?.fingerprint,
    "account unlink sets lifecycle identities null while content fingerprint and history remain stable",
  );
}

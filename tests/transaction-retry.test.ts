import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withDeadlockRetry,
  type TransactionConnection,
} from "../src/shared/server/database/transaction-retry.server";
const deadlock = { code: "ER_LOCK_DEADLOCK", errno: 1213, sqlState: "40001" };
function fixture(
  options: {
    rollbackFailure?: boolean;
    releaseFailure?: boolean;
    commitFailure?: unknown;
  } = {},
) {
  const calls: string[] = [];
  let acquired = 0;
  const acquire = async (): Promise<TransactionConnection> => {
    const id = ++acquired;
    calls.push(`${id}:acquire`);
    return {
      async beginTransaction() {
        calls.push(`${id}:begin`);
      },
      async commit() {
        calls.push(`${id}:commit`);
        if (options.commitFailure) throw options.commitFailure;
      },
      async rollback() {
        calls.push(`${id}:rollback`);
        if (options.rollbackFailure) throw Error("rollback failed");
      },
      async release() {
        calls.push(`${id}:release`);
        if (options.releaseFailure) throw Error("release failed");
      },
      destroy() {
        calls.push(`${id}:destroy`);
      },
    };
  };
  return { calls, acquire, count: () => acquired };
}
test("deadlock retries the complete unit after rollback and release", async () => {
  const f = fixture();
  let runs = 0;
  const writes: string[] = [];
  const result = await withDeadlockRetry(f.acquire, async () => {
    writes.push("first statement");
    if (++runs === 1) throw deadlock;
    writes.push("second statement");
    return 42;
  });
  assert.equal(result, 42);
  assert.equal(f.count(), 2);
  assert.deepEqual(f.calls, [
    "1:acquire",
    "1:begin",
    "1:rollback",
    "1:release",
    "2:acquire",
    "2:begin",
    "2:commit",
    "2:release",
  ]);
  assert.deepEqual(writes, [
    "first statement",
    "first statement",
    "second statement",
  ]);
});
test("deadlock attempts are capped at three", async () => {
  const f = fixture();
  await assert.rejects(
    withDeadlockRetry(f.acquire, async () => {
      throw deadlock;
    }),
    (e) => e === deadlock,
  );
  assert.equal(f.count(), 3);
});
for (const error of [
  { errno: 1205, code: "ER_LOCK_WAIT_TIMEOUT" },
  { errno: 1064, code: "ER_PARSE_ERROR" },
  { code: "ECONNRESET" },
  { code: "ER_ACCESS_DENIED_ERROR" },
])
  test(`does not retry ${error.code}`, async () => {
    const f = fixture();
    await assert.rejects(
      withDeadlockRetry(f.acquire, async () => {
        throw error;
      }),
      (e) => e === error,
    );
    assert.equal(f.count(), 1);
  });
test("ambiguous commit failure is not retried", async () => {
  const error = { code: "ECONNRESET" };
  const f = fixture({ commitFailure: error });
  await assert.rejects(
    withDeadlockRetry(f.acquire, async () => 1),
    (e) => e === error,
  );
  assert.equal(f.count(), 1);
});
test("failed rollback preserves original failure and prevents retry", async () => {
  const f = fixture({ rollbackFailure: true });
  await assert.rejects(
    withDeadlockRetry(f.acquire, async () => {
      throw deadlock;
    }),
    (e) => e === deadlock,
  );
  assert.equal(f.count(), 1);
  assert.ok(f.calls.includes("1:destroy"));
});
test("acquisition failure is not retried", async () => {
  let calls = 0;
  const error = Error("acquisition failed");
  await assert.rejects(
    withDeadlockRetry(
      async () => {
        calls++;
        throw error;
      },
      async () => 1,
    ),
    (e) => e === error,
  );
  assert.equal(calls, 1);
});
test("success commits/releases exactly once", async () => {
  const f = fixture();
  assert.equal(await withDeadlockRetry(f.acquire, async () => 7), 7);
  assert.deepEqual(f.calls, ["1:acquire", "1:begin", "1:commit", "1:release"]);
});
test("failed release prevents another deadlock attempt", async () => {
  const { mock } = await import("node:test");
  const warning = mock.method(console, "warn", () => undefined);
  try {
    const f = fixture({ releaseFailure: true });
    await assert.rejects(
      withDeadlockRetry(f.acquire, async () => {
        throw deadlock;
      }),
      (e) => e === deadlock,
    );
    assert.equal(f.count(), 1);
    assert.ok(f.calls.includes("1:destroy"));
    assert.equal(warning.mock.callCount(), 1);
  } finally {
    warning.mock.restore();
  }
});
test("release failure after commit does not trigger mutation compensation", async () => {
  const { mock } = await import("node:test");
  const warning = mock.method(console, "warn", () => undefined);
  try {
    const f = fixture({ releaseFailure: true });
    assert.equal(await withDeadlockRetry(f.acquire, async () => 42), 42);
    assert.equal(f.count(), 1);
    assert.ok(f.calls.includes("1:destroy"));
    assert.equal(warning.mock.callCount(), 1);
  } finally {
    warning.mock.restore();
  }
});

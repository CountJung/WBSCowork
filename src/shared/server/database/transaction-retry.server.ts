/** A fresh whole-transaction retry is safe only for a confirmed deadlock rollback. */
export type TransactionConnection = {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
  destroy(): void;
};
function isDeadlock(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const sqlError = error as { errno?: unknown; code?: unknown };
  return sqlError.errno === 1213 || sqlError.code === "ER_LOCK_DEADLOCK";
}

export async function withDeadlockRetry<C extends TransactionConnection, T>(
  acquire: () => Promise<C>,
  execute: (connection: C) => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; ; attempt++) {
    // Acquisition failures and ambiguous connection/commit errors are never retried.
    const connection = await acquire();
    let result: T | undefined;
    let failed = false;
    let failure: unknown;
    let rollbackConfirmed = false;
    try {
      await connection.beginTransaction();
      result = await execute(connection);
      await connection.commit();
    } catch (error) {
      failed = true;
      failure = error;
      try {
        await connection.rollback();
        rollbackConfirmed = true;
      } catch {
        // Keep the original error, discard the connection, and do not retry.
        connection.destroy();
      }
    }
    try {
      await connection.release();
    } catch {
      connection.destroy();
      rollbackConfirmed = false;
      // A successful commit stays successful; do not trigger caller compensation.
      console.warn("Database connection release failed; connection discarded.");
    }
    if (!failed) return result as T;
    if (!rollbackConfirmed || !isDeadlock(failure) || attempt >= maxAttempts)
      throw failure;
    // Release has completed before acquiring a new transaction; bounded backoff.
    await new Promise((resolve) => setTimeout(resolve, attempt * 10));
  }
}

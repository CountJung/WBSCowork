import { withDeadlockRetry } from "./transaction-retry.server";
import { createConnection, createPool, type Pool } from "mariadb";
import { getHostedDatabase, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { requireDatabaseEnv } from "@/src/shared/server/runtime-env/index.server";

const globalForDatabase = globalThis as typeof globalThis & {
  __wbsMariaDbPool?: Pool;
};

function getMariaDatabasePool() {
  if (!globalForDatabase.__wbsMariaDbPool) {
    const databaseEnv = requireDatabaseEnv();

    globalForDatabase.__wbsMariaDbPool = createPool({
      host: databaseEnv.host,
      port: databaseEnv.port,
      user: databaseEnv.user,
      password: databaseEnv.password,
      database: databaseEnv.database,
      connectionLimit: databaseEnv.connectionLimit,
      connectTimeout: databaseEnv.connectTimeoutMs,
      insertIdAsNumber: true,
      bigIntAsNumber: true,
    });
  }

  return globalForDatabase.__wbsMariaDbPool;
}

export async function checkDatabaseConnection() {
  const databaseEnv = requireDatabaseEnv();
  const connection = await createConnection({
    host: databaseEnv.host,
    port: databaseEnv.port,
    user: databaseEnv.user,
    password: databaseEnv.password,
    database: databaseEnv.database,
    connectTimeout: databaseEnv.connectTimeoutMs,
  });

  try {
    const rows = (await connection.query(
      "SELECT DATABASE() AS databaseName, VERSION() AS serverVersion",
    )) as Array<{ databaseName: string | null; serverVersion: string }>;

    const firstRow = rows[0];

    if (!firstRow) {
      throw new Error("MariaDB health query returned no rows.");
    }

    return {
      databaseName: firstRow.databaseName,
      serverVersion: firstRow.serverVersion,
    };
  } finally {
    await connection.end();
  }
}

export async function closeDatabasePool() {
  if (!globalForDatabase.__wbsMariaDbPool) {
    return;
  }

  await globalForDatabase.__wbsMariaDbPool.end();
  globalForDatabase.__wbsMariaDbPool = undefined;
}


export type QueryStatement = { sql: string; params?: readonly unknown[] };
function boundValues(params: readonly unknown[] = []) {
  if (params.length > 100) throw new Error("D1 statements may bind at most 100 parameters.");
  return params.map((value) => {
    if (value === null || typeof value === "string" || value instanceof ArrayBuffer) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "bigint" && Number.isSafeInteger(Number(value))) return Number(value);
    throw new Error("Unsupported or missing SQL parameter.");
  });
}
export function getDatabasePool() {
  if (!isHostedRuntime()) return getMariaDatabasePool();
  return {
    async query(sql: string, params?: readonly unknown[]) {
      const result = await getHostedDatabase().prepare(sql).bind(...boundValues(params)).all();
      if (!result.success) throw new Error("D1 statement failed.");
      if (/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) return result.results.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
        key.endsWith("_at") && typeof value === "string" && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)
          ? value.replace(" ", "T") + "Z" : value,
      ])));
      return { insertId: result.meta.last_row_id, affectedRows: result.meta.changes };
    },
    async getConnection(): Promise<never> {
      throw new Error("D1 uses atomic databaseBatch, not connection transactions.");
    },
  };
}
/** Executes related mutations atomically in either supported database runtime. */
export async function databaseBatch(statements: readonly QueryStatement[]) {
  if (!statements.length) return [];
  if (isHostedRuntime()) {
    return getHostedDatabase().batch(statements.map(({ sql, params }) => getHostedDatabase().prepare(sql).bind(...boundValues(params))));
  }
  return withDeadlockRetry(
    () => getMariaDatabasePool().getConnection(),
    async (connection) => {
      const results = [];
      for (const { sql, params } of statements) results.push(await connection.query(sql, params ? [...params] : undefined));
      return results;
    },
  );
}

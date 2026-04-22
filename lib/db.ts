import { createConnection, createPool, type Pool } from "mariadb";
import { requireDatabaseEnv } from "@/lib/env";

const globalForDatabase = globalThis as typeof globalThis & {
  __wbsMariaDbPool?: Pool;
};

export function getDatabasePool() {
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
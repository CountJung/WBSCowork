import { loadEnvConfig } from "@next/env";
import { checkDatabaseConnection, closeDatabasePool } from "../lib/db";
import { requireDatabaseEnv } from "../lib/env";

loadEnvConfig(process.cwd());

async function main() {
  const validateOnly = process.argv.includes("--validate-only");
  const databaseEnv = requireDatabaseEnv();

  console.log(
    `Database env loaded: host=${databaseEnv.host} port=${databaseEnv.port} name=${databaseEnv.database} user=${databaseEnv.user} password=${databaseEnv.password === "" ? "(empty)" : "(set)"}`,
  );

  if (validateOnly) {
    console.log("Database environment validation passed.");
    return;
  }

  const databaseStatus = await checkDatabaseConnection();

  console.log(
    `MariaDB connection OK: database=${databaseStatus.databaseName ?? databaseEnv.database} version=${databaseStatus.serverVersion}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabasePool();
  });
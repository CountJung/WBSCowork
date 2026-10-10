import nextEnv from "@next/env";
import { checkDatabaseConnection, closeDatabasePool } from "../src/shared/server/database/index.server";
import { requireDatabaseEnv } from "../src/shared/server/runtime-env/index.server";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log("Usage: npm run db:check -- [--validate-only]\n--validate-only validates configuration without connecting to MariaDB.");
    return;
  }
  if (args.some(value => value !== "--validate-only") || args.length > 1) {
    throw new Error("Use --validate-only, --help, or no arguments.");
  }
  nextEnv.loadEnvConfig(process.cwd());
  const validateOnly = args.includes("--validate-only");
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

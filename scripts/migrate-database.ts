/** Operator-invoked native workflow. Default is read-only status; --apply is explicit DDL. */
import nextEnv from "@next/env";
import { getDatabaseAdminStatus, initializeDatabaseSchema } from "../src/shared/server/database-admin/index.server";
const args = process.argv.slice(2);
try {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log("Usage: npm run db:migrate -- [--status | --apply]\nDefault/--status: read-only schema status. --apply: explicit native migration with DB_SCHEMA_USER/PASSWORD.");
  } else {
    if (args.some(value => !["--apply", "--status"].includes(value)) || args.length > 1) {
      throw new Error("Use one of --status (default), --apply, or --help.");
    }
    nextEnv.loadEnvConfig(process.cwd());
    const status = args.includes("--apply") ? await initializeDatabaseSchema() : await getDatabaseAdminStatus();
    console.log(JSON.stringify({ database: status.databaseName, tables: `${status.existingTableCount}/${status.managedTableCount}`, schemaConfigured: status.schemaConfigured, migrations: status.nativeMigrations }, null, 2));
    if (status.nativeMigrations?.error) process.exitCode = 1;
  }
} catch (error) {
  // Avoid dumping driver errors/objects containing connection information.
  console.error(error instanceof Error ? error.message : "Native migration command failed.");
  process.exitCode = 1;
}

/** Operator-invoked native workflow. Default is read-only status; --apply is explicit DDL. */
import { loadEnvConfig } from "@next/env";
import { getDatabaseAdminStatus, initializeDatabaseSchema } from "../src/shared/server/database-admin/index.server";
loadEnvConfig(process.cwd());
try {
  const unknown = process.argv.slice(2).filter(value => !["--apply", "--status"].includes(value));
  if (unknown.length) throw new Error("Use --status (default) or --apply.");
  const status = process.argv.includes("--apply") ? await initializeDatabaseSchema() : await getDatabaseAdminStatus();
  console.log(JSON.stringify({ database: status.databaseName, tables: `${status.existingTableCount}/${status.managedTableCount}`, schemaConfigured: status.schemaConfigured, migrations: status.nativeMigrations }, null, 2));
  if (status.nativeMigrations?.error) process.exitCode = 1;
} catch (error) {
  // Avoid dumping driver errors/objects containing connection information.
  console.error(error instanceof Error ? error.message : "Native migration command failed.");
  process.exitCode = 1;
}

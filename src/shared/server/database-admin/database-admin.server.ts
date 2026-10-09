import { nativeMigrationManifest, NativeMigrationError, readNativeMigrationStatus, runNativeMigrations } from "./native-migrations.server";
import { bugLifecycleColumns } from "./bug-schema.server";
import { pendingObjectCleanupCount } from "@/src/shared/server/object-cleanup/index.server";
import { getHostedDatabase, isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { createConnection } from "mariadb";
import { requireDatabaseEnv, requireDatabaseSchemaEnv, isDatabaseSchemaConfigured, type DatabaseEnv } from "@/src/shared/server/runtime-env/index.server";

type ColumnDefinition = {
  name: string;
  definition: string;
};

const managedTableNames = ["users", "projects", "tasks", "submissions", "submission_attachments", "comments", "bug_reports", "bug_report_events", "bug_report_purge_receipts", "task_events", "submission_revisions", "submission_events", "task_dependencies", "task_template_runs"] as const;

export type ManagedTableName = (typeof managedTableNames)[number];

export type DatabaseAdminStatus = {
  managedMigrations?: boolean;
  schemaConfigured?: boolean;
  nativeMigrations?: { ledgerExists: boolean; appliedVersions: number[]; pendingVersions: number[]; error?: string };
  pendingCleanupCount?: number;
  host: string;
  port: number;
  user: string;
  databaseName: string;
  databaseExists: boolean;
  tables: Array<{
    name: ManagedTableName;
    exists: boolean;
    missingColumns: string[];
  }>;
  existingTableCount: number;
  managedTableCount: number;
};

const requiredUsersColumns: ColumnDefinition[] = [
  { name: "google_id", definition: "google_id VARCHAR(255) NULL" },
  { name: "avatar_url", definition: "avatar_url VARCHAR(500) NULL" },
  { name: "last_login_at", definition: "last_login_at DATETIME NULL" },
  { name: "last_synced_at", definition: "last_synced_at DATETIME NULL" },
];

const requiredSubmissionColumns: ColumnDefinition[] = [
  { name: "visibility", definition: "visibility ENUM('public', 'private') NOT NULL DEFAULT 'public'" },
  { name: "file_name", definition: "file_name VARCHAR(255) NULL" },
  { name: "file_mime_type", definition: "file_mime_type VARCHAR(255) NULL" },
  { name: "file_size_bytes", definition: "file_size_bytes BIGINT NULL" },
];

const requiredColumnsByTable: Partial<Record<ManagedTableName, string[]>> = {
  bug_report_purge_receipts: ["actor_id","operation_token","fingerprint","report_version","event_count","last_event_id","purged_at"],
  bug_reports: [...bugLifecycleColumns.map(c=>c.name),"reporter_id","creation_token","last_operation_token","title","reproduction","expected","actual","page_path","status","priority","resolution","fix_commit","version","created_at","updated_at"],
  bug_report_events: ["lifecycle_action","report_id","actor_id","operation_token","kind","body","status","priority","resolution","fix_commit","report_version","created_at"],
  task_template_runs:["project_id","actor_id","template_key","template_version","operation_token","request_fingerprint","task_count","completed_at"],
  task_dependencies:["project_id","task_id","predecessor_id"],
  projects: ["goal", "success_criteria", "dependency_version", "dependency_token"],
  tasks: ["review_submission_id", "review_revision_number", "deliverable", "definition_of_done", "review_required", "status", "version", "workflow_note", "reviewer_id", "last_operation_token", "creation_token"],
  task_events: ["task_id", "actor_id", "operation_token", "request_fingerprint", "kind", "status", "assignee_id", "reviewer_id", "note", "task_version"],
  submissions: [...requiredSubmissionColumns.map((column) => column.name),"creation_token","current_revision","version","last_operation_token","material_url"],
  submission_attachments:["revision_number"],
  comments:["revision_number"],
  submission_revisions:["submission_id","revision_number","editor_id","content","visibility","material_url","change_summary","file_path","file_name","file_mime_type","file_size_bytes","source"],
  submission_events:["submission_id","revision_number","actor_id","operation_token","request_fingerprint","kind","body"],
  users: requiredUsersColumns.map((column) => column.name),
};

async function withServerConnection<T>(callback: (connection: Awaited<ReturnType<typeof createConnection>>) => Promise<T>, databaseEnv: DatabaseEnv = requireDatabaseEnv()) {
  const connection = await createConnection({
    host: databaseEnv.host,
    port: databaseEnv.port,
    user: databaseEnv.user,
    password: databaseEnv.password,
    connectTimeout: databaseEnv.connectTimeoutMs,
  });

  try {
    return await callback(connection);
  } finally {
    await connection.end();
  }
}

async function withDatabaseConnection<T>(callback: (connection: Awaited<ReturnType<typeof createConnection>>) => Promise<T>, databaseEnv: DatabaseEnv = requireDatabaseEnv()) {
  const connection = await createConnection({
    host: databaseEnv.host,
    port: databaseEnv.port,
    user: databaseEnv.user,
    password: databaseEnv.password,
    database: databaseEnv.database,
    connectTimeout: databaseEnv.connectTimeoutMs,
  });

  try {
    return await callback(connection);
  } finally {
    await connection.end();
  }
}

export async function getDatabaseAdminStatus(): Promise<DatabaseAdminStatus> {
  if (isHostedRuntime()) {
    const db = getHostedDatabase();
    const tables = await Promise.all(managedTableNames.map(async (name) => {
      const columns = await db.prepare(`PRAGMA table_info(${name})`).all<{ name: string }>();
      const found = new Set(columns.results.map((row) => row.name));
      return { name, exists: found.size > 0, missingColumns: (requiredColumnsByTable[name] ?? []).filter((column) => !found.has(column)) };
    }));
    return { managedMigrations: true, pendingCleanupCount: await pendingObjectCleanupCount(), host: "Sites D1", port: 0, user: "Worker binding", databaseName: "DB", databaseExists: true, tables, existingTableCount: tables.filter((table) => table.exists).length, managedTableCount: tables.length };
  }
  const databaseEnv = requireDatabaseEnv();

  const databaseExists = await withServerConnection(async (connection) => {
    const rows = (await connection.query(
      "SELECT SCHEMA_NAME AS schemaName FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [databaseEnv.database],
    )) as Array<{ schemaName: string }>;

    return rows.length > 0;
  });

  if (!databaseExists) {
    return {
      host: databaseEnv.host,
      port: databaseEnv.port,
      user: databaseEnv.user,
      databaseName: databaseEnv.database,
      databaseExists: false,
      schemaConfigured: isDatabaseSchemaConfigured(),
      nativeMigrations: { ledgerExists: false, appliedVersions: [], pendingVersions: nativeMigrationManifest.map(migration => migration.version) },
      tables: managedTableNames.map((name) => ({ name, exists: false, missingColumns: requiredColumnsByTable[name] ?? [] })),
      existingTableCount: 0,
      managedTableCount: managedTableNames.length,
    };
  }

  const { existingColumnsByTable, existingTables, nativeMigrations } = await withDatabaseConnection(async (connection) => {
    const [tableRows, columnRows] = await Promise.all([
      connection.query("SELECT TABLE_NAME AS tableName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?", [databaseEnv.database]),
      connection.query(
        "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?",
        [databaseEnv.database],
      ),
    ]);

    const existingTables = new Set((tableRows as Array<{ tableName: string }>).map((row) => row.tableName as ManagedTableName));
    const existingColumnsByTable = new Map<ManagedTableName, Set<string>>();

    for (const row of columnRows as Array<{ tableName: string; columnName: string }>) {
      const tableName = row.tableName as ManagedTableName;
      const columns = existingColumnsByTable.get(tableName) ?? new Set<string>();

      columns.add(row.columnName);
      existingColumnsByTable.set(tableName, columns);
    }

    let nativeMigrations: DatabaseAdminStatus["nativeMigrations"];
    try { nativeMigrations = await readNativeMigrationStatus(connection, databaseEnv.database); }
    catch { nativeMigrations = { ledgerExists: true, appliedVersions: [], pendingVersions: [], error: "Native migration history cannot be verified. Review ledger permissions/checksums with the schema operator." }; }
    return {
      nativeMigrations,
      existingColumnsByTable,
      existingTables,
    };
  });

  const tables = managedTableNames.map((name) => ({
    name,
    exists: existingTables.has(name),
    missingColumns: existingTables.has(name)
      ? (requiredColumnsByTable[name] ?? []).filter((columnName) => !existingColumnsByTable.get(name)?.has(columnName))
      : [],
  }));

  return {
    host: databaseEnv.host,
    port: databaseEnv.port,
    user: databaseEnv.user,
    databaseName: databaseEnv.database,
    databaseExists: true,
    schemaConfigured: isDatabaseSchemaConfigured(),
    nativeMigrations,
    tables,
    existingTableCount: tables.filter((table) => table.exists).length,
    managedTableCount: tables.length,
  };
}

export async function initializeDatabaseSchema() {
  if (isHostedRuntime()) throw new Error("Sites manages schema migrations during deployment. Runtime DDL is disabled.");
  const databaseEnv = requireDatabaseSchemaEnv();
  try {
    await withServerConnection(connection => runNativeMigrations(connection, databaseEnv.database), databaseEnv);
  } catch (error) {
    // Driver errors may contain the privileged username, SQL or connection details.
    // Only our constant/schema-contract messages may cross the UI/audit boundary.
    if (error instanceof NativeMigrationError) throw error;
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    const safeCode = /^[A-Z0-9_]{1,64}$/.test(code) ? ` (${code})` : "";
    throw new Error(`Native schema operation failed${safeCode}. Check the schema identity and database state with the operator before retrying.`);
  }
  return getDatabaseAdminStatus();
}

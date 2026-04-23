import { createConnection } from "mariadb";
import { requireDatabaseEnv } from "@/lib/env";

type ColumnDefinition = {
  name: string;
  definition: string;
};

const managedTableNames = ["users", "projects", "tasks", "submissions", "submission_attachments", "comments"] as const;

export type ManagedTableName = (typeof managedTableNames)[number];

export type DatabaseAdminStatus = {
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

const createSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'member', 'guest') NOT NULL DEFAULT 'guest',
    google_id VARCHAR(255) NULL,
    avatar_url VARCHAR(500) NULL,
    last_login_at DATETIME NULL,
    last_synced_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_email_unique (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS projects (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    parent_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    depth INT NOT NULL DEFAULT 0,
    order_index INT NOT NULL DEFAULT 0,
    assignee_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY tasks_project_idx (project_id),
    KEY tasks_parent_idx (parent_id),
    KEY tasks_assignee_idx (assignee_id),
    CONSTRAINT tasks_project_fk FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT tasks_parent_fk FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE SET NULL,
    CONSTRAINT tasks_assignee_fk FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    file_path VARCHAR(500) NULL,
    file_name VARCHAR(255) NULL,
    file_mime_type VARCHAR(255) NULL,
    file_size_bytes BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY submissions_task_idx (task_id),
    KEY submissions_author_idx (author_id),
    CONSTRAINT submissions_task_fk FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT submissions_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS submission_attachments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_mime_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
    file_size_bytes BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY submission_attachments_submission_idx (submission_id),
    CONSTRAINT submission_attachments_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS comments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submission_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY comments_submission_idx (submission_id),
    KEY comments_author_idx (author_id),
    CONSTRAINT comments_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE,
    CONSTRAINT comments_author_fk FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
] as const;

const requiredUsersColumns: ColumnDefinition[] = [
  { name: "google_id", definition: "google_id VARCHAR(255) NULL" },
  { name: "avatar_url", definition: "avatar_url VARCHAR(500) NULL" },
  { name: "last_login_at", definition: "last_login_at DATETIME NULL" },
  { name: "last_synced_at", definition: "last_synced_at DATETIME NULL" },
];

const requiredSubmissionColumns: ColumnDefinition[] = [
  { name: "file_name", definition: "file_name VARCHAR(255) NULL" },
  { name: "file_mime_type", definition: "file_mime_type VARCHAR(255) NULL" },
  { name: "file_size_bytes", definition: "file_size_bytes BIGINT NULL" },
];

const requiredColumnsByTable: Partial<Record<ManagedTableName, string[]>> = {
  submissions: requiredSubmissionColumns.map((column) => column.name),
  users: requiredUsersColumns.map((column) => column.name),
};

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error("DB_NAME must use only letters, numbers, and underscores for admin creation tasks.");
  }

  return `\`${identifier}\``;
}

async function ensureTableColumns(
  connection: Awaited<ReturnType<typeof createConnection>>,
  databaseName: string,
  tableName: string,
  columns: ColumnDefinition[],
) {
  const rows = (await connection.query(
    `SELECT COLUMN_NAME AS columnName
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [databaseName, tableName],
  )) as Array<{ columnName: string }>;

  const existingColumns = new Set(rows.map((row) => row.columnName));

  for (const column of columns) {
    if (existingColumns.has(column.name)) {
      continue;
    }

    await connection.query(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${column.definition}`);
  }
}

async function withServerConnection<T>(callback: (connection: Awaited<ReturnType<typeof createConnection>>) => Promise<T>) {
  const databaseEnv = requireDatabaseEnv();
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

async function withDatabaseConnection<T>(callback: (connection: Awaited<ReturnType<typeof createConnection>>) => Promise<T>) {
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
    return await callback(connection);
  } finally {
    await connection.end();
  }
}

export async function getDatabaseAdminStatus(): Promise<DatabaseAdminStatus> {
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
      tables: managedTableNames.map((name) => ({ name, exists: false, missingColumns: requiredColumnsByTable[name] ?? [] })),
      existingTableCount: 0,
      managedTableCount: managedTableNames.length,
    };
  }

  const { existingColumnsByTable, existingTables } = await withDatabaseConnection(async (connection) => {
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

    return {
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
    tables,
    existingTableCount: tables.filter((table) => table.exists).length,
    managedTableCount: tables.length,
  };
}

export async function initializeDatabaseSchema() {
  const databaseEnv = requireDatabaseEnv();
  const quotedDatabaseName = quoteIdentifier(databaseEnv.database);

  await withServerConnection(async (connection) => {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${quotedDatabaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  });

  await withDatabaseConnection(async (connection) => {
    for (const statement of createSchemaStatements) {
      await connection.query(statement);
    }

    await ensureTableColumns(connection, databaseEnv.database, "users", requiredUsersColumns);
    await ensureTableColumns(connection, databaseEnv.database, "submissions", requiredSubmissionColumns);

    await connection.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'member', 'guest') NOT NULL DEFAULT 'guest'",
    );
  });

  return getDatabaseAdminStatus();
}
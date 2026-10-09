import { createHash } from "node:crypto";
import { nativeMigrationV1 } from "./native-migration-v1";
import { nativeMigrationV5 } from "./native-migration-v5";
import { nativeMigrationV4 } from "./native-migration-v4";
import { nativeMigrationV3 } from "./native-migration-v3";
import { nativeMigrationV2 } from "./native-migration-v2";

export class NativeMigrationError extends Error {}

export type MigrationConnection = { query(sql: string, values?: unknown[]): Promise<unknown> };
export type MigrationLedgerRow = { version: number; name: string; checksum: string; appliedAt?: string };
export const nativeMigrationManifest = [nativeMigrationV1, nativeMigrationV2, nativeMigrationV3, nativeMigrationV4, nativeMigrationV5] as const;
export const migrationChecksum = (specification: unknown) => createHash("sha256").update(JSON.stringify(specification)).digest("hex");
export function quoteSchemaIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(identifier)) throw new NativeMigrationError("Schema identifier must contain 1–64 letters, numbers or underscores.");
  return `\`${identifier}\``;
}
async function rows<T>(connection: MigrationConnection, sql: string, params: unknown[] = []) { return await connection.query(sql, params) as T[]; }
export function validateMigrationLedger(ledger: MigrationLedgerRow[]) {
  for (let i = 0; i < ledger.length; i++) {
    const expected = nativeMigrationManifest[i];
    const actual = ledger[i];
    if (!expected || actual.version !== expected.version || actual.name !== expected.name || actual.checksum !== migrationChecksum(expected)) {
      throw new NativeMigrationError("Native migration ledger has an unknown version, gap, or checksum mismatch. Stop and review the schema history; no automatic repair is allowed.");
    }
  }
  return nativeMigrationManifest.slice(ledger.length);
}

/** Splits immutable CREATE body entries, including ENUM/CHECK expressions and quoted commas. */
export function splitSchemaEntries(body: string) {
  const result: string[] = []; let depth = 0, quoted = false, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'" && body[i - 1] !== "\\") {
      if (quoted && body[i + 1] === "'") { i++; continue; }
      quoted = !quoted;
    }
    if (!quoted) { if (c === "(") depth++; if (c === ")") depth--; }
    if (c === "," && !quoted && depth === 0) { result.push(body.slice(start, i).trim()); start = i + 1; }
  }
  result.push(body.slice(start).trim()); return result.filter(Boolean);
}
// SQL keywords are case-insensitive; quoted role/default/CHECK literals are not.
function normalizeSqlSyntax(value: string) {
  return value.split(/('(?:[^']|'')*')/g).map((part, index) => index % 2 ? part : part.toLowerCase().replace(/[\s`]/g, "")).join("");
}
const normalizeType = (value: string) => normalizeSqlSyntax(value.replace(/\b(bigint|int)\(\d+\)/gi, "$1"));
const normalizeDefault = (value: unknown) => {
  if (value == null || value === "NULL") return null;
  const text = String(value);
  if (/^'.*'$/.test(text)) return text;
  return text.replace(/^current_timestamp(?:\(\))?$/i, "current_timestamp");
};
const normalizeCheck = (value: string) => normalizeSqlSyntax(value).replace(/[()]/g, "");
const columnList = (value: string) => value.replace(/[\s`]/g, "");
type ColumnRow = { name: string; type: string; nullable: string; defaultValue: unknown; extra: string; collation: string | null };
async function columns(connection: MigrationConnection, database: string, table: string) {
  return rows<ColumnRow>(connection, "SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra, COLLATION_NAME AS collation FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?", [database, table]);
}

export async function verifyNativeSchema(connection: MigrationConnection, database: string, specifications: readonly string[] = nativeMigrationManifest.flatMap(migration => [...migration.statements])) {
  for (const statement of specifications) {
    const table = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/)![1];
    const body = statement.slice(statement.indexOf("(") + 1, statement.lastIndexOf(") ENGINE"));
    const found = new Map((await columns(connection, database, table)).map(row => [row.name, row]));
    const indexes = await rows<{ name: string; uniqueFlag: number; names: string; prefixLength: number }>(connection,
      "SELECT INDEX_NAME AS name, NON_UNIQUE AS uniqueFlag, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS names, MAX(COALESCE(SUB_PART,0)) AS prefixLength FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? GROUP BY INDEX_NAME, NON_UNIQUE", [database, table]);
    const foreignKeys = await rows<{ columnName: string; targetSchema: string; targetTable: string; targetColumn: string; deleteRule: string }>(connection,
      "SELECT k.COLUMN_NAME AS columnName, k.REFERENCED_TABLE_SCHEMA AS targetSchema, k.REFERENCED_TABLE_NAME AS targetTable, k.REFERENCED_COLUMN_NAME AS targetColumn, r.DELETE_RULE AS deleteRule FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=? AND k.TABLE_NAME=? AND k.REFERENCED_TABLE_NAME IS NOT NULL", [database, table]);
    const checks = await rows<{ name: string; clause: string }>(connection, "SELECT CONSTRAINT_NAME AS name, CHECK_CLAUSE AS clause FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME=?", [database, table]);
    const tableInfo = await rows<{ engine: string; collation: string }>(connection, "SELECT ENGINE AS engine, TABLE_COLLATION AS collation FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?", [database, table]);
    if (tableInfo[0]?.engine.toLowerCase() !== "innodb" || tableInfo[0]?.collation !== "utf8mb4_unicode_ci") throw new NativeMigrationError(`Native schema drift: ${table} must use InnoDB and utf8mb4_unicode_ci.`);
    for (const entry of splitSchemaEntries(body)) {
      const column = entry.match(/^(\w+)\s+(BIGINT|INT|VARCHAR\(\d+\)|CHAR\(\d+\)|DATETIME|DATE|TEXT|ENUM\([^)]*\))([\s\S]*)$/);
      if (column) {
        const [, name, type, rest] = column, actual = found.get(name);
        const nullable = !/NOT NULL|PRIMARY KEY/.test(rest);
        const defaultValue = rest.match(/DEFAULT\s+('(?:[^']|'')*'|\w+)/)?.[1] ?? null;
        if (!actual || normalizeType(actual.type) !== normalizeType(type) || (actual.nullable === "YES") !== nullable || normalizeDefault(actual.defaultValue) !== normalizeDefault(defaultValue) || (/VARCHAR|CHAR|TEXT|ENUM/.test(type) && actual.collation !== "utf8mb4_unicode_ci") || /AUTO_INCREMENT/.test(rest) !== /auto_increment/i.test(actual.extra)) {
          throw new NativeMigrationError(`Native schema drift: ${table}.${name} has an incompatible type, nullability, default, or identity definition.`);
        }
        if (/PRIMARY KEY|UNIQUE/.test(rest) && !indexes.some(index => Number(index.uniqueFlag) === 0 && Number(index.prefixLength) === 0 && index.names === name)) throw new NativeMigrationError(`Native schema drift: ${table}.${name} requires a unique key.`);
        continue;
      }
      const key = entry.match(/^(PRIMARY KEY|UNIQUE KEY \w+|KEY \w+)\s*\(([^)]+)\)/);
      if (key && !indexes.some(index => index.names === columnList(key[2]) && Number(index.prefixLength) === 0 && (!key[1].startsWith("KEY ") ? Number(index.uniqueFlag) === 0 : true))) throw new NativeMigrationError(`Native schema drift: missing index on ${table}(${key[2]}).`);
      const fk = entry.match(/^CONSTRAINT \w+ FOREIGN KEY\s*\((\w+)\) REFERENCES (\w+)\s*\((\w+)\)(?: ON DELETE (CASCADE|SET NULL|RESTRICT))?/);
      if (fk && !foreignKeys.some(row => row.columnName === fk[1] && row.targetSchema === database && row.targetTable === fk[2] && row.targetColumn === fk[3] && row.deleteRule === (fk[4] ?? "RESTRICT"))) throw new NativeMigrationError(`Native schema drift: incompatible foreign key ${table}.${fk[1]}.`);
      const check = entry.match(/^CONSTRAINT (\w+) CHECK\(([\s\S]*)\)$/);
      if (check && !checks.some(row => row.name === check[1] && normalizeCheck(row.clause) === normalizeCheck(check[2]))) throw new NativeMigrationError(`Native schema drift: incompatible CHECK ${table}.${check[1]}.`);
      if (!key && !fk && !check) throw new NativeMigrationError(`Unsupported immutable schema entry in ${table}.`);
    }
  }
}

export async function readNativeMigrationStatus(connection: MigrationConnection, database: string) {
  const present = await rows(connection, "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='schema_migrations'", [database]);
  const ledger = present.length ? await rows<MigrationLedgerRow>(connection, "SELECT version,name,checksum,applied_at AS appliedAt FROM schema_migrations ORDER BY version") : [];
  const pending = validateMigrationLedger(ledger);
  return { ledgerExists: present.length > 0, appliedVersions: ledger.map(row => row.version), pendingVersions: pending.map(row => row.version) };
}

async function applyNativeV1(connection: MigrationConnection, database: string) {
  for (const statement of nativeMigrationV1.statements) await connection.query(statement);
  for (const addition of nativeMigrationV1.additions) {
    if (!(await columns(connection, database, addition.table)).some(column => column.name === addition.name)) {
      await connection.query(`ALTER TABLE ${quoteSchemaIdentifier(addition.table)} ADD COLUMN ${addition.definition}`);
    }
  }
  const role = (await columns(connection, database, "users")).find(column => column.name === "role");
  if (!role) throw new NativeMigrationError("Native schema drift: users.role is missing.");
  if (normalizeType(role.type) !== "enum('admin','member','guest')" || role.nullable !== "NO" || normalizeDefault(role.defaultValue) !== "'guest'") {
    const invalid = await rows<{ count: number }>(connection, "SELECT COUNT(*) AS count FROM users WHERE role IS NULL OR BINARY role NOT IN (BINARY 'admin',BINARY 'member',BINARY 'guest')");
    if (Number(invalid[0]?.count) !== 0) throw new NativeMigrationError("Legacy users.role contains unsupported values; manual review is required without coercing account roles.");
    await connection.query(`ALTER TABLE users MODIFY COLUMN ${nativeMigrationV1.roleUpgrade.definition}`);
  }
  for (const column of nativeMigrationV1.additiveForeignKeys) {
    const present = await rows(connection, "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME='bug_reports' AND COLUMN_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL", [database, column]);
    if (!present.length) await connection.query(`ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_${column}_fk FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE SET NULL`);
  }
  await verifyNativeSchema(connection, database, nativeMigrationV1.statements);
}

async function applyNativeV2(connection: MigrationConnection, database: string) {
  for (const addition of nativeMigrationV2.additions) {
    if (!(await columns(connection, database, addition.table)).some(column => column.name === addition.name)) {
      await connection.query(`ALTER TABLE ${quoteSchemaIdentifier(addition.table)} ADD COLUMN ${addition.definition}`);
    }
  }
  await verifyNativeSchema(connection, database, [...nativeMigrationV1.statements, ...nativeMigrationV2.statements]);
}

async function applyNativeV3(connection: MigrationConnection, database: string) {
  for(const addition of nativeMigrationV3.additions) {
    if(!(await columns(connection,database,addition.table)).some(column=>column.name===addition.name))await connection.query(`ALTER TABLE ${quoteSchemaIdentifier(addition.table)} ADD COLUMN ${addition.definition}`);
  }
  for(const key of nativeMigrationV3.foreignKeys) {
    const present=await rows(connection,"SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL",[database,key.table,key.column]);
    if(!present.length)await connection.query(`ALTER TABLE ${quoteSchemaIdentifier(key.table)} ADD ${key.definition}`);
  }
  for(const statement of nativeMigrationV3.newTables)await connection.query(statement);
  await connection.query(nativeMigrationV3.baselineSql);
  await verifyNativeSchema(connection,database,[...nativeMigrationV1.statements,...nativeMigrationV2.statements,...nativeMigrationV3.statements]);
}

async function applyNativeV4(connection: MigrationConnection, database: string) {
  for(const addition of nativeMigrationV4.additions) {
    if(!(await columns(connection,database,addition.table)).some(column=>column.name===addition.name))await connection.query(`ALTER TABLE ${quoteSchemaIdentifier(addition.table)} ADD COLUMN ${addition.definition}`);
  }
  for(const statement of nativeMigrationV4.newTables)await connection.query(statement);
  for(const statement of nativeMigrationV4.baselineSql)await connection.query(statement);
  await verifyNativeSchema(connection,database,[...nativeMigrationV1.statements,...nativeMigrationV2.statements,...nativeMigrationV3.statements,...nativeMigrationV4.statements]);
}

async function applyNativeV5(connection: MigrationConnection, database: string) {
  for (const addition of nativeMigrationV5.additions) {
    if (!(await columns(connection, database, addition.table)).some(column => column.name === addition.name)) {
      await connection.query(`ALTER TABLE ${quoteSchemaIdentifier(addition.table)} ADD COLUMN ${addition.definition}`);
    }
  }
  await verifyNativeSchema(connection, database, [...nativeMigrationV1.statements, ...nativeMigrationV2.statements, ...nativeMigrationV3.statements, ...nativeMigrationV4.statements, ...nativeMigrationV5.statements]);
}

/** One caller-owned, schema-only connection. DDL implicitly commits; never wrap in deadlock retries. */
export async function runNativeMigrations(connection: MigrationConnection, database: string) {
  const quoted = quoteSchemaIdentifier(database);
  const lockName = `wbs-schema-${createHash("sha256").update(database).digest("hex").slice(0, 40)}`;
  const lock = await rows<{ acquired: number | null }>(connection, "SELECT GET_LOCK(?,10) AS acquired", [lockName]);
  if (Number(lock[0]?.acquired) !== 1) throw new NativeMigrationError("Another native migration is running or the migration lock is unavailable.");
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${quoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${quoted}`);
    await connection.query("CREATE TABLE IF NOT EXISTS schema_migrations (version INT NOT NULL PRIMARY KEY, name VARCHAR(128) NOT NULL, checksum CHAR(64) NOT NULL, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    const ledger = await rows<MigrationLedgerRow>(connection, "SELECT version,name,checksum,applied_at AS appliedAt FROM schema_migrations ORDER BY version");
    const pending = validateMigrationLedger(ledger);
    for (const migration of pending) {
      if (migration.version === 1) await applyNativeV1(connection, database);
      else if (migration.version === 2) await applyNativeV2(connection, database);
      else if (migration.version === 3) await applyNativeV3(connection, database);
      else if (migration.version === 4) await applyNativeV4(connection, database);
      else if (migration.version === 5) await applyNativeV5(connection, database);
      else throw new NativeMigrationError("This migration version has no implementation.");
      await connection.query("INSERT INTO schema_migrations(version,name,checksum) VALUES(?,?,?)", [migration.version, migration.name, migrationChecksum(migration)]);
      // Explicit durability even if this dedicated connection inherits autocommit=0.
      await connection.query("COMMIT");
    }
    // Already applied is still verified; ledger alone is not proof against later schema drift.
    if (!pending.length) await verifyNativeSchema(connection, database);
    return await readNativeMigrationStatus(connection, database);
  } finally {
    const released = await rows<{ released: number | null }>(connection, "SELECT RELEASE_LOCK(?) AS released", [lockName]);
    if (Number(released[0]?.released) !== 1) throw new NativeMigrationError("Native migration lock release failed; close the schema connection and inspect status before retrying.");
  }
}

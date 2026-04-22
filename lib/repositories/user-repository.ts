import { getDatabaseAdminStatus } from "@/lib/database-admin";
import { getDatabasePool } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/env";
import { mapUserRow, type User, type UserRole, type UserRow } from "@/models/user";

export type UpsertUserInput = {
  email: string;
  name: string;
  role: UserRole;
};

export type SyncAuthenticatedUserInput = {
  email?: string | null;
  name?: string | null;
  role: UserRole;
};

export type SyncAuthenticatedUserResult =
  | { persisted: true; user: User }
  | {
      persisted: false;
      reason:
        | "missing-email"
        | "database-env-missing"
        | "database-schema-pending"
        | "database-unavailable";
    };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeName(name: string) {
  const trimmedName = name.trim();

  return trimmedName.length > 0 ? trimmedName : "이름 없음";
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, created_at FROM users WHERE email = ? LIMIT 1",
    [normalizeEmail(email)],
  )) as UserRow[];

  const row = rows[0];

  return row ? mapUserRow(row) : null;
}

export async function listUsers(limit = 10): Promise<User[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT ?",
    [limit],
  )) as UserRow[];

  return rows.map(mapUserRow);
}

export async function getUserCount(): Promise<number> {
  const rows = (await getDatabasePool().query("SELECT COUNT(*) AS count FROM users")) as Array<{
    count: number;
  }>;

  return Number(rows[0]?.count ?? 0);
}

export async function upsertUser(input: UpsertUserInput): Promise<User> {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name);

  await getDatabasePool().query(
    `INSERT INTO users (email, name, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       role = CASE
         WHEN users.role = 'admin' OR VALUES(role) = 'admin' THEN 'admin'
         ELSE 'member'
       END`,
    [email, name, input.role],
  );

  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("User upsert completed but the user row could not be loaded.");
  }

  return user;
}

export async function syncAuthenticatedUserIfPossible(
  input: SyncAuthenticatedUserInput,
): Promise<SyncAuthenticatedUserResult> {
  if (!input.email) {
    return {
      persisted: false,
      reason: "missing-email",
    };
  }

  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.database.configured) {
    return {
      persisted: false,
      reason: "database-env-missing",
    };
  }

  try {
    const databaseStatus = await getDatabaseAdminStatus();
    const usersTableReady = databaseStatus.databaseExists && databaseStatus.tables.some((table) => table.name === "users" && table.exists);

    if (!usersTableReady) {
      return {
        persisted: false,
        reason: "database-schema-pending",
      };
    }

    return {
      persisted: true,
      user: await upsertUser({
        email: input.email,
        name: input.name ?? input.email,
        role: input.role,
      }),
    };
  } catch {
    return {
      persisted: false,
      reason: "database-unavailable",
    };
  }
}
import { getDatabaseAdminStatus } from "@/lib/database-admin";
import { getDatabasePool } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/env";
import {
  getDefaultUserRole,
  manageableUserRoles,
  mapUserRow,
  type ManageableUserRole,
  type User,
  type UserRole,
  type UserRow,
} from "@/models/user";

export type UpsertUserInput = {
  email: string;
  name: string;
  role: UserRole;
  googleId?: string | null;
  avatarUrl?: string | null;
};

export type SyncAuthenticatedUserInput = {
  email?: string | null;
  name?: string | null;
  role: UserRole;
  googleId?: string | null;
  avatarUrl?: string | null;
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

const runtimeEnv = getRuntimeEnv();

function isUsersTableReady(status: Awaited<ReturnType<typeof getDatabaseAdminStatus>>) {
  return status.databaseExists && status.tables.some((table) => table.name === "users" && table.exists);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeName(name: string) {
  const trimmedName = name.trim();

  return trimmedName.length > 0 ? trimmedName : "이름 없음";
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users WHERE email = ? LIMIT 1",
    [normalizeEmail(email)],
  )) as UserRow[];

  const row = rows[0];

  return row ? mapUserRow(row) : null;
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users WHERE id = ? LIMIT 1",
    [id],
  )) as UserRow[];

  const row = rows[0];

  return row ? mapUserRow(row) : null;
}

export async function listUsers(limit = 10): Promise<User[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users ORDER BY COALESCE(last_login_at, created_at) DESC, id DESC LIMIT ?",
    [limit],
  )) as UserRow[];

  return rows.map(mapUserRow);
}

export async function listAllUsers(): Promise<User[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users ORDER BY COALESCE(last_login_at, created_at) DESC, id DESC",
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
    `INSERT INTO users (email, name, role, google_id, avatar_url, last_login_at, last_synced_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       google_id = VALUES(google_id),
       avatar_url = VALUES(avatar_url),
       last_login_at = CURRENT_TIMESTAMP,
       last_synced_at = CURRENT_TIMESTAMP,
       role = CASE
         WHEN users.role = 'admin' OR VALUES(role) = 'admin' THEN 'admin'
         WHEN users.role = 'member' AND VALUES(role) = 'guest' THEN 'member'
         ELSE VALUES(role)
       END`,
    [email, name, input.role, input.googleId ?? null, input.avatarUrl ?? null],
  );

  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("User upsert completed but the user row could not be loaded.");
  }

  return user;
}

export async function updateUserRole(userId: number, role: ManageableUserRole): Promise<User> {
  if (!manageableUserRoles.includes(role)) {
    throw new Error("변경 가능한 사용자 권한이 아닙니다.");
  }

  const existingUser = await getUserById(userId);

  if (!existingUser) {
    throw new Error("대상 사용자 정보를 찾을 수 없습니다.");
  }

  if (getDefaultUserRole(existingUser.email, runtimeEnv.auth.superuserEmail) === "admin") {
    throw new Error("env에 지정된 슈퍼관리자 계정의 권한은 여기서 변경할 수 없습니다.");
  }

  await getDatabasePool().query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);

  const updatedUser = await getUserById(userId);

  if (!updatedUser) {
    throw new Error("권한 변경 후 사용자 정보를 다시 불러오지 못했습니다.");
  }

  return updatedUser;
}

export async function resolveUserRoleForSession(email?: string | null): Promise<UserRole> {
  const normalizedEmail = email ? normalizeEmail(email) : undefined;
  const defaultRole = getDefaultUserRole(normalizedEmail, runtimeEnv.auth.superuserEmail);

  if (!normalizedEmail || defaultRole === "admin") {
    return defaultRole;
  }

  if (!runtimeEnv.database.configured) {
    return defaultRole;
  }

  try {
    const databaseStatus = await getDatabaseAdminStatus();

    if (!isUsersTableReady(databaseStatus)) {
      return defaultRole;
    }

    const user = await getUserByEmail(normalizedEmail);

    return user?.role ?? defaultRole;
  } catch {
    return defaultRole;
  }
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

  if (!runtimeEnv.database.configured) {
    return {
      persisted: false,
      reason: "database-env-missing",
    };
  }

  try {
    const databaseStatus = await getDatabaseAdminStatus();

    if (!isUsersTableReady(databaseStatus)) {
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
        googleId: input.googleId,
        avatarUrl: input.avatarUrl,
      }),
    };
  } catch {
    return {
      persisted: false,
      reason: "database-unavailable",
    };
  }
}
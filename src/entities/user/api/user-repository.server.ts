import { isHostedRuntime } from "@/src/shared/server/hosted-runtime/index.server";
import { getDatabaseAdminStatus } from "@/src/shared/server/database-admin/index.server";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { projectAccessGuard,type ProjectViewer } from "@/src/shared/server/project-scope/index.server";
import {
  getDefaultUserRole,
  getEffectiveUserRole,
  isConfiguredSuperuser,
  manageableUserRoles,
  mapUserRow,
  type ManageableUserRole,
  type User,
  type UserRole,
  type UserRow,
} from "../model/user";

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

function mapServerUserRow(row:UserRow):User {
  const user=mapUserRow(row),configured=getRuntimeEnv().auth.superuserEmail;
  return {...user,role:getEffectiveUserRole(user.role,user.email,configured),isSuperuser:isConfiguredSuperuser(user.email,configured)};
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users WHERE email = ? LIMIT 1",
    [normalizeEmail(email)],
  )) as UserRow[];

  const row = rows[0];

  return row ? mapServerUserRow(row) : null;
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users WHERE id = ? LIMIT 1",
    [id],
  )) as UserRow[];

  const row = rows[0];

  return row ? mapServerUserRow(row) : null;
}

export async function listUsers(limit = 10): Promise<User[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users ORDER BY COALESCE(last_login_at, created_at) DESC, id DESC LIMIT ?",
    [limit],
  )) as UserRow[];

  return rows.map(mapServerUserRow);
}

export async function listAllUsers(): Promise<User[]> {
  const rows = (await getDatabasePool().query(
    "SELECT id, email, name, role, google_id, avatar_url, last_login_at, last_synced_at, created_at FROM users ORDER BY COALESCE(last_login_at, created_at) DESC, id DESC",
  )) as UserRow[];

  return rows.map(mapServerUserRow);
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
    isHostedRuntime() ? `INSERT INTO users (email, name, role, google_id, avatar_url, last_login_at, last_synced_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name, google_id = excluded.google_id, avatar_url = excluded.avatar_url,
       last_login_at = CURRENT_TIMESTAMP, last_synced_at = CURRENT_TIMESTAMP,
       role = CASE WHEN users.role = 'admin' OR excluded.role = 'admin' THEN 'admin'
         WHEN users.role = 'member' AND excluded.role = 'guest' THEN 'member' ELSE excluded.role END`
    : `INSERT INTO users (email, name, role, google_id, avatar_url, last_login_at, last_synced_at)
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

export async function updateUserRole(userId: number, role: ManageableUserRole, actor:{userId:number;email:string;isSuperuser:boolean}): Promise<User> {
  const superuserEmail=getRuntimeEnv().auth.superuserEmail;
  if(!actor?.isSuperuser||!superuserEmail||normalizeEmail(actor.email)!==superuserEmail) throw new Error("사용자 권한 변경은 슈퍼관리자만 할 수 있습니다.");
  const persistedActor=await getUserById(actor.userId);
  if(!persistedActor||normalizeEmail(persistedActor.email)!==superuserEmail) throw new Error("슈퍼관리자 계정을 확인할 수 없습니다.");
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

  const result=await getDatabasePool().query("UPDATE users SET role = ? WHERE id = ? AND EXISTS (SELECT 1 FROM (SELECT id,email FROM users) AS actor_identity WHERE actor_identity.id=? AND LOWER(TRIM(actor_identity.email))=?)", [role, userId, actor.userId, superuserEmail]) as {affectedRows?:number};
  if(result.affectedRows===0) {
    const currentActor=await getUserById(actor.userId);
    if(!currentActor||normalizeEmail(currentActor.email)!==superuserEmail) throw new Error("슈퍼관리자 계정을 확인할 수 없습니다.");
  }

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

/** Public workspace selector labels only; never serialize authentication metadata. */
export async function listUserNames():Promise<{id:number;name:string}[]> {
 return await getDatabasePool().query('SELECT id,name FROM users ORDER BY name,id') as {id:number;name:string}[];
}

/** Assignment selector data only; restricted projects expose their active roster. */
export async function listProjectUsersForViewer(projectId:number,viewer:ProjectViewer):Promise<Pick<User,"id"|"name"|"email"|"role">[]> {
  if(!Number.isSafeInteger(projectId)||projectId<1)return [];
  const access=projectAccessGuard(viewer,"directory_project.id");
  const email=typeof viewer.email==="string"?normalizeEmail(viewer.email):null;
  return await getDatabasePool().query(`SELECT u.id,u.name,u.email,u.role FROM users u JOIN projects directory_project ON directory_project.id=?
    WHERE LOWER(TRIM(u.email))<>? AND ${access.sql} AND EXISTS(SELECT 1 FROM users directory_viewer WHERE directory_viewer.id=? OR (? IS NOT NULL AND LOWER(directory_viewer.email)=?))
    AND (directory_project.access_mode='legacy_authenticated' OR EXISTS(SELECT 1 FROM project_members directory_member WHERE directory_member.project_id=directory_project.id AND directory_member.user_id=u.id AND directory_member.active=1))
    ORDER BY u.name,u.id`,[projectId,getRuntimeEnv().auth.superuserEmail??"",...access.params,viewer.userId??null,email,email]) as Pick<User,"id"|"name"|"email"|"role">[];
}

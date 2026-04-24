export type UserRole = "admin" | "member" | "guest";

// 슈퍼관리자(env)가 직접 변경 가능한 역할 목록 (admin 포함)
export const manageableUserRoles = ["guest", "member", "admin"] as const;

export type ManageableUserRole = (typeof manageableUserRoles)[number];

// 관리자(admin 역할)가 변경 가능한 역할 목록 — admin 부여는 슈퍼관리자 전용
export const adminAssignableRoles = ["guest", "member"] as const;

export type AdminAssignableRole = (typeof adminAssignableRoles)[number];

export function getDefaultUserRole(email: string | null | undefined, superuserEmail: string | null | undefined): UserRole {
  if (!email || !superuserEmail) {
    return "guest";
  }

  return email.trim().toLowerCase() === superuserEmail.trim().toLowerCase() ? "admin" : "guest";
}

export function getUserRoleLabel(role: UserRole, isSuperuser = false) {
  if (isSuperuser) {
    return "슈퍼관리자";
  }

  switch (role) {
    case "admin":
      return "관리자";
    case "member":
      return "일반사용자";
    case "guest":
      return "게스트";
    default:
      return role;
  }
}

export function canWriteTaskContent(role: UserRole, isSuperuser = false) {
  return isSuperuser || role === "admin" || role === "member";
}

/**
 * 관리자 패널 접근 권한: 슈퍼관리자 또는 관리자(admin) 역할
 * DB 관리 및 사용자 관리는 슈퍼관리자 전용 (isSuperuser 직접 확인)
 */
export function canAccessAdminPanel(role: UserRole, isSuperuser = false) {
  return isSuperuser || role === "admin";
}

/**
 * 모든 제출물(비공개 포함) 조회 권한: 슈퍼관리자 또는 관리자(admin) 역할
 */
export function canManageAllSubmissions(role: UserRole, isSuperuser = false) {
  return isSuperuser || role === "admin";
}

export type UserRow = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  google_id: string | null;
  avatar_url: string | null;
  last_login_at: Date | string | null;
  last_synced_at: Date | string | null;
  created_at: Date | string;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  googleId: string | null;
  avatarUrl: string | null;
  lastLoginAt: Date | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
};

export function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    googleId: row.google_id,
    avatarUrl: row.avatar_url,
    lastLoginAt: row.last_login_at ? (row.last_login_at instanceof Date ? row.last_login_at : new Date(row.last_login_at)) : null,
    lastSyncedAt: row.last_synced_at ? (row.last_synced_at instanceof Date ? row.last_synced_at : new Date(row.last_synced_at)) : null,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}
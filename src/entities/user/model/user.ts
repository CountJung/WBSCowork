export type UserRole = "admin" | "member" | "guest";

// 슈퍼관리자(env)가 직접 변경 가능한 역할 목록 (admin 포함)
export const manageableUserRoles = ["guest", "member", "admin"] as const;

export type ManageableUserRole = (typeof manageableUserRoles)[number];

// 프로젝트 관리자는 전역 계정 역할을 부여하지 않습니다. 호환용 공개 상수입니다.
export const adminAssignableRoles = [] as const;

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
 * 관리 메뉴 진입 후보: 슈퍼관리자 또는 프로젝트 관리자(admin).
 * 일반 관리자는 배정된 프로젝트만 관리하며 전역 화면은 별도로 SU를 검증합니다.
 * DB 관리 및 사용자 관리는 슈퍼관리자 전용 (isSuperuser 직접 확인)
 */
export function canAccessAdminPanel(role: UserRole, isSuperuser = false) {
  return isSuperuser || role === "admin";
}

/**
 * 제출물 관리 후보 역할. 서버는 현재 프로젝트 관리 범위를 추가로 검사합니다.
 * 이 값만으로 비공개 제출물 조회를 허용하지 않습니다.
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

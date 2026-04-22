export type UserRole = "admin" | "member" | "guest";

export const manageableUserRoles = ["guest", "member"] as const;

export type ManageableUserRole = (typeof manageableUserRoles)[number];

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

export type UserRow = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: Date | string;
};

export type User = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
};

export function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}
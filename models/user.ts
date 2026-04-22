export type UserRole = "admin" | "member";

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
import { isNamed, type User } from "@/src/entities/user";

export function renameUser(user: User, name: string) {
  const next = { ...user, name };
  return isNamed(next) ? next : user;
}

import type { User } from "@/src/entities/user";

export function badgeLabel(user: User) {
  return String(user.id);
}

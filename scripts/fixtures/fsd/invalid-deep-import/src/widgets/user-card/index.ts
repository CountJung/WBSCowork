import type { User } from "@/src/entities/user/model/user";

export function userCardId(user: User) {
  return user.id;
}

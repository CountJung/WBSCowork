"use client";

import { loadUsers } from "@/src/entities/user";

export function UserCard() {
  return loadUsers();
}

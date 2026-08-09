"use client";

import { Button } from "@/src/shared/ui/button";
import type { User } from "@/src/entities/user";
import { renameUser } from "@/src/features/user-rename";

export function UserCard({ user }: { user: User }) {
  return <Button label={renameUser(user, user.name).name} />;
}

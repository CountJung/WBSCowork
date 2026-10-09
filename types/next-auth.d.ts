import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/src/entities/user";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: UserRole;
      isSuperuser: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    isSuperuser?: boolean;
  }
}
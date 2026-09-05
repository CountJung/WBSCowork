import type { Session } from "next-auth";
import type { UserRole } from "@/src/entities/user";
import { TEST_SUPERUSER_EMAIL } from "./test-env";

export type TestActor = {
  email: string;
  name: string;
  role: UserRole;
  isSuperuser: boolean;
};

/** HARNESS_MAP 6절 fixture 의 viewer 5종. */
export const testActors = {
  guest: { email: "guest@example.test", name: "게스트", role: "guest", isSuperuser: false },
  member1: { email: "member1@example.test", name: "멤버1", role: "member", isSuperuser: false },
  member2: { email: "member2@example.test", name: "멤버2", role: "member", isSuperuser: false },
  admin: { email: "admin@example.test", name: "관리자", role: "admin", isSuperuser: false },
  superuser: { email: TEST_SUPERUSER_EMAIL, name: "슈퍼관리자", role: "admin", isSuperuser: true },
} as const satisfies Record<string, TestActor>;

export type TestActorName = keyof typeof testActors;

export const allActorNames = Object.keys(testActors) as TestActorName[];

export function sessionFor(actor: TestActor): Session {
  return {
    user: {
      email: actor.email,
      name: actor.name,
      role: actor.role,
      isSuperuser: actor.isSuperuser,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as Session;
}

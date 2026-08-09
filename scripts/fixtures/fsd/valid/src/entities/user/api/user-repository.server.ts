import { readDatabaseConfig } from "@/src/shared/server/db.server";
import type { User } from "../model/user";

export async function findUser(id: number): Promise<User> {
  readDatabaseConfig("/dev/null");
  return { id, name: "user" };
}

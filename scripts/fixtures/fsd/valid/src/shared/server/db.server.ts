import { readFileSync } from "node:fs";

export function readDatabaseConfig(path: string) {
  return readFileSync(path, "utf8");
}

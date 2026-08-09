import { readFileSync } from "node:fs";

export function loadUsers() {
  return readFileSync("/dev/null", "utf8");
}

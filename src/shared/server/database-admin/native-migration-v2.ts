/** Released specification: append a new migration instead of editing this object. */
import { nativeMigrationV1 } from "./native-migration-v1";
const additions = [
  { table: "projects", name: "goal", definition: "goal TEXT NOT NULL DEFAULT ''" },
  { table: "projects", name: "success_criteria", definition: "success_criteria TEXT NOT NULL DEFAULT ''" },
  { table: "tasks", name: "deliverable", definition: "deliverable TEXT NOT NULL DEFAULT ''" },
  { table: "tasks", name: "definition_of_done", definition: "definition_of_done TEXT NOT NULL DEFAULT ''" },
  { table: "tasks", name: "review_required", definition: "review_required INT NOT NULL DEFAULT 0" },
] as const;
export const nativeMigrationV2 = {
  version: 2, name: "work_goals", verifierVersion: 1,
  additions,
  statements: ["projects", "tasks"].map(table => {
    const baseline = nativeMigrationV1.statements.find(sql => sql.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`))!;
    return baseline.replace("(\n", `(\n${additions.filter(c => c.table === table).map(c => `    ${c.definition},`).join("\n")}\n`);
  }),
} as const;

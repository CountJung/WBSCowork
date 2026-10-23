/** Explicit project access mode. Every existing project retains legacy access. No roster inference. */
import { nativeMigrationV1 } from "./native-migration-v1";
const additions=[{table:"projects",name:"access_mode",definition:"access_mode VARCHAR(32) NOT NULL DEFAULT 'legacy_authenticated'"}] as const;
const checks=[{table:"projects",name:"project_access_mode_check",definition:"CONSTRAINT project_access_mode_check CHECK(access_mode IN ('legacy_authenticated','members_only'))"}] as const;
export const nativeMigrationV12={version:12,name:"project_access_mode",verifierVersion:1,additions,checks,
  statements:[nativeMigrationV1.statements.find(sql=>sql.startsWith("CREATE TABLE IF NOT EXISTS projects ("))!.replace("(\n",`(\n    ${additions[0].definition},\n    ${checks[0].definition},\n`)],
} as const;

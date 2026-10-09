/** Current readiness fields. Released DDL lives in immutable native-migration-v1.ts. */
export const bugLifecycleColumns = [
  { name: "verified_at", definition: "verified_at DATETIME NULL" },
  { name: "verified_by", definition: "verified_by BIGINT NULL" },
  {
    name: "verification_note",
    definition: "verification_note TEXT NOT NULL DEFAULT ''",
  },
  { name: "trashed_at", definition: "trashed_at DATETIME NULL" },
  { name: "trashed_by", definition: "trashed_by BIGINT NULL" },
];

"use server";

import {
  initializeDatabaseAction as initializeDatabaseActionImpl,
  refreshDatabaseStatusAction as refreshDatabaseStatusActionImpl,
} from "@/src/features/database-manage/index.server";
import type { DatabaseAdminActionState } from "@/src/features/database-manage";

export async function initializeDatabaseAction(previousState: DatabaseAdminActionState) {
  return initializeDatabaseActionImpl(previousState);
}

export async function refreshDatabaseStatusAction(previousState: DatabaseAdminActionState) {
  return refreshDatabaseStatusActionImpl(previousState);
}

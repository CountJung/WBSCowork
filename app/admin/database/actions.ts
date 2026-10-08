"use server";

import {
  retryStorageCleanupAction as retryStorageCleanupActionImpl,
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

export async function retryStorageCleanupAction(previousState: DatabaseAdminActionState) {
  return retryStorageCleanupActionImpl(previousState);
}

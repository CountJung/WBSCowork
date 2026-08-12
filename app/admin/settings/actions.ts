"use server";

import { saveSettingsAction as saveSettingsActionImpl } from "@/src/features/settings-manage/index.server";
import type { SettingsActionState } from "@/src/features/settings-manage";

export async function saveSettingsAction(previousState: SettingsActionState, formData: FormData) {
  return saveSettingsActionImpl(previousState, formData);
}

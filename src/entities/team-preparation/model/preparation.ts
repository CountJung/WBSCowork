import { activityKinds, type ActivityKind } from "@/src/shared/config/activity-kinds";

export const PREPARATION_MAX_ENTRIES = 50;
export const PREPARATION_MAX_BYTES = 64 * 1024;
export type PreparationStatus = "planned" | "in_progress" | "done";
export type PreparationCheck = { label: string; done: boolean };
export type PreparationEntryBase = {
  id: string;
  date: string;
  title: string;
  notes: string;
  status: PreparationStatus;
  checks: PreparationCheck[];
};
export type MealPreparationEntry = PreparationEntryBase & {
  meal: "breakfast" | "lunch" | "dinner" | "snack" | null;
  expectedPeople: number | null;
  amountPerPerson: number | null;
  unit: string;
};
export type FacilityPreparationEntry = PreparationEntryBase & { materials: string; tools: string };
export type CarePreparationEntry = PreparationEntryBase & { time: string; role: string; materials: string };
export type RecreationPreparationEntry = PreparationEntryBase & { order: number; time: string; durationMinutes: number; materials: string };
export type OtherPreparationEntry = PreparationEntryBase & { materials: string };
export type PreparationEntry = MealPreparationEntry | FacilityPreparationEntry | CarePreparationEntry | RecreationPreparationEntry | OtherPreparationEntry;
export type PreparationDocument = { schemaVersion: 1; kind: ActivityKind; entries: PreparationEntry[] };

function fail(): never { throw new Error("팀 준비표 입력이 올바르지 않습니다."); }
function kind(value: unknown): ActivityKind {
  if (typeof value !== "string" || !activityKinds.includes(value as ActivityKind)) fail();
  return value as ActivityKind;
}
function record(value: unknown, keys: readonly string[], optionalKeys: readonly string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const actual = Reflect.ownKeys(value);
  if (keys.some(key => !Object.hasOwn(value, key)) || actual.some(key => typeof key !== "string" || (!keys.includes(key) && !optionalKeys.includes(key)))) fail();
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false, multiline = false): string {
  if (typeof value !== "string" || !value.isWellFormed()) fail();
  const forbidden = multiline ? /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/ : /[\u0000-\u001f\u007f-\u009f]/;
  if (forbidden.test(value) || [...value].length > max || (required && !value.trim())) fail();
  return required ? value.trim() : value;
}
function date(value: unknown): string {
  if (typeof value !== "string" || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) fail();
  const parsed = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail();
  return value;
}
function time(value: unknown): string {
  if (typeof value !== "string" || (value !== "" && (value.length !== 5 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)))) fail();
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) fail();
  return value;
}
function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10_000 || !/^\d+(?:\.\d{1,3})?$/.test(String(value))) fail();
  return value;
}
function boundedBytes(value: unknown): void {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); } catch { fail(); }
  if (serialized === undefined || new TextEncoder().encode(serialized).byteLength > PREPARATION_MAX_BYTES) fail();
}
const commonKeys = ["id", "date", "title", "notes", "status", "checks"];
const extraKeys: Record<ActivityKind, string[]> = {
  meal: ["meal", "expectedPeople", "amountPerPerson", "unit"],
  facility: ["materials", "tools"],
  senior_care: ["time", "role", "materials"],
  child_care: ["time", "role", "materials"],
  recreation: ["order", "time", "durationMinutes", "materials"],
  media: ["materials"],
  other: ["materials"],
};

function entry(value: unknown, activityKind: ActivityKind): PreparationEntry {
  const isMeal = activityKind === "meal";
  const input = isMeal
    ? record(value, ["id", "date", "title"], ["notes", "status", "checks", ...extraKeys.meal])
    : record(value, [...commonKeys, ...extraKeys[activityKind]]);
  if (typeof input.id !== "string" || input.id.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) fail();
  const status = isMeal && !Object.hasOwn(input, "status") ? "planned" : input.status;
  if (!["planned", "in_progress", "done"].includes(status as string)) fail();
  const rawChecks = isMeal && (input.checks === undefined || input.checks === null) ? [] : input.checks;
  if (!Array.isArray(rawChecks) || rawChecks.length > 20) fail();
  const checks = Array.from(rawChecks, value => {
    const check = record(value, ["label", "done"]);
    if (typeof check.done !== "boolean") fail();
    const label = text(check.label, 120, !isMeal);
    return { label: label.trim(), done: check.done };
  }).filter(check => !isMeal || check.label !== "");
  const base: PreparationEntryBase = {
    id: input.id.toLowerCase(), date: date(input.date), title: text(input.title, 120, true),
    notes: text(isMeal && (input.notes === undefined || input.notes === null) ? "" : input.notes, 1000, false, true), status: status as PreparationStatus, checks,
  };
  switch (activityKind) {
    case "meal":
      if (input.meal !== undefined && input.meal !== null && input.meal !== "" && !["breakfast", "lunch", "dinner", "snack"].includes(input.meal as string)) fail();
      return {
        ...base, meal: input.meal == null || input.meal === "" ? null : input.meal as MealPreparationEntry["meal"],
        expectedPeople: input.expectedPeople == null || input.expectedPeople === "" ? null : integer(input.expectedPeople, 0, 10_000),
        amountPerPerson: input.amountPerPerson == null || input.amountPerPerson === "" ? null : amount(input.amountPerPerson),
        unit: text(input.unit == null ? "" : input.unit, 20).trim(),
      };
    case "facility": return { ...base, materials: text(input.materials, 1000), tools: text(input.tools, 1000) };
    case "senior_care":
    case "child_care": return { ...base, time: time(input.time), role: text(input.role, 120), materials: text(input.materials, 1000) };
    case "recreation": return { ...base, order: integer(input.order, 1, 1000), time: time(input.time), durationMinutes: integer(input.durationMinutes, 0, 1440), materials: text(input.materials, 1000) };
    case "media":
    case "other": return { ...base, materials: text(input.materials, 1000) };
  }
}

/** Validate the entire replacement document against the server's current team kind. */
export function normalizePreparationDocument(value: unknown, expectedKind: ActivityKind): PreparationDocument {
  const activityKind = kind(expectedKind);
  boundedBytes(value);
  const input = record(value, ["schemaVersion", "kind", "entries"]);
  if (input.schemaVersion !== 1 || kind(input.kind) !== activityKind || !Array.isArray(input.entries) || input.entries.length > PREPARATION_MAX_ENTRIES) fail();
  const entries = Array.from(input.entries, value => entry(value, activityKind));
  if (new Set(entries.map(value => value.id)).size !== entries.length) fail();
  const normalized: PreparationDocument = { schemaVersion: 1, kind: activityKind, entries };
  boundedBytes(normalized);
  return normalized;
}

export function emptyPreparationDocument(activityKind: ActivityKind): PreparationDocument {
  return { schemaVersion: 1, kind: kind(activityKind), entries: [] };
}

/** Drafts may contain blank required values; saving always calls normalizePreparationDocument. */
export function createPreparationEntry(activityKind: ActivityKind, initialDate = ""): PreparationEntry {
  kind(activityKind);
  if (initialDate !== "") date(initialDate);
  const base: PreparationEntryBase = { id: crypto.randomUUID(), date: initialDate, title: "", notes: "", status: "planned", checks: [] };
  switch (activityKind) {
    case "meal": return { ...base, meal: null, expectedPeople: null, amountPerPerson: null, unit: "" };
    case "facility": return { ...base, materials: "", tools: "" };
    case "senior_care":
    case "child_care": return { ...base, time: "", role: "", materials: "" };
    case "recreation": return { ...base, order: 1, time: "", durationMinutes: 0, materials: "" };
    case "media":
    case "other": return { ...base, materials: "" };
  }
}

/** Display-only derived quantity: fixed thousandths avoid binary rounding drift. */
export function mealQuantity(value: PreparationEntry): number | null {
  if (!("expectedPeople" in value) || !("amountPerPerson" in value)) fail();
  if (value.expectedPeople === null || value.amountPerPerson === null || !value.unit.trim()) return null;
  const people = integer(value.expectedPeople, 0, 10_000);
  const thousandths = Math.round(amount(value.amountPerPerson) * 1000);
  return people * thousandths / 1000;
}

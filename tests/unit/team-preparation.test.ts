import assert from "node:assert/strict";
import { test } from "node:test";
import { activityKinds, activityKindLabels } from "../../src/shared/config/activity-kinds";
import { activityKinds as legacyKinds, activityKindLabels as legacyLabels } from "../../src/entities/project/model/workspace";
import {
  createPreparationEntry, emptyPreparationDocument, mealQuantity, normalizePreparationDocument,
  PREPARATION_MAX_BYTES, PREPARATION_MAX_ENTRIES,
  type MealPreparationEntry, type PreparationDocument, type PreparationEntry,
} from "../../src/entities/team-preparation";
import type { ActivityKind } from "../../src/shared/config/activity-kinds";

function fixture(kind: ActivityKind = "meal"): PreparationDocument {
  const entry = createPreparationEntry(kind, "2028-02-29");
  entry.title = "함께 준비하기";
  entry.notes = "준비 사항\n확인\t완료";
  entry.checks = [{ label: "담당 확인", done: false }];
  return { ...emptyPreparationDocument(kind), entries: [entry] };
}
function rejects(change: (doc: PreparationDocument) => void, kind: ActivityKind = "meal"): void {
  const doc = fixture(kind); change(doc);
  assert.throws(() => normalizePreparationDocument(doc, kind));
}

test("activity kinds retain the existing order, labels and project public exports", () => {
  assert.deepEqual(activityKinds.slice(0, 6), ["meal", "facility", "senior_care", "child_care", "recreation", "other"]);
  assert.deepEqual(activityKinds.slice(6), ["media"]);
  assert.equal(activityKindLabels.media, "미디어");
  assert.equal(legacyKinds, activityKinds); assert.equal(legacyLabels, activityKindLabels);
  assert.equal(activityKindLabels.child_care, "아동 돌봄");
});
test("all seven activity documents round trip without unrelated fields", () => {
  for (const kind of activityKinds) {
    const doc = fixture(kind);
    assert.deepEqual(normalizePreparationDocument(doc, kind), doc);
    assert.deepEqual(normalizePreparationDocument(emptyPreparationDocument(kind), kind).entries, []);
  }
});
test("draft defaults have an explicit empty date and become valid only after required inputs", () => {
  const draft = createPreparationEntry("meal") as MealPreparationEntry;
  assert.equal(draft.date, ""); assert.equal(draft.title, "");
  assert.equal(draft.meal, null); assert.equal(draft.unit, ""); assert.equal(draft.amountPerPerson, null); assert.equal(draft.expectedPeople, null);
  assert.notEqual(draft.id, createPreparationEntry("meal").id);
  assert.throws(() => normalizePreparationDocument({ ...emptyPreparationDocument("meal"), entries: [draft] }, "meal"));
  draft.title = "식단 준비"; draft.date = "2026-10-23";
  assert.equal(normalizePreparationDocument({ ...emptyPreparationDocument("meal"), entries: [draft] }, "meal").entries.length, 1);
});
test("strict Gregorian dates reject rollover, nonleap days and year zero", () => {
  for (const date of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "0000-01-01", "2026-1-01", "2028-02-29\n", ""]) rejects(doc => { doc.entries[0].date = date; });
  assert.throws(() => createPreparationEntry("meal", "2026-02-30"));
  assert.equal(normalizePreparationDocument(fixture(), "meal").entries[0].date, "2028-02-29");
});
test("kind mismatch, schema changes and unknown fields fail closed", () => {
  assert.throws(() => normalizePreparationDocument(fixture(), "facility"));
  const doc = fixture();
  for (const changed of [{ ...doc, schemaVersion: 2 }, { ...doc, quantity: 1 }, { ...doc, kind: "unknown" }]) assert.throws(() => normalizePreparationDocument(changed, "meal"));
  rejects(doc => { Object.assign(doc.entries[0], { quantity: 3 }); });
  rejects(doc => { Object.assign(doc.entries[0], { tools: "다른 종류 필드" }); });
  rejects(doc => { Object.assign(doc.entries[0].checks[0], { hidden: true }); });
  assert.throws(() => normalizePreparationDocument(null, "meal"));
  assert.throws(() => normalizePreparationDocument([], "meal"));
  rejects(doc => { doc.entries = new Array(1); });
  rejects(doc => { doc.entries[0].checks = new Array(1); });
});
test("UUID syntax and case-insensitive duplicates are enforced", () => {
  rejects(doc => { doc.entries[0].id = "not-a-uuid"; });
  rejects(doc => { doc.entries[0].id += "\n"; });
  rejects(doc => { doc.entries.push({ ...doc.entries[0], id: doc.entries[0].id.toUpperCase() }); });
  const doc = fixture(); doc.entries[0].id = doc.entries[0].id.toUpperCase();
  assert.equal(normalizePreparationDocument(doc, "meal").entries[0].id, doc.entries[0].id.toLowerCase());
});
test("entry and checklist limits preserve the full allowed boundary", () => {
  const doc = fixture();
  doc.entries = Array.from({ length: PREPARATION_MAX_ENTRIES }, () => ({ ...doc.entries[0], id: crypto.randomUUID(), notes: "" }));
  assert.equal(normalizePreparationDocument(doc, "meal").entries.length, 50);
  doc.entries.push({ ...doc.entries[0], id: crypto.randomUUID() });
  assert.throws(() => normalizePreparationDocument(doc, "meal"));
  const checks = fixture(); checks.entries[0].checks = Array.from({ length: 20 }, () => ({ label: "확인", done: true }));
  assert.equal(normalizePreparationDocument(checks, "meal").entries[0].checks.length, 20);
  checks.entries[0].checks.push({ label: "초과", done: false });
  assert.throws(() => normalizePreparationDocument(checks, "meal"));
});
test("UTF-8 document budget includes Korean bytes and rejects cyclic input", () => {
  const doc = fixture();
  doc.entries = Array.from({ length: 30 }, () => ({ ...doc.entries[0], id: crypto.randomUUID(), notes: "한".repeat(1000) }));
  assert(new TextEncoder().encode(JSON.stringify(doc)).byteLength > PREPARATION_MAX_BYTES);
  assert.throws(() => normalizePreparationDocument(doc, "meal"));
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  assert.throws(() => normalizePreparationDocument(cycle, "meal"));
});
test("text limits accept Unicode codepoints and reject blank required labels", () => {
  const doc = fixture(); doc.entries[0].title = "😀".repeat(120);
  assert.equal(normalizePreparationDocument(doc, "meal").entries[0].title, doc.entries[0].title);
  rejects(doc => { doc.entries[0].title = "😀".repeat(121); });
  rejects(doc => { doc.entries[0].title = "  "; });
  rejects(doc => { doc.entries[0].notes = "x".repeat(1001); });
  rejects(doc => { doc.entries[0].checks[0].label = " "; }, "facility");
  rejects(doc => { (doc.entries[0] as MealPreparationEntry).unit = "x".repeat(21); });
});
test("controls are rejected except notes LF and TAB, and malformed Unicode is rejected", () => {
  assert.doesNotThrow(() => normalizePreparationDocument(fixture(), "meal"));
  for (const bad of ["a\u0000b", "a\u007fb", "a\u0085b", "a\ud800b"]) rejects(doc => { doc.entries[0].title = bad; });
  rejects(doc => { doc.entries[0].title = "줄\n바꿈"; });
  rejects(doc => { doc.entries[0].notes = "CR\rLF"; });
  rejects(doc => { Object.assign(doc.entries[0], { materials: "준비\n사항" }); }, "other");
});
test("statuses and checklist booleans require their exact types", () => {
  for (const status of ["planned", "in_progress", "done"] as const) {
    const doc = fixture(); doc.entries[0].status = status;
    assert.equal(normalizePreparationDocument(doc, "meal").entries[0].status, status);
  }
  rejects(doc => { Object.assign(doc.entries[0], { status: "complete" }); });
  rejects(doc => { Object.assign(doc.entries[0].checks[0], { done: "true" }); });
});
test("meal numbers enforce finite bounds and thousandths without floating point drift", () => {
  const doc = fixture(), meal = doc.entries[0] as MealPreparationEntry;
  meal.unit = "kg";
  meal.expectedPeople = 3; meal.amountPerPerson = 0.1;
  assert.equal(mealQuantity(meal), 0.3);
  meal.amountPerPerson = 1.001; assert.equal(mealQuantity(meal), 3.003);
  meal.expectedPeople = 10_000; meal.amountPerPerson = 10_000;
  assert.equal(mealQuantity(meal), 100_000_000); assert.doesNotThrow(() => normalizePreparationDocument(doc, "meal"));
  for (const amountPerPerson of [NaN, Infinity, -1, 10_000.001, 0.0001, "1"]) rejects(doc => { Object.assign(doc.entries[0], { amountPerPerson }); });
  for (const expectedPeople of [NaN, Infinity, -1, 10_001, 0.5, "3"]) rejects(doc => { Object.assign(doc.entries[0], { expectedPeople }); });
  assert.throws(() => mealQuantity(fixture("other").entries[0]));
});
test("care and recreation clock fields are strict optional HH:mm", () => {
  for (const kind of ["senior_care", "child_care", "recreation"] as const) {
    for (const time of ["", "00:00", "23:59"]) {
      const doc = fixture(kind); Object.assign(doc.entries[0], { time });
      assert.doesNotThrow(() => normalizePreparationDocument(doc, kind));
    }
    for (const time of ["24:00", "09:60", "9:00", "12:00:00", "12:00\n"]) rejects(doc => { Object.assign(doc.entries[0], { time }); }, kind);
  }
});
test("recreation order and duration enforce integer boundaries", () => {
  const doc = fixture("recreation"); Object.assign(doc.entries[0], { order: 1000, durationMinutes: 1440 });
  assert.doesNotThrow(() => normalizePreparationDocument(doc, "recreation"));
  for (const order of [0, 1001, 1.5, NaN]) rejects(doc => { Object.assign(doc.entries[0], { order }); }, "recreation");
  for (const durationMinutes of [-1, 1441, 0.5, Infinity]) rejects(doc => { Object.assign(doc.entries[0], { durationMinutes }); }, "recreation");
});
test("normalization returns independent entry/check objects and does not mutate inputs", () => {
  const doc = fixture(); doc.entries[0].title = "  준비  ";
  const normalized = normalizePreparationDocument(doc, "meal");
  assert.equal(normalized.entries[0].title, "준비"); assert.equal(doc.entries[0].title, "  준비  ");
  normalized.entries[0].checks[0].done = true;
  assert.equal(doc.entries[0].checks[0].done, false);
  const optional = structuredClone(doc); delete (optional.entries[0] as Partial<PreparationEntry>).notes;
  assert.equal(normalizePreparationDocument(optional, "meal").entries[0].notes, "");
  const invalid = fixture("facility"); delete (invalid.entries[0] as Partial<PreparationEntry>).notes;
  assert.throws(() => normalizePreparationDocument(invalid, "facility"));
});

test("meal accepts only date and menu with omitted optional fields and default planned status", () => {
  const minimal = { id: crypto.randomUUID(), date: "2026-10-27", title: "비빔밥" };
  const document = normalizePreparationDocument({ schemaVersion: 1, kind: "meal", entries: [minimal] }, "meal");
  assert.deepEqual(document.entries[0], { ...minimal, status: "planned", notes: "", checks: [], meal: null, expectedPeople: null, amountPerPerson: null, unit: "" });
  assert.equal(mealQuantity(document.entries[0]), null);
  assert.deepEqual(normalizePreparationDocument(document, "meal"), document);
});

test("meal omitted, null and empty optional numbers become unspecified without coercion", () => {
  for (const empty of [undefined, null, ""]) {
    const doc = fixture();
    Object.assign(doc.entries[0], { meal: empty, expectedPeople: empty, amountPerPerson: empty, unit: "", notes: "", checks: [] });
    const normalized = normalizePreparationDocument(doc, "meal").entries[0] as MealPreparationEntry;
    assert.equal(normalized.meal, null); assert.equal(normalized.expectedPeople, null); assert.equal(normalized.amountPerPerson, null);
    assert.equal(mealQuantity(normalized), null);
  }
  for (const invalid of ["0", "3", "  ", true, [], {}]) {
    rejects(doc => { Object.assign(doc.entries[0], { expectedPeople: invalid }); });
    rejects(doc => { Object.assign(doc.entries[0], { amountPerPerson: invalid }); });
  }
  rejects(doc => { Object.assign(doc.entries[0], { meal: "brunch" }); });
});

test("meal quantity distinguishes missing inputs from a legitimate zero", () => {
  const meal = fixture().entries[0] as MealPreparationEntry;
  meal.expectedPeople = 12; meal.amountPerPerson = 150;
  assert.equal(mealQuantity(meal), null);
  meal.unit = "g"; assert.equal(mealQuantity(meal), 1800);
  meal.expectedPeople = null; assert.equal(mealQuantity(meal), null);
  meal.expectedPeople = 0; assert.equal(mealQuantity(meal), 0);
  meal.amountPerPerson = null; assert.equal(mealQuantity(meal), null);
  meal.amountPerPerson = 0; assert.equal(mealQuantity(meal), 0);
});

test("only omitted meal status defaults; explicit invalid status never passes", () => {
  for (const status of [null, "", undefined, false, "invalid"]) rejects(doc => { Object.assign(doc.entries[0], { status }); });
  const omitted = fixture(); delete (omitted.entries[0] as Partial<PreparationEntry>).status;
  assert.equal(normalizePreparationDocument(omitted, "meal").entries[0].status, "planned");
  for (const kind of activityKinds.filter(kind => kind !== "meal")) {
    const other = fixture(kind); delete (other.entries[0] as Partial<PreparationEntry>).status;
    assert.throws(() => normalizePreparationDocument(other, kind));
  }
});

test("meal skips blank shopping rows after validating text and boolean types", () => {
  const doc = fixture(); doc.entries[0].checks = [{ label: " ", done: false }, { label: " 쌀 ", done: true }, { label: "", done: false }];
  assert.deepEqual(normalizePreparationDocument(doc, "meal").entries[0].checks, [{ label: "쌀", done: true }]);
  rejects(doc => { Object.assign(doc.entries[0], { checks: [{ label: "", done: "false" }] }); });
  rejects(doc => { Object.assign(doc.entries[0], { checks: [{ label: 0, done: false }] }); });
  rejects(doc => { doc.entries[0].checks = [{ label: "\u0000", done: false }]; });
  rejects(doc => { doc.entries[0].checks = Array.from({ length: 21 }, () => ({ label: "", done: false })); });
  for (const kind of activityKinds.filter(kind => kind !== "meal")) rejects(doc => { doc.entries[0].checks = [{ label: "", done: false }]; }, kind);
});

test("meal expansion preserves complete legacy v1 values and all other kind required keys", () => {
  const legacy = fixture(); Object.assign(legacy.entries[0], { meal: "lunch", expectedPeople: 12, amountPerPerson: 150, unit: "g" });
  assert.deepEqual(normalizePreparationDocument(legacy, "meal"), legacy);
  for (const kind of activityKinds.filter(kind => kind !== "meal")) {
    const doc = fixture(kind); delete (doc.entries[0] as Partial<PreparationEntry>).checks;
    assert.throws(() => normalizePreparationDocument(doc, kind));
  }
  rejects(doc => { Object.assign(doc.entries[0], { secret: "unknown" }); });
});

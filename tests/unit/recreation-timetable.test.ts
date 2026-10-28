import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { buildRecreationTimetable, initialTimetableDate, isTimetableDate, shiftTimetableDate, timetableDates } from "../../src/entities/team-preparation/model/timetable";
import type { RecreationPreparationEntry } from "../../src/entities/team-preparation/model/preparation";

function entry(id: string, date = "2026-10-28", time = "10:00", durationMinutes = 60): RecreationPreparationEntry {
  return { id, date, time, durationMinutes, order: 1, title: `프로그램 ${id}`, status: "planned", notes: "합성 메모", checks: [], materials: "합성 준비물" };
}
test("calendar dates are Gregorian, timezone independent and cover the legacy year range", () => {
  for (const value of ["0001-01-01", "0099-12-31", "2028-02-29", "9999-12-31"]) assert.equal(isTimetableDate(value), true);
  for (const value of ["0000-01-01", "2026-02-29", "2026-13-01", "2026-1-01", "2026-10-28\n", ""]) assert.equal(isTimetableDate(value), false);
  assert.equal(shiftTimetableDate("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftTimetableDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftTimetableDate("0001-01-01", -7), "0001-01-01");
  assert.equal(shiftTimetableDate("9999-12-31", 7), "9999-12-31");
  assert.throws(() => shiftTimetableDate("2026-02-29", 1));
  assert.throws(() => shiftTimetableDate("2026-10-28", Infinity));
});
test("week navigation starts Monday, includes Sunday and handles year boundaries", () => {
  assert.deepEqual(timetableDates("2026-11-01", "week"), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  assert.deepEqual(timetableDates("2026-10-28", "day"), ["2026-10-28"]);
  const lastWeek = timetableDates("9999-12-31", "week");
  assert.equal(new Set(lastWeek).size, lastWeek.length);
  assert.equal(lastWeek.at(-1), "9999-12-31");
});
test("calendar projection is identical under UTC, Seoul and New York server/client timezones", () => {
  const script = `import {timetableDates,shiftTimetableDate} from ${JSON.stringify(new URL("../../src/entities/team-preparation/model/timetable.ts", import.meta.url).href)}; console.log(JSON.stringify([timetableDates('2026-11-01','week'),shiftTimetableDate('2028-02-28',1)]));`;
  const outputs = ["UTC", "Asia/Seoul", "America/New_York"].map(TZ => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8", env: { ...process.env, TZ }, timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  });
  assert.deepEqual(outputs[0], outputs[1]); assert.deepEqual(outputs[0], outputs[2]);
});
test("initial focus uses an existing valid event date without mutating the original order", () => {
  const entries = [entry("b", "2026-10-29"), entry("a", "2026-10-28"), entry("invalid", "")];
  const before = JSON.stringify(entries);
  assert.equal(initialTimetableDate(entries, "2026-11-01"), "2026-10-28");
  assert.equal(initialTimetableDate([], "2026-11-01"), "2026-11-01");
  assert.equal(JSON.stringify(entries), before);
});
test("empty periods keep seven dated columns and a useful bounded time axis", () => {
  const result = buildRecreationTimetable([], timetableDates("2026-10-28", "week"));
  assert.equal(result.days.length, 7);
  assert.equal(result.startMinute, 8 * 60);
  assert.equal(result.endMinute, 18 * 60);
  assert(result.days.every(day => day.events.length === 0 && day.unscheduled.length === 0));
});
test("overlapping durations have separate lanes, exact end/start adjacency is not a conflict", () => {
  const source = [entry("a", undefined, "10:00", 90), entry("b", undefined, "10:30", 30), entry("c", undefined, "11:30", 30)];
  const result = buildRecreationTimetable(source, ["2026-10-28"]);
  const [a, b, c] = result.days[0].events;
  assert.equal(a.startMinute, 600); assert.equal(a.endMinute, 690);
  assert(a.overlaps && b.overlaps); assert.equal(c.overlaps, false);
  assert.notEqual(a.lane, b.lane); assert(a.lanes >= 2);
});
test("visual minimum heights separate dense labels without falsely marking adjacent short events as overlapping", () => {
  const result = buildRecreationTimetable([entry("a", undefined, "10:00", 5), entry("b", undefined, "10:10", 5)], ["2026-10-28"]);
  const [a, b] = result.days[0].events;
  assert.equal(a.overlaps, false); assert.equal(b.overlaps, false);
  assert.notEqual(a.lane, b.lane);
  assert.equal(a.endMinute, 605); assert(a.visualEndMinute >= 660);
});
test("blank clock and invalid editing drafts remain visible as unscheduled, zero duration is an unchanged point", () => {
  const source = [entry("no-time", undefined, "", 30), entry("bad-time", undefined, "25:00"), entry("bad-duration", undefined, "11:00", NaN), entry("zero", undefined, "12:00", 0), entry("bad-date", "")];
  const result = buildRecreationTimetable(source, ["2026-10-28"]);
  assert.deepEqual(result.days[0].unscheduled.map(e => e.id), ["no-time", "bad-time", "bad-duration"]);
  assert.equal(result.invalidDateEntries[0].id, "bad-date");
  const [point] = result.days[0].events;
  assert.equal(point.entry.id, "zero"); assert.equal(point.startMinute, point.endMinute);
  assert.equal(point.entry.durationMinutes, 0);
});
test("cross-midnight entries split into next-day segments, retaining the original date, duration and identity", () => {
  const source = [entry("night", "2026-10-31", "23:30", 90)];
  const before = JSON.stringify(source);
  const result = buildRecreationTimetable(source, ["2026-10-31", "2026-11-01"]);
  const first = result.days[0].events[0], next = result.days[1].events[0];
  assert.deepEqual([first.startMinute, first.endMinute, first.continuesBefore, first.continuesAfter], [1410, 1440, false, true]);
  assert.deepEqual([next.startMinute, next.endMinute, next.continuesBefore, next.continuesAfter], [0, 60, true, false]);
  assert.equal(next.entry.date, "2026-10-31"); assert.equal(next.entry.durationMinutes, 90);
  assert.notEqual(first.key, next.key);
  assert.equal(JSON.stringify(source), before);
});
test("a previous-day continuation is included when its original entry falls outside the visible week", () => {
  const result = buildRecreationTimetable([entry("night", "2026-10-25", "23:45", 60)], timetableDates("2026-10-26", "week"));
  const monday = result.days[0].events[0];
  assert.equal(monday.entry.id, "night"); assert.equal(monday.continuesBefore, true);
  assert.equal(monday.endMinute, 45);
});
test("24h duration remains bounded, midnight termination adds no phantom next-day segment", () => {
  const whole = buildRecreationTimetable([entry("whole", undefined, "00:00", 1440)], ["2026-10-28", "2026-10-29"]);
  assert.equal(whole.days[0].events[0].endMinute, 1440); assert.equal(whole.days[1].events.length, 0);
  const edge = buildRecreationTimetable([entry("edge", "9999-12-31", "23:59", 1440)], ["9999-12-31"]);
  assert.equal(edge.days[0].events.length, 1); assert.equal(edge.days[0].events[0].continuesAfter, true);
  assert(edge.endMinute <= 1500);
});
test("editing drafts reject trailing newline clock values instead of projecting a valid-looking time", () => {
  const result = buildRecreationTimetable([entry("newline", undefined, "10:00\n")], ["2026-10-28"]);
  assert.equal(result.days[0].events.length, 0);
  assert.equal(result.days[0].unscheduled[0].id, "newline");
});
test("point overlap uses half-open real durations and detects simultaneous points", () => {
  const result = buildRecreationTimetable([entry("point", undefined, "10:00", 0), entry("same", undefined, "10:00", 0), entry("before", undefined, "09:00", 60), entry("after", undefined, "10:00", 15)], ["2026-10-28"]);
  const events = Object.fromEntries(result.days[0].events.map(e => [e.entry.id, e]));
  assert.equal(events.before.overlaps, false);
  assert(events.point.overlaps && events.same.overlaps && events.after.overlaps);
});
test("50 simultaneous events get distinct lanes and no source/private-state mutation", () => {
  const source = Array.from({ length: 50 }, (_, i) => entry(String(i)));
  const before = JSON.stringify(source);
  const events = buildRecreationTimetable(source, ["2026-10-28"]).days[0].events;
  assert.equal(events.length, 50); assert.equal(new Set(events.map(e => e.lane)).size, 50);
  assert(events.every(e => e.lanes === 50 && e.overlaps));
  assert.equal(JSON.stringify(source), before);
});

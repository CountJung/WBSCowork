import type { RecreationPreparationEntry } from "./preparation";

export type TimetableView = "day" | "week";
export type TimetableEvent = {
  key: string;
  entry: RecreationPreparationEntry;
  date: string;
  startMinute: number;
  endMinute: number;
  /** Readable label space only; never interpreted as the saved duration. */
  visualEndMinute: number;
  lane: number;
  lanes: number;
  overlaps: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
};
export type TimetableDay = { date: string; events: TimetableEvent[]; unscheduled: RecreationPreparationEntry[] };
const DAY_MS = 86_400_000;
const firstDay = Date.parse("0001-01-01T00:00:00.000Z");
const lastDay = Date.parse("9999-12-31T00:00:00.000Z");
const timestamp = (date: string) => Date.parse(`${date}T00:00:00.000Z`);

export function isTimetableDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function shiftTimetableDate(date: string, offset: number): string {
  if (!isTimetableDate(date) || !Number.isSafeInteger(offset)) throw new RangeError("시간표 날짜가 올바르지 않습니다.");
  const next = Math.min(lastDay, Math.max(firstDay, timestamp(date) + offset * DAY_MS));
  return new Date(next).toISOString().slice(0, 10);
}
export function timetableDates(anchor: string, view: TimetableView): string[] {
  if (!isTimetableDate(anchor)) throw new RangeError("시간표 날짜가 올바르지 않습니다.");
  if (view === "day") return [anchor];
  const weekday = new Date(`${anchor}T00:00:00.000Z`).getUTCDay();
  const monday = shiftTimetableDate(anchor, -((weekday + 6) % 7));
  return [...new Set(Array.from({ length: 7 }, (_, index) => shiftTimetableDate(monday, index)))];
}
export function initialTimetableDate(entries: readonly RecreationPreparationEntry[], today: string): string {
  if (!isTimetableDate(today)) throw new RangeError("시간표 날짜가 올바르지 않습니다.");
  return entries.map(entry => entry.date).filter(isTimetableDate).sort()[0] ?? today;
}
function clockMinute(value: string): number | null {
  if (value.length !== 5 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function actualOverlap(a: TimetableEvent, b: TimetableEvent): boolean {
  const aPoint = a.startMinute === a.endMinute, bPoint = b.startMinute === b.endMinute;
  if (aPoint && bPoint) return a.startMinute === b.startMinute;
  if (aPoint) return b.startMinute <= a.startMinute && a.startMinute < b.endMinute;
  if (bPoint) return a.startMinute <= b.startMinute && b.startMinute < a.endMinute;
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}
function layoutEvents(events: TimetableEvent[]): void {
  events.sort((a, b) => a.startMinute - b.startMinute || a.entry.order - b.entry.order || a.key.localeCompare(b.key));
  for (const event of events) event.overlaps = events.some(other => other !== event && actualOverlap(event, other));
  let cluster: TimetableEvent[] = [], clusterEnd = -1;
  const finish = () => {
    const laneEnds: number[] = [];
    for (const event of cluster) {
      let lane = laneEnds.findIndex(end => end <= event.startMinute);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = event.visualEndMinute;
      event.lane = lane;
    }
    for (const event of cluster) event.lanes = laneEnds.length;
  };
  for (const event of events) {
    if (event.startMinute >= clusterEnd) { finish(); cluster = []; clusterEnd = -1; }
    cluster.push(event); clusterEnd = Math.max(clusterEnd, event.visualEndMinute);
  }
  finish();
}
/** Display projection only: never normalizes, mutates, saves, shares or authorizes documents. */
export function buildRecreationTimetable(entries: readonly RecreationPreparationEntry[], dates: readonly string[]): { days: TimetableDay[]; invalidDateEntries: RecreationPreparationEntry[]; startMinute: number; endMinute: number } {
  if (!dates.length || dates.length > 7 || dates.some(date => !isTimetableDate(date)) || new Set(dates).size !== dates.length) throw new RangeError("시간표 범위가 올바르지 않습니다.");
  const days: TimetableDay[] = dates.map(date => ({ date, events: [], unscheduled: [] }));
  const byDate = new Map(days.map(day => [day.date, day]));
  const invalidDateEntries: RecreationPreparationEntry[] = [];
  function segment(entry: RecreationPreparationEntry, date: string, startMinute: number, endMinute: number, continuesBefore: boolean, continuesAfter: boolean) {
    byDate.get(date)?.events.push({ key: `${entry.id}:${date}`, entry, date, startMinute, endMinute, visualEndMinute: Math.max(endMinute, startMinute + 60), lane: 0, lanes: 1, overlaps: false, continuesBefore, continuesAfter });
  }
  for (const entry of entries) {
    if (!isTimetableDate(entry.date)) { invalidDateEntries.push(entry); continue; }
    const start = clockMinute(entry.time);
    if (start === null || !Number.isInteger(entry.durationMinutes) || entry.durationMinutes < 0 || entry.durationMinutes > 1440) {
      byDate.get(entry.date)?.unscheduled.push(entry); continue;
    }
    const end = start + entry.durationMinutes;
    segment(entry, entry.date, start, Math.min(1440, end), false, end > 1440);
    const nextDate = shiftTimetableDate(entry.date, 1);
    if (end > 1440 && nextDate !== entry.date) segment(entry, nextDate, 0, end - 1440, true, false);
  }
  for (const day of days) layoutEvents(day.events);
  const scheduled = days.flatMap(day => day.events);
  const startMinute = scheduled.length ? Math.floor(Math.min(...scheduled.map(event => event.startMinute)) / 60) * 60 : 8 * 60;
  const endMinute = scheduled.length ? Math.min(1500, Math.ceil(Math.max(...scheduled.map(event => event.visualEndMinute)) / 60) * 60) : 18 * 60;
  return { days, invalidDateEntries, startMinute, endMinute };
}

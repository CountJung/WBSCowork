export function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}


/** Calendar dates shared by MariaDB DATE and D1 TEXT, without timezone-dependent rollover. */
export function toCalendarDate(value: Date | string): string {
  const candidate = typeof value === "string" ? value.trim() : Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate) || Number(candidate.slice(0, 4)) < 1000) {
    throw new Error("날짜는 1000~9999년의 YYYY-MM-DD 형식이어야 합니다.");
  }
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) {
    throw new Error("실제로 존재하는 날짜를 입력해야 합니다.");
  }
  return candidate;
}

export function validateDateRange(start: Date | string, end: Date | string) {
  const startDate = toCalendarDate(start), endDate = toCalendarDate(end);
  if (startDate > endDate) throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
  return { startDate, endDate };
}

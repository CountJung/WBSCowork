/** The form explicitly uses Korea Standard Time; never infer the browser/server timezone. */
export function votingKstToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) throw new Error("날짜와 시각을 모두 입력해 주세요.");
  const date = new Date(`${value}:00+09:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16) !== value) throw new Error("실제로 존재하는 날짜와 시각을 입력해 주세요.");
  return date.toISOString();
}

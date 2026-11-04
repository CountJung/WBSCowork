export type PollPhase = "scheduled" | "open" | "closed";
export type ProjectPoll = {
  id: number; projectId: number; title: string; description: string; startsAt: string; endsAt: string; phase: PollPhase;
  options: { id: number; label: string }[]; ownChoice: number | null;
  results: { optionId: number; count: number }[] | null; totalVotes: number | null;
};
export type PollList = { polls: ProjectPoll[]; canManage: boolean; canVote: boolean; nextCursor: number | null; serverNow: string };
export type CreatePollInput = { title: string; description: string; startsAt: string; endsAt: string; options: string[]; mutationKey: string };
export class ProjectVoteError extends Error {
  readonly status: number;
  constructor(readonly code: "NOT_FOUND" | "INVALID_INPUT" | "CONFLICT" | "VOTING_CLOSED" | "UNAVAILABLE") {
    super(code); this.status = code === "NOT_FOUND" ? 404 : code === "INVALID_INPUT" ? 400 : code === "CONFLICT" || code === "VOTING_CLOSED" ? 409 : 503;
  }
}
function text(value: unknown, limit: number, required = false) {
  if (typeof value !== "string" || value.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || (required && !value.trim())) throw new ProjectVoteError("INVALID_INPUT");
  return value.trim();
}
export function voteId(value: unknown) {
  const n = typeof value === "string" && /^[1-9]\d*$/.test(value) && String(Number(value)) === value ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1) throw new ProjectVoteError("NOT_FOUND"); return n;
}
function timestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 35 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new ProjectVoteError("INVALID_INPUT");
  const parts = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,3})?(Z|[+-]\d\d:\d\d)$/.exec(value)!;
  const [, year, month, day, hour, minute, second, offset] = parts;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59))) throw new ProjectVoteError("INVALID_INPUT");
  const result = new Date(value).toISOString();
  if (result.length !== 24 || !/^20\d\d-/.test(result)) throw new ProjectVoteError("INVALID_INPUT"); return result;
}
export function normalizePollInput(input: CreatePollInput): CreatePollInput {
  const title = text(input.title, 160, true), description = text(input.description, 2000);
  const startsAt = timestamp(input.startsAt), endsAt = timestamp(input.endsAt);
  if (startsAt >= endsAt || !Array.isArray(input.options) || input.options.length < 2 || input.options.length > 10) throw new ProjectVoteError("INVALID_INPUT");
  const options = input.options.map(value => text(value, 120, true));
  if (new Set(options.map(value => value.toLocaleLowerCase("en-US"))).size !== options.length || typeof input.mutationKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.mutationKey)) throw new ProjectVoteError("INVALID_INPUT");
  return { title, description, startsAt, endsAt, options, mutationKey: input.mutationKey.toLowerCase() };
}

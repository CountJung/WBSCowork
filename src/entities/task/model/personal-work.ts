import { taskStatusLabels, type TaskStatus } from "./workflow";

export const personalWorkPageSize = 20;
export const personalWorkMaxPage = 1000;
export const personalWorkScopeLabels = {
  mine: "내 담당 업무",
  contributed: "내가 기여한 업무",
  review: "내 검토 대기",
} as const;

export type PersonalWorkScope = keyof typeof personalWorkScopeLabels;
export type PersonalWorkStatus = "open" | "all" | TaskStatus;
export type PersonalWorkSearchParams = Record<string, string | string[] | undefined>;
export type PersonalWorkFilters = {
  scope: PersonalWorkScope;
  status: PersonalWorkStatus;
  overdue: boolean;
  page: number;
};
export type PersonalWorkItem = {
  taskId: number;
  projectId: number;
  projectName: string;
  title: string;
  status: TaskStatus;
  endDate: string;
  reviewTarget: { submissionId: number; revisionNumber: number } | null;
};
export type PersonalWorkPage = {
  items: PersonalWorkItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isScope(value: string | undefined): value is PersonalWorkScope {
  return value !== undefined && Object.hasOwn(personalWorkScopeLabels, value);
}

function isStatus(value: string | undefined): value is PersonalWorkStatus {
  return value === "open" || value === "all" || (value !== undefined && Object.hasOwn(taskStatusLabels, value));
}

export function parsePersonalWorkSelectedTaskId(value: string | string[] | undefined): number | null {
  const raw = single(value);
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

/** URL filters are bounded before reaching SQL or pagination links. */
export function parsePersonalWorkFilters(params: PersonalWorkSearchParams): PersonalWorkFilters {
  const scope = single(params.scope), status = single(params.status), rawPage = single(params.page);
  const page = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    scope: isScope(scope) ? scope : "mine",
    status: isStatus(status) ? status : "open",
    overdue: single(params.overdue) === "1",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, personalWorkMaxPage) : 1,
  };
}

export function buildPersonalWorkPath(filters: PersonalWorkFilters, selectedTaskId?: number | null): string {
  const normalized = parsePersonalWorkFilters({
    scope: filters.scope, status: filters.status, overdue: filters.overdue ? "1" : "0", page: String(filters.page),
  });
  const params = new URLSearchParams({
    scope: normalized.scope, status: normalized.status, overdue: normalized.overdue ? "1" : "0", page: String(normalized.page),
  });
  const selected = parsePersonalWorkSelectedTaskId(selectedTaskId === undefined || selectedTaskId === null ? undefined : String(selectedTaskId));
  if (selected !== null) params.set("taskId", String(selected));
  return `/my-work?${params.toString()}${selected === null ? "" : `#work-${selected}`}`;
}

/** Only a canonical local queue URL may survive a form/action redirect. */
export function parsePersonalWorkReturnTo(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512 || /[\u0000-\u0020\\]/.test(value)) return null;
  if (value.split(/[?#]/, 1)[0] !== "/my-work") return null;
  let url: URL;
  try { url = new URL(value, "https://personal-work.invalid"); } catch { return null; }
  if (url.origin !== "https://personal-work.invalid" || url.pathname !== "/my-work") return null;
  const allowed = new Set(["scope", "status", "overdue", "page", "taskId"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) return null;
  }
  const params = Object.fromEntries(url.searchParams);
  if (params.scope !== undefined && !isScope(params.scope)) return null;
  if (params.status !== undefined && !isStatus(params.status)) return null;
  if (params.overdue !== undefined && params.overdue !== "0" && params.overdue !== "1") return null;
  if (params.page !== undefined && (!/^[1-9]\d*$/.test(params.page) || !Number.isSafeInteger(Number(params.page)) || Number(params.page) > personalWorkMaxPage)) return null;
  const selected = parsePersonalWorkSelectedTaskId(params.taskId);
  if (params.taskId !== undefined && selected === null) return null;
  if (url.hash && (selected === null || url.hash !== `#work-${selected}`)) return null;
  return buildPersonalWorkPath(parsePersonalWorkFilters(params), selected);
}

export function getPersonalWorkLinks(item: PersonalWorkItem, filters: PersonalWorkFilters) {
  const returnTo = buildPersonalWorkPath(filters, item.taskId);
  const taskParams = new URLSearchParams({ projectId: String(item.projectId), taskId: String(item.taskId), returnTo });
  const reviewParams = item.reviewTarget
    ? new URLSearchParams({ revision: String(item.reviewTarget.revisionNumber), returnTo })
    : null;
  return {
    taskHref: `/tasks?${taskParams.toString()}`,
    reviewHref: item.reviewTarget && reviewParams ? `/submissions/${item.reviewTarget.submissionId}?${reviewParams.toString()}` : null,
  };
}

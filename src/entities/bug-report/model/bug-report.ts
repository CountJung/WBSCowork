export const bugStatuses = [
  "new",
  "in_progress",
  "resolved",
  "closed",
] as const;
export const bugPriorities = ["low", "normal", "high"] as const;
export type BugStatus = (typeof bugStatuses)[number];
export type BugPriority = (typeof bugPriorities)[number];
export const bugStatusLabels: Record<BugStatus, string> = {
  new: "접수",
  in_progress: "검토·수정 중",
  resolved: "해결",
  closed: "종료",
};
export const bugPriorityLabels: Record<BugPriority, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
};
export type BugViewer = { userId: number; canReview: boolean };
export type BugReport = {
  id: number;
  reporter_id: number | null;
  title: string;
  reproduction: string;
  expected: string;
  actual: string;
  page_path: string;
  status: BugStatus;
  priority: BugPriority;
  resolution: string;
  fix_commit: string;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
};
export type BugEvent = {
  id: number;
  report_id: number;
  actor_id: number | null;
  kind: "created" | "addendum" | "review";
  body: string;
  status: BugStatus;
  priority: BugPriority;
  resolution: string;
  fix_commit: string;
  report_version: number;
  created_at: Date | string;
};
export type NewBugInput = Pick<
  BugReport,
  "title" | "reproduction" | "expected" | "actual" | "page_path"
>;
export function bugText(
  value: unknown,
  label: string,
  max: number,
  required = true,
) {
  if (typeof value !== "string")
    throw new Error(`${label} 값이 올바르지 않습니다.`);
  const text = value.trim();
  if (
    (required && !text) ||
    text.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)
  )
    throw new Error(
      `${label}: ${required ? "1" : "0"}~${max}자 이내로 입력하세요.`,
    );
  return text;
}
export function bugToken(value: unknown) {
  const token = bugText(value, "요청 식별자", 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token,
    )
  )
    throw new Error(
      "요청 식별자가 만료되었거나 올바르지 않습니다. 화면을 새로고침하세요.",
    );
  return token.toLowerCase();
}
export function parseBugInput(data: FormData): NewBugInput {
  const rawPath = bugText(
    data.get("pagePath") ?? "",
    "페이지 경로",
    500,
    false,
  );
  const page_path = rawPath.split(/[?#]/, 1)[0];
  if (
    page_path &&
    (!page_path.startsWith("/") ||
      page_path.startsWith("//") ||
      /[\\\s]/.test(page_path))
  )
    throw new Error("페이지 경로는 /tasks 같은 사이트 내부 경로만 입력하세요.");
  return {
    title: bugText(data.get("title"), "제목", 160),
    reproduction: bugText(data.get("reproduction"), "재현 방법", 8000),
    expected: bugText(data.get("expected"), "예상 결과", 4000),
    actual: bugText(data.get("actual"), "실제 결과", 4000),
    page_path,
  };
}
export function parseBugReview(data: FormData) {
  const status = data.get("status") as BugStatus,
    priority = data.get("priority") as BugPriority;
  if (!bugStatuses.includes(status) || !bugPriorities.includes(priority))
    throw new Error("상태 또는 우선순위가 올바르지 않습니다.");
  const resolution = bugText(
    data.get("resolution") ?? "",
    "해결 내용",
    4000,
    false,
  );
  const body = bugText(data.get("body") ?? "", "검토 메모", 4000, false);
  const fix_commit = bugText(
    data.get("fixCommit") ?? "",
    "수정 commit",
    40,
    false,
  );
  if (fix_commit && !/^[a-f0-9]{7,40}$/i.test(fix_commit))
    throw new Error("수정 commit은 7~40자리 Git SHA만 입력하세요.");
  if (["resolved", "closed"].includes(status) && !resolution)
    throw new Error("해결·종료 시 해결 내용이나 종료 사유를 입력하세요.");
  return { status, priority, resolution, body, fix_commit };
}

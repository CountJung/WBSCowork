import type { SubmissionVisibility } from "./submission";

/** The editor is independent of the submission's original author. */
export type SubmissionActor = { userId: number; isAdmin: boolean; isSuperuser: boolean };

export type SubmissionRevision = {
  id: number;
  submissionId: number;
  taskId: number;
  revisionNumber: number;
  editorId: number | null;
  editorName: string | null;
  content: string;
  visibility: SubmissionVisibility;
  materialUrl: string;
  changeSummary: string;
  filePath: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  source: "legacy" | "live";
  createdAt: Date;
};

export type SubmissionEvent = {
  id: number;
  submissionId: number;
  revisionNumber: number;
  actorId: number | null;
  actorName: string | null;
  kind: string;
  body: string;
  createdAt: Date;
};

export function normalizeSubmissionMaterialUrl(value: string | undefined): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f]/.test(value)) {
    throw new Error("자료 링크에는 제어 문자를 사용할 수 없습니다.");
  }
  const text = value.trim();
  if (!text) return "";
  if (text.length > 2048) throw new Error("자료 링크는 2048자 이하로 입력해 주세요.");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("자료 링크는 완전한 http 또는 https 주소로 입력해 주세요.");
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("자료 링크에는 로그인 정보가 없는 http 또는 https 주소만 사용할 수 있습니다.");
  }
  if (url.href.length > 2048) throw new Error("자료 링크는 2048자 이하로 입력해 주세요.");
  return url.href;
}

export function submissionOperationToken(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) {
    throw new Error("요청 식별자가 올바르지 않습니다. 화면을 새로고침해 주세요.");
  }
  return value.toLowerCase();
}

export function submissionRevisionNumber(value: unknown): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new Error("제출물 버전이 올바르지 않습니다. 화면을 새로고침해 주세요.");
  }
  return number;
}

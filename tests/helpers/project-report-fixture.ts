import type { DigestSnapshotInput } from "../../src/entities/project-report";
/** De-identified data only; no runtime DB or uploaded user files. */
export function reportFixture(): DigestSnapshotInput {
  return {
    project: { id: 101, name: "합성 봉사 프로젝트", goal: "지역 활동 준비", startDate: "2026-10-01", endDate: "2026-12-01", projectType: "volunteering" },
    period: { start: "2026-10-22T00:00:00.000Z", end: "2026-10-23T00:00:00.000Z", snapshotAt: "2026-10-23T01:00:00.000Z", timeZone: "Asia/Seoul" },
    audienceMode: "public_only", requestedById: 901,
    tasks: [
      { projectId: 101, id: 201, parentId: null, title: "식사 준비", status: "in_progress", startDate: "2026-10-20", endDate: "2026-10-22", assigneeName: "합성 담당자", completionMode: "direct_completion" },
      { projectId: 101, id: 202, parentId: 201, title: "레크레이션", status: "planned", startDate: "2026-10-25", endDate: "2026-10-27", assigneeName: null, completionMode: "submission_required" },
    ],
    submissions: [
      { projectId: 101, id: 301, taskId: 201, revisionNumber: 1, authorName: "합성 작성자", createdAt: "2026-10-21T01:00:00Z", visibility: "public", content: "이전 제출에 최근 댓글이 있습니다." },
      { projectId: 101, id: 302, taskId: 201, revisionNumber: 2, authorName: "합성 작성자", createdAt: "2026-10-22T01:00:00Z", visibility: "public", content: "한글 공개 활동 기록 <script>실행 없음</script>" },
      { projectId: 101, id: 303, taskId: 202, revisionNumber: 1, authorName: "비공개 작성자", createdAt: "2026-10-22T01:30:00Z", visibility: "private", content: "PRIVATE_REPORT_BODY" },
    ],
    comments: [
      { projectId: 101, id: 401, submissionId: 301, revisionNumber: null, authorName: "합성 댓글 작성자", createdAt: "2026-10-22T02:00:00Z", content: "이전 제출의 최근 댓글" },
      { projectId: 101, id: 402, submissionId: 303, revisionNumber: 1, authorName: "비공개 댓글 작성자", createdAt: "2026-10-22T03:00:00Z", content: "PRIVATE_REPORT_COMMENT" },
    ],
    attachments: [
      { projectId: 101, id: 501, submissionId: 302, revisionNumber: 2, fileName: "한글 합성파일.txt", mimeType: "text/plain", sizeBytes: 42, createdAt: "2026-10-22T01:00:00Z" },
      { projectId: 101, id: 502, submissionId: 303, revisionNumber: 1, fileName: "PRIVATE_REPORT_FILE.txt", mimeType: "text/plain", sizeBytes: 21, createdAt: "2026-10-22T01:30:00Z" },
    ],
  };
}

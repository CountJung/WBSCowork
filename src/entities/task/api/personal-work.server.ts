import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { toCalendarDate } from "@/src/shared/lib/date";
import {
  parsePersonalWorkFilters, personalWorkMaxPage, personalWorkPageSize,
  type PersonalWorkFilters, type PersonalWorkItem, type PersonalWorkPage,
} from "../model/personal-work";
import type { TaskStatus } from "../model/workflow";

/** The user ID and SU bit come only from a verified server session, never URL input. */
export type PersonalWorkViewer = { viewerUserId: number; isSuperuser: boolean };

const superuser = "(viewer_flags.is_superuser=1 AND LOWER(viewer.email)=viewer_flags.superuser_email)";
const administrator = `(viewer.role='admin' OR ${superuser})`;
const reviewEligible = `(
  task.reviewer_id=viewer.id AND task.review_required=1 AND task.status='review_pending'
  AND (viewer.role IN ('member','admin') OR ${superuser})
  AND review_submission.author_id=task.assignee_id
  AND TRIM(task.deliverable)<>'' AND TRIM(task.definition_of_done)<>''
  AND (assignee.role IN ('member','admin') OR LOWER(assignee.email)=viewer_flags.superuser_email)
  AND review_submission.id IS NOT NULL
  AND review_revision.revision_number=review_submission.current_revision
  AND review_submission.author_id<>viewer.id
  AND (task.assignee_id IS NULL OR task.assignee_id<>viewer.id)
  AND (review_revision.editor_id IS NULL OR review_revision.editor_id<>viewer.id)
  AND (${administrator} OR (review_submission.visibility='public' AND review_revision.visibility='public'))
)`;

// Current role and both visibility boundaries are checked again in every SQL query.
// Comment authorship alone never grants access to the parent or its historical version.
const contributed = `(
  EXISTS (SELECT 1 FROM submissions own_submission
    INNER JOIN submission_revisions own_revision ON own_revision.submission_id=own_submission.id
      AND own_revision.revision_number=own_submission.current_revision
    WHERE own_submission.task_id=task.id AND own_submission.author_id=viewer.id)
  OR EXISTS (SELECT 1 FROM comments own_comment
    INNER JOIN submissions comment_submission ON comment_submission.id=own_comment.submission_id
    INNER JOIN submission_revisions comment_revision ON comment_revision.submission_id=comment_submission.id
      AND comment_revision.revision_number=COALESCE(own_comment.revision_number,1)
    WHERE comment_submission.task_id=task.id AND own_comment.author_id=viewer.id
      AND (${administrator} OR comment_submission.author_id=viewer.id
        OR (comment_submission.visibility='public' AND comment_revision.visibility='public')))
)`;

const fromSql = `FROM tasks task
  INNER JOIN projects project ON project.id=task.project_id
  INNER JOIN users viewer ON viewer.id=?
  CROSS JOIN (SELECT ? AS is_superuser,? AS superuser_email) viewer_flags
  LEFT JOIN users assignee ON assignee.id=task.assignee_id
  LEFT JOIN submissions review_submission ON review_submission.id=task.review_submission_id
    AND review_submission.task_id=task.id
  LEFT JOIN submission_revisions review_revision ON review_revision.submission_id=review_submission.id
    AND review_revision.revision_number=task.review_revision_number`;

type PersonalWorkRow = {
  task_id: number; project_id: number; project_name: string; title: string;
  status: TaskStatus; end_date: Date | string;
  review_submission_id: number | null; review_revision_number: number | null;
};

export async function listPersonalWorkPage(
  viewer: PersonalWorkViewer,
  input: PersonalWorkFilters,
  today = new Date().toISOString().slice(0, 10),
): Promise<PersonalWorkPage> {
  if (!Number.isSafeInteger(viewer.viewerUserId) || viewer.viewerUserId < 1 || typeof viewer.isSuperuser !== "boolean") {
    throw new Error("현재 로그인 사용자를 확인할 수 없습니다.");
  }
  const filters = parsePersonalWorkFilters({ scope: input.scope, status: input.status, overdue: input.overdue ? "1" : "0", page: String(input.page) });
  const predicates = [filters.scope === "mine" ? "task.assignee_id=viewer.id" : filters.scope === "contributed" ? contributed : reviewEligible];
  const params: unknown[] = [viewer.viewerUserId, viewer.isSuperuser ? 1 : 0, (getRuntimeEnv().auth.superuserEmail??"").toLowerCase()];
  if (filters.status === "open") predicates.push("task.status<>'done'");
  else if (filters.status !== "all") { predicates.push("task.status=?"); params.push(filters.status); }
  if (filters.overdue) { predicates.push("task.status<>'done' AND task.end_date<?"); params.push(toCalendarDate(today)); }
  const whereSql = `WHERE ${predicates.map(predicate => `(${predicate})`).join(" AND ")}`;
  const counts = await getDatabasePool().query(`SELECT COUNT(*) AS total ${fromSql} ${whereSql}`, params) as Array<{ total: number | string }>;
  const total = Number(counts[0]?.total ?? 0);
  const pageCount = Math.min(personalWorkMaxPage, Math.max(1, Math.ceil(total / personalWorkPageSize)));
  const page = Math.min(filters.page, pageCount);
  const rows = await getDatabasePool().query(
    `SELECT task.id AS task_id,task.project_id,project.name AS project_name,task.title,task.status,task.end_date,
      CASE WHEN ${reviewEligible} THEN review_submission.id ELSE NULL END AS review_submission_id,
      CASE WHEN ${reviewEligible} THEN review_revision.revision_number ELSE NULL END AS review_revision_number
      ${fromSql} ${whereSql} ORDER BY task.end_date ASC,task.id ASC LIMIT ? OFFSET ?`,
    [...params, personalWorkPageSize, (page - 1) * personalWorkPageSize],
  ) as PersonalWorkRow[];
  const items: PersonalWorkItem[] = rows.map(row => ({
    taskId: Number(row.task_id), projectId: Number(row.project_id), projectName: row.project_name,
    title: row.title, status: row.status, endDate: toCalendarDate(row.end_date),
    reviewTarget: row.review_submission_id === null || row.review_revision_number === null ? null : {
      submissionId: Number(row.review_submission_id), revisionNumber: Number(row.review_revision_number),
    },
  }));
  return { items, total, page, pageCount, pageSize: personalWorkPageSize };
}

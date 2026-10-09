import type { TaskStatus } from "./workflow";
export type TaskRow = {
  id: number;
  project_id: number;
  parent_id: number | null;
  title: string;
  description: string | null;
  deliverable: string;
  definition_of_done: string;
  review_required: number;
  status: TaskStatus;
  version: number;
  workflow_note: string;
  reviewer_id: number | null;
  reviewer_name: string | null;
  assignee_eligible: number;
  start_date: Date | string;
  end_date: Date | string;
  depth: number;
  order_index: number;
  assignee_id: number | null;
  assignee_name: string | null;
  created_at: Date | string;
};

export type Task = {
  id: number;
  projectId: number;
  parentId: number | null;
  title: string;
  description: string;
  deliverable: string;
  definitionOfDone: string;
  reviewRequired: boolean;
  status: TaskStatus;
  version: number;
  workflowNote: string;
  reviewerId: number | null;
  reviewerName: string | null;
  assigneeEligible: boolean;
  startDate: Date;
  endDate: Date;
  depth: number;
  orderIndex: number;
  assigneeId: number | null;
  assigneeName: string | null;
  createdAt: Date;
};

export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    description: row.description ?? "",
    deliverable: row.deliverable ?? "",
    definitionOfDone: row.definition_of_done ?? "",
    reviewRequired: Number(row.review_required ?? 0) === 1,
    status: row.status ?? "planned",
    version: Number(row.version ?? 1),
    workflowNote: row.workflow_note ?? "",
    reviewerId: row.reviewer_id ?? null,
    reviewerName: row.reviewer_name ?? null,
    assigneeEligible: Number(row.assignee_eligible) === 1,
    startDate: row.start_date instanceof Date ? row.start_date : new Date(row.start_date),
    endDate: row.end_date instanceof Date ? row.end_date : new Date(row.end_date),
    depth: row.depth,
    orderIndex: row.order_index,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

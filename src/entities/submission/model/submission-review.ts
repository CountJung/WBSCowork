import type { SubmissionActor } from "./submission-revision";

export type SubmissionReviewInput = {
  taskId: number;
  submissionId: number;
  revisionNumber: number;
  expectedTaskVersion: number;
  actor: SubmissionActor;
  token: string;
};

export type SubmissionReviewContext = {
  taskId: number;
  projectId: number;
  taskVersion: number;
  status: string;
  reviewRequired: boolean;
  selected: boolean;
  reviewerId: number | null;
  reviewerName: string | null;
  canRequest: boolean;
  canDecide: boolean;
  canCancelOrReopen: boolean;
  unavailableReason: string | null;
};

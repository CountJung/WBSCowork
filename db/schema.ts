import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, index, uniqueIndex, check, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
export const users = sqliteTable("users", {
  id: id(), email: text("email").notNull(), name: text("name").notNull(),
  role: text("role").notNull().default("guest"), googleId: text("google_id"), avatarUrl: text("avatar_url"),
  lastLoginAt: text("last_login_at"), lastSyncedAt: text("last_synced_at"), createdAt: createdAt(),
}, (t) => [uniqueIndex("users_email_unique").on(t.email), check("users_role_check", sql`${t.role} IN ('admin','member','guest')`)]);
export const projects = sqliteTable("projects", {
  id: id(), name: text("name").notNull(), dependencyVersion: integer("dependency_version").notNull().default(0), dependencyToken: text("dependency_token"), goal: text("goal").notNull().default(""), successCriteria: text("success_criteria").notNull().default(""), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(), createdAt: createdAt(),
});
export const tasks = sqliteTable("tasks", {
  id: id(), projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references((): AnySQLiteColumn => tasks.id, { onDelete: "set null" }),
  title: text("title").notNull(), description: text("description"), deliverable: text("deliverable").notNull().default(""), definitionOfDone: text("definition_of_done").notNull().default(""), reviewRequired: integer("review_required").notNull().default(0), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(),
  creationToken: text("creation_token").unique(),
  status: text("status").notNull().default("planned"), version: integer("version").notNull().default(1),
  workflowNote: text("workflow_note").notNull().default(""), lastOperationToken: text("last_operation_token"),
  reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  reviewSubmissionId: integer("review_submission_id"), reviewRevisionNumber: integer("review_revision_number"),
  depth: integer("depth").notNull().default(0), orderIndex: integer("order_index").notNull().default(0),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }), createdAt: createdAt(),
}, (t) => [index("tasks_project_idx").on(t.projectId), index("tasks_parent_idx").on(t.parentId), index("tasks_assignee_idx").on(t.assigneeId)]);
export const submissions = sqliteTable("submissions", {
  id: id(), taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  currentRevision: integer("current_revision").notNull().default(1), version: integer("version").notNull().default(1), lastOperationToken: text("last_operation_token"), materialUrl: text("material_url").notNull().default(""),
  creationToken: text("creation_token").unique(), content: text("content").notNull(), visibility: text("visibility").notNull().default("public"),
  filePath: text("file_path"), fileName: text("file_name"), fileMimeType: text("file_mime_type"), fileSizeBytes: integer("file_size_bytes"),
  createdAt: createdAt(),
}, (t) => [index("submissions_task_idx").on(t.taskId), index("submissions_author_idx").on(t.authorId), check("submissions_visibility_check", sql`${t.visibility} IN ('public','private')`)]);
export const submissionAttachments = sqliteTable("submission_attachments", {
  id: id(), submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull().default(1),
  filePath: text("file_path").notNull(), fileName: text("file_name").notNull(), fileMimeType: text("file_mime_type").notNull().default("application/octet-stream"),
  fileSizeBytes: integer("file_size_bytes").notNull(), createdAt: createdAt(),
}, (t) => [index("submission_attachments_submission_idx").on(t.submissionId)]);
export const comments = sqliteTable("comments", {
  id: id(), submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number"),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }), content: text("content").notNull(), createdAt: createdAt(),
}, (t) => [index("comments_submission_idx").on(t.submissionId), index("comments_author_idx").on(t.authorId)]);
export const auditLogs = sqliteTable("audit_logs", {
  id: id(), timestamp: text("timestamp").notNull(), level: text("level").notNull(),
  source: text("source").notNull(), message: text("message").notNull(), details: text("details"),
}, (t) => [index("audit_logs_timestamp_idx").on(t.timestamp)]);
export const fileCleanupJobs = sqliteTable("file_cleanup_jobs", {
  objectKey: text("object_key").primaryKey(), notBefore: text("not_before").notNull(), stagingExpiresAt: text("staging_expires_at"),
  attempts: integer("attempts").notNull().default(0), createdAt: createdAt(),
}, (t) => [index("file_cleanup_due_idx").on(t.notBefore)]);

// Independent archive: no project FK; account removal unlinks identity without exposing reports.
export const bugReports = sqliteTable(
  "bug_reports",
  {
    id: id(),
    reporterId: integer("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    creationToken: text("creation_token").notNull().unique(),
    lastOperationToken: text("last_operation_token").notNull(),
    title: text("title").notNull(),
    reproduction: text("reproduction").notNull(),
    expected: text("expected").notNull(),
    actual: text("actual").notNull(),
    pagePath: text("page_path").notNull().default(""),
    status: text("status").notNull().default("new"),
    priority: text("priority").notNull().default("normal"),
    resolution: text("resolution").notNull().default(""),
    fixCommit: text("fix_commit").notNull().default(""),
    verifiedAt: text("verified_at"),
    verifiedBy: integer("verified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    verificationNote: text("verification_note").notNull().default(""),
    trashedAt: text("trashed_at"),
    trashedBy: integer("trashed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("bug_reports_reporter_idx").on(t.reporterId, t.id),
    index("bug_reports_status_idx").on(t.status, t.id),
    check(
      "bug_status_check",
      sql`${t.status} IN ('new','in_progress','resolved','closed')`,
    ),
    check("bug_priority_check", sql`${t.priority} IN ('low','normal','high')`),
  ],
);
export const bugReportEvents = sqliteTable(
  "bug_report_events",
  {
    id: id(),
    reportId: integer("report_id")
      .notNull()
      .references(() => bugReports.id),
    actorId: integer("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    operationToken: text("operation_token").notNull().unique(),
    kind: text("kind").notNull(),
    body: text("body").notNull().default(""),
    status: text("status").notNull(),
    priority: text("priority").notNull(),
    resolution: text("resolution").notNull().default(""),
    fixCommit: text("fix_commit").notNull().default(""),
    lifecycleAction: text("lifecycle_action").notNull().default(""),
    reportVersion: integer("report_version").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("bug_events_report_idx").on(t.reportId, t.id),
    check(
      "bug_event_kind_check",
      sql`${t.kind} IN ('created','addendum','review')`,
    ),
  ],
);

// Minimal durable audit receipt survives a separately confirmed permanent purge.
export const bugReportPurgeReceipts = sqliteTable("bug_report_purge_receipts", {
  reportId: integer("report_id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  operationToken: text("operation_token").notNull().unique(),
  fingerprint: text("fingerprint").notNull(),
  reportVersion: integer("report_version").notNull(),
  eventCount: integer("event_count").notNull(),
  lastEventId: integer("last_event_id").notNull(),
  purgedAt: text("purged_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const taskEvents = sqliteTable("task_events", {
  id: id(), taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  operationToken: text("operation_token").notNull().unique(), requestFingerprint: text("request_fingerprint").notNull(),
  kind: text("kind").notNull(), status: text("status").notNull(),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
  reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  note: text("note").notNull().default(""), taskVersion: integer("task_version").notNull(), createdAt: createdAt(),
}, t => [index("task_events_task_idx").on(t.taskId,t.id), uniqueIndex("task_events_version_unique").on(t.taskId,t.taskVersion)]);

export const submissionRevisions = sqliteTable("submission_revisions", {
  id:id(), submissionId:integer("submission_id").notNull().references(()=>submissions.id,{onDelete:"cascade"}),
  revisionNumber:integer("revision_number").notNull(), editorId:integer("editor_id").references(()=>users.id,{onDelete:"set null"}),
  content:text("content").notNull(), visibility:text("visibility").notNull(), materialUrl:text("material_url").notNull().default(""), changeSummary:text("change_summary").notNull().default(""),
  filePath:text("file_path"),fileName:text("file_name"),fileMimeType:text("file_mime_type"),fileSizeBytes:integer("file_size_bytes"),source:text("source").notNull().default("live"),createdAt:createdAt(),
},t=>[uniqueIndex("submission_revision_unique").on(t.submissionId,t.revisionNumber),index("submission_revisions_submission_idx").on(t.submissionId,t.id)]);
export const submissionEvents = sqliteTable("submission_events", {
  id:id(),submissionId:integer("submission_id").notNull().references(()=>submissions.id,{onDelete:"cascade"}),revisionNumber:integer("revision_number").notNull(),actorId:integer("actor_id").references(()=>users.id,{onDelete:"set null"}),
  operationToken:text("operation_token").notNull().unique(),requestFingerprint:text("request_fingerprint").notNull(),kind:text("kind").notNull(),body:text("body").notNull().default(""),createdAt:createdAt(),
},t=>[index("submission_events_submission_idx").on(t.submissionId,t.id)]);

export const taskDependencies = sqliteTable("task_dependencies", {
  id: id(), projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  predecessorId: integer("predecessor_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
}, t => [uniqueIndex("task_dependency_unique").on(t.taskId, t.predecessorId), index("task_dependency_project_idx").on(t.projectId), check("task_dependency_self_check", sql`${t.taskId} <> ${t.predecessorId}`)]);

export const taskTemplateRuns=sqliteTable('task_template_runs',{
 id:id(),projectId:integer('project_id').notNull().references(()=>projects.id,{onDelete:'cascade'}),actorId:integer('actor_id').references(()=>users.id,{onDelete:'set null'}),
 templateKey:text('template_key').notNull(),templateVersion:integer('template_version').notNull(),operationToken:text('operation_token').notNull().unique(),requestFingerprint:text('request_fingerprint').notNull(),taskCount:integer('task_count').notNull(),createdAt:createdAt(),completedAt:text('completed_at'),
});

export const notificationReads=sqliteTable('notification_reads',{
 id:id(),recipientId:integer('recipient_id').notNull().references(()=>users.id,{onDelete:'cascade'}),projectId:integer('project_id').notNull().references(()=>projects.id,{onDelete:'cascade'}),sourceKind:text('source_kind').notNull(),sourceId:integer('source_id').notNull(),readAt:text('read_at').notNull().default(sql`CURRENT_TIMESTAMP`),
},t=>[uniqueIndex('notification_read_unique').on(t.recipientId,t.sourceKind,t.sourceId),index('notification_reads_project_idx').on(t.projectId)]);

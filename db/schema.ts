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
  id: id(), name: text("name").notNull(), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(), createdAt: createdAt(),
});
export const tasks = sqliteTable("tasks", {
  id: id(), projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references((): AnySQLiteColumn => tasks.id, { onDelete: "set null" }),
  title: text("title").notNull(), description: text("description"), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(),
  depth: integer("depth").notNull().default(0), orderIndex: integer("order_index").notNull().default(0),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }), createdAt: createdAt(),
}, (t) => [index("tasks_project_idx").on(t.projectId), index("tasks_parent_idx").on(t.parentId), index("tasks_assignee_idx").on(t.assigneeId)]);
export const submissions = sqliteTable("submissions", {
  id: id(), taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  creationToken: text("creation_token").unique(), content: text("content").notNull(), visibility: text("visibility").notNull().default("public"),
  filePath: text("file_path"), fileName: text("file_name"), fileMimeType: text("file_mime_type"), fileSizeBytes: integer("file_size_bytes"),
  createdAt: createdAt(),
}, (t) => [index("submissions_task_idx").on(t.taskId), index("submissions_author_idx").on(t.authorId), check("submissions_visibility_check", sql`${t.visibility} IN ('public','private')`)]);
export const submissionAttachments = sqliteTable("submission_attachments", {
  id: id(), submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(), fileName: text("file_name").notNull(), fileMimeType: text("file_mime_type").notNull().default("application/octet-stream"),
  fileSizeBytes: integer("file_size_bytes").notNull(), createdAt: createdAt(),
}, (t) => [index("submission_attachments_submission_idx").on(t.submissionId)]);
export const comments = sqliteTable("comments", {
  id: id(), submissionId: integer("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }), content: text("content").notNull(), createdAt: createdAt(),
}, (t) => [index("comments_submission_idx").on(t.submissionId), index("comments_author_idx").on(t.authorId)]);
export const auditLogs = sqliteTable("audit_logs", {
  id: id(), timestamp: text("timestamp").notNull(), level: text("level").notNull(),
  source: text("source").notNull(), message: text("message").notNull(), details: text("details"),
}, (t) => [index("audit_logs_timestamp_idx").on(t.timestamp)]);
export const fileCleanupJobs = sqliteTable("file_cleanup_jobs", {
  objectKey: text("object_key").primaryKey(), notBefore: text("not_before").notNull(),
  attempts: integer("attempts").notNull().default(0), createdAt: createdAt(),
}, (t) => [index("file_cleanup_due_idx").on(t.notBefore)]);

// Independent archive: no project FK; account removal unlinks identity without exposing reports.
export const bugReports = sqliteTable("bug_reports", {
  id: id(), reporterId: integer("reporter_id").references(() => users.id, { onDelete: "set null" }),
  creationToken: text("creation_token").notNull().unique(), lastOperationToken: text("last_operation_token").notNull(),
  title: text("title").notNull(), reproduction: text("reproduction").notNull(), expected: text("expected").notNull(), actual: text("actual").notNull(), pagePath: text("page_path").notNull().default(""),
  status: text("status").notNull().default("new"), priority: text("priority").notNull().default("normal"), resolution: text("resolution").notNull().default(""), fixCommit: text("fix_commit").notNull().default(""),
  version: integer("version").notNull().default(1), createdAt: createdAt(), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("bug_reports_reporter_idx").on(t.reporterId, t.id), index("bug_reports_status_idx").on(t.status, t.id), check("bug_status_check", sql`${t.status} IN ('new','in_progress','resolved','closed')`), check("bug_priority_check", sql`${t.priority} IN ('low','normal','high')`)]);
export const bugReportEvents = sqliteTable("bug_report_events", {
  id: id(), reportId: integer("report_id").notNull().references(() => bugReports.id), actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  operationToken: text("operation_token").notNull().unique(), kind: text("kind").notNull(), body: text("body").notNull().default(""),
  status: text("status").notNull(), priority: text("priority").notNull(), resolution: text("resolution").notNull().default(""), fixCommit: text("fix_commit").notNull().default(""),
  reportVersion: integer("report_version").notNull(), createdAt: createdAt(),
}, (t) => [index("bug_events_report_idx").on(t.reportId, t.id), check("bug_event_kind_check", sql`${t.kind} IN ('created','addendum','review')`)]);

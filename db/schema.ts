import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, index, uniqueIndex, check, primaryKey, foreignKey, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
export const users = sqliteTable("users", {
  id: id(), email: text("email").notNull(), name: text("name").notNull(),
  role: text("role").notNull().default("guest"), googleId: text("google_id"), avatarUrl: text("avatar_url"),
  lastLoginAt: text("last_login_at"), lastSyncedAt: text("last_synced_at"), createdAt: createdAt(),
}, (t) => [uniqueIndex("users_email_unique").on(t.email), check("users_role_check", sql`${t.role} IN ('admin','member','guest')`)]);
export const projects = sqliteTable("projects", {
  id: id(), name: text("name").notNull(), accessMode: text("access_mode").notNull().default("legacy_authenticated"), projectType: text("project_type").notNull().default("collaboration"), workspaceVersion: integer("workspace_version").notNull().default(0), workspaceToken: text("workspace_token"), dependencyVersion: integer("dependency_version").notNull().default(0), dependencyToken: text("dependency_token"), goal: text("goal").notNull().default(""), successCriteria: text("success_criteria").notNull().default(""), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(), createdAt: createdAt(),
}, (t) => [check("project_type_check", sql`${t.projectType} IN ('collaboration','volunteering')`), check("project_access_mode_check", sql`${t.accessMode} IN ('legacy_authenticated','members_only')`)]);
export const projectMembers = sqliteTable("project_members", {
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  active: integer("active").notNull().default(1), joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, t => [primaryKey({columns:[t.projectId,t.userId]}), check("project_member_active_check", sql`${t.active} IN (0,1)`)]);
export const activityTeams = sqliteTable("activity_teams", {
  id: id(), projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  activityKind: text("activity_kind").notNull(), name: text("name").notNull(), createdAt: createdAt(),
}, t => [uniqueIndex("activity_team_project_unique").on(t.projectId,t.id)]);
export const activityTeamMembers = sqliteTable("activity_team_members", {
  projectId: integer("project_id").notNull(), teamId: integer("team_id").notNull(), userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), active: integer("active").notNull().default(1),
}, t => [primaryKey({columns:[t.teamId,t.userId]}),
  foreignKey({columns:[t.projectId,t.userId],foreignColumns:[projectMembers.projectId,projectMembers.userId]}).onDelete("cascade"),
  foreignKey({columns:[t.projectId,t.teamId],foreignColumns:[activityTeams.projectId,activityTeams.id]}).onDelete("cascade"),
  check("activity_team_role_check",sql`${t.role} IN ('member','leader')`), check("activity_team_active_check",sql`${t.active} IN (0,1)`),
]);
export const activityTeamLeaders = sqliteTable("activity_team_leaders", {
  teamId: integer("team_id").primaryKey().notNull(), projectId: integer("project_id").notNull(), userId: integer("user_id"),
}, t => [
  foreignKey({columns:[t.projectId,t.teamId],foreignColumns:[activityTeams.projectId,activityTeams.id]}).onDelete("cascade"),
  foreignKey({columns:[t.teamId,t.userId],foreignColumns:[activityTeamMembers.teamId,activityTeamMembers.userId]}).onDelete("cascade"),
]);
export const projectWorkspaceEvents = sqliteTable("project_workspace_events", {
  id: id(), projectId: integer("project_id").notNull().references(() => projects.id,{onDelete:"cascade"}),
  actorId: integer("actor_id").references(() => users.id,{onDelete:"set null"}),
  operationToken: text("operation_token").notNull(), requestFingerprint: text("request_fingerprint").notNull(), kind:text("kind").notNull(),
  detail: text("detail").notNull().default(""), workspaceVersion: integer("workspace_version").notNull(), createdAt:createdAt(),
}, t => [uniqueIndex("project_workspace_operation_unique").on(t.projectId,t.operationToken)]);
export const tasks = sqliteTable("tasks", {
  id: id(), projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  activityTeamId: integer("activity_team_id").references(() => activityTeams.id, {onDelete:"set null"}),
  completionMode: text("completion_mode").notNull().default("submission_required"),
  completedBy: integer("completed_by").references(() => users.id,{onDelete:"set null"}), completedAt: text("completed_at"),
  parentId: integer("parent_id").references((): AnySQLiteColumn => tasks.id, { onDelete: "set null" }),
  title: text("title").notNull(), description: text("description"), deliverable: text("deliverable").notNull().default(""), definitionOfDone: text("definition_of_done").notNull().default(""), reviewRequired: integer("review_required").notNull().default(0), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(),
  creationToken: text("creation_token").unique(),
  status: text("status").notNull().default("planned"), version: integer("version").notNull().default(1),
  workflowNote: text("workflow_note").notNull().default(""), lastOperationToken: text("last_operation_token"),
  reviewerId: integer("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  reviewSubmissionId: integer("review_submission_id"), reviewRevisionNumber: integer("review_revision_number"),
  depth: integer("depth").notNull().default(0), orderIndex: integer("order_index").notNull().default(0),
  assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }), createdAt: createdAt(),
}, (t) => [index("tasks_project_idx").on(t.projectId), index("tasks_parent_idx").on(t.parentId), index("tasks_assignee_idx").on(t.assigneeId), check("task_completion_mode_check",sql`${t.completionMode} IN ('submission_required','direct_completion')`)]);
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
    creationFingerprint: text("creation_fingerprint").notNull().default(""),
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

export const bugReportScreenshots = sqliteTable("bug_report_screenshots", {
  id:id(), reportId:integer("report_id").notNull().references(()=>bugReports.id,{onDelete:"cascade"}),
  ordinal:integer("ordinal").notNull(), filePath:text("file_path").notNull().unique(), fileName:text("file_name").notNull(),
  fileMimeType:text("file_mime_type").notNull(), fileSizeBytes:integer("file_size_bytes").notNull(), contentHash:text("content_hash").notNull(),
}, t=>[uniqueIndex("bug_screenshot_ordinal_unique").on(t.reportId,t.ordinal), check("bug_screenshot_ordinal_check",sql`${t.ordinal} BETWEEN 0 AND 2`), check("bug_screenshot_size_check",sql`${t.fileSizeBytes} BETWEEN 1 AND 2097152`), check("bug_screenshot_type_check",sql`${t.fileMimeType} IN ('image/png','image/jpeg','image/webp')`)]);

/** Reports retain metadata until an explicit report retention contract is applied. */
export const projectReportSchedules=sqliteTable('project_report_schedules',{
 id:id(),projectId:integer('project_id').notNull().references(()=>projects.id,{onDelete:'restrict'}),createdBy:integer('created_by').notNull().references(()=>users.id,{onDelete:'restrict'}),enabled:integer('enabled').notNull().default(0),timeZone:text('time_zone').notNull(),lookbackHours:integer('lookback_hours').notNull(),formatsJson:text('formats_json').notNull(),audienceMode:text('audience_mode').notNull().default('public_only'),deliveryMode:text('delivery_mode').notNull().default('none'),version:integer('version').notNull().default(1),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('report_schedule_project_unique').on(t.id,t.projectId),index('report_schedule_project_idx').on(t.projectId,t.createdBy),check('report_schedule_enabled_check',sql`${t.enabled} IN (0,1)`),check('report_schedule_hours_check',sql`${t.lookbackHours} BETWEEN 1 AND 744`),check('report_schedule_formats_check',sql`${t.formatsJson} IN ('["docx"]','["pptx"]','["docx","pptx"]')`),check('report_schedule_audience_check',sql`${t.audienceMode}='public_only'`),check('report_schedule_delivery_check',sql`${t.deliveryMode}='none'`),check('report_schedule_version_check',sql`${t.version}>=1`)]);
export const projectReportRuns=sqliteTable('project_report_runs',{
 id:id(),projectId:integer('project_id').notNull().references(()=>projects.id,{onDelete:'restrict'}),requestedBy:integer('requested_by').notNull().references(()=>users.id,{onDelete:'restrict'}),scheduleId:integer('schedule_id'),idempotencyKey:text('idempotency_key').notNull(),requestFingerprint:text('request_fingerprint').notNull(),status:text('status').notNull().default('queued'),dryRun:integer('dry_run').notNull().default(1),formatsJson:text('formats_json').notNull(),audienceMode:text('audience_mode').notNull(),timeZone:text('time_zone').notNull(),periodStart:text('period_start').notNull(),periodEnd:text('period_end').notNull(),snapshotAt:text('snapshot_at').notNull(),snapshotJson:text('snapshot_json'),snapshotHash:text('snapshot_hash'),leaseToken:text('lease_token'),leaseUntil:text('lease_until'),heartbeatAt:text('heartbeat_at'),attempts:integer('attempts').notNull().default(0),errorCode:text('error_code').notNull().default(''),expiresAt:text('expires_at').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('report_run_key_unique').on(t.idempotencyKey),index('report_run_project_idx').on(t.projectId,t.requestedBy,t.createdAt),index('report_run_lease_idx').on(t.status,t.leaseUntil),foreignKey({columns:[t.scheduleId,t.projectId],foreignColumns:[projectReportSchedules.id,projectReportSchedules.projectId],name:'report_run_schedule_fk'}).onDelete('restrict'),check('report_run_status_check',sql`${t.status} IN ('queued','running','rendered','failed','skipped')`),check('report_run_dry_check',sql`${t.dryRun} IN (0,1)`),check('report_run_audience_check',sql`${t.audienceMode} IN ('public_only','requester_scope')`),check('report_run_formats_check',sql`${t.formatsJson} IN ('["docx"]','["pptx"]','["docx","pptx"]')`),check('report_run_attempts_check',sql`${t.attempts} BETWEEN 0 AND 3`),check('report_run_period_check',sql`${t.periodStart}<${t.periodEnd} AND ${t.periodEnd}<=${t.snapshotAt} AND ${t.snapshotAt}<${t.expiresAt}`)]);
export const projectReportArtifacts=sqliteTable('project_report_artifacts',{
 id:id(),runId:integer('run_id').notNull().references(()=>projectReportRuns.id,{onDelete:'restrict'}),format:text('format').notNull(),storageKey:text('storage_key').notNull(),sha256:text('sha256').notNull(),sizeBytes:integer('size_bytes').notNull(),state:text('state').notNull().default('staged'),expiresAt:text('expires_at').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('report_artifact_run_format_unique').on(t.runId,t.format),uniqueIndex('report_artifact_storage_unique').on(t.storageKey),index('report_artifact_expiry_idx').on(t.state,t.expiresAt),check('report_artifact_format_check',sql`${t.format} IN ('docx','pptx')`),check('report_artifact_size_check',sql`${t.sizeBytes} BETWEEN 1 AND 8388608`),check('report_artifact_state_check',sql`${t.state} IN ('staged','ready','quarantining','quarantined')`)]);

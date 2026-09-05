/**
 * HARNESS_MAP.md 6절의 가시성 fixture.
 *
 *   public submission A, member1 private B, member2 private C
 *   각 제출물에 comment, legacy file, multi-attachment
 *   guest/member1/member2/admin/superuser viewer
 *   project/task 가 다른 교차 식별자
 *
 * 스키마는 앱이 실제로 쓰는 `initializeDatabaseSchema()` 로 만든다. 테스트가 별도 DDL 을 갖고
 * 있으면 운영 스키마와 조용히 어긋나기 때문이다.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getDatabasePool } from "@/src/shared/server/database/index.server";
import { initializeDatabaseSchema } from "@/src/shared/server/database-admin/index.server";
import { getRuntimeEnv } from "@/src/shared/server/runtime-env/index.server";
import { testActors, type TestActorName } from "./session";
import { assertTestDatabaseName, testDatabaseEnv } from "./test-env";

export type SeededSubmission = {
  id: number;
  label: string;
  authorEmail: string;
  visibility: "public" | "private";
  commentId: number;
  legacyFilePath: string;
  attachmentIds: number[];
};

export type Fixture = {
  userIdByActor: Record<TestActorName, number>;
  projectId: number;
  taskId: number;
  /** 교차 식별자 확인용. 다른 프로젝트/작업에 속한 공개 제출물이다. */
  otherProjectId: number;
  otherTaskId: number;
  otherSubmissionId: number;
  submissionA: SeededSubmission;
  submissionB: SeededSubmission;
  submissionC: SeededSubmission;
  /** 존재하지 않는 식별자. 열거 방지 응답 비교에 쓴다. */
  missingSubmissionId: number;
  missingAttachmentId: number;
};

async function truncateAll() {
  // FOREIGN_KEY_CHECKS 는 세션 변수다. 풀에서 매번 다른 연결을 받으면 TRUNCATE 가 FK 에 막히므로
  // 비우는 동안에는 연결 하나를 잡고 있어야 한다.
  const connection = await getDatabasePool().getConnection();

  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of ["comments", "submission_attachments", "submissions", "tasks", "projects", "users"]) {
      await connection.query(`TRUNCATE TABLE ${table}`);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await connection.release();
  }
}

async function insertUser(actor: (typeof testActors)[TestActorName]) {
  const result = (await getDatabasePool().query(
    "INSERT INTO users (email, name, role) VALUES (?, ?, ?)",
    [actor.email, actor.name, actor.role],
  )) as { insertId: number };

  return Number(result.insertId);
}

async function insertProject(name: string) {
  const result = (await getDatabasePool().query(
    "INSERT INTO projects (name, start_date, end_date) VALUES (?, ?, ?)",
    [name, "2026-01-01", "2026-12-31"],
  )) as { insertId: number };

  return Number(result.insertId);
}

async function insertTask(projectId: number, title: string) {
  const result = (await getDatabasePool().query(
    `INSERT INTO tasks (project_id, parent_id, title, description, start_date, end_date, depth, order_index)
     VALUES (?, NULL, ?, '', ?, ?, 0, 0)`,
    [projectId, title, "2026-01-01", "2026-12-31"],
  )) as { insertId: number };

  return Number(result.insertId);
}

/** 실제 파일도 만든다. download handler 가 저장 파일을 읽기 때문이다. */
async function writeStoredFile(relativePath: string, contents: string) {
  const absolutePath = join(getRuntimeEnv().uploadDir, relativePath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
}

async function insertSubmission(options: {
  taskId: number;
  authorId: number;
  authorEmail: string;
  label: string;
  visibility: "public" | "private";
  commentAuthorId: number;
}): Promise<SeededSubmission> {
  const pool = getDatabasePool();
  const legacyFilePath = `${options.taskId}/${options.label}-legacy.txt`;

  await writeStoredFile(legacyFilePath, `legacy body of ${options.label}`);

  const submissionResult = (await pool.query(
    `INSERT INTO submissions (task_id, author_id, content, visibility, file_path, file_name, file_mime_type, file_size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      options.taskId,
      options.authorId,
      `${options.label} 제출 내용`,
      options.visibility,
      legacyFilePath,
      `${options.label}-legacy.txt`,
      "text/plain",
      64,
    ],
  )) as { insertId: number };
  const submissionId = Number(submissionResult.insertId);

  const attachmentIds: number[] = [];

  for (const index of [1, 2]) {
    const attachmentPath = `${options.taskId}/${options.label}-att${index}.txt`;

    await writeStoredFile(attachmentPath, `attachment ${index} of ${options.label}`);

    const attachmentResult = (await pool.query(
      `INSERT INTO submission_attachments (submission_id, file_path, file_name, file_mime_type, file_size_bytes)
       VALUES (?, ?, ?, ?, ?)`,
      [submissionId, attachmentPath, `${options.label}-att${index}.txt`, "text/plain", 32],
    )) as { insertId: number };

    attachmentIds.push(Number(attachmentResult.insertId));
  }

  const commentResult = (await pool.query(
    "INSERT INTO comments (submission_id, author_id, content) VALUES (?, ?, ?)",
    [submissionId, options.commentAuthorId, `${options.label} 에 달린 댓글`],
  )) as { insertId: number };

  return {
    id: submissionId,
    label: options.label,
    authorEmail: options.authorEmail,
    visibility: options.visibility,
    commentId: Number(commentResult.insertId),
    legacyFilePath,
    attachmentIds,
  };
}

/**
 * 스키마 준비. 앱이 실제로 쓰는 초기화 경로를 그대로 호출하므로 파일당 한 번이면 된다.
 */
export async function ensureSchema() {
  assertTestDatabaseName(testDatabaseEnv.database);
  await initializeDatabaseSchema();
}

/**
 * fixture 를 처음 상태로 되돌린다.
 *
 * 테스트마다 호출해 실행 순서에 의존하지 않게 한다. 어떤 테스트가 제출물이나 댓글을 지워도
 * 다음 테스트의 전제가 흔들리지 않아야 하기 때문이다. `TRUNCATE` 가 AUTO_INCREMENT 도
 * 되돌리므로 매번 같은 식별자가 나온다.
 */
export async function seedFixture(): Promise<Fixture> {
  assertTestDatabaseName(testDatabaseEnv.database);

  await truncateAll();

  const userIdByActor = {} as Record<TestActorName, number>;

  for (const [name, actor] of Object.entries(testActors)) {
    userIdByActor[name as TestActorName] = await insertUser(actor);
  }

  const projectId = await insertProject("가시성 fixture 프로젝트");
  const taskId = await insertTask(projectId, "대상 작업");

  // 교차 식별자: 다른 프로젝트/작업에 속한 공개 제출물.
  const otherProjectId = await insertProject("다른 프로젝트");
  const otherTaskId = await insertTask(otherProjectId, "다른 작업");
  const otherSubmission = await insertSubmission({
    taskId: otherTaskId,
    authorId: userIdByActor.member1,
    authorEmail: testActors.member1.email,
    label: "D-other",
    visibility: "public",
    commentAuthorId: userIdByActor.member2,
  });

  const submissionA = await insertSubmission({
    taskId,
    authorId: userIdByActor.member1,
    authorEmail: testActors.member1.email,
    label: "A-public",
    visibility: "public",
    commentAuthorId: userIdByActor.member2,
  });
  const submissionB = await insertSubmission({
    taskId,
    authorId: userIdByActor.member1,
    authorEmail: testActors.member1.email,
    label: "B-member1-private",
    visibility: "private",
    commentAuthorId: userIdByActor.member1,
  });
  const submissionC = await insertSubmission({
    taskId,
    authorId: userIdByActor.member2,
    authorEmail: testActors.member2.email,
    label: "C-member2-private",
    visibility: "private",
    commentAuthorId: userIdByActor.member2,
  });

  const maxSubmissionId = Math.max(submissionA.id, submissionB.id, submissionC.id, otherSubmission.id);
  const maxAttachmentId = Math.max(...submissionC.attachmentIds, ...otherSubmission.attachmentIds);

  return {
    userIdByActor,
    projectId,
    taskId,
    otherProjectId,
    otherTaskId,
    otherSubmissionId: otherSubmission.id,
    submissionA,
    submissionB,
    submissionC,
    missingSubmissionId: maxSubmissionId + 1000,
    missingAttachmentId: maxAttachmentId + 1000,
  };
}

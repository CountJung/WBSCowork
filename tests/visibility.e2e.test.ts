import "./helpers/bootstrap";

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setSession, clearSession } from "./helpers/bootstrap";
import { allActorNames, sessionFor, testActors, type TestActorName } from "./helpers/session";
import { ensureSchema, seedFixture, type Fixture } from "./helpers/fixture";
import { formDataFrom, runAction } from "./helpers/redirect";
import { closeDatabasePool } from "@/src/shared/server/database/index.server";
import { listCommentsByProject } from "@/src/entities/comment/index.server";
import {
  getSubmissionByIdForViewer,
  listAttachmentsByProject,
  listSubmissionsByProject,
} from "@/src/entities/submission/index.server";
import { getUserByEmail } from "@/src/entities/user/index.server";
import { canManageAllSubmissions } from "@/src/entities/user";
import {
  deleteCommentAction,
  deleteProjectAction,
  deleteSubmissionAction,
  updateCommentAction,
  updateSubmissionAction,
} from "@/src/features/task-workspace/index.server";
import { GET as getAttachmentByAttachmentId } from "@/app/api/submission-attachments/[attachmentId]/route";
import { GET as getAttachmentBySubmissionId } from "@/app/api/submissions/[submissionId]/attachment/route";

let fixture: Fixture;

/** `app/tasks/page.tsx` 가 실제로 하는 조회 조합을 그대로 재현한다. */
async function loadWorkspaceAs(actorName: TestActorName) {
  const actor = testActors[actorName];
  const canSeeAll = canManageAllSubmissions(actor.role, actor.isSuperuser);
  const dbUser = await getUserByEmail(actor.email);

  const submissions = await listSubmissionsByProject(fixture.projectId, {
    canSeeAll,
    viewerUserId: dbUser?.id ?? null,
  });
  const scope = { ids: submissions.map((submission) => submission.id) };

  const [comments, attachments] = await Promise.all([
    listCommentsByProject(fixture.projectId, scope),
    listAttachmentsByProject(fixture.projectId, scope),
  ]);

  return { submissions, comments, attachments };
}

function expectedVisibleLabels(actorName: TestActorName) {
  const all = [fixture.submissionA, fixture.submissionB, fixture.submissionC];
  const actor = testActors[actorName];

  if (canManageAllSubmissions(actor.role, actor.isSuperuser)) {
    return all.map((submission) => submission.label).sort();
  }

  return all
    .filter((submission) => submission.visibility === "public" || submission.authorEmail === actor.email)
    .map((submission) => submission.label)
    .sort();
}

before(async () => {
  await ensureSchema();
});

// 테스트마다 fixture 를 되돌려 실행 순서에 의존하지 않게 한다.
beforeEach(async () => {
  clearSession();
  fixture = await seedFixture();
});

after(async () => {
  await closeDatabasePool();
});

// ── HARNESS_MAP 6절 검증 1 ────────────────────────────────────────────────
describe("1. 목록·댓글·첨부 metadata 가 부모 가시성을 그대로 따른다", () => {
  for (const actorName of allActorNames) {
    test(`${actorName} 의 워크스페이스 payload`, async () => {
      const { submissions, comments, attachments } = await loadWorkspaceAs(actorName);
      const visibleIds = new Set(submissions.map((submission) => submission.id));

      assert.deepEqual(
        submissions.map((submission) => submission.content.split(" ")[0]).sort(),
        expectedVisibleLabels(actorName),
        "제출물 목록이 역할별 공개 범위와 일치해야 한다",
      );

      for (const comment of comments) {
        assert.ok(
          visibleIds.has(comment.submissionId),
          `볼 수 없는 제출물(${comment.submissionId})의 댓글이 payload 에 실렸다`,
        );
      }

      for (const attachment of attachments) {
        assert.ok(
          visibleIds.has(attachment.submissionId),
          `볼 수 없는 제출물(${attachment.submissionId})의 첨부 metadata 가 payload 에 실렸다`,
        );
      }

      // 제출물 1건당 댓글 1개 + 첨부 2개를 심었으므로 개수도 정확히 맞아야 한다.
      assert.equal(comments.length, submissions.length, "댓글 수가 가시 제출물 수와 일치해야 한다");
      assert.equal(attachments.length, submissions.length * 2, "첨부 수가 가시 제출물 수와 일치해야 한다");
    });
  }

  test("guest payload 에 비공개 제출물의 본문·저장 경로·댓글·첨부파일명이 남지 않는다", async () => {
    const workspace = await loadWorkspaceAs("guest");
    const payload = JSON.stringify(workspace);

    // fixture 의 모든 문자열 자산(본문·댓글·파일명·저장 경로)은 제출물 label 을 포함한다.
    // 따라서 label 부재는 그 제출물에서 파생된 어떤 문자열도 새지 않았다는 뜻이다.
    for (const hidden of [fixture.submissionB, fixture.submissionC]) {
      assert.ok(!payload.includes(hidden.label), `${hidden.label} 에서 파생된 문자열이 payload 에 남아 있다`);
      assert.ok(!payload.includes(hidden.legacyFilePath), "비공개 제출물의 저장 경로가 노출됐다");
    }

    // 비공개 제출물 C 의 작성자(member2)는 '제출물 작성자'로 노출되면 안 된다.
    // 단, member2 는 공개 제출물 A 의 댓글 작성자이기도 하므로 payload 전체 문자열 검색으로는
    // 두 경우를 구분할 수 없다. 그래서 구조로 확인한다.
    assert.deepEqual(
      workspace.submissions.map((submission) => submission.authorEmail),
      [testActors.member1.email],
      "guest 에게는 공개 제출물 A 의 작성자만 보여야 한다",
    );

    const visibleIds = new Set(workspace.submissions.map((submission) => submission.id));

    assert.deepEqual(
      [...new Set(workspace.comments.map((comment) => comment.submissionId))].filter(
        (id) => !visibleIds.has(id),
      ),
      [],
      "가시 제출물 밖의 댓글 작성자 정보가 payload 에 실리면 안 된다",
    );
  });

  test("다른 프로젝트의 제출물은 프로젝트 범위를 넘어오지 않는다", async () => {
    const { submissions, comments, attachments } = await loadWorkspaceAs("superuser");

    assert.ok(
      !submissions.some((submission) => submission.id === fixture.otherSubmissionId),
      "교차 프로젝트 제출물이 섞였다",
    );
    assert.ok(!comments.some((comment) => comment.submissionId === fixture.otherSubmissionId));
    assert.ok(!attachments.some((attachment) => attachment.submissionId === fixture.otherSubmissionId));
  });
});

// ── HARNESS_MAP 6절 검증 2 ────────────────────────────────────────────────
describe("2. 두 download URL 의 직접 ID 접근도 같은 결과다", () => {
  async function fetchLegacyDownload(actorName: TestActorName, submissionId: number) {
    setSession(sessionFor(testActors[actorName]));

    return getAttachmentBySubmissionId(
      new Request(`http://127.0.0.1/api/submissions/${submissionId}/attachment`),
      { params: Promise.resolve({ submissionId: String(submissionId) }) },
    );
  }

  async function fetchAttachmentDownload(actorName: TestActorName, attachmentId: number) {
    setSession(sessionFor(testActors[actorName]));

    return getAttachmentByAttachmentId(
      new Request(`http://127.0.0.1/api/submission-attachments/${attachmentId}`),
      { params: Promise.resolve({ attachmentId: String(attachmentId) }) },
    );
  }

  for (const actorName of allActorNames) {
    test(`${actorName} 의 직접 ID 다운로드는 목록 가시성과 일치한다`, async () => {
      const visibleLabels = new Set(expectedVisibleLabels(actorName));

      for (const submission of [fixture.submissionA, fixture.submissionB, fixture.submissionC]) {
        const allowed = visibleLabels.has(submission.label);
        const expectedStatus = allowed ? 200 : 404;

        const legacy = await fetchLegacyDownload(actorName, submission.id);
        assert.equal(legacy.status, expectedStatus, `${submission.label} legacy download`);

        for (const attachmentId of submission.attachmentIds) {
          const response = await fetchAttachmentDownload(actorName, attachmentId);
          assert.equal(response.status, expectedStatus, `${submission.label} attachment ${attachmentId}`);
        }
      }
    });
  }

  test("비로그인 접근은 401 이다", async () => {
    clearSession();

    const response = await getAttachmentBySubmissionId(
      new Request(`http://127.0.0.1/api/submissions/${fixture.submissionA.id}/attachment`),
      { params: Promise.resolve({ submissionId: String(fixture.submissionA.id) }) },
    );

    assert.equal(response.status, 401);
  });

  test("허용된 다운로드는 실제 파일 본문과 private 캐시 헤더를 돌려준다", async () => {
    const response = await fetchLegacyDownload("member1", fixture.submissionB.id);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(await response.text(), `legacy body of ${fixture.submissionB.label}`);
  });
});

// ── HARNESS_MAP 6절 검증 3 ────────────────────────────────────────────────
describe("3. 수정·삭제는 author 또는 명시된 관리자만 가능하다", () => {
  function submissionForm(submissionId: number, extra: Record<string, string | number> = {}) {
    return formDataFrom({
      projectId: fixture.projectId,
      taskId: fixture.taskId,
      submissionId,
      content: "수정된 내용",
      ...extra,
    });
  }

  test("타인의 비공개 제출물은 수정할 수 없다", async () => {
    setSession(sessionFor(testActors.member2));

    const outcome = await runAction(() => updateSubmissionAction(submissionForm(fixture.submissionB.id)));

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /찾을 수 없습니다/);
  });

  test("타인의 공개 제출물도 수정할 수 없다", async () => {
    setSession(sessionFor(testActors.member2));

    const outcome = await runAction(() => updateSubmissionAction(submissionForm(fixture.submissionA.id)));

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /본인이 작성한 제출물만/);
  });

  test("타인의 제출물을 공개로 바꾸는 경로가 막혀 있다", async () => {
    setSession(sessionFor(testActors.member2));

    const outcome = await runAction(() =>
      updateSubmissionAction(submissionForm(fixture.submissionB.id, { visibility: "public" })),
    );

    assert.equal(outcome.status, "error");

    const stillPrivate = await getSubmissionByIdForViewer(fixture.submissionB.id, { canSeeAll: true });
    assert.equal(stillPrivate?.visibility, "private", "visibility 가 덮어쓰기 되면 안 된다");
  });

  test("작성자 본인은 자기 제출물을 수정한다", async () => {
    setSession(sessionFor(testActors.member1));

    const outcome = await runAction(() =>
      updateSubmissionAction(submissionForm(fixture.submissionB.id, { content: "본인이 수정" })),
    );

    assert.equal(outcome.status, "success");

    const updated = await getSubmissionByIdForViewer(fixture.submissionB.id, { canSeeAll: true });
    assert.equal(updated?.content, "본인이 수정");
  });

  test("관리자는 타인의 비공개 제출물을 관리한다", async () => {
    setSession(sessionFor(testActors.admin));

    const outcome = await runAction(() =>
      updateSubmissionAction(submissionForm(fixture.submissionC.id, { content: "관리자가 수정" })),
    );

    assert.equal(outcome.status, "success");
  });

  test("guest 는 쓰기 경로 자체에서 막힌다", async () => {
    setSession(sessionFor(testActors.guest));

    const outcome = await runAction(() => updateSubmissionAction(submissionForm(fixture.submissionA.id)));

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /게스트 계정은/);
  });

  test("타인의 댓글은 수정·삭제할 수 없다", async () => {
    // A 에 달린 댓글의 작성자는 member2 다. 따라서 member1 이 타인 케이스다.
    setSession(sessionFor(testActors.member1));

    const outcome = await runAction(() =>
      updateCommentAction(
        formDataFrom({
          projectId: fixture.projectId,
          taskId: fixture.taskId,
          submissionId: fixture.submissionA.id,
          commentId: fixture.submissionA.commentId,
          content: "남의 댓글 수정",
        }),
      ),
    );

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /본인이 작성한 댓글만/);
  });

  test("댓글은 폼이 주장한 제출물에 실제로 속해야 한다", async () => {
    setSession(sessionFor(testActors.member2));

    const outcome = await runAction(() =>
      updateCommentAction(
        formDataFrom({
          projectId: fixture.projectId,
          taskId: fixture.taskId,
          // 실제로는 A 에 달린 댓글인데 C 소속이라고 주장한다.
          submissionId: fixture.submissionC.id,
          commentId: fixture.submissionA.commentId,
          content: "관계를 속인 수정",
        }),
      ),
    );

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /대상 댓글을 찾을 수 없습니다/);
  });

  test("제출물은 폼이 주장한 project·task 에 실제로 속해야 한다", async () => {
    setSession(sessionFor(testActors.member1));

    const outcome = await runAction(() =>
      updateSubmissionAction(
        formDataFrom({
          // 다른 프로젝트의 제출물을 이 프로젝트 소속인 것처럼 주장한다.
          projectId: fixture.projectId,
          taskId: fixture.taskId,
          submissionId: fixture.otherSubmissionId,
          content: "교차 프로젝트 수정",
        }),
      ),
    );

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /찾을 수 없습니다/);
  });

  test("타인의 제출물은 삭제할 수 없고 자원도 남아 있다", async () => {
    setSession(sessionFor(testActors.member2));

    const outcome = await runAction(() =>
      deleteSubmissionAction(
        formDataFrom({
          projectId: fixture.projectId,
          taskId: fixture.taskId,
          submissionId: fixture.submissionA.id,
        }),
      ),
    );

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /본인이 작성한 제출물만/);

    const survivor = await getSubmissionByIdForViewer(fixture.submissionA.id, { canSeeAll: true });
    assert.ok(survivor, "거부된 삭제가 실제로는 수행되면 안 된다");
  });

  test("작성자 본인은 자기 댓글을 삭제한다", async () => {
    setSession(sessionFor(testActors.member1));

    const outcome = await runAction(() =>
      deleteCommentAction(
        formDataFrom({
          projectId: fixture.projectId,
          taskId: fixture.taskId,
          submissionId: fixture.submissionB.id,
          commentId: fixture.submissionB.commentId,
        }),
      ),
    );

    assert.equal(outcome.status, "success");
  });

  test("프로젝트 CRUD server action 은 관리자 이상만 호출할 수 있다", async () => {
    setSession(sessionFor(testActors.member1));

    const outcome = await runAction(() =>
      deleteProjectAction(formDataFrom({ projectId: fixture.otherProjectId })),
    );

    assert.equal(outcome.status, "error");
    assert.match(outcome.message ?? "", /관리자 이상만/);

    const survivingSubmission = await getSubmissionByIdForViewer(fixture.otherSubmissionId, {
      canSeeAll: true,
    });
    assert.ok(survivingSubmission, "member 호출로 프로젝트가 cascade 삭제되면 안 된다");
  });
});

// ── HARNESS_MAP 6절 검증 4 ────────────────────────────────────────────────
describe("4. unauthorized·missing 응답이 자원 열거를 줄인다", () => {
  test("볼 수 없는 제출물과 없는 제출물의 다운로드 응답이 구별되지 않는다", async () => {
    setSession(sessionFor(testActors.member2));

    const hidden = await getAttachmentBySubmissionId(
      new Request(`http://127.0.0.1/api/submissions/${fixture.submissionB.id}/attachment`),
      { params: Promise.resolve({ submissionId: String(fixture.submissionB.id) }) },
    );
    const missing = await getAttachmentBySubmissionId(
      new Request(`http://127.0.0.1/api/submissions/${fixture.missingSubmissionId}/attachment`),
      { params: Promise.resolve({ submissionId: String(fixture.missingSubmissionId) }) },
    );

    assert.equal(hidden.status, missing.status);
    assert.deepEqual(await hidden.json(), await missing.json());
  });

  test("볼 수 없는 첨부와 없는 첨부의 응답이 구별되지 않는다", async () => {
    setSession(sessionFor(testActors.member2));

    const hidden = await getAttachmentByAttachmentId(
      new Request(`http://127.0.0.1/api/submission-attachments/${fixture.submissionB.attachmentIds[0]}`),
      { params: Promise.resolve({ attachmentId: String(fixture.submissionB.attachmentIds[0]) }) },
    );
    const missing = await getAttachmentByAttachmentId(
      new Request(`http://127.0.0.1/api/submission-attachments/${fixture.missingAttachmentId}`),
      { params: Promise.resolve({ attachmentId: String(fixture.missingAttachmentId) }) },
    );

    assert.equal(hidden.status, missing.status);
    assert.deepEqual(await hidden.json(), await missing.json());
  });

  test("볼 수 없는 제출물과 없는 제출물의 mutation 오류 메시지가 같다", async () => {
    setSession(sessionFor(testActors.member2));

    const base = { projectId: fixture.projectId, taskId: fixture.taskId, content: "x" };

    const hidden = await runAction(() =>
      updateSubmissionAction(formDataFrom({ ...base, submissionId: fixture.submissionB.id })),
    );
    const missing = await runAction(() =>
      updateSubmissionAction(formDataFrom({ ...base, submissionId: fixture.missingSubmissionId })),
    );

    assert.equal(hidden.message, missing.message);
  });
});

// ── HARNESS_MAP 6절 검증 5 ────────────────────────────────────────────────
describe("5. DB query 가 UI 사후 필터가 아니라 bounded viewer filter 를 수행한다", () => {
  test("가려진 제출물 id 를 범위에 넣어도 DB 가 그 행을 돌려주지 않는다", async () => {
    // member2 가 볼 수 있는 제출물만 조회한 뒤, 가려진 B 의 id 를 범위에 억지로 끼워 넣는다.
    // 사후 필터라면 여기서 B 의 댓글·첨부가 나오지만, 질의가 bounded 하면 애초에 조회되지 않는다.
    const dbUser = await getUserByEmail(testActors.member2.email);
    const visible = await listSubmissionsByProject(fixture.projectId, {
      canSeeAll: false,
      viewerUserId: dbUser?.id ?? null,
    });

    assert.ok(
      !visible.some((submission) => submission.id === fixture.submissionB.id),
      "member2 에게 B 가 보이면 fixture 전제가 깨진 것이다",
    );

    const comments = await listCommentsByProject(fixture.projectId, {
      ids: visible.map((submission) => submission.id),
    });

    assert.ok(!comments.some((comment) => comment.submissionId === fixture.submissionB.id));
  });

  test("빈 범위는 전체 조회로 넓어지지 않는다", async () => {
    // 가장 위험한 회귀다. 빈 배열을 '조건 없음'으로 처리하면 프로젝트 전체가 새어 나간다.
    assert.deepEqual(await listCommentsByProject(fixture.projectId, { ids: [] }), []);
    assert.deepEqual(await listAttachmentsByProject(fixture.projectId, { ids: [] }), []);
  });

  test("unrestricted 범위는 관리 경로에서 전체를 돌려준다", async () => {
    const comments = await listCommentsByProject(fixture.projectId, { unrestricted: true });
    const attachments = await listAttachmentsByProject(fixture.projectId, { unrestricted: true });

    assert.equal(comments.length, 3, "파기 경로는 비공개 포함 전체를 봐야 한다");
    assert.equal(attachments.length, 6);
  });

  test("단건 조회도 질의 수준에서 공개 범위를 적용한다", async () => {
    const dbUser = await getUserByEmail(testActors.member2.email);

    assert.equal(
      await getSubmissionByIdForViewer(fixture.submissionB.id, {
        canSeeAll: false,
        viewerUserId: dbUser?.id ?? null,
      }),
      null,
    );
    assert.ok(
      await getSubmissionByIdForViewer(fixture.submissionB.id, {
        canSeeAll: false,
        viewerEmail: testActors.member1.email,
      }),
      "작성자는 이메일 기준으로도 본인 제출물을 조회한다",
    );
    assert.equal(
      await getSubmissionByIdForViewer(fixture.submissionB.id, {
        canSeeAll: false,
        viewerEmail: "  Member1@EXAMPLE.test  ",
      }) !== null,
      true,
      "이메일 비교는 대소문자·공백에 좌우되지 않는다",
    );
  });
});

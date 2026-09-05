import "./helpers/bootstrap";

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { canViewSubmission } from "@/src/entities/submission";
import {
  canAccessAdminPanel,
  canManageAllSubmissions,
  canWriteTaskContent,
} from "@/src/entities/user";
import { testActors, type TestActorName } from "./helpers/session";

const publicSubmission = { visibility: "public", authorEmail: "member1@example.test" } as const;
const member1Private = { visibility: "private", authorEmail: "member1@example.test" } as const;

function viewerFor(name: TestActorName) {
  const actor = testActors[name];

  return {
    canSeeAll: canManageAllSubmissions(actor.role, actor.isSuperuser),
    email: actor.email,
  };
}

describe("역할 정책", () => {
  test("쓰기 권한은 guest 만 제외한다", () => {
    assert.equal(canWriteTaskContent("guest"), false);
    assert.equal(canWriteTaskContent("member"), true);
    assert.equal(canWriteTaskContent("admin"), true);
    assert.equal(canWriteTaskContent("guest", true), true, "슈퍼관리자는 역할과 무관하게 통과");
  });

  test("admin 패널과 전체 제출물 관리는 admin 이상", () => {
    for (const check of [canAccessAdminPanel, canManageAllSubmissions]) {
      assert.equal(check("guest"), false);
      assert.equal(check("member"), false);
      assert.equal(check("admin"), true);
      assert.equal(check("guest", true), true);
    }
  });
});

describe("canViewSubmission — 공개 범위", () => {
  test("공개 제출물은 모든 viewer 가 본다", () => {
    for (const name of Object.keys(testActors) as TestActorName[]) {
      assert.equal(canViewSubmission(publicSubmission, viewerFor(name)), true, name);
    }
  });

  test("비공개 제출물은 작성자와 관리자만 본다", () => {
    assert.equal(canViewSubmission(member1Private, viewerFor("member1")), true, "작성자 본인");
    assert.equal(canViewSubmission(member1Private, viewerFor("admin")), true, "관리자");
    assert.equal(canViewSubmission(member1Private, viewerFor("superuser")), true, "슈퍼관리자");
    assert.equal(canViewSubmission(member1Private, viewerFor("member2")), false, "다른 멤버");
    assert.equal(canViewSubmission(member1Private, viewerFor("guest")), false, "게스트");
  });

  test("작성자 비교는 대소문자·공백에 좌우되지 않는다", () => {
    assert.equal(
      canViewSubmission(member1Private, { canSeeAll: false, email: "  Member1@Example.TEST " }),
      true,
    );
  });

  test("이메일이 없는 viewer 는 비공개 제출물을 보지 못한다", () => {
    assert.equal(canViewSubmission(member1Private, { canSeeAll: false, email: null }), false);
    assert.equal(canViewSubmission(member1Private, { canSeeAll: false }), false);
  });
});

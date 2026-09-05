import "./helpers/bootstrap";

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildIdScopeClause,
  isEmptyIdScope,
  isUnrestrictedScope,
} from "@/src/shared/server/query-scope/index.server";

describe("IdScope — 조회 범위는 SQL 수준에서 bounded 해야 한다", () => {
  test("id 집합은 bind 파라미터가 있는 IN 절이 된다", () => {
    const { clause, params } = buildIdScopeClause("comments.submission_id", { ids: [7, 9] });

    assert.equal(clause, "AND comments.submission_id IN (?, ?)");
    assert.deepEqual(params, [7, 9]);
  });

  test("중복 id 는 한 번만 bind 된다", () => {
    const { clause, params } = buildIdScopeClause("sa.submission_id", { ids: [3, 3, 4, 3] });

    assert.equal(clause, "AND sa.submission_id IN (?, ?)");
    assert.deepEqual(params, [3, 4]);
  });

  test("unrestricted 는 빈 절이며 관리 경로에서만 명시된다", () => {
    const scope = { unrestricted: true } as const;

    assert.equal(isUnrestrictedScope(scope), true);
    assert.equal(isEmptyIdScope(scope), false);
    assert.deepEqual(buildIdScopeClause("x.y", scope), { clause: "", params: [] });
  });

  test("빈 범위는 '전체 조회'가 아니라 '결과 없음'으로 구분된다", () => {
    // 빈 IN 절은 SQL 로 만들 수 없으므로, 호출부가 질의를 건너뛰도록 별도 신호를 준다.
    assert.equal(isEmptyIdScope({ ids: [] }), true);
    assert.equal(isEmptyIdScope({ ids: [1] }), false);
  });

  test("컬럼명은 호출부 상수만 허용한다", () => {
    assert.doesNotThrow(() => buildIdScopeClause("comments.submission_id", { ids: [1] }));
    assert.doesNotThrow(() => buildIdScopeClause("submission_id", { ids: [1] }));

    for (const injected of ["id; DROP TABLE users", "id) OR (1=1", "", "a.b.c", "1"]) {
      assert.throws(() => buildIdScopeClause(injected, { ids: [1] }), /컬럼명이 올바르지 않습니다/);
    }
  });
});

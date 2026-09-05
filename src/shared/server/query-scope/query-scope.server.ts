/**
 * 목록 쿼리의 조회 범위를 SQL WHERE 절 수준에서 제한하는 공용 helper.
 *
 * UI 사후 필터가 아니라 DB 질의 자체를 bounded 하게 만들기 위한 것이다.
 * 호출부는 "무엇으로 제한할지"를 반드시 명시해야 하며, 안전한 기본값을 두지 않는다.
 */

/** 허용된 id 집합으로 제한하거나(`ids`), 관리 목적의 전체 조회(`unrestricted`)를 명시한다. */
export type IdScope = { readonly ids: readonly number[] } | { readonly unrestricted: true };

/** 컬럼명은 SQL에 그대로 들어가므로 호출부 상수만 허용한다. */
const SAFE_COLUMN_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

export function isUnrestrictedScope(scope: IdScope): scope is { readonly unrestricted: true } {
  return "unrestricted" in scope;
}

/** 허용 id가 하나도 없는 범위. 이 경우 질의 자체를 건너뛰어야 한다. */
export function isEmptyIdScope(scope: IdScope) {
  return !isUnrestrictedScope(scope) && scope.ids.length === 0;
}

/**
 * `AND <column> IN (?, ?, ...)` 조각과 bind 파라미터를 만든다.
 * `unrestricted` 이거나 빈 범위이면 빈 절을 돌려주므로, 빈 범위는 호출부가 `isEmptyIdScope`로 먼저 걸러야 한다.
 */
export function buildIdScopeClause(column: string, scope: IdScope): { clause: string; params: number[] } {
  if (!SAFE_COLUMN_PATTERN.test(column)) {
    throw new Error(`조회 범위 컬럼명이 올바르지 않습니다: ${column}`);
  }

  if (isUnrestrictedScope(scope) || scope.ids.length === 0) {
    return { clause: "", params: [] };
  }

  const uniqueIds = [...new Set(scope.ids)];

  return {
    clause: `AND ${column} IN (${uniqueIds.map(() => "?").join(", ")})`,
    params: uniqueIds,
  };
}

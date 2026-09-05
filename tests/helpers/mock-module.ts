import { mock } from "node:test";

/**
 * `mock.module()` 의 named export 지정 helper.
 *
 * Node 26 런타임은 `options.exports` 를 요구하고 `namedExports` 를 deprecated 로 경고하지만,
 * 이 저장소의 `@types/node`(v20 계열)에는 아직 `exports` 가 없다. 런타임 계약을 따르고
 * 타입 지연만 이 한 곳에서 흡수한다.
 */
export function mockModuleExports(specifier: string, exports: Record<string, unknown>) {
  mock.module(specifier, { exports } as unknown as Parameters<typeof mock.module>[1]);
}

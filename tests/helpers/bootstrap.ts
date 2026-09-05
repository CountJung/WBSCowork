/**
 * DB 를 쓰는 테스트의 공통 부트스트랩.
 *
 * 반드시 어떤 `src/` 모듈보다 먼저 import 되어야 한다.
 *  - `getRuntimeEnv()` 는 첫 호출 결과를 캐시하므로 env 를 먼저 심어야 하고,
 *  - `server-only` / `next-auth` 는 Next 런타임 밖에서 대체해야 하기 때문이다.
 */
import type { Session } from "next-auth";
import { applyTestEnv } from "./test-env";
import { mockModuleExports } from "./mock-module";

applyTestEnv();

let currentSession: Session | null = null;

// `import "server-only"` 는 Next 번들러가 해석하는 marker 다. Node 실행에서는 무해한 빈 모듈로 둔다.
mockModuleExports("server-only", {});

// 실제 `getAuthSession()` 코드 경로를 그대로 타면서 세션만 주입한다.
mockModuleExports("next-auth", { getServerSession: async () => currentSession });

// `revalidatePath()` 는 Next 요청 컨텍스트(static generation store)를 요구한다.
// 캐시 무효화는 여기서 검증하는 인가 계약과 무관하므로 no-op 으로 둔다. 이것을 두지 않으면
// action 의 성공 경로가 전부 캐시 오류로 끝나 "거부됨"과 구분되지 않는다.
const revalidatedPaths: string[] = [];

mockModuleExports("next/cache", {
  revalidatePath: (path: string) => {
    revalidatedPaths.push(path);
  },
  revalidateTag: () => undefined,
});

/** action 이 무효화를 요청한 경로 목록. 필요하면 테스트에서 확인한다. */
export function takeRevalidatedPaths() {
  return revalidatedPaths.splice(0, revalidatedPaths.length);
}

/** 이후 모든 action/handler 호출이 이 세션으로 실행된다. */
export function setSession(session: Session | null) {
  currentSession = session;
}

/** 세션 없이(비로그인) 실행한다. */
export function clearSession() {
  currentSession = null;
}

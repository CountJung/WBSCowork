# 점진적 FSD 마이그레이션 계획

> 상태: M0~M5 완료(2026-08-12). 루트 `app/`은 Next.js App Router 엔트리로 유지하고 구현은 `src/shared`, `src/entities`, `src/features`, `src/widgets` 공개 API로 분리했다.

## 1. 구조 계약

```text
app/                         # 마지막 조립: route/layout/page/handler/action adapter
src/widgets/                 # 화면의 큰 조립 블록
src/features/                # 사용자 행동/use-case
src/entities/                # 도메인 타입·정책·조회/저장 API
src/shared/                  # 도메인을 모르는 UI/config/server utility
```

- `src/app`, `src/pages`는 만들지 않는다. page 역할은 기존 루트 `app/**/page.tsx`가 담당한다.
- 공개 API는 각 slice의 `index.ts`(server 전용 소비자는 `index.server.ts`)로 제한하고 다른 slice의 내부 파일을 deep import하지 않는다.
- 허용 의존 방향은 `app → widgets → features → entities → shared`이다. 같은 레이어의 서로 다른 slice 간 직접 import는 금지한다.
- **구현/이동 순서는 의존 방향의 반대인 `shared → entities → features → widgets → app pages`**이다. 하위 레이어 공개 API를 먼저 안정화한 뒤 상위 소비자를 전환한다.
- Server Component가 기본이며 브라우저 상태가 필요한 leaf에만 `"use client"`를 둔다. DB/env/fs API는 server-only 공개 API로 제공한다.
- 한 변경 단위에서 **구조 이동과 기능/SQL/권한/UI 동작 변경을 섞지 않는다**. 순수 이동 PR은 기존 export/signature/SQL을 보존하고 임시 re-export를 둔다. 기능 변경이 필요하면 별도 변경에서 먼저 테스트와 함께 완료한 뒤 이동한다.

## 2. 현재 파일 → 목표 slice 매핑

| 현재 파일/폴더 | 목표 | 이동 단위와 주의점 |
| --- | --- | --- |
| `components/MarkdownContent.tsx` | `src/shared/ui/markdown-content/` | 도메인 비의존 유지 |
| `components/AppProviders.tsx`, `lib/theme.ts` | `src/shared/ui/providers/`, `src/shared/config/theme/` | 루트 layout에서만 조립 |
| `lib/db.ts`, `lib/env.ts`, `lib/logger.ts` | `src/shared/server/` | server-only; 기존 경로 임시 re-export |
| `lib/auth.ts` | provider/session wiring은 `src/shared/server/auth/`, 역할 정책은 `src/entities/user` | 정책을 shared에 넣지 않음 |
| `models/project.ts` | `src/entities/project/model/` | 타입·순수 정책부터 이동 |
| `lib/repositories/project-repository.ts` | `src/entities/project/api/project-repository.server.ts` | SQL/signature 보존 |
| `models/task.ts`, `lib/task-view.ts` | `src/entities/task/model/` | 순수 변환과 DB shape 분리 |
| `lib/repositories/task-repository.ts` | `src/entities/task/api/task-repository.server.ts` | 기존 함수 시그니처 보존 |
| `models/submission.ts`, `models/submission-attachment.ts` | `src/entities/submission/model/` | visibility 정책 공개 API 유지 |
| `lib/repositories/submission*.ts`, `lib/submission-files.ts` | `src/entities/submission/api/` | 목록 조회의 visibility 계약 유지; 저장소 I/O는 server-only |
| `models/comment.ts`, `lib/repositories/comment-repository.ts` | `src/entities/comment/{model,api}/` | submission 공개 API만 사용 |
| `models/user.ts`, `lib/repositories/user-repository.ts` | `src/entities/user/{model,api}/` | 권한 helper 회귀 금지 |
| `app/tasks/actions.ts`의 mutation | `src/features/task-{create,update,delete}/server/` 등 | app action은 `"use server"` adapter/revalidation만 유지 |
| 제출물/댓글/첨부 mutation | `src/features/submission-*`, `src/features/comment-*`, `src/features/attachment-upload` | 세션·입력 검증·로그를 use-case에 묶음 |
| `app/admin/users/actions.ts` | `src/features/user-role-change/server/` | admin 부여 범위 유지 |
| `app/admin/projects/actions.ts` | `src/features/project-manage/server/` | route action은 얇은 adapter |
| `components/gantt/ProjectGanttChart.tsx` | `src/widgets/project-gantt/` | client leaf 유지 |
| `components/task/*` | `src/widgets/task-workspace/`, `src/widgets/submission-panel/` | 행동 코드는 feature 전환 후 UI 이동 |
| `components/AppShell.tsx` | `src/widgets/app-shell/` | user entity 공개 API 사용 |
| `components/admin/*` | `src/widgets/admin-{settings,database}/` | superuser 경계를 route/use-case 양쪽에서 검증 |
| `app/**/page.tsx`, `app/**/route.ts` | 제자리, 마지막 전환 | 파라미터 파싱, auth guard, widget/use-case 호출, HTTP 응답만 담당 |

## 3. 실행 순서와 게이트

### M0 — import boundary 하네스(완료, 2026-08-09)

1. `scripts/check-fsd-boundaries.ts`를 첫 실제 slice(`src/shared/ui/markdown-content`)와 함께 추가했다.
2. `tsconfig.json`의 `@/* → ./*` alias를 그대로 사용해 `@/src/...`로 import한다. 별도 alias는 만들지 않았다.
3. `package.json`에 `check:fsd`를 연결했다. 함께 `typecheck`(`tsc --noEmit`)도 추가했다.

**게이트 결과**: fixture self-test 5건(정상 1, 역방향/cross-slice/deep/client-server 각 1) PASS, 저장소 위반 0건, `npm run lint`·`npm run typecheck`·`npm run build` 통과.

구현하면서 확정한 계약:

| 결정 | 내용 | 이유 |
| --- | --- | --- |
| 공개 API 2종 | slice 공개 진입점은 `index.ts`와 `index.server.ts` | 순수 모델과 server 전용 API를 한 index에 섞으면 client 그래프가 server 코드를 끌어온다 |
| shared 공개 단위 | `src/shared/<segment>/<unit>` (슬라이스가 아닌 세그먼트 구조) | 표준 FSD에서 shared는 slice를 갖지 않는다 |
| type-only import 예외 | `import type` / `export type`은 client-server 검사에서 제외 | 컴파일 시 지워지므로 번들 경계에 영향이 없다 |
| `"use server"` 경계 | Server Action 모듈에서 그래프 탐색을 멈춘다 | client → Server Action은 네트워크 참조로 대체되어 서버 코드를 번들에 넣지 않는다 |
| `legacy-import`는 경고 | src 슬라이스가 `components/`·`lib/`·`models/`를 참조하면 warn | 이동 도중 불가피한 과도기 상태를 차단하지 않되 남은 부채로 노출한다 |
| 전이 검사 | client 진입점에서 도달 가능한 그래프 전체를 탐색 | re-export를 한 단계 거치면 직접 import 검사만으로는 뚫린다 |

**남은 M0 후속**: CI 워크플로가 없으므로 `check:fsd`는 아직 로컬 게이트다. CI 도입 시 lint/typecheck/build와 함께 연결한다.

### M1 — shared 기반 (완료, 2026-08-12)

완료: `src/shared/ui/markdown-content`, `src/shared/ui/providers`, `src/shared/config/theme`, `src/shared/server/{runtime-env,database,database-admin,logging}`, `src/shared/lib/date`.

도메인 비의존 UI/config부터 이동한다. `db`, `env`, `logger`, auth provider wiring 같은 server module은 각 파일에 server-only 경계를 두되 도메인 권한 helper를 shared로 끌어내리지 않는다.

**게이트**: 기능·설정 키·로그 동작 변경 없이 `npm run check:fsd`, `npm run typecheck`, `npm run lint` 통과.

### M2 — entities (완료, 2026-08-12)

`project`, `task`, `submission`, `comment`, `user` 모델/정책과 repository를 entity slice의 public API로 이동했다.

**게이트**: 이동 전후 export/signature/SQL/반환 shape가 동일해야 한다. visibility/권한 table test, `npm run db:check -- --validate-only`, 테스트 DB가 제공될 때 repository CRUD, lint/build 통과. Client graph에 `mariadb`, `node:fs`, server env가 없어야 한다.

### M3 — features (완료, 2026-08-12)

Server Action의 세션 확인, 입력 정규화, repository 호출, 행동 로그를 feature use-case로 추출했다. `app/**/actions.ts`는 route-local `"use server"` adapter로 남는다.

**게이트**: guest/member/admin/superuser 권한 매트릭스, private submission, 실패 로그, 기존 URL/Form action smoke test와 lint/build 통과. 이 단계에서 새 사용자 기능을 추가하지 않는다.

### M4 — widgets (완료, 2026-08-12)

`ProjectGanttChart`, task/submission panel, `AppShell`, admin panel을 widget slice로 이동했다. widget은 feature/entity/shared 공개 API만 사용한다.

**게이트**: `/`, `/tasks`, `/admin`, `/admin/users` desktop/mobile·light/dark smoke test, focused task routing/Gantt 회귀 확인, lint/build 통과. UI redesign을 섞지 않는다.

### M5 — 루트 app pages/adapters 전환 및 호환 제거 (완료, 2026-08-12)

루트 `app/**/page.tsx`와 route handler가 widget/use-case/entity/shared 공개 API를 직접 조립하도록 전환했다. `components/`, `lib/`, `models/` 호환 re-export는 제거했다.

**게이트**: `npm run check:fsd`가 역방향, cross-slice deep import, client→server import를 거부하고 전체 lint/build가 통과해야 한다. URL, Route Handler, Server Action entry는 루트 `app/`에 남는다.

## 4. import boundary gate 사양 (구현됨)

`scripts/check-fsd-boundaries.ts`가 정적 import, dynamic import, `require`, re-export를 대상으로 다음을 검사한다.

| 코드 | 차단 대상 | 심각도 |
| --- | --- | --- |
| `layer-direction` | `shared → entities\|features\|widgets`, `entities → features\|widgets`, `features → widgets`, `src → app` | error |
| `cross-slice` | 같은 레이어의 다른 slice 직접 import | error |
| `deep-import` | 다른 slice의 `index.ts`/`index.server.ts`를 우회한 내부 파일 참조 | error |
| `unknown-layer` | `src/` 아래에 정의되지 않은 레이어(예: `src/app`) | error |
| `client-server` | client 진입점에서 **전이적으로** 도달하는 `*.server.ts(x)`, `src/shared/server/**`, `mariadb`, `node:fs(/promises)`, `server-only` 등 | error |
| `legacy-import` | src 슬라이스 → `components/`·`lib/`·`models/` | warn |

client 진입점은 `"use client"` 지시문 또는 `*.client.ts(x)` 파일이다. `import type`/`export type`과 `"use server"` 모듈은 client-server 검사에서 제외한다(각각 컴파일 시 소거, 네트워크 경계 대체).

경계 예외를 blanket disable하지 않는다. fixture(`scripts/fixtures/fsd/`)는 허용 방향 1건과 금지 유형 4건을 모두 포함하며, 기본 실행이 self-test를 먼저 통과해야 저장소 검사로 넘어간다. 이 저장소에는 아직 CI 워크플로가 없어 현재는 로컬 게이트다.

## 5. 완료 정의

- 구현 순서가 `shared → entities → features → widgets → root app pages`이고 의존 방향은 그 반대다.
- 구조 이동 commit/PR에 기능, SQL, 권한, UI 동작 변경이 섞이지 않는다.
- 핵심 권한/visibility 정책과 SQL 동작이 이동 전후 동일하다.
- 모든 새 slice는 public API를 가지며 실제 import boundary gate가 로컬/CI에서 실행된다.
- `docs/TODO.md`, `docs/PROJECT_MAP.md`, `docs/HARNESS_MAP.md`, `AGENTS.md`가 실제 상태와 동기화된다.

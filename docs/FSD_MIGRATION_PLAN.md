# 점진적 FSD 마이그레이션 계획

> 상태: 계획/검토 완료, 구현 미착수 · 대규모 이동 금지

> 범위: 루트 `app/`을 Next.js App Router 엔트리로 유지하고 구현을 `src/shared → src/entities → src/features → src/widgets → 루트 app page` 순서로 점진 이동한다.

## 1. 구조 계약

```text
app/                         # 마지막 조립: route/layout/page/handler/action adapter
src/widgets/                 # 화면의 큰 조립 블록
src/features/                # 사용자 행동/use-case
src/entities/                # 도메인 타입·정책·조회/저장 API
src/shared/                  # 도메인을 모르는 UI/config/server utility
```

- `src/app`, `src/pages`는 만들지 않는다. page 역할은 기존 루트 `app/**/page.tsx`가 담당한다.
- 공개 API는 각 slice의 `index.ts`로 제한하고 다른 slice의 내부 파일을 deep import하지 않는다.
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

### M0 — import boundary 하네스(이동 전)

1. 빈 레이어를 만들기보다 첫 실제 slice와 함께 `scripts/check-fsd-boundaries.ts`를 추가한다.
2. 현재 `tsconfig.json`의 `@/* → ./*` alias를 그대로 사용해 `@/src/...`를 import한다. 별도 alias를 약속하지 않는다.
3. `package.json`에 `check:fsd`를 연결하고 CI 품질 게이트에 포함한다.

**게이트**: 정상 fixture는 통과하고 역방향/deep/server-client 위반 fixture는 실패해야 한다. `npm run check:fsd`, `npm run lint`, `npm run build` 통과. 런타임 파일 이동 없음.

### M1 — shared 기반

도메인 비의존 UI/config부터 이동한다. `db`, `env`, `logger`, auth provider wiring 같은 server module은 각 파일에 server-only 경계를 두되 도메인 권한 helper를 shared로 끌어내리지 않는다.

**게이트**: 기존 import 소비자는 호환 re-export로 유지, client 위반 fixture 실패, lint/build 통과. 기능·설정 키·로그 동작 변경 없음.

### M2 — entities

`project → task → submission → comment → user` 순으로 모델/순수 함수를 옮긴 뒤 repository를 같은 entity의 `api/*.server.ts`로 옮긴다. 모델 이동과 repository 이동도 별도 변경 단위로 수행한다.

**게이트**: 이동 전후 export/signature/SQL/반환 shape가 동일해야 한다. visibility/권한 table test, `npm run db:check -- --validate-only`, 테스트 DB가 제공될 때 repository CRUD, lint/build 통과. Client graph에 `mariadb`, `node:fs`, server env가 없어야 한다.

### M3 — features

Server Action의 세션 확인, 입력 정규화, repository 호출, 행동 로그를 feature use-case로 추출한다. `revalidatePath`, redirect, FormData/HTTP 변환은 app adapter에 남긴다.

**게이트**: guest/member/admin/superuser 권한 매트릭스, private submission, 실패 로그, 기존 URL/Form action smoke test와 lint/build 통과. 이 단계에서 새 사용자 기능을 추가하지 않는다.

### M4 — widgets

`ProjectGanttChart`, task/submission panel, AppShell, admin panel을 하나씩 옮긴다. widget은 feature/entity 공개 API만 사용한다.

**게이트**: `/`, `/tasks`, `/admin`, `/admin/users` desktop/mobile·light/dark smoke test, focused task routing/Gantt 회귀 확인, lint/build 통과. UI redesign을 섞지 않는다.

### M5 — 루트 app pages/adapters 전환 및 호환 제거

루트 `app/**/page.tsx`가 안정화된 widget/use-case를 조립하도록 마지막에 전환한다. 남은 legacy import가 0인 slice만 `models/`, `components/`, `lib/repositories/` re-export를 제거한다.

**게이트**: `npm run check:fsd`가 역방향, cross-slice deep import, client→server import를 거부하고 전체 lint/build가 통과해야 한다. URL, Route Handler, Server Action entry는 루트 `app/`에 남는다.

## 4. import boundary gate 최소 사양

검사기는 정적 import, dynamic import, re-export를 대상으로 최소한 다음을 실패 처리한다.

- `src/shared/**` → `src/entities|features|widgets/**`
- `src/entities/**` → `src/features|widgets/**`
- `src/features/**` → `src/widgets/**`
- 같은 레이어의 다른 slice 직접 import
- 다른 slice의 public `index.ts`를 우회한 deep import
- `"use client"` 파일 또는 `*.client.ts(x)` → `*.server.ts`, `mariadb`, `node:fs`, server env import

경계 예외를 blanket disable하지 않는다. fixture에는 각 금지 유형과 허용 방향을 모두 포함한다. CI 연결이 구현되기 전에는 `check:fsd`를 완료로 표시하지 않는다.

## 5. 완료 정의

- 구현 순서가 `shared → entities → features → widgets → root app pages`이고 의존 방향은 그 반대다.
- 구조 이동 commit/PR에 기능, SQL, 권한, UI 동작 변경이 섞이지 않는다.
- 핵심 권한/visibility 정책과 SQL 동작이 이동 전후 동일하다.
- 모든 새 slice는 public API를 가지며 실제 import boundary gate가 로컬/CI에서 실행된다.
- `docs/TODO.md`, `docs/PROJECT_MAP.md`, `AGENTS.md`가 실제 상태와 동기화된다.

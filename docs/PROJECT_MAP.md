# WBSCowork 프로젝트 맵

> 현재 코드의 탐색 지도. 실행·검증 명령은 [HARNESS_MAP.md](HARNESS_MAP.md), 열린 항목은 [TODO.md](TODO.md), 완료 이력은 [COMPLETED_LOG.md](COMPLETED_LOG.md)를 본다.

## 1. 루트 지도

| 경로 | 책임 | 핵심 파일 |
| --- | --- | --- |
| `app/` | Next.js 16 App Router 엔트리, Server Component, Server Action, Route Handler | `layout.tsx`, `page.tsx`, `tasks/*`, `admin/*`, `api/*` |
| `src/shared/` | 도메인 비의존 UI/config/server utility | `ui/markdown-content`, `ui/providers`, `config/theme`, `server/*`, `lib/date` |
| `src/entities/` | 도메인 모델·정책·MariaDB/file repository public API | project/task/submission/comment/user |
| `src/features/` | Server Action use-case | task-workspace, database-manage, project-manage, settings-manage, user-role-change |
| `src/widgets/` | MUI 화면 조립과 client leaf | app-shell, project-gantt, task-workspace, admin-database, admin-settings |
| `scripts/` | 실제 CLI 하네스 | `run-next.ts`, `check-db.ts`, `check-fsd-boundaries.ts`, `fixtures/fsd/`, 문서 변환 스크립트 |
| `docs/` | 모든 하위 문서 | 아래 4절 |
| `.github/` | Copilot 규칙과 저장소 skills | instructions, document skills |
| `tasks/` | 작업 인계 템플릿 | `TASK_TEMPLATE.md` |

`components/`, `lib/`, `models/` 호환 re-export는 8단계 M5에서 제거했다. 루트 `app/`은 Next.js 엔트리로 유지하며 `src/**` public API를 조립한다.

## 2. 런타임 라우트 맵

| URL / entry | 파일 | 인증/권한 | 주요 데이터 |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | 비로그인은 안내, 로그인 후 조회 | projects, tasks, Gantt |
| `/privacy` | `app/privacy/page.tsx` | 공개 | 수집 항목, 보유 기간, 프로젝트 종료·파기 절차 |
| `/tasks` | `app/tasks/page.tsx` | 로그인 필수; guest read-only, member+ write | 모든 핵심 entity; submission 목록만 viewer filter 적용 |
| `/admin` | `app/admin/page.tsx` | admin/superuser | 운영 요약 |
| `/admin/projects` | `app/admin/projects/page.tsx` | admin/superuser | project CRUD |
| `/admin/users` | `app/admin/users/page.tsx` | admin/superuser | user role 관리 |
| `/admin/database` | `app/admin/database/page.tsx` | superuser only | schema 상태/초기화 |
| `/admin/logs` | `app/admin/logs/page.tsx` | superuser only | rolling log tail |
| `/admin/settings` | `app/admin/settings/page.tsx` | superuser only | env 설정 UI |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | NextAuth | Google OAuth GET/POST |
| `/api/submissions/[submissionId]/attachment` | 해당 `route.ts` | 로그인 + `getSubmissionByIdForViewer` 가시성 | legacy 단일 첨부 download |
| `/api/submission-attachments/[attachmentId]` | 해당 `route.ts` | 로그인 + 부모 제출물 가시성 | 다중 첨부 download |

두 attachment route는 권한이 없거나 존재하지 않는 자원을 모두 404로 응답해 식별자 열거를 줄인다.

## 3. 주요 실행 흐름

### 인증

`GoogleProvider → src/entities/user auth.server callbacks → user repository sync/role resolve → JWT token → session.user.{role,isSuperuser}`

### 작업 화면 조회

`app/tasks/page.tsx → database readiness → project/user 병렬 조회 → viewer DB id 해석 → task/submission 조회 → 가시 submission id로 comment/attachment 조회 → task UI`

- `submission-repository`의 `SubmissionVisibilityFilter`는 필수 인자다. 단건은 `getSubmissionByIdForViewer`를 쓴다.
- comment/attachment project 조회는 필수 `IdScope`(`src/shared/server/query-scope`)를 받는다. 화면은 가시 submission id 집합을 넘기므로 비공개 제출물의 파생 데이터가 client props에 실리지 않는다. 파기·삭제 등 관리 경로만 `{ unrestricted: true }`를 명시한다.

### 쓰기

`form → app/**/actions.ts adapter → src/features/* use-case → entity repository/file/log/revalidate → redirect`

`app/tasks/actions.ts`는 `"use server"` adapter이고 실제 task/submission/comment mutation은 `src/features/task-workspace`에 있다.

### 프로젝트 종료·파기

`/admin/projects 종료 및 파기 확인 → 프로젝트 연결 제출물·첨부·태스크 경로 선조회 → project DELETE/FK cascade → UPLOAD_DIR 저장 파일·빈 태스크 디렉터리 정리 → 구조화 결과 로그`

프로젝트 종료일만으로 자동 삭제하지 않는다. 관리자가 산출물 인계와 별도 보존 의무를 확인한 뒤 명시적으로 실행하며, 공유 사용자 계정과 단기 운영 로그는 프로젝트 데이터와 별도 수명주기로 관리한다.

### DB 초기화

`/admin/database → app/admin/database/actions.ts adapter → src/features/database-manage → initializeDatabaseSchema() → CREATE DATABASE/TABLE + 일부 누락 컬럼 ALTER`

별도 migration history table/runner는 없다.

## 4. 데이터 관계

```text
projects 1 ── N tasks
users    1 ── N tasks (assignee, nullable)
tasks    1 ── N tasks (parent, nullable)
tasks    1 ── N submissions
users    1 ── N submissions
submissions 1 ── N submission_attachments
submissions 1 ── N comments
users       1 ── N comments
```

상세 DDL은 `ARCHITECTURE.md`와 `src/shared/server/database-admin`을 본다.

## 5. 변경 시 동반 확인

| 변경 | 반드시 함께 확인 |
| --- | --- |
| 역할 helper | auth callback/session types, admin pages/actions, tasks UI/actions |
| submission visibility | submission query, comments, attachments, download handlers, mutation ownership |
| DB column/table | database-admin status, create/upgrade path, model mapper, repository SQL, `db:check` |
| route/action | page form, redirect/revalidate, auth guard, structured log |
| 파일 저장 | DB row lifecycle, path boundary, deletion cleanup, size/body limit |
| FSD 이동 | public API, server/client boundary, alias `@/*`, `npm run check:fsd` |
| Next 설정 | `scripts/run-next.ts`, APP_PORT, build/start/dev 모두 |

## 6. 문서 지도

루트에는 진입점 3개(`README.md`, `AGENTS.md`, `CLAUDE.md`)만 두고 나머지 문서는 모두 `docs/`에 있다.

| 문서 | 성격 | 언제 보는가 |
| --- | --- | --- |
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | 제품 정의·MVP 범위·DB 설계 | 기능 범위/스키마 판단 |
| [MASTER_PLAN.html](MASTER_PLAN.html) | 운영 마스터 플랜(사람용, standalone) | 우선순위·로드맵 공유 |
| PROJECT_MAP.md (이 문서) | 코드 탐색 지도 | 어디를 고칠지 찾을 때 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 인증·인가·가시성·데이터 경계 | 정책/구조 변경 |
| [HARNESS_MAP.md](HARNESS_MAP.md) | 실행·검증 명령과 기준선 | 검증 범위 결정 |
| [TODO.md](TODO.md) | 열린 항목(`T-###`)·상태·선행 | 매 작업 시작·종료 |
| [COMPLETED_LOG.md](COMPLETED_LOG.md) | 완료 항목의 원인·조치·회귀 방지 | 항목 완료 시 |
| [FSD_MIGRATION_PLAN.md](FSD_MIGRATION_PLAN.md) | 8단계 M0~M5 계약 | 구조 이동 |
| [PROJECT_DIGEST_REPORT_PLAN.md](PROJECT_DIGEST_REPORT_PLAN.md) | 9단계 D0~D5 계약 | digest/report |
| [manual/](manual/) | 사용자 교육 자료(슬라이드·빠른 참조) | 교육·발표 |

## 7. 권위 자료 우선순위

1. 실제 코드와 `package.json`/lockfile
2. `src/shared/server/database-admin`의 실제 DDL
3. 운영 문서(`AGENTS.md`, 이 문서, `ARCHITECTURE.md`, `HARNESS_MAP.md`)
4. `docs/`의 계획/이력 문서

문서와 코드가 다르면 차이를 기록하고 코드를 근거로 운영한다.

## Sites Worker 빌드 진입점

- `vite.config.mts`, `sites/worker.ts`: 기존 App Router를 Worker 산출물로 빌드한다. Google/NextAuth와 MUI는 유지한다.
- `scripts/test-sites-auth.mjs`: 빌드 산출물을 workerd에서 실행하는 인증/익명 접근 계약. 가상 테스트 설정만 사용한다.
- `docs/SITES_WORKER_AUTH_2026-10-08.md`: 통과 범위와 운영 검증의 남은 단계.


## D1/R2 및 실패 복구

- `db/schema.ts`, `drizzle/`: 기존 6개 domain table, 감사 로그, 저장 객체 정리 ledger와 cascade/staging trigger. 배포된 migration은 수정하지 않고 추가한다.
- `src/shared/server/hosted-runtime`: request-scoped D1/R2 binding. MariaDB 실행 경로와 분리한다.
- `src/shared/server/object-cleanup`: 참조 중 객체 삭제 거부, 지연 재시도/backoff, 만료된 staging 객체 복구.
- `src/entities/submission/api/submission-files.server.ts`: Worker에서는 known-length Blob을 R2에 전달하고 다운로드를 stream으로 읽는다. Node는 파일 저장소를 유지한다.
- `scripts/test-sites-{auth.mjs,storage.ts,http.mjs,browser.py}`: 인증·저장소·실제 Worker HTTP·시각 QA의 검증 경계를 구분한다.

## 관리자 운영 표시

- `src/shared/config/admin-runtime`: 비밀값 없는 runtime metadata로 hosted D1/R2·Sites 설정과 native MariaDB·파일 로그 안내를 분기한다. 인가나 환경 설정은 변경하지 않는다.
- `tests/admin-runtime.test.ts`: hosted / configured native / unconfigured native 표시 회귀. Worker HTTP suite는 `/admin`을 포함한 실제 역할별 SSR과 DB/log/user 안내를 확인한다.

- `scripts/verify-sites-crud.mjs`: HTTP suite의 실제 form/RSC action reference로 isolated CRUD lifecycle과 cross-user denied writes를 확인한다. 운영 데이터/계정을 사용하지 않는다.

## 버그 제보·리뷰 (T-027)

- `app/bugs`, `app/admin/bugs`: thin page adapters.
- `src/widgets/bug-reports`: MUI own queue/create/detail/history/admin triage; pending submit button.
- `src/features/bug-report-manage`: fresh authenticated actor, independent report rights, fixed redirect actions.
- `src/entities/bug-report`: bounded validation, SQL-scoped list/count/detail/events, immutable originals, atomic version/idempotency guarded events.
- `drizzle/0003_free_zarek.sql`: additive D1 report/archive migration. `src/shared/server/database-admin/bug-schema.server.ts`: matching native MariaDB schema.
- `scripts/test-bug-reports.ts` / `verify-bug-http.mjs`: D1 archive/concurrency and actual Worker HTTP authorization/validation.

- `scripts/check-rsc-decoder.mjs`: RSC 보안 패치 버전과 실제 Worker decoder fingerprint를 검사한다. 빌드 후 `npm run test:sites:decoder`.

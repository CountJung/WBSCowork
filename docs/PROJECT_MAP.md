# WBSCowork 프로젝트 맵

이 문서는 **실제 경로·라우트·호출의 진입점이 어디인가**를 소유한다. 설계 이유/권한 계약은 [ARCHITECTURE](ARCHITECTURE.md), 상태는 [TODO](TODO.md)를 본다.

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
| `/tasks` | `app/tasks/page.tsx` | 로그인 + project scope; guest read-only | viewer 허용 프로젝트/업무·제출·댓글/첨부 |
| `/admin` | `app/admin/page.tsx` | superuser only | 전역 운영 요약; admin은 `/admin/projects`로 이동 |
| `/admin/projects` | `app/admin/projects/page.tsx` | 지정 프로젝트 admin/SU | SU 생성·소속/접근 정책, 범위 내 관리 |
| `/admin/users` | `app/admin/users/page.tsx` | superuser only | 전역 user role 관리 |
| `/admin/database` | `app/admin/database/page.tsx` | superuser only | schema 상태/초기화 |
| `/admin/logs` | `app/admin/logs/page.tsx` | superuser only | rolling log tail |
| `/admin/settings` | `app/admin/settings/page.tsx` | superuser only | env 설정 UI |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | NextAuth | Google OAuth GET/POST |
| `/api/submissions/[submissionId]/attachment` | 해당 `route.ts` | 로그인 + `getSubmissionByIdForViewer` 가시성 | legacy 단일 첨부 download |
| `/api/submission-attachments/[attachmentId]` | 해당 `route.ts` | 로그인 + 부모 제출물 가시성 | 다중 첨부 download |

두 attachment route는 권한이 없거나 존재하지 않는 자원을 모두 404로 응답해 식별자 열거를 줄인다.

## 3. 주요 실행 흐름

### 공통 UI 레이아웃

`src/shared/config/theme/theme.ts`의 `MuiContainer.defaultProps.maxWidth = xl`을 AppShell·작업·관리자·버그 목록·개인 업무·검색·알림·제출 이력이 공유한다. 개인정보와 버그 상세의 긴 글은 명시적 `md` 예외다. `src/widgets/app-shell/ui/AppShell.tsx`는 모든 폭에서 상단 햄버거와 기본 닫힌 top Drawer를 사용한다. `src/shared/ui/scoped-navigation`은 서버가 허용한 프로젝트 탐색만 등록하고 정확한 root/하위 경로에서 활성화한다. `scripts/test-ui-layout.mjs`/`.py`는 격리 합성 D1과 production Worker/JS/CSS/font를 사용해 화면과 메뉴를 검증한다. [검증 기록](ARCHITECTURE.md#화면-구조).

### 운영 HTTP와 테스트 네트워크

`scripts/test-sites-live.py` → `sites_test_network.py`는 현 프록시/정책의 안전한 진단과 anonymous GET-only HTTP smoke를 제공한다. 같은 모듈의 loopback origin 검사를 두 로컬 브라우저 하네스가 재사용해 합성 session의 운영 전송을 막는다. `tests/test_site_network.py`는 외부 요청 없이 CONNECT 거부·성공 경로·실패 분류/exit·비밀값 비노출을 검사한다. [플랫폼 제한과 최소 관리자 조치](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크).

### 인증

`GoogleProvider → src/entities/user auth.server callbacks → user repository sync/role resolve → JWT token → session.user.{role,isSuperuser}`

### 작업 화면 조회

`app/tasks/page.tsx → database readiness → 현재 viewer DB identity → 허용 project/배정 user 조회 → scoped task/submission 조회 → 가시 submission id+viewer로 comment/attachment 조회 → 요약/선택 상세 UI`

- `submission-repository`의 `SubmissionVisibilityFilter`는 필수 인자다. 단건은 `getSubmissionByIdForViewer`를 쓴다.
- comment/attachment project 조회는 필수 `IdScope`(`src/shared/server/query-scope`)를 받는다. 화면은 가시 submission id 집합을 넘기므로 비공개 제출물의 파생 데이터가 client props에 실리지 않는다. 파기·삭제 등 관리 경로만 `{ unrestricted: true }`를 명시한다.

### 쓰기

`form → app/**/actions.ts adapter → src/features/* use-case → entity repository/file/log/revalidate → redirect`

`app/tasks/actions.ts`는 `"use server"` adapter이고 실제 task/submission/comment mutation은 `src/features/task-workspace`에 있다. 프로젝트 생성·수정·파기는 `app/admin/projects/actions.ts` → `src/features/project-manage` 한 경로만 사용한다(QLT-010). 사용하지 않던 task-workspace 프로젝트 action 3개를 제거했으며 `/tasks`, `/admin/projects`의 사용자 URL은 유지한다. 프로젝트 파기는 지정 프로젝트 관리자/SU의 확인 값과 현재 scope·파일 정리를 거친다.

### 프로젝트 종료·파기

`/admin/projects 종료 및 파기 확인 → 프로젝트 연결 제출물·첨부·태스크 경로 선조회 → project DELETE/FK cascade → UPLOAD_DIR 저장 파일·빈 태스크 디렉터리 정리 → 구조화 결과 로그`

프로젝트 종료일만으로 자동 삭제하지 않는다. 관리자가 산출물 인계와 별도 보존 의무를 확인한 뒤 명시적으로 실행하며, 공유 사용자 계정과 단기 운영 로그는 프로젝트 데이터와 별도 수명주기로 관리한다.

### DB 초기화

`/admin/database → app/admin/database/actions.ts adapter → src/features/database-manage → initializeDatabaseSchema() → native-migrations.server.ts`

Native는 전용 schema 연결의 lock/불변 명세·postcondition 검증과 `schema_migrations` ledger를 사용한다. Sites는 runtime DDL 없이 `db/schema.ts`와 `drizzle/`를 사용한다. [운영 진입점](#native-migration-진입점-qlt-012013).

## 4. 문서 탐색

읽기 순서와 유일한 문서 등록부는 [AGENTS](../AGENTS.md#읽기-순서와-문서-책임)가 소유한다. 이 지도는 코드 위치만 설명하고 문서 목록이나 검증 수치를 복제하지 않는다.

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

## 6. 문서 진입점

읽기 순서와 유일한 역할 등록부는 [AGENTS](../AGENTS.md#읽기-순서와-문서-책임)를 따른다. 이 문서는 코드 위치만 관리한다.

## 7. 권위 자료 우선순위

1. 실제 코드와 `package.json`/lockfile
2. `src/shared/server/database-admin`의 실제 DDL
3. 운영 문서(`AGENTS.md`, 이 문서, `ARCHITECTURE.md`, `HARNESS_MAP.md`)
4. `docs/`의 계획/이력 문서

문서와 코드가 다르면 차이를 기록하고 코드를 근거로 운영한다.

## Sites Worker 빌드 진입점

- `vite.config.mts`, `sites/worker.ts`: 기존 App Router를 Worker 산출물로 빌드한다. Google/NextAuth와 MUI는 유지한다.
- `scripts/test-sites-auth.mjs`: 빌드 산출물을 workerd에서 실행하는 인증/익명 접근 계약. 가상 테스트 설정만 사용한다.
- `docs/ARCHITECTURE.md#사이트-실행과-인증`: 통과 범위와 운영 검증의 남은 단계.


## D1/R2 및 실패 복구

- `db/schema.ts`, `drizzle/`: 업무/제출/버그·명단/활동팀과 감사·저장 객체 정리 ledger, cascade/staging trigger. 배포된 migration은 수정하지 않고 추가한다.
- `src/shared/server/hosted-runtime`: request-scoped D1/R2 binding. MariaDB 실행 경로와 분리한다.
- `src/shared/server/object-cleanup`: 참조 중 객체 삭제 거부, 지연 재시도/backoff, 만료된 staging 객체 복구.
- `src/entities/submission/api/submission-files.server.ts`: Worker에서는 known-length Blob을 R2에 전달하고 다운로드를 stream으로 읽는다. Node는 파일 저장소를 유지한다.
- `scripts/test-sites-{auth.mjs,storage.ts,http.mjs,browser.py}`: 인증·저장소·실제 Worker HTTP·시각 QA의 검증 경계를 구분한다.

## 관리자 운영 표시

- `src/shared/config/admin-runtime`: 비밀값 없는 runtime metadata로 hosted D1/R2·Sites 설정과 native MariaDB·파일 로그 안내를 분기한다. 인가나 환경 설정은 변경하지 않는다.
- `tests/admin-runtime.test.ts`: hosted / configured native / unconfigured native 표시 회귀. Worker HTTP suite는 `/admin`을 포함한 실제 역할별 SSR과 DB/log/user 안내를 확인한다.

- `scripts/verify-sites-crud.mjs`: HTTP suite의 실제 form/RSC action reference로 isolated CRUD lifecycle과 cross-user denied writes를 확인한다. 운영 데이터/계정을 사용하지 않는다.

## 버그 제보·리뷰 (OPS-027)

- `app/bugs`, `app/admin/bugs`: thin page adapters.
- `src/widgets/bug-reports`: MUI own queue/create/detail/history/admin triage; pending submit button.
- `src/features/bug-report-manage`: fresh authenticated actor, independent report rights, fixed redirect actions.
- `src/entities/bug-report`: bounded validation, SQL-scoped list/count/detail/events, immutable originals, atomic version/idempotency guarded events.
- `drizzle/0003_free_zarek.sql`: additive D1 report/archive migration. `src/shared/server/database-admin/bug-schema.server.ts`: matching native MariaDB schema.
- `scripts/test-bug-reports.ts` / `verify-bug-http.mjs`: D1 archive/concurrency and actual Worker HTTP authorization/validation.

- `scripts/check-rsc-decoder.mjs`: RSC 보안 패치 버전과 실제 Worker decoder fingerprint를 검사한다. 빌드 후 `npm run test:sites:decoder`.


### Native migration 진입점 (QLT-012/013)

`npm run db:migrate`(기본 read-only) / SU database action → `database-admin` → 전용 schema connection → `native-migrations.server.ts` lock/ledger/검증 → 불변 `native-migration-v1.ts`–`native-migration-v12.ts`. 일반 runtime readiness는 기존 DB identity를 사용한다. D1 `drizzle/`와 분리되며 봉사 저장 기반은 Native v10/Drizzle0014, 단일 팀장·완료 metadata는 v11/0015, 프로젝트 읽기 모드는 v12/0016에 추가한다. [운영 절차](NATIVE_DATABASE_MIGRATIONS.md).

P1 의존성: `src/entities/task/api/task-dependencies.server.ts`의 graph CAS와 `src/shared/server/task-dependencies`의 실행 guard, `src/features/task-dependencies` action, `src/widgets/task-dependencies` UI가 WBS와 별도 선후행을 담당한다. 상세 범위는 [P1 계획](ARCHITECTURE.md#팀-업무와-검토-계약).

P1 템플릿: `src/entities/task/model/task-templates.ts`의 versioned catalog와 `api/task-template.server.ts`의 원자적 application, `src/features/task-templates`, `src/widgets/task-templates`의 편집 미리보기를 사용한다.

P1 검색: `/search` → `src/widgets/work-search` → `src/entities/task/api/work-search.server.ts`. 버전 가시성·필터·건수·snippet은 같은 SQL relation에서 계산한다.

Native NAS 실행은 `scripts/run-next.ts`와 main의 기본 `build`/`start`를 사용한다. 명시적 Worker 빌드는 `build:sites`다. 환경·백업·migration·수동 인수는 [NAS 업데이트 안내](NAS_UPDATE_GUIDE.md)를 따른다.

## 버그 스크린샷 (2026-10-20)

`BugReportForm`은 선택/미리보기/제거/실패 보존을 담당한다. `entities/bug-report/api/screenshots.server.ts`가 검증/권한 조회/미참조 파일 정리를 제공하고 `shared/server/private-files`를 기존 submission 파일 IO와 함께 사용한다. `/api/bug-screenshots/[screenshotId]`는 비공개 bytes route다. Drizzle0013/native v9와 검증 진입점은 [첨부 기록](BUG_REPORTS.md#스크린샷)을 따른다.


### 제출물 최종 삭제 판정 (QLT-021)

`src/entities/submission/api/submission-repository.server.ts`의 `deleteSubmission`은 guarded DELETE/RETURNING의 요청 ID로 성공을 판정한다. `src/features/task-workspace/server/actions.ts`는 commit 이전 실패와 이후 followup 오류를 분리한다. `scripts/test-submission-delete.ts`는 실제 D1/MariaDB 비교·권한 변경·rollback, `tests/submission-delete-actions.test.ts`는 action fault injection, `scripts/verify-sites-crud.mjs`는 production Worker HTTP/redirect/audit/파일 경계를 검사한다. [분석과 실행 명령](ARCHITECTURE.md#제출물-삭제-결과와-후속-처리-qlt-021).

## 봉사활동 팀과 직접 완료

- `src/entities/project/model/workspace.ts`: 프로젝트 유형·활동 종류·팀 역할/완료 모드 타입과 저장 command 정규화.
- `src/entities/project/api/project-workspace.server.ts`: SU 프로젝트 명단/접근 모드·지정 관리자 팀 관리/단일 팀장 교체, `getProjectTaskTeams`의 metadata·범위별 배정 명단 조회, workspace CAS·명단 event. `/admin/projects` → `features/project-manage` → `widgets/project-workspace`가 유형·참여자·팀 관리 UI를 조립한다.
- `src/shared/server/task-scope`와 `src/entities/task/api/task-permissions.server.ts`: 현재 canonical 팀장·프로젝트/팀 소속·계정 자격의 SQL 관리/실행/배정 guard. task repository/workflow·선후행·템플릿·검토의 각 mutation이 사용한다.
- `/tasks` → `TaskAssignmentFields`/`TaskCard`: 팀 필터·범위별 생성/편집/담당자·완료 방식·완료자/시각과 event 이력. 기존 제출 UI는 직접 완료에서도 선택적으로 재사용한다.
- `native-migration-v10.ts`/`native-migration-v11.ts`는 database-admin slice, D1은 `drizzle/0014_volunteer_workspace.sql`/`drizzle/0015_volunteer_team_completion.sql`; readiness는 같은 slice의 실제 관리표/필수 컬럼을 사용한다.
- `scripts/test-project-workspace.ts`, `scripts/test-volunteer-schema.ts`: 저장 기반 검증. `scripts/test-volunteer-tasks.ts`/`test-volunteer-completion-schema.ts`/`test-volunteer-browser.mjs`·`.py`는 후속 양 DB·단일 팀장/완료 metadata·hydrated UI를 검사한다. 실제 결과는 [하네스](HARNESS_MAP.md#봉사활동-팀장과-직접-완료-검증)가 소유한다.

## 프로젝트 중심 UX와 접근 scope

- `src/shared/server/project-scope`: 현재 DB identity/role·활성 소속·설정된 SU와 `legacy_authenticated`/`members_only` 읽기/관리 SQL guard. `project-repository.server.ts`의 viewer-aware 목록·단건·건수/관리 목록, task/submission/댓글/첨부·검색·알림이 재사용한다.
- `app/page.tsx`/`app/tasks/page.tsx`: viewer 프로젝트 목록·요약에서 기존 `/tasks` project/task/submission query로 상세 선택. `TaskSummaryCard`·`TaskCard`·`TaskSubmissionPanel`이 요약/선택 상세·댓글을 나눈다.
- `src/shared/ui/field-label`·`validated-text-field.tsx`, `TaskStatusForm`·`TaskDateFields`·`DeleteConfirmation`: 외부 필수/선택 표시, 상태 조건 메모, 날짜/오류, 명시적으로 연 뒤의 영구 삭제 확인. 별도 일괄 삭제는 아니다.
- `native-migration-v12.ts`/`drizzle/0016_project_access_mode.sql`: 기존 인증 읽기를 보존하는 additive 접근 모드. `project-workspace.server.ts`의 SU 영향 미리보기/hash·CAS가 실제 전환을 검사한다.
- `scripts/test-project-binding.ts`, `test-project-ux.mjs`·`.py`·`test-project-ux-native.mjs`: 양 DB scope/로컬 브라우저 진입점. 최신 실행 여부와 실제 결과는 [하네스](HARNESS_MAP.md#ux-바인딩-구현과-회귀-검증)가 소유한다.


## 프로젝트 보고서 구현 진입점

D0–D4의 소스·로컬/compiled 인수와 실제 화면/운영 활성화를 구분하며 현재 진행/검증은 [TODO](TODO.md)·[HARNESS_MAP](HARNESS_MAP.md#남은-품질과-digest-구현-진행)을 따른다. 경로 존재가 운영 활성화나 외부 발송을 뜻하지 않는다.

- `/admin/projects/[projectId]/reports` → `app/admin/projects/[projectId]/reports/page.tsx` → `src/widgets/project-report-admin`: 현재 프로젝트 관리 scope의 미리보기·생성·내 기록/다운로드 화면.
- `src/entities/project-report/model/snapshot.ts`와 `api/collector.server.ts`·`ledger.server.ts`: versioned snapshot, bounded/current-viewer 수집, schedule/run/artifact CAS·lease·idempotency.
- `src/features/project-digest-generate`: session viewer·현재 scope 재검사, 생성/재시도·download/retention·비활성 기본 scheduler use-case. `src/features/project-report-export`: 동일 snapshot의 직접 DOCX/PPTX Buffer 생성.
- `app/api/projects/[projectId]/reports/{preview,schedules,retention}`·`app/api/project-reports`·`app/api/project-reports/[artifactId]`·`app/api/project-reports/runs/[runId]/retry`는 얇은 HTTP adapter다. machine adapter는 `/api/internal/project-digests/run`이며 기존 cookie를 scheduler 권한으로 쓰지 않는다.
- `src/shared/server/report-storage`는 private Native/R2 IO·hash/size·symlink/path 검사와 가역 quarantine, `native-migration-v14.ts`/`drizzle/0017_project_report_ledger.sql`은 새 ledger 명세를 소유한다. D5 delivery adapter는 없다.


## 활동팀 공통 준비표

`app/projects/[projectId]/teams/page.tsx`는 현재 viewer 허용 팀 요약을100팀/cursor 단위로 표시하고 `[teamId]/preparation/page.tsx`가 준비표 상세를 연다. `/tasks`의 현재 프로젝트와 관리자 team card는 이 경로로 진입한다. `src/widgets/team-preparation`은 종류별 읽기/편집·이력 UI를 조립한다.

`src/entities/team-preparation/model/preparation.ts`·`api/preparation.server.ts`는 활동 종류별 문서 검증/식사량·현재 scope·CAS/immutable revision을, `src/features/team-preparation/server/http.ts`와 `app/api/projects/[projectId]/teams/[teamId]/preparation/route.ts`는 bounded GET/PUT adapter를 소유한다. meal optional 정규화/nullable 계산은 이 model이 소유하고 `src/widgets/team-preparation`·`src/widgets/project-portal/ui/ProjectPresentation.tsx`는 editor/read/공유의 기본 접힌 선택 상세를 표시한다. 활동 종류 공통 값은 `src/shared/config/activity-kinds.ts`, schema는 `native-migration-v15.ts`/`drizzle/0018_team_preparation_sheets.sql`에 있다. 삭제 endpoint는 없으며 구현/검증/미게시 여부는 [TODO](TODO.md)·[HARNESS_MAP](HARNESS_MAP.md#활동팀-공통-준비표-구현-검증)을 따른다.


## 역할별 웹 사용설명서

`app/guide/page.tsx` → `[role]/page.tsx` → `[role]/[feature]/page.tsx`는 공통 시작·역할·기능별 공개 정적 설명을 조립한다. `src/entities/user-guide/model/guide.ts`는5역할의 기능별 단계·예시·저장 확인·오류 대응을 소유한다. media를 포함한12기능/50유효 조합·공개56페이지의 안내를 제공한다. `src/widgets/user-guide`의 GuidePages/GuideFrame/GuideScreenshots와 `model/screenshots.ts`가 화면·실제 캡처 manifest를 연결하며 AppShell 상단44px 책 아이콘/Drawer 사용설명서로 진입한다.

설명은 DB/계정 자료를 조회하지 않고 설명용 역할/기능 조합만 검증하며 잘못된 경로는404다. 역할 선택은 실제 계정·소속·자료 권한을 바꾸지 않고 기존 서버 인가/API는 유지한다. 공개 설명의 SU 예시는 다른 역할의 실제 접근 성공 증거가 아니다. 실제 캡처는 검수된 Git 자산에서 `public/guide/screenshots`로 수신했고 `model/screenshots.ts` manifest가 검수된 원본·캡처 버전/alt/caption/크기·역할 예시를 연결한다. 과거 전송 실패와 새 수신·루트 검수/Worker strict 통과와 운영 브라우저 잔여는 [TODO](TODO.md)·[하네스](HARNESS_MAP.md#가이드-스크린샷-git-수신과-검수)에서 구분한다. 기존 [팀 업무 안내](TEAM_WORKFLOW_GUIDE.md)와 [교육 자료 제작 안내](manual/USER_MANUAL.md)를 재사용한다.


공통 browser origin guard는 `src/shared/server/request-origin/index.server.ts`, Worker ingress의 불변 ALS context는 `src/shared/server/hosted-runtime/index.server.ts`·`sites/worker.ts`가 소유한다. `sites/public-origin.json`은 공개 siteID/origin pin이며 `vite.config.mts`가 `.openai/hosting.json`과 project ID 일치/정확 HTTPS origin을 검사한다. secret/env 설정 대체가 아니고 [Origin 계약](ARCHITECTURE.md#활동팀-공통-준비표-설계)을 따른다.

## 독립 프로젝트 포털 구현 계획

`app/projects/page.tsx`는 엄격한 내 프로젝트 목록, `app/projects/[projectId]/layout.tsx`와 `page.tsx`는 현재 프로젝트/전환 링크·전체폭 본문·유형별 홈이다. 메뉴는 AppShell의 top Drawer로 통합하며 고정 aside/15rem grid를 제거했다. `activities/page.tsx`·`activities/[teamId]/page.tsx`, `media/page.tsx`, `settings/page.tsx`가 팀 목록/상세·미디어·설정으로 연결하며 기존 WBS 링크는 유지한다. `src/widgets/project-portal`·`src/features/project-portal`이 shell/presentation과 서버 조립, `src/entities/project-presentation`·`src/features/project-presentation`이 selected immutable 준비표 revision publication을 소유한다.

`src/entities/project-media`·`src/features/project-media`·`src/widgets/project-media`는 미디어 검증/저장·HTTP·gallery를 맡고 `app/api/projects/[projectId]/teams/[teamId]/media`의 목록/업로드·`[mediaId]`·`[mediaId]/file`과 presentation API에 연결한다. 새 strict gate는 `src/shared/server/project-portal-scope`, 기존 legacy WBS scope는 `src/shared/server/project-scope/index.server.ts`로 분리한다. 활동 종류는 `src/shared/config/activity-kinds.ts`, Native v16/v17·D1 0019/0020·`db/schema.ts`는7개 신규 표 명세를 소유하며 실제 Native/운영 적용 성공을 뜻하지 않는다. Native 호환 구현과 사용자 담당 NAS 실행 검증을 분리하고 이번 Sites 완료 게이트에 Native 실행을 요구하지 않는다.

`app/projects/[projectId]/teams/page.tsx`·`[teamId]/preparation/page.tsx`, `src/entities/team-preparation`·`src/features/team-preparation`·`src/widgets/team-preparation`의 식사/레크 준비표를 재사용한다. 기존 Native/D1 migration과 private file IO의 실제 명세가 저장 계약을 소유한다. 현재 역할/파일 계약을 참조하며 실제 route/실행 결과와 계획을 구분한다. 단계/현재 진행은 [TODO](TODO.md)·[MASTER_PLAN](MASTER_PLAN.html#project-portal)을 따른다.

레크레이션 시간표의 순수 날짜/겹침/segment/lane helper는 `src/entities/team-preparation/model/timetable.ts`와 slice index가 소유한다. `src/features/recreation-timetable`의 public index/`ui/RecreationTimetable.tsx`를 기존 `TeamPreparationEditor`·`ProjectPresentation`이 재사용하며 서버/API·문서 normalizer는 변경하지 않는다. 날짜 입력은 편집 form 밖이고 기존 입력·홈3개 요약은 유지한다.

# WBSCowork 아키텍처

## 1. 시스템 경계

WBSCowork는 Next.js 16 App Router 단일 애플리케이션이다. UI, Server Components, Server Actions, Route Handlers가 같은 배포 단위에서 동작하고 MariaDB 및 로컬/NAS 파일 저장소를 직접 사용한다.

```text
Browser
  ├─ React 19 + MUI + frappe-gantt client leaf
  └─ Next.js navigation/forms/download
        ↓
Root app/ adapters (page/layout/action/route)
        ↓
src/widgets/features/entities/shared public API
        ├─ MariaDB
        ├─ UPLOAD_DIR
        └─ LOG_DIR
```

현재 별도 REST API 계층, ORM, test runner, background worker, migration framework는 없다.

## 2. Next.js 렌더링과 조립

- `app/layout.tsx`: global CSS, frappe-gantt CSS, provider와 `AppShell` 조립.
- `app/page.tsx`: 로그인 전 readiness 안내; 로그인 후 선택 프로젝트 Gantt/태스크 요약.
- `app/privacy/page.tsx`: 로그인 없이 접근 가능한 개인정보 처리·보유·프로젝트 종료 파기 안내.
- `app/tasks/page.tsx`: `dynamic = "force-dynamic"`; 세션과 DB readiness 확인 후 workspace 조립.
- 관리자 page도 서버에서 권한을 검사한다. 민감 route는 UI 메뉴 노출과 독립적으로 fail closed해야 한다.
- 동적 params/searchParams는 Next.js 16 패턴에 맞게 Promise를 await한다.
- 브라우저 API가 필요한 Gantt/focus/provider/UI leaf만 client component로 둔다.

## 3. 인증·인가

### 인증

`src/entities/user/api/auth.server.ts`가 NextAuth v4 설정의 단일 중심이다.

1. Google OAuth가 설정된 경우 provider 활성화.
2. sign-in callback이 DB user를 sync하고 action log 기록.
3. JWT callback이 email, DB role, env 기반 `isSuperuser`를 넣음.
4. session callback이 이를 `session.user`에 노출.

슈퍼관리자는 별도 DB role이 아니라 `SUPERUSER_EMAIL`과 session flag로 표현된다. DB row의 role은 `admin|member|guest`다.

### 권한 정책

- write: `isSuperuser || admin || member`
- admin panel: `isSuperuser || admin`
- all submissions: `isSuperuser || admin`
- DB/log/settings: route와 action 양쪽에서 `isSuperuser`
- admin actor의 역할 부여: `guest|member`; superuser는 `guest|member|admin`

인가를 UI props로만 구현하지 않는다. action/handler에서 actor, target resource, ownership/visibility를 확인한다.

## 4. 산출물 가시성 경계

의도된 정책은 다음과 같다.

```text
public  → 모든 인증 사용자
private → author OR admin/superuser
```

`src/entities/submission`의 목록 함수는 `SubmissionVisibilityFilter`로 SQL에 조건을 붙인다. 하지만 안전한 경계는 제출물 row에서 끝나지 않으므로 다음 네 지점을 모두 질의 수준에서 막는다.

- comments는 부모 submission이 보이는 경우에만 노출
- attachment metadata와 binary도 부모 submission이 보이는 경우에만 노출
- 단건 조회/download는 viewer-aware repository 사용
- update/delete는 write role과 별도로 author/admin ownership 확인

### 적용 방식 (2026-09-05)

| 경계 | 계약 |
| --- | --- |
| 제출물 목록 | `listSubmissionsByProject/ByTask(id, filter)` — `filter`는 필수. 관리 경로만 `{ canSeeAll: true }`를 명시한다. |
| 댓글 목록 | `listCommentsByProject(projectId, scope)` — `scope`는 필수 `IdScope`. 화면은 가시 제출물 id(`{ ids }`), 파기 경로만 `{ unrestricted: true }`. |
| 첨부 목록 | `listAttachmentsByProject(projectId, scope)` — 위와 동일. |
| 단건 조회 | `getSubmissionByIdForViewer(id, filter)`가 공개 범위를 SQL에 적용한다. `getSubmissionById`는 unscoped이며 actor 권한을 이미 검증한 mutation 경로 전용이다. |
| mutation ownership | `src/features/task-workspace`의 `requireVisibleSubmission` / `requireOwnedSubmission` / `requireOwnedComment`가 project → task → submission → comment 상위 관계를 서버에서 재확인하고 작성자 본인 또는 `canManageAllSubmissions` actor만 통과시킨다. |

조회 범위 helper는 `src/shared/server/query-scope`의 `IdScope`, `buildIdScopeClause`, `isEmptyIdScope`다. 안전한 기본값을 두지 않아, 새 호출부가 범위를 명시하지 않으면 타입 검사에서 걸린다.

볼 수 없는 자원은 "권한 없음"이 아니라 "찾을 수 없음"과 같은 응답으로 처리해 id 열거로 존재 여부를 알아내지 못하게 한다.

UI에서 private card가 숨겨진다는 사실만으로 데이터가 보호된다고 판단하지 않는다. 이 경계를 만든 배경과 회귀 방지 수단은 [COMPLETED_LOG.md](COMPLETED_LOG.md)의 T-003~T-007에 있고, 남은 항목은 [TODO.md](TODO.md)에 있다.

## 5. 데이터 아키텍처

`src/shared/server/database-admin`이 현재 managed schema의 사실상 schema manager다.

| 테이블 | 핵심 컬럼 | 관계/삭제 |
| --- | --- | --- |
| `users` | email unique, role enum, Google/profile/login metadata | submission/comment author, task assignee |
| `projects` | name, start/end DATE | 삭제 시 tasks cascade |
| `tasks` | project_id, parent_id, dates, depth/order, assignee_id | parent/assignee SET NULL; submissions cascade |
| `submissions` | task_id, author_id, content, visibility, legacy file metadata | task/author cascade |
| `submission_attachments` | submission_id, path/name/MIME/size | submission cascade |
| `comments` | submission_id, author_id, content | submission/author cascade |

DB cascade는 파일 삭제를 하지 않는다. 삭제 action은 DB 삭제 전 경로를 모으고 이후 저장 파일을 정리하지만 실패 복구/transaction 경계를 별도로 고려해야 한다.

프로젝트 종료·파기는 `end_date` 도래만으로 자동 실행하지 않는다. 관리자가 `/admin/projects`에서 파기 확인을 명시한 경우 project 삭제와 FK cascade를 실행하고, 선조회한 legacy/multi-attachment 경로의 실제 파일과 빈 태스크 디렉터리를 함께 정리한다. 사용자 계정은 여러 프로젝트에서 공유될 수 있으므로 project cascade 대상이 아니며, 참여 목적이 모두 종료된 뒤 별도 계정 파기 절차가 필요하다. 운영 로그는 `LOG_RETENTION_DAYS`에 따라 만료 삭제된다.

### 스키마 운영 제약

- fresh install: `CREATE DATABASE IF NOT EXISTS`, 6개 table 생성.
- existing DB: users/submissions의 일부 컬럼만 INFORMATION_SCHEMA로 확인해 `ALTER ADD`; users role enum 보정.
- versioned migration/rollback 이력은 없다.
- admin schema 작업과 정상 runtime pool이 같은 `DB_*` credential을 사용한다.

스키마 변경은 idempotent upgrade, 기존 데이터 backfill, FK/index, 최소권한 계정 분리를 설계해야 한다.

## 6. 파일·로그

- `src/entities/submission/api/submission-files.server.ts`: `UPLOAD_DIR`, 크기 제한, 안전한 경로 해석, 읽기/삭제.
- `next.config.ts`: 업로드 최대치 + 2MB로 Server Action body limit 계산.
- 다운로드는 `getSubmissionByIdForViewer`로 부모 제출물의 public/작성자/admin 가시성을 질의에 적용하고 `Cache-Control: private, no-store`, length/type/disposition을 반환한다.
- `src/shared/server/logging` 및 `instrumentation.ts`: `LOG_DIR` 롤링 로그와 구조화 action log.
- action log metadata의 경로성 키(`filePath`, `storedFilePath`, `absolutePath`, `uploadDir`, `path`)는 기록 시 `[redacted]` 또는 `[redacted]:<확장자>`로 축약된다(`REDACTED_METADATA_KEYS`). 비밀값·private content는 애초에 metadata에 담지 않는다.

## 7. 목표 FSD

```text
app/          route adapter와 최종 조립 (계속 루트 유지)
src/widgets/  큰 UI 조립
src/features/ 사용자 use-case
src/entities/ 도메인 모델·정책·repository public API
src/shared/   도메인 비의존 UI/config/server utility
```

허용 의존은 `app → widgets → features → entities → shared`; 실제 이전은 역순이다. slice 외부는 `index.ts` 공개 API만 사용하고, server-only 소비자가 필요하면 `index.server.ts`를 두 번째 공개 API로 둔다. server-only API가 client graph에 들어가지 않게 한다.

`npm run check:fsd`(`scripts/check-fsd-boundaries.ts`)가 이 계약을 실행 가능한 게이트로 강제한다. 2026-08-12 기준 M0~M5가 완료되어 `src/shared`, `src/entities`, `src/features`, `src/widgets`가 실제 런타임 구조다.

## 8. 품질 속성 및 우선순위

1. **기밀성**: private submission의 파생 데이터와 파일까지 동일 필터.
2. **인가 일관성**: page/action/route 중 하나도 우회 경로가 되지 않음.
3. **데이터 무결성**: 날짜/FK/parent 구조, DB row와 파일 lifecycle.
4. **운영성**: APP_PORT, env readiness, DB 검증, rolling log.
5. **점진성**: FSD 이동과 기능 변경 분리, URL/SQL/signature 보존.
6. **검증 가능성**: 현재 lint/build/db harness를 실제 실행하고 이후 focused policy tests를 추가.

## 9. 아키텍처 결정 기록이 필요한 변경

- project membership/owner 도입
- migration runner와 runtime/admin DB credential 분리
- attachment 저장 backend 변경
- NextAuth major upgrade/session 전략 변경
- `src/` FSD boundary checker 도입
- scheduler/report route 및 machine authentication 도입

이 경우 `docs/ARCHITECTURE.md`, `docs/PROJECT_MAP.md`, `docs/HARNESS_MAP.md`와 관련 `docs/` 계획을 함께 갱신한다.

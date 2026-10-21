# WBSCowork 구조와 결정

이 문서는 **왜 그렇게 정했고 경계가 어떻게 연결되는가**를 소유한다. 위치는 [PROJECT_MAP](PROJECT_MAP.md), 현재 상태는 [TODO](TODO.md), 검증 방법/결과는 [HARNESS_MAP](HARNESS_MAP.md), 운영은 [NAS_UPDATE_GUIDE](NAS_UPDATE_GUIDE.md)를 본다.

## 1. 시스템 경계

WBSCowork는 Next.js 16 App Router 단일 애플리케이션이다. UI, Server Components, Server Actions, Route Handlers가 같은 배포 단위에서 동작한다. Node 실행은 MariaDB 및 로컬/NAS 파일 저장소를, Sites 실행은 Vinext/Workers + D1/SQLite + 비공개 R2를 사용한다. Google NextAuth와 FSD 경계는 동일하다.

Sites의 실행 계약은 아래에, 검증 기준선은 HARNESS_MAP, 게시 이력은 COMPLETED_LOG에 둔다. MariaDB/파일 경로 설명은 Node 실행 경로다.

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

별도 REST API 계층은 없다. Node의 node:test 하네스를 유지하며 Sites는 Drizzle schema/migration과 Miniflare/workerd 검증을 추가한다. 애플리케이션 질의는 작은 prepared-query adapter를 통한다. Sites 런타임에서는 DDL이나 .env 편집을 실행하지 않는다.

### Sites 저장 경계

- `sites/worker.ts` → request-scoped `hosted-runtime` → D1/R2 bindings.
- DB parent/attachment 변경 및 task 계층 갱신은 atomic batch를 사용한다.
- R2 객체는 인증된 제출물/버그 download handler로만 읽으며 공개 URL을 제공하지 않는다.
- cascade/교체/중단 업로드는 durable cleanup ledger와 지연 재시도로 정리한다.
- 감사 상세는 D1의 제한된 보존 정책, console은 비민감 요약이다. 감사 저장 장애 시 상세 기록을 보장하지 않는 best-effort 정책을 명시한다.
- 앱의 superuser 설정 화면은 배포 설정 유무만 표시한다. 실제 secret 및 SUPERUSER_EMAIL은 소유자의 Sites 설정에서 관리한다.

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

UI에서 private card가 숨겨진다는 사실만으로 데이터가 보호된다고 판단하지 않는다. 이 경계를 만든 배경과 회귀 방지 수단은 [COMPLETED_LOG.md](COMPLETED_LOG.md)의 QLT-003~QLT-007에 있고, 남은 항목은 [TODO.md](TODO.md)에 있다.

## 5. 데이터 아키텍처

Native의 불변 version/checksum migration과 Sites의 Drizzle migration이 schema를 소유한다. 아래는 주요 관계 요약이며 전체 DDL 사본이 아니다.

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

- Native fresh install은 불변 v1 명세로 9개 domain table과 `schema_migrations` ledger를 만든다. Sites D1은 기존 `drizzle/` migration을 유지한다.
- Native는 DB별 연결 lock 아래 version/name/checksum과 schema postcondition을 확인하며 문서화된 누락 필드/FK만 추가한다. 기존 role/private/원문/이력은 보존한다.
- runtime/readiness는 `DB_*`, 명시적 native schema 변경은 `DB_SCHEMA_USER/DB_SCHEMA_PASSWORD`를 사용한다. 누락 시 runtime으로 대체하지 않는다. 실제 최소권한 계정 적용 여부는 별도 검증 대상이다.
- DDL은 암묵 commit되므로 transaction rollback/자동 down을 제공하지 않는다. 중단 시 현재 상태를 확인하고 재개/forward fix하며 성공 검증 후 ledger를 기록한다.

불변 명세·운영 적용·백업·실패 복구 계약은 [Native 운영](NATIVE_DATABASE_MIGRATIONS.md)을 따른다. 코드 구현이 실제 운영 migration/권한 적용 승인을 대신하지 않는다.

## 6. 파일·로그

- `src/entities/submission/api/submission-files.server.ts`: `UPLOAD_DIR`, 크기 제한, 안전한 경로 해석, 읽기/삭제.
- `next.config.ts`: 업로드 최대치 + 2MB로 Server Action body limit 계산.
- 다운로드는 `getSubmissionByIdForViewer`로 부모 제출물의 public/작성자/admin 가시성을 질의에 적용하고 `Cache-Control: private, no-store`, length/type/disposition을 반환한다.
- `src/shared/server/logging` 및 `instrumentation.ts`: `LOG_DIR` 롤링 로그와 구조화 action log.
- action log metadata의 경로성 키(`filePath`, `storedFilePath`, `absolutePath`, `uploadDir`, `path`)는 기록 시 `[redacted]` 또는 `[redacted]:<확장자>`로 축약된다(`REDACTED_METADATA_KEYS`). 비밀값·private content는 애초에 metadata에 담지 않는다.

## FSD 의존 경계

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

## 비공개 버그 제보 기록

bug_reports / bug_report_events는 프로젝트·작업·제출물과 독립적이며 프로젝트 파기나 audit_logs 보존 정리에 연동되지 않는다. reporter_id/actor_id는 계정 삭제 시 SET NULL이며 이후 동일 이메일 신규 계정에 기록 권한이 상속되지 않는다. SQL scope가 author id 또는 admin/superuser 판정을 적용하고 count/search/events도 같은 범위를 사용한다. 원문 UPDATE/일반 DELETE endpoint는 없다. 버전 검사와 operation-token NOT EXISTS 조건을 포함한 state UPDATE, event INSERT를 D1 batch/Node transaction으로 함께 수행한다. 변경 기록은 제보자에게도 표시된다.


### Native schema credential 경계 (QLT-013)

일반 readiness와 질의는 DB_* runtime identity를 유지한다. 명시적 schema 작업만 lazy DB_SCHEMA_USER/DB_SCHEMA_PASSWORD 연결을 쓰며 누락 시 runtime으로 대체하지 않는다. 값은 status/편집 UI로 보내지 않는다. Sites D1 runtime DDL 비활성은 유지한다. 실제 권한 적용 상태는 [native 운영 문서](NATIVE_DATABASE_MIGRATIONS.md)를 따른다.


### 제출물 삭제 결과와 후속 처리 (QLT-021)

`deleteSubmission`은 기존 current-role/ownership token guard와 atomic batch를 유지하고 마지막 DELETE의 `RETURNING id` rowset을 검증한다. D1 meta.changes는 FK/cleanup trigger 쓰기를 포함하므로 MariaDB affectedRows와 같은 부모 행 수로 쓰지 않는다. repository 성공 이후 파일 정리·화면 갱신·감사 기록은 별도 단계다. action은 커밋 이후 오류를 `submission.delete.followup`으로 기록하고 DB 삭제 완료 사실을 사용자에게 알린다. 실제 D1 변화 수는 부모/FK/trigger/조합에서 1/3/2/4, MariaDB affectedRows는 모두1이었다. 결과 rowset은 batch가 정상 commit 반환한 뒤에만 쓰며 통신 중단의 불확정 commit을 자동 성공/재시도로 바꾸지 않는다. 실패한 batch에서는 파일 정리를 시작하지 않고, metadata 삭제 후 파일 정리 실패는 재시도 대기·후속 오류로 알린다. 검증 명령/조건은 HARNESS_MAP이 소유한다.


## 팀 업무와 검토 계약

| 경계 | 확정 계약 |
| --- | --- |
| 담당/상태 | 새 담당·검토자는 현재 member/admin/SU여야 한다. 기존 guest 배정은 승급/삭제하지 않고 수행 불가로 표시한다. 카드 편집/재배정 권한과 현재 담당자/admin/SU의 상태 변경 권한은 별개다. planned/in_progress/blocked/review_pending/changes_requested/done을 사용한다. |
| 완료/재오픈 | 실제 담당자 제출·완료 기준·근거가 필요하다. 검토 필요 카드는 선택된 현재 제출 버전 승인 없이는 직접 완료하지 못한다. 시작 후 reviewRequired 변경을 막으며 재오픈 사유와 이전 판정은 보존한다. leaf만 완료 집계 분모에 넣고 날짜 경과율/부모 관계를 완료·선행으로 취급하지 않는다. |
| 버전 | 본문·visibility·자료 링크·첨부·변경 요약·실제 editor를 snapshot/첨부/event와 같은 transaction에 저장한다. expected revision/stable token/bytes hash로 충돌과 동일 재시도를 판정한다. 기존 남은 자료만 baseline으로 만들며 과거 덮어쓴 버전/편집 시각을 복원했다고 주장하지 않는다. 기존 댓글은 버전 미지정으로 구분한다. |
| 파일/가시성 | 첨부 제외는 새 버전이며 과거 파일을 물리 삭제하지 않는다. 현재 parent와 당시 revision 모두 보이는 경우에만 bytes·댓글·이력에 접근한다. HTTP(S) 자료 링크는 서버가 자동 조회하지 않는다. version은 자동 만료하지 않는다. |
| 검토 | 현재 담당자의 현재 제출 버전만 요청하고 지정 검토자만 결정한다. author/assignee/해당 revision editor는 admin/SU도 자체 승인할 수 없다. 상세 사유는 private 제출 이력에만 두고 공개 task event에는 고정 상태 안내만 기록한다. |
| 무효화/경합 | 보완한 버전은 새 버전 제출 후 다시 요청한다. 새 revision·완료 후 내용 변경·사유 있는 재오픈은 현재 선택/승인을 무효화하고 과거 판정은 남긴다. 상태·판정·event는 atomic version/token 검사로 한 번만 저장한다. 검토자가 권한을 잃어도 담당자/admin은 검토 취소 가능하다. |
| 개인 큐 | 내 담당/내 기여/내 검토 대기를 구분한다. 현재 역할/visibility를 count/list/link 모두 SQL에서 적용한다. URL queue filter/선택 위치를 작업 후 복귀 링크에 보존하고 외부 return URL은 거부한다. |
| 선후행 | 같은 프로젝트의 별도 graph CAS와 task version을 검사한다. 순환·다른 프로젝트 참조를 거부한다. 선행 미완료 시 시작·완료·검토 요청/판정을 보류하되 취소/재오픈은 허용한다. 선행 재오픈으로 과거 후행 승인을 덮지 않고 현재 차단을 따로 표시한다. 개별 업무 삭제 전 관계 해제가 필요하다. |
| 수동 템플릿 | versioned catalog, 최대20개, 기본 미배정, 상위 제외 시 하위 제외. 미리보기에서 제목/설명/산출물/기준/담당/날짜/포함을 편집한다. 파일·private 본문·접근권·검토 이력은 복사하지 않는다. stable token/payload로 원자적 생성하고 변경 payload 재사용은 거부한다. task를 나중에 삭제해도 receipt로 부활 생성을 막는다. |
| 검색 | 최신 기본, 승인본은 취소/무효화되지 않은 현재 선택 버전이다. 이전 버전은 parent와 당시 visibility를 함께 적용한다. count/list/snippet/pagination 전에 SQL scope를 걸고 LIKE %, _, !는 literal이다. 업무 카드는 기존 인증 사용자 공유 정책을 유지한다. |
| 알림 | 원본 배정/검토/댓글 event에서 현재 수신자·상태·역할·가시성으로 파생하고 읽음 receipt만 별도 저장한다. A→B→A 과거 배정을 재알림하지 않으며 중복 읽음은 한 행이다. 원래 작성자의 기존 private 조회권을 유지하고 외부 발송은 하지 않는다. |

account 파기 기능은 현재 없으며 향후 author cascade 전에 선택 검토 근거 무효화가 필요하다. task/submission 전체 영구 삭제는 모든 버전·파일을 포함한 확인을 받는다. 프로젝트는 기존 관리자 명시 확인을 유지한다. 새 이력 작성 후 구형 덮어쓰기 앱으로 writable rollback하지 않는다.

## 사이트 실행과 인증

- NextAuth4의 Babel/CommonJS default export를 Vite8에서 해석하기 위해 `legacy.inconsistentCjsInterop: true`를 유지한다. Google handler/provider·Secure/HttpOnly/SameSite cookie·CSRF·callback/state 검사를 대체하지 않는다.
- request-scoped D1/R2 binding, 100 bind parameter 한도에 다른 viewer 조건도 포함한 bounded IdScope 분할, UTC timestamp, atomic batch를 사용한다. runtime DDL/.env 편집은 금지한다.
- R2 저장은 기존 private-files IO를 쓰며 file bytes를 추가 전체 Buffer로 복제하지 않는 bounded hash/stream을 사용한다. staging lease는 cleanup backoff와 분리하고 정리 전에 영구 회수한다. 만료/회수한 업로드의 metadata commit은 DB guard가 거부한다. cleanup은 current·모든 revision·bug screenshot 참조를 확인한다.
- Worker 전체 요청은22MiB, `/bugs` 생성 multipart만7MiB, 그 외 bug 경로64KiB, bug action text48KiB, 동시 multipart1건이다. storage/DB 한쪽 실패는 새 미참조 파일만 정리하거나 durable queue로 남긴다.
- 감사 상세는 D1 audit_logs에 기본5일 보존한다. 새 기록 시 만료분 최대500행 정리, 조회 즉시 기간 밖 제외이며 idle 자동 삭제/secure erase를 보장하지 않는다. console은 비민감 요약이다.
- React/ReactDOM/react-server-dom-webpack19.2.8 direct decoder 경로를 사용한다. dependency 버전만으로 보안 패치를 판정하지 않고 compiled active decoder를 검사한다. 해당 advisory 해결을 전체 dependency audit 완료로 확대하지 않는다.

## 화면 구조

theme의 Container 기본은 xl(1536px), 긴 글 privacy/bug detail은 md다. AppShell은 xl 이상 한 행, md~xl 미만 별도 메뉴 행, md 미만 기존 Drawer를 쓴다. 메뉴 nowrap/비수축, 이름 칩 ellipsis+전체 title, 한국어 keep-all/긴 문자열 anywhere를 유지한다. shape.borderRadius는4px 단위이며 sx 숫자는 배수다. 업무 집중/복귀 맥락과 간트 내부 가로 스크롤을 보존한다. 개요·작업 화면은 간트를 중심으로 배치하며 light/dark 모두 선택 카드·중첩 패널·업로드 상태의 대비를 유지한다. 공통 SubmitButton의 pending 표시는 서버 중복 방지·인가를 대신하지 않는다.

## 결정 색인

| 결정 | 이유/불변식 | 근거/위치 |
| --- | --- | --- |
| 루트 app + FSD public API | framework entry와 업무 구현을 분리하고 private 데이터의 client 전이 유출 방지 | 이 문서 FSD 경계, check-fsd-boundaries |
| 현재+과거 SQL visibility | 과거 public이 현재 private를 공개하거나 담당 배정이 열람권을 늘리지 않음 | 이 문서 산출물/팀 계약 |
| immutable revision + atomic token | 원본/피드백 보존과 동일 재시도·충돌 분리 | submission-revision 및 task workflow |
| staging lease와 cleanup backoff 분리 | cleanup retry가 만료된 업로드 권한을 되살리지 않음 | object-cleanup, Drizzle0008 |
| DELETE RETURNING id (QLT-021) | D1 cascade/trigger 총 변경 수와 직접 삭제 부모를 분리 | 이 문서 QLT-021, test-submission-delete |
| main/sites 실행 분리 | 코드 공통 수정과 NAS/Sites 데이터·build·배포 경계 분리 | NAS_UPDATE_GUIDE |
| schema credential/불변 ledger | runtime의 DDL 권한/자동 rollback에 의존하지 않음 | NATIVE_DATABASE_MIGRATIONS |
| 기존 정본 갱신 | 새 기능/날짜별 보고서 대신 역할별 한 곳에 사실을 소유 | AGENTS 등록부; Git 과거 원문 복구는 COMPLETED_LOG |

### FSD 검사 사양


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

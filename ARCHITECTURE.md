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
lib auth/policy orchestration + repositories
        ├─ MariaDB
        ├─ UPLOAD_DIR
        └─ LOG_DIR
```

현재 별도 REST API 계층, ORM, test runner, background worker, migration framework는 없다.

## 2. Next.js 렌더링과 조립

- `app/layout.tsx`: global CSS, frappe-gantt CSS, provider와 `AppShell` 조립.
- `app/page.tsx`: 로그인 전 readiness 안내; 로그인 후 선택 프로젝트 Gantt/태스크 요약.
- `app/tasks/page.tsx`: `dynamic = "force-dynamic"`; 세션과 DB readiness 확인 후 workspace 조립.
- 관리자 page도 서버에서 권한을 검사한다. 민감 route는 UI 메뉴 노출과 독립적으로 fail closed해야 한다.
- 동적 params/searchParams는 Next.js 16 패턴에 맞게 Promise를 await한다.
- 브라우저 API가 필요한 Gantt/focus/provider/UI leaf만 client component로 둔다.

## 3. 인증·인가

### 인증

`lib/auth.ts`가 NextAuth v4 설정의 단일 중심이다.

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

`submission-repository.ts`의 목록 함수는 `SubmissionVisibilityFilter`로 SQL에 조건을 붙인다. 하지만 안전한 경계는 제출물 row에서 끝나지 않는다.

- comments는 부모 submission이 보이는 경우에만 노출
- attachment metadata와 binary도 부모 submission이 보이는 경우에만 노출
- 단건 조회/download는 viewer-aware repository 또는 조회 후 policy check 필요
- update/delete는 write role과 별도로 author/admin ownership 확인 필요

### 현재 확인된 보안 부채

1. `app/tasks/page.tsx`는 submissions만 visibility-filtered이고 comments/attachments는 프로젝트 전체를 조회한다.
2. 두 attachment Route Handler는 로그인만 확인하고 부모 submission visibility를 확인하지 않는다.
3. `getSubmissionById`는 unscoped 단건 조회이므로 사용자 응답 경계에서 직접 사용하면 안 된다.
4. task actions의 일부 mutation은 쓰기 역할만 확인하므로 작성자 ownership 정책을 별도로 감사해야 한다.

따라서 UI에서 private card가 숨겨진다는 사실만으로 데이터가 보호된다고 판단하지 않는다.

## 5. 데이터 아키텍처

`lib/database-admin.ts`가 현재 managed schema의 사실상 schema manager다.

| 테이블 | 핵심 컬럼 | 관계/삭제 |
| --- | --- | --- |
| `users` | email unique, role enum, Google/profile/login metadata | submission/comment author, task assignee |
| `projects` | name, start/end DATE | 삭제 시 tasks cascade |
| `tasks` | project_id, parent_id, dates, depth/order, assignee_id | parent/assignee SET NULL; submissions cascade |
| `submissions` | task_id, author_id, content, visibility, legacy file metadata | task/author cascade |
| `submission_attachments` | submission_id, path/name/MIME/size | submission cascade |
| `comments` | submission_id, author_id, content | submission/author cascade |

DB cascade는 파일 삭제를 하지 않는다. 삭제 action은 DB 삭제 전 경로를 모으고 이후 저장 파일을 정리하지만 실패 복구/transaction 경계를 별도로 고려해야 한다.

### 스키마 운영 제약

- fresh install: `CREATE DATABASE IF NOT EXISTS`, 6개 table 생성.
- existing DB: users/submissions의 일부 컬럼만 INFORMATION_SCHEMA로 확인해 `ALTER ADD`; users role enum 보정.
- versioned migration/rollback 이력은 없다.
- admin schema 작업과 정상 runtime pool이 같은 `DB_*` credential을 사용한다.

스키마 변경은 idempotent upgrade, 기존 데이터 backfill, FK/index, 최소권한 계정 분리를 설계해야 한다.

## 6. 파일·로그

- `lib/submission-files.ts`: `UPLOAD_DIR`, 크기 제한, 안전한 경로 해석, 읽기/삭제.
- `next.config.ts`: 업로드 최대치 + 2MB로 Server Action body limit 계산.
- 다운로드는 `Cache-Control: private, no-store`, length/type/disposition을 반환한다.
- `lib/logger.ts` 및 `instrumentation.ts`: `LOG_DIR` 롤링 로그와 구조화 action log.
- 파일 경로·비밀값·private content를 로그 metadata에 남기지 않는 방향으로 보강해야 한다.

## 7. 목표 FSD

```text
app/          route adapter와 최종 조립 (계속 루트 유지)
src/widgets/  큰 UI 조립
src/features/ 사용자 use-case
src/entities/ 도메인 모델·정책·repository public API
src/shared/   도메인 비의존 UI/config/server utility
```

허용 의존은 `app → widgets → features → entities → shared`; 실제 이전은 역순이다. slice 외부는 `index.ts` 공개 API만 사용하고 server-only API가 client graph에 들어가지 않게 한다. 현재 `src/`와 `check:fsd` script는 미구현이다.

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

이 경우 `ARCHITECTURE.md`, `PROJECT_MAP.md`, `HARNESS_MAP.md`와 관련 `docs/` 계획을 함께 갱신한다.

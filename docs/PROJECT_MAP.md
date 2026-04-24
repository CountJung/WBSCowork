# Project Map

> **이전 이름**: `HARNESS_MAP.md` (루트에서 `/docs/PROJECT_MAP.md`로 이동)  
> 앞으로 모든 서브 문서는 `/docs/` 디렉터리에서 관리합니다.

이 파일은 설정·검증·미해결 블로커를 추적하는 살아있는 실행 맵입니다.
명령, 스크립트, 의존성, 품질 게이트가 바뀔 때마다 업데이트하십시오.

## 현재 목표

- Stage 7 제출물 첨부 플로우 구현 및 검증 완료.
- 구조화 사용자 행동 로깅, 관리자 로그 검토, APP_PORT 빌드/시작 스크립트, 집중 태스크 라우팅, Gantt 우선 레이아웃 구현 완료.
- 홈은 선택한 프로젝트 Gantt와 태스크 목록 중심으로 단순화.
- 파일 로깅·환경변수 편집 관리자 세팅 완료.
- `/logs`에 환경변수 기반 롤링 파일 로그 저장.
- 슈퍼유저 로그인 및 관리자 전용 DB 관리 라우트 완료.
- 반응형 앱셸, 라우트 내비게이션, 3-모드 테마 스위칭 완료.
- **역할 시스템 확장 (현 스프린트)**:
  - 슈퍼관리자(env) / 관리자(admin 역할) / 일반사용자(member) / 게스트(guest) 4단계
  - 제출물 공개/비공개(visibility) 타입 추가
  - 관리자 역할은 `/admin`, `/admin/logs`, `/admin/settings` 접근 가능 (DB·사용자 관리 제외)
  - 일반사용자·게스트는 공개 제출물만 조회 가능, 일반사용자는 본인 비공개도 조회 가능

## Live Rules

- 경고나 오류를 무시하지 않는다.
- 실패한 명령이나 블로커는 반드시 기록하고 다음 조치를 명시한다.
- 이 파일을 TODO.md 및 `.github/copilot-instructions.md`와 동기화한다.
- `.env`, `.env.local`, `.env.*` 파일을 AI 작업 컨텍스트나 리뷰 입력으로 사용하지 않는다.

## 커맨드 하네스

| 범위 | 커맨드 | 기대 결과 | 상태 |
| --- | --- | --- | --- |
| Bootstrap | `npx create-next-app@latest wbs-task-bootstrap --ts --app --eslint --use-npm --import-alias "@/*" --no-tailwind --no-src-dir --disable-git --yes` | Next.js 워크스페이스 생성 및 루트 이동 | 완료 |
| Debug | `npm run dev:debug` | Node 인스펙터 활성화된 Next.js dev 서버 시작 | Ready |
| Debug | VS Code `Next.js: debug full stack (Chrome popup)` | dev 서버 + Chrome 팝업 동시 실행 | Ready |
| Database Env | `npm run db:check -- --validate-only` | DB env 검증 (실 연결 없이) | 완료 |
| Database Connect | `npm run db:check` | MariaDB 연결 성공 (DB 존재 시) | 관리자 초기화 필요 |
| Admin Auth | `SUPERUSER_EMAIL` 계정으로 Google 로그인 | 슈퍼유저 세션 수신, `/admin` 접근 가능 | 빌드·라우트 연결로 확인 |
| Admin DB | `/admin/database` | 슈퍼유저가 DB·테이블 생성 트리거 가능 | 빌드·라우트 연결로 확인 |
| Admin Settings | `/admin/settings` | 슈퍼관리자·관리자가 로그 정책·환경변수 편집 가능 | 린트·빌드 확인 |
| Admin Logs | `/admin/logs` | 슈퍼관리자·관리자가 구조화 로그 및 파일 로그 꼬리 검토 | Ready |
| Auth Persistence | DB 초기화 후 Google 로그인 | 로그인 사용자가 `users` 테이블에 upsert | 빌드·라우트 연결로 확인 |
| User Roles | `/admin/users` | 슈퍼유저가 `guest/member/admin` 역할 변경 (SUPERUSER_EMAIL 예약) | 린트·라우트 연결로 확인 |
| Task CRUD | `/tasks` | 인증 사용자가 프로젝트 태스크 조회, `member/admin/superuser`가 생성·수정·삭제 | 린트·라우트 연결로 확인 |
| Submission Visibility | `/tasks` | 쓰기 사용자가 공개/비공개 제출물 등록, 역할에 따라 조회 범위 제한 | 린트·라우트 연결로 확인 |
| Comment | `/tasks` | 쓰기 사용자가 제출물에 댓글 CRUD, 모든 인증 사용자가 읽기 | 린트·라우트 연결로 확인 |
| Gantt | `/tasks` | 선택한 프로젝트 태스크가 frappe-gantt 타임라인으로 렌더링 | 린트·라우트 연결로 확인 |
| Home | `/` | 인증 사용자가 선택 프로젝트 Gantt와 태스크 목록 확인 | 린트·라우트 연결로 확인 |
| Lint | `npm run lint` | 수정 파일에 미해결 경고·오류 없음 | Passed |
| Build | `npm run build` | 프로덕션 빌드 성공 | Passed |

## 실행 노트

- 루트 bootstrap 실패 — `WBSTask` 폴더명에 대문자가 포함되어 npm 패키지 명명 규칙 위반.  
  해결: 소문자 임시 폴더에 앱 생성 후 루트로 이동.
- 설치된 `next-auth`는 v4.24.14로 해석 → `NextAuthOptions` 및 App Router 핸들러 패턴 사용.
- macOS 외장 드라이브 환경에서 AppleDouble 파일(`._*`)이 Turbopack 캐시에 쓰여 시작 실패.  
  `next.config.ts`에 `experimental.turbopackFileSystemCacheForDev = false` 설정으로 해결.
- `frappe-gantt` CSS는 Turbopack에서 `globals.css`로 불러올 수 없어 `app/layout.tsx`에서 직접 import.

## 환경 가정

- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` 필요.
- `APP_PORT`: `npm run start` 포트 제어.
- MariaDB: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT_MS`.
- 업로드: `UPLOAD_DIR`, `UPLOAD_MAX_FILE_SIZE_MB`.
- 롤링 로그: `LOG_DIR`, `LOG_RETENTION_DAYS`, `LOG_MAX_FILE_SIZE_MB`.
- `.env*` 파일은 런타임 전용 — AI 작업 컨텍스트 제외.

## VS Code 디버깅

- `.vscode/launch.json` + `npm run dev:debug` 사용.
- 풀 스택 런치는 `debugWithChrome`으로 Chrome을 실행.

## Stage 2 기반

- `lib/env.ts`: env 파싱 및 준비 상태 확인.
- `lib/db.ts`: 검증된 env로 MariaDB 풀 생성.
- `models/user.ts`, `models/project.ts`: Stage 2 도메인 형태 정의.
- `lib/auth.ts`: env 기반 슈퍼유저 세션 매핑 + Google 프로필 동기화 + `requireAdminPanelSession` 헬퍼.
- `/admin`, `/admin/database`: 슈퍼유저 전용 관리자 진입점.
- `/admin/users`: 슈퍼유저 전용 사용자 역할 관리 (guest/member/admin 변경).
- `components/AppShell.tsx`: 반응형 앱바, 모바일 드로어, 역할 기반 관리자 메뉴 분기.

## Stage 3 태스크 플로우

- `/tasks`: 프로젝트 선택 + WBS 태스크 트리 편집.
- `lib/repositories/task-repository.ts`: MariaDB 기반 태스크 CRUD.
- `models/task.ts`: Stage 3 태스크 도메인 형태.

## Stage 4 타임라인 및 옵저빌리티

- `components/gantt/ProjectGanttChart.tsx`: frappe-gantt 렌더링.
- `app/admin/settings`, `components/admin/SettingsAdminPanel.tsx`: 로그 정책·APP_PORT·env 편집.
- `app/admin/logs`, `lib/logger.ts`: 롤링 로그 꼬리 + 구조화 행동 이력.
- `instrumentation.ts`, `lib/logger.ts`: 롤링 파일 로그 초기화.

## Stage 5 제출물 플로우

- `models/submission.ts`: `visibility` 필드 포함 제출물 도메인 형태.
- `lib/repositories/submission-repository.ts`: MariaDB CRUD + `SubmissionVisibilityFilter` 역할 기반 필터링.
- `/tasks`: 역할에 따라 공개/비공개 제출물 조회, 쓰기 사용자는 등록·수정·삭제 가능.

## Stage 7 첨부 플로우

- `lib/submission-files.ts`: env 설정 업로드 디렉터리에 첨부파일 저장 + 크기 제한 적용.
- `/api/submissions/[submissionId]/attachment`: 인증 첨부파일 다운로드 스트리밍.

## Stage 6 피드백 플로우

- `models/comment.ts`, `lib/repositories/comment-repository.ts`: MariaDB 기반 댓글 도메인 CRUD.
- `/tasks`: 제출물 수준 인라인 피드백 스레드 렌더링.

## 역할 확장 (현 스프린트)

- `models/user.ts`: `canAccessAdminPanel`, `canManageAllSubmissions` 헬퍼 추가; `manageableUserRoles`에 `admin` 포함.
- `models/submission.ts`: `SubmissionVisibility = "public" | "private"` 타입 추가.
- `lib/database-admin.ts`: `submissions` 테이블에 `visibility` 컬럼 추가 (신규 + 마이그레이션).
- `lib/auth.ts`: `requireAdminPanelSession` 헬퍼 추가.
- `app/admin/page.tsx`, `app/admin/logs/page.tsx`, `app/admin/settings/page.tsx`: 관리자 역할 접근 허용.
- `components/AppShell.tsx`: 슈퍼관리자는 전체 메뉴, 관리자 역할은 제한 메뉴(DB·사용자 관리 제외).
- `components/task/TaskSubmissionPanel.tsx`: 공개/비공개 배지, visibility 라디오 폼 추가.

## 알려진 블로커

- 없음.

## 다음 업데이트 트리거

- Synology NAS 배포 준비 시작 시
- auth 공급자 시크릿 프로비저닝 시
- 새 검증 명령 또는 블로커 발생 시

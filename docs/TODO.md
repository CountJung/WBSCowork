# WBS 태스크 — 진행 목록

> **살아있는 문서** — 단계 범위, 검증 절차, 블로커가 바뀔 때마다 업데이트하십시오.
> 최종 검토: 2026-09-06

---

## 완료된 단계

| 단계 | 범위 | 결과물 |
| --- | --- | --- |
| 1 | Next.js 16 + TypeScript + MUI + NextAuth 기반 | `app/layout.tsx`, `src/shared/config/theme`, `src/entities/user` |
| 2 | MariaDB 연결, User/Project 모델, 슈퍼관리자 DB 관리 | `src/shared/server/{database,runtime-env,database-admin}`, `/admin/database` |
| 3 | 태스크(WBS) CRUD + 게스트/멤버 쓰기 정책 | `src/entities/task`, `/tasks` |
| 4 | frappe-gantt 간트 차트 연동 | `src/widgets/project-gantt` |
| 5 | 제출물 기능 | `src/entities/submission` |
| 6 | 댓글 기능 | `src/entities/comment` |
| 7 | 파일 업로드·다운로드 | `src/entities/submission/api/submission-files.server.ts`, 2개 attachment route |
| 역할 확장 | 4단계 역할 + 제출물 public/private | `src/entities/user`, `SubmissionVisibilityFilter` |
| 운영 | 롤링 파일 로그, 구조화 행동 로그, 관리자 로그/세팅 화면, APP_PORT 하네스 | `src/shared/server/logging`, `/admin/logs`, `/admin/settings`, `scripts/run-next.ts` |
| 개인정보 | `/privacy` 안내, 관리자 명시 확인 기반 프로젝트 파기 | `app/privacy`, `/admin/projects` |
| 8 | Feature-Sliced Design(FSD) 기반 구조 정리 | `src/shared`, `src/entities`, `src/features`, `src/widgets`, `npm run check:fsd` |

---

## 현재 진행

- [x] 8단계: Feature-Sliced Design(FSD) 기반 프론트엔드 구조 정리
  - 실행 계약과 파일별 매핑은 [FSD_MIGRATION_PLAN.md](FSD_MIGRATION_PLAN.md)를 따른다.
  - 루트 `app/`은 App Router 엔트리로 유지한다. 이동 순서는 `src/shared → src/entities → src/features → src/widgets → root app pages`이며 `src/app`, `src/pages`는 만들지 않는다.
  - [x] M0: `scripts/check-fsd-boundaries.ts` + `npm run check:fsd` 경계 하네스 (self-test 5건, 저장소 위반 0건)
  - [x] M1: 범용 UI/config/server utility를 shared로 이동 (`markdown-content`, `theme`, `providers`, `runtime-env`, `database`, `database-admin`, `logging`, `date`)
  - [x] M2: 모델/정책과 repository를 entity로 이동 (`project`, `task`, `submission`, `comment`, `user`)
  - [x] M3: Server Action mutation을 feature use-case로 추출 (`task-workspace`, `database-manage`, `project-manage`, `settings-manage`, `user-role-change`)
  - [x] M4: UI를 widget 단위로 이동 (`app-shell`, `project-gantt`, `task-workspace`, `admin-database`, `admin-settings`, `stage-overview`)
  - [x] M5: root app page/route adapter 전환 후 `components/`, `lib/`, `models/` 호환 re-export 제거
  - 검증: 2026-08-12 `npm run check:fsd`, `npm run typecheck`, `npm run lint`, `npm run build` 통과

---

## 다음 작업

- [ ] 9단계: Scheduled project digest + DOCX/PPTX report export
  - 상세 계약과 D0~D5 게이트는 [PROJECT_DIGEST_REPORT_PLAN.md](PROJECT_DIGEST_REPORT_PLAN.md)를 따른다.
  - [ ] D0: 현재 DB 사실만 담는 versioned `DigestSnapshot` + privacy fixture
  - [ ] D1: admin/superuser용 manual JSON preview
  - [ ] D2: 동일 snapshot 기반 DOCX/PPTX export + 권한 다운로드
  - [ ] D3: scheduler token, dry-run, MariaDB versioned migration·최소권한·run ledger/idempotency
  - [ ] D4: download-only 운영 + artifact retention
  - [ ] D5: membership/recipient consent와 threat model 승인 후 delivery 검토
- [ ] 10단계: Synology NAS 배포 준비

---

## 보안·정합성 백로그

- [x] **P0 — 비공개 제출물의 파생 데이터가 client payload로 노출된다.** (해소: 2026-09-05)

  `listCommentsByProject`, `listAttachmentsByProject`에 필수 `IdScope` 인자를 추가했다. `app/tasks/page.tsx`는 `SubmissionVisibilityFilter`를 통과한 제출물 id 집합으로 두 질의를 제한하므로, 비공개 제출물의 댓글 본문·작성자 이메일·첨부 파일명·저장 경로가 RSC payload에 실리지 않는다. 상단 `댓글 N` Chip도 가시 댓글만 센다. 범위 helper는 `src/shared/server/query-scope`이며 안전한 기본값이 없어 새 호출부는 범위를 반드시 명시해야 한다.
- [x] **P1 — 제출물·댓글 mutation에 작성자 ownership 검사가 없다.** (해소: 2026-09-05)

  `src/features/task-workspace/server/actions.ts`에 `requireVisibleSubmission` / `requireOwnedSubmission` / `requireOwnedComment`를 추가했다. `updateSubmissionAction`, `deleteSubmissionAction`, `deleteSubmissionAttachmentAction`, `updateCommentAction`, `deleteCommentAction`은 작성자 본인 또는 `canManageAllSubmissions` actor만 통과하고, `createSubmissionAction`·`createCommentAction`을 포함한 모든 경로가 폼이 주장한 project → task → submission → comment 관계를 서버에서 재확인한다. 볼 수 없는 자원은 존재하지 않는 자원과 같은 오류로 처리한다.
- [x] **P1 — 단건 조회 `getSubmissionById`는 unscoped다.** (해소: 2026-09-05)

  `getSubmissionByIdForViewer(id, filter)`를 추가하고 두 attachment route를 조회 후 policy check에서 질의 수준 필터로 교체했다. `SubmissionVisibilityFilter`에 `viewerEmail`을 추가해 세션 이메일만 있는 route handler도 DB 사용자 id 조회 없이 쓸 수 있다. `getSubmissionById`는 actor 권한을 이미 검증한 mutation 경로 전용임을 JSDoc으로 못박았다.
- [x] **P2 — 로그 metadata에 파일 경로가 남는다.** (해소: 2026-09-05)

  `src/shared/server/logging`이 `REDACTED_METADATA_KEYS`(`filePath`, `storedFilePath`, `absolutePath`, `uploadDir`, `path`)를 기록 시 `[redacted]` 또는 `[redacted]:<확장자>`로 축약한다. 호출부를 일일이 고치는 대신 기록 지점에서 한 번 막았으므로 새 action도 자동 적용된다.

- [x] **P1 — `/tasks` 프로젝트 CRUD server action이 쓰기 역할만 확인했다.** (2026-09-05 검토에서 확인·해소)

  `app/tasks/actions.ts`가 `createProjectAction`, `updateProjectAction`, `deleteProjectAction`을 export한다. `/tasks` 화면에는 이 폼이 없지만 `"use server"` 모듈의 export는 호출 가능한 엔드포인트로 등록되고, 구현부는 `canWriteTaskContent`만 확인했다. 즉 `member`가 프로젝트를 cascade 삭제(태스크·제출물·댓글·저장 파일)할 수 있었다. `requireProjectAdminSession`(`canAccessAdminPanel`)으로 막았다.

- [ ] **정리 — 프로젝트 CRUD 경로가 이중이다.** `src/features/task-workspace`(권한 보강 완료, 화면 폼 없음)와 `src/features/project-manage`(`/admin/projects`, 파기 확인 포함)가 같은 기능을 갖는다. `/tasks`에 프로젝트 폼을 되살릴 계획이 없다면 task-workspace 쪽 3개 action과 `app/tasks/actions.ts` 어댑터를 지워 표면을 하나로 줄인다. 삭제 여부는 제품 판단이 필요해 남겨 둔다.

> 회귀 방지 fixture(`HARNESS_MAP.md` 6절)는 2026-09-06에 `npm test`로 고정했다. P0/P1 수정을 각각 되돌려 테스트가 실제로 실패하는지 확인했다(P0 주입 시 6건, ownership 주입 시 2건 실패).

## 품질·운영 백로그

- [x] 자동화 테스트 러너 도입 (2026-09-06). Node 내장 `node:test` 기반 `npm test` — 단위 14건 + 가시성 e2e 33건. 새 테스트 의존성은 추가하지 않았고, 테스트 DB 백엔드는 docker/Homebrew MariaDB 중 사용 가능한 쪽을 자동 선택한다(`scripts/test-database.ts`).
- [ ] 테스트 커버리지 확장. 현재 하네스는 가시성·권한 경계에 집중되어 있다. 다음 후보: 파일 업로드 경로 경계(traversal·크기 제한), task/project CRUD의 날짜·계층 규칙, admin 화면 action. HTTP 계층(미들웨어·OAuth 로그인)은 여전히 범위 밖이다.
- [ ] versioned migration 없음. `src/shared/server/database-admin`이 `CREATE TABLE`과 일부 `ALTER ADD`만 수행하고 migration ledger/rollback 이력이 없다. 9단계 D3가 이를 전제로 한다.
- [ ] runtime pool과 schema admin이 같은 `DB_*` credential을 사용한다. 최소권한 계정 분리 필요.
- [x] `npm run build`·`npm run check:fsd`의 Node `[DEP0205] module.register()` deprecation 경고 해소 (2026-09-05). `tsx`를 4.21.0 → 4.23.13으로 올려 경고가 사라졌다.
- [ ] `next-env.d.ts`가 `.gitignore` 대상인데 `tsconfig.json` `include`에 남아 있다. 외장 볼륨 AppleDouble(`._next-env.d.ts`)과 함께 정리 대상인지 판단한다.

---

## 해소된 블로커

- 2026-09-06: 가시성 fixture를 실행 가능한 게이트로 고정했다(`npm test`). Docker Hub에서 이미지를 받을 수 없는 환경이라 Homebrew MariaDB 백엔드를 함께 지원한다. 검증은 lint/typecheck/check:fsd/build/test 전부 통과.
- 2026-09-05: 보안·정합성 백로그 P0/P1/P2와 새로 확인한 프로젝트 CRUD 권한 누락을 코드로 해소했다. 검증은 `npm run lint`, `npm run typecheck`, `npm run check:fsd`, `npm run build` 통과. `npm run db:check`는 이 환경에 MariaDB 인스턴스가 없어 미실행이다.
- 2026-08-09: `npm run lint` 17건(오류 10, 경고 7) 해소. AppleDouble(`**/._*`), 벤더 skill 스크립트(`.github/skills/**`), 생성물·fixture를 `eslint.config.mjs`에서 제외하고, 문서 생성용 CommonJS 스크립트에 `sourceType: "commonjs"` override를 적용했으며 `scripts/generate-manual-docx.js`의 미사용 import를 제거했다.

---

## 참고 문서

- [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — 제품 정의·MVP 범위·DB 설계
- [MASTER_PLAN.html](MASTER_PLAN.html) — 운영 마스터 플랜(사람용)
- [PROJECT_MAP.md](PROJECT_MAP.md) — 코드 탐색 지도
- [ARCHITECTURE.md](ARCHITECTURE.md) — 인증·인가·가시성·데이터 경계
- [HARNESS_MAP.md](HARNESS_MAP.md) — 실행·검증 하네스
- [../AGENTS.md](../AGENTS.md) — AI 에이전트 가이드

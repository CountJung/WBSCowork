# WBS 태스크 — 진행 목록

> **살아있는 문서** — 단계 범위, 검증 절차, 블로커가 바뀔 때마다 업데이트하십시오.
> 최종 검토: 2026-08-12

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

## 보안·정합성 백로그 (2026-08-09 코드 검토에서 확인)

FSD 이동과 섞지 않고 별도 변경으로 처리한다. 구조 이동보다 우선순위가 높다.

- [ ] **P0 — 비공개 제출물의 파생 데이터가 client payload로 노출된다.**

  `app/tasks/page.tsx`는 `listCommentsByProject`, `listAttachmentsByProject`로 프로젝트 전체를 조회한 뒤, 그룹화한 `commentsBySubmissionId`·`attachmentsBySubmissionId` **전체**를 client widget `src/widgets/task-workspace`에 props로 넘긴다. 제출물 목록만 `SubmissionVisibilityFilter`를 통과하므로, 조회 권한이 없는 비공개 제출물의 댓글 본문·작성자 이메일·첨부 파일명·저장 경로가 RSC payload에 실려 브라우저에 도달한다. 상단 `댓글 N` Chip도 비공개 댓글을 포함한 수치다.

  조치: 두 repository 함수에 viewer filter를 추가하거나 가시 제출물 id로 조회를 제한하고, 카드에 넘기는 map을 해당 태스크의 가시 제출물로 좁힌다. 회귀 방지 fixture는 `HARNESS_MAP.md` 6절 사양을 사용한다.
- [ ] **P1 — 제출물·댓글 mutation에 작성자 ownership 검사가 없다.**

  `app/tasks/actions.ts`의 `updateSubmissionAction`, `deleteSubmissionAction`, `updateCommentAction`, `deleteCommentAction`은 `requireWritableSession`(쓰기 역할)만 확인한다. 임의의 `member`가 타인의 제출물·댓글을 수정·삭제할 수 있고, `updateSubmissionAction`은 `visibility`도 함께 덮어쓰므로 타인의 비공개 제출물을 공개로 바꾸는 경로가 된다. `updateCommentAction`은 대상 댓글이 폼에 담긴 submission/project에 속하는지도 확인하지 않는다.

  조치: 작성자 본인 또는 `canManageAllSubmissions` 통과 actor만 허용하고, 대상 자원의 상위 관계(project/task/submission)를 서버에서 재확인한다.
- [ ] **P1 — 단건 조회 `getSubmissionById`는 unscoped다.**

  현재 두 attachment route는 조회 후 `canViewSubmission`으로 막고 있어 다운로드 경로는 닫혀 있다. 새 소비자가 정책 검사를 빠뜨리지 않도록 viewer-aware 단건 조회 API를 추가하거나 호출부 규약을 문서화한다.
- [ ] **P2 — 로그 metadata에 파일 경로가 남는다.** `app/tasks/actions.ts`의 cleanup 실패 로그가 `filePath`를 기록한다. 비공개 산출물 경로가 로그로 새지 않도록 redaction 정책을 정한다.

---

## 품질·운영 백로그

- [ ] 자동화 테스트 러너 부재. `HARNESS_MAP.md` 6절의 가시성 fixture 사양이 문서로만 존재하고 `npm test`가 없다. P0/P1 수정과 함께 focused policy test 인프라를 도입한다.
- [ ] versioned migration 없음. `src/shared/server/database-admin`이 `CREATE TABLE`과 일부 `ALTER ADD`만 수행하고 migration ledger/rollback 이력이 없다. 9단계 D3가 이를 전제로 한다.
- [ ] runtime pool과 schema admin이 같은 `DB_*` credential을 사용한다. 최소권한 계정 분리 필요.
- [ ] `npm run build`에서 Node `[DEP0205] module.register()` deprecation 경고가 남는다. 원인은 `tsx@4.21.0` 로더(Node v26). 다음 의존성 갱신에서 `tsx` 최신(4.23.x) 적용 후 경고 소멸 여부를 재확인한다.
- [ ] `next-env.d.ts`가 `.gitignore` 대상인데 `tsconfig.json` `include`에 남아 있다. 외장 볼륨 AppleDouble(`._next-env.d.ts`)과 함께 정리 대상인지 판단한다.

---

## 해소된 블로커

- 2026-08-09: `npm run lint` 17건(오류 10, 경고 7) 해소. AppleDouble(`**/._*`), 벤더 skill 스크립트(`.github/skills/**`), 생성물·fixture를 `eslint.config.mjs`에서 제외하고, 문서 생성용 CommonJS 스크립트에 `sourceType: "commonjs"` override를 적용했으며 `scripts/generate-manual-docx.js`의 미사용 import를 제거했다.

---

## 참고 문서

- [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — 제품 정의·MVP 범위·DB 설계
- [MASTER_PLAN.html](MASTER_PLAN.html) — 운영 마스터 플랜(사람용)
- [PROJECT_MAP.md](PROJECT_MAP.md) — 코드 탐색 지도
- [ARCHITECTURE.md](ARCHITECTURE.md) — 인증·인가·가시성·데이터 경계
- [HARNESS_MAP.md](HARNESS_MAP.md) — 실행·검증 하네스
- [../AGENTS.md](../AGENTS.md) — AI 에이전트 가이드

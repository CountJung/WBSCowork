# WBSCowork Agent Guide

> **살아있는 문서** — 프로젝트 구조, 역할, 규칙, 검증 명령이 바뀔 때마다 업데이트하십시오.  
> 하위 문서는 모두 `/docs/` 에서 관리합니다.

---

## 빠른 참조

| 항목 | 값 |
| --- | --- |
| 프레임워크 | Next.js 16 App Router, TypeScript, MUI; Sites 빌드는 Vinext/Workers |
| DB | Node: MariaDB; Sites Worker: D1/SQLite, Drizzle migrations |
| 인증 | NextAuth v4 (Google OAuth) |
| 차트 | frappe-gantt |
| 데이터 조회 | TanStack Query (클라이언트), Server Components (서버) |

---

## 역할 시스템

| 역할 | 식별 | 권한 요약 |
| --- | --- | --- |
| **슈퍼관리자** | `isSuperuser = true` (env `SUPERUSER_EMAIL`) | 모든 권한, 환경설정 세팅, DB 관리, 사용자 관리 |
| **관리자** | `role = "admin"` | `/admin` (관리 개요), `/admin/users` (사용자 관리) 접근; `guest`·`member` 이하 권한 부여 가능; 모든 제출물(비공개 포함) 조회·관리 |
| **일반사용자** | `role = "member"` | 태스크/제출물/댓글 CRUD, 공개 제출물 + 본인 비공개 제출물 조회 |
| **게스트** | `role = "guest"` | 공개 제출물 읽기 전용, 권한 승급 대기 상태 |

---

## 제출물 공개 범위

- `visibility = "public"`: 모든 인증 사용자 조회 가능  
- `visibility = "private"`: 작성자 본인 + 관리자(admin) + 슈퍼관리자만 조회 가능  
- 역할 기반 필터링은 `src/entities/submission`의 `SubmissionVisibilityFilter`로 처리

---

## 프로젝트 구조

```
app/           # Next.js App Router 엔트리(라우트/handler/action adapter)
  api/         # Route Handlers
  admin/       # 관리자 페이지 (슈퍼관리자·관리자 접근)
  tasks/       # 메인 WBS 태스크 워크스페이스
src/
  shared/      # 공통 UI/config/server utility
  entities/    # 도메인 타입·정책·repository public API
  features/    # Server Action use-case
  widgets/     # 전역 앱바, 간트, task workspace, admin panel
scripts/       # 실행·검증 하네스 (run-next, check-db, check-fsd-boundaries, run-tests, test-database)
tests/         # node:test 기반 정책·가시성 e2e (helpers/ 에 fixture·세션 주입)
docs/          # 모든 하위 문서 (루트에는 README/AGENTS/CLAUDE 만 둔다)
```

---

## 핵심 규칙

1. `canAccessAdminPanel(role, isSuperuser)` — admin 패널 접근 확인
2. `canManageAllSubmissions(role, isSuperuser)` — 비공개 제출물 접근 확인
3. `canWriteTaskContent(role, isSuperuser)` — 태스크/제출물 쓰기 확인
4. Admin 패널 중 `/admin/database`, `/admin/logs`, `/admin/settings`는 `isSuperuser`만 접근 가능; `/admin/users`는 관리자 역할도 접근 가능 (`guest`·`member`만 부여)
5. 제출물 목록 쿼리는 반드시 `SubmissionVisibilityFilter`를 사용할 것. 댓글·첨부의 프로젝트 조회는 `IdScope`와 viewer filter를 함께 전달하여 매 SQL에서 현재/해당 버전 가시성을 재검사하고, 단건은 `getSubmissionByIdForViewer`를 쓴다. 제출물·댓글 mutation은 상위 관계 재확인과 작성자/관리자 ownership 검사를 통과해야 한다
6. 환경 변수 파일(`.env*`)을 AI 컨텍스트로 열지 않는다
7. 경고·오류 무시 금지 — 해결 불가 시 `docs/TODO.md`(해당 섹션 `QLT/RPT/OPS/PRD-###` 번호 발급)와 `docs/HARNESS_MAP.md`(기준선)에 기록. 완료 시 `docs/COMPLETED_LOG.md`로 번호를 유지한 채 옮긴다
8. FSD 의존 방향은 `app → widgets → features → entities → shared`, 구축/이동 순서는 `shared → entities → features → widgets → root app pages`이다. 루트 `app/`을 `src/app`으로 옮기지 않고 구조 이동과 기능 변경을 분리한다. `src/`를 건드리면 `npm run check:fsd`를 반드시 실행한다.
9. scheduled digest는 기본 dry-run/download-only이며, `SubmissionVisibilityFilter`, machine token, DB idempotency ledger 없이 활성화하지 않는다.
10. report renderer는 동일한 versioned snapshot을 사용한다. DOCX는 `docx`, runtime PPTX는 브라우저 없는 `pptxgenjs` 직접 생성을 사용한다.
11. 개인정보 처리지침은 실제 schema·로그·파일 수명주기와 일치시킨다. 프로젝트 파기는 종료일 자동 삭제가 아니라 관리자 명시 확인 후 DB cascade와 저장 파일 정리를 함께 실행하며, 공유 사용자 계정은 별도 수명주기로 다룬다.

---

## 검증 명령

```bash
npm run lint          # ESLint 검사
npm run typecheck     # tsc --noEmit
npm run check:fsd     # FSD import 경계 (fixture self-test + 저장소 검사)
npm test              # 단위 + 가시성 e2e (DB 없으면 DB suite는 사유 남기고 건너뜀)
npm run test:db:up    # 테스트 전용 MariaDB 기동 (127.0.0.1:3307 / wbs_app_test)
npm run test:db:down  # 테스트 DB 종료 및 데이터 폐기
npm run build         # Sites Worker 프로덕션 빌드
npm run build:next    # 기존 Node/Next 빌드
npm run test:sites:auth # 실제 workerd 인증 계약 (가상 테스트 값만)
npm run test:sites:storage # 로컬 D1/R2 및 실패 복구
npm run test:sites:http # 실제 Worker HTTP 권한/업로드 계약
npm run db:check      # DB 연결 테스트
npm run db:migrate -- --status # native ledger 읽기 전용 (명시 --apply만 schema DDL)
npm run test:native:migrations # loopback3307 새 *_test DB를 보존하는 additive 검증
npm run dev:debug     # Node 인스펙터 포함 dev 서버
```

가시성·권한 경계를 건드리면 `npm test`를 반드시 실행한다. 테스트 DB는 개발용(3306)과 포트·DB 이름이 분리되어 있고, `_test`로 끝나지 않는 DB 이름은 하네스가 거부한다.

기준선과 미실행 사유는 [docs/HARNESS_MAP.md](docs/HARNESS_MAP.md) 10절에 있다.

---

## 문서 스택

루트 진입점은 `README.md`, `AGENTS.md`, `CLAUDE.md` 세 개뿐이고 나머지 문서는 모두 `docs/`에 있다. 변경 성격에 맞춰 함께 확인하고, 구조·명령·권한 경계가 달라지면 같은 변경에서 갱신한다.

| 문서 | 성격 |
| --- | --- |
| [docs/TODO.md](docs/TODO.md) | 열린 항목만. 섹션별 `QLT/RPT/OPS/PRD-###` 고유번호로 추적 (매 작업 시작·종료) |
| [docs/COMPLETED_LOG.md](docs/COMPLETED_LOG.md) | 완료 항목의 원인·조치·회귀 방지 기록 |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | 제품 정의·MVP 범위·DB 설계 |
| [docs/MASTER_PLAN.html](docs/MASTER_PLAN.html) | 사람용 운영 로드맵과 권한·가시성 우선순위 |
| [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) | App Router·repository·DB 작업별 진입점 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 인증·인가, 제출물 가시성, MariaDB·파일 경계 |
| [docs/HARNESS_MAP.md](docs/HARNESS_MAP.md) | 실행·검증 명령과 알려진 기준선 |
| [docs/FSD_MIGRATION_PLAN.md](docs/FSD_MIGRATION_PLAN.md) | 8단계 M0~M5 완료 구조와 경계 게이트 사양 |
| [docs/PROJECT_DIGEST_REPORT_PLAN.md](docs/PROJECT_DIGEST_REPORT_PLAN.md) | 9단계 digest/report export 계약 |
| [docs/manual/](docs/manual/) | 사용자 교육 슬라이드·빠른 참조 |
| [tasks/TASK_TEMPLATE.md](tasks/TASK_TEMPLATE.md) | 권한 매트릭스·DB 영향·완료 조건 템플릿 |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | AI 작업 규칙 |
| [.github/instructions/](.github/instructions/) | Next.js 스택·품질 게이트 가이드 |
| [.github/skills/wbs-project-digest-report/SKILL.md](.github/skills/wbs-project-digest-report/SKILL.md) | digest/export 구현 workflow |

---

## Next.js 버전 주의

이 저장소는 **Next.js 16 App Router**를 사용합니다. 훈련 데이터와 API·컨벤션이 다를 수 있습니다.  
코드 작성 전 `node_modules/next/dist/docs/`를 반드시 참조하십시오.

---

## 도구 사용 기준

Serena는 역할·권한, DB schema, repository 계약 또는 여러 Route Handler를 함께 바꾸는 경우의 실제 참조 추적에만 사용한다. Graphify는 일반적인 문서·검색으로 설명되지 않는 의존 구조 리팩터링 때만 예외적으로 사용한다. 구조·명령·권한 경계가 달라지면 관련 운영 문서를 같은 변경에서 갱신한다.

## 버그 제보·리뷰

`/bugs`, `/bugs/[id]`는 Google 인증된 모든 기존 역할(guest 포함)이 본인 제보를 작성·조회·추가 설명할 수 있다. `/admin/bugs`와 검토 변경은 admin/superuser만 가능하다. 이 권한은 task/project 쓰기 권한을 확대하지 않는다. 원문은 불변이고 검토/정정은 `bug_report_events`에 추가하며, version + operation token을 DB transaction 안에서 검사한다. 프로젝트 파기/5일 audit pruning과 독립된 보존 기록이다. 제보 텍스트는 비신뢰 데이터로 취급하고 실행·외부 전송·자동 수정을 하지 않는다. 신규 검증: `npm run test:sites:bugs`. 상세 [BUG_REPORTS.md](docs/BUG_REPORTS.md).

버그 lifecycle: admin은 해결/종료 제보 검증 완료, 휴지통 이동·복원을 수행한다. 영구 삭제는 SU만 현재 제목/버전/전체 이력 지문 확인 후 가능하며 최소 삭제 증빙을 남긴다. 휴지통은 admin/SU 전용 SQL scope이며 일반 조회·검색·건수·이력에서 제외한다. 상세 계약은 BUG_REPORTS.md를 따른다.

Native MariaDB schema 변경은 DB_SCHEMA_USER/DB_SCHEMA_PASSWORD 전용 연결과 불변 version/checksum ledger를 사용한다. 일반 DB_* runtime/readiness와 분리하며 fallback하지 않는다. DDL은 transaction rollback 대상이 아니므로 자동 down/DROP이나 ledger 강제 수정은 없다. 실제 운영 적용/계정 권한 변경은 별도 승인 범위다. [Native 운영](docs/NATIVE_DATABASE_MIGRATIONS.md).

산출물 버전: 쓰기는 canonical submission revision batch만 사용한다. 현재 projection·불변 snapshot·버전 첨부·event를 같은 transaction에 저장하고 expected revision/stable token/bytes fingerprint를 검사한다. 이전 파일 제외는 새 버전일 뿐 물리 삭제가 아니다. current/historical visibility를 함께 검사하며 담당자/검토자 지정으로 private 접근이 늘지 않는다. `/submissions/[id]`의 이력 보존 정책은 TEAM_WORKFLOW_PLAN.md와 privacy 화면을 따른다.

팀 업무: `/my-work`는 count/list/link에 동일 viewer/current-role SQL 조건을 사용한다. `/submissions/[id]`의 검토 action은 현재 담당자의 특정 현재 버전만 선택하고 reviewer 권한·visibility·self-approval 배제·token/version을 transaction 안에서 재검사한다. 상세 검토 사유를 공개 task event에 복사하지 않는다. form pending UI는 shared SubmitButton을 사용하며 서버의 중복 방지·권한 검사를 대신하지 않는다. [사용 안내](docs/TEAM_WORKFLOW_GUIDE.md), [P0 인수 범위](docs/P0_ACCEPTANCE_2026-10-09.md).

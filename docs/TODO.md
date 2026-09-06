# WBS 태스크 — 진행 목록

> **살아있는 문서** — 단계 범위, 검증 절차, 블로커가 바뀔 때마다 업데이트하십시오.
> 최종 검토: 2026-09-06 · 다음 번호: **T-022**

완료된 항목은 [COMPLETED_LOG.md](COMPLETED_LOG.md)로 옮긴다. 이 문서에는 열린 항목만 남긴다.

---

## ID 규칙

- 형식은 `T-###`이며 **전체에서 하나뿐인 번호**다. 분류별로 나누지 않는다.
- **번호는 재사용하지 않는다.** 취소한 항목의 번호도 비워 두고 다시 쓰지 않는다.
- 새 항목은 위 머리말의 `다음 번호`를 쓰고, 그 값을 1 올린다.
- 완료하면 [COMPLETED_LOG.md](COMPLETED_LOG.md)로 옮기되 **번호는 그대로 유지**한다. 커밋 메시지·문서·코드 주석에서 `T-004` 처럼 참조할 수 있어야 하기 때문이다.
- 항목이 커져 쪼개질 때는 원래 번호를 지우고 새 번호 여러 개를 발급한다. 하위 번호(`T-004a`)는 만들지 않는다.
- 「세부」의 착수 체크리스트 항목에는 번호를 주지 않는다. 그 항목 안에서만 의미가 있고, 밖에서 참조할 일이 없기 때문이다.

---

## 진행 표기 범례

| 표기 | 상태 | 뜻 | 다음 행동 |
| --- | --- | --- | --- |
| `- [ ]` | 대기 | 착수하지 않음. 막는 것은 없다 | 아무 때나 시작할 수 있다 |
| `- [~]` | 진행 | 작업 중 | 끝내고 `[x]`로 바꾼다 |
| `- [!]` | 보류 | 선행 조건이나 사람의 판단을 기다림 | 무엇을 기다리는지 항목에 적는다 |
| `- [x]` | 완료 | 끝남 | 다음 정리 때 [COMPLETED_LOG.md](COMPLETED_LOG.md)로 옮긴다 |
| `- [-]` | 취소 | 하지 않기로 함 | 사유를 적고 남긴다. 번호는 회수하지 않는다 |

`[!]`와 `[-]`를 구분하는 기준은 **되살아날 수 있는가**다. 판단을 기다리는 동안 멈춘 것은 `[!]`, 하지 않기로 결론이 난 것은 `[-]`다.

**표기가 상태의 단일 출처다.** 같은 줄이나 「세부」에 상태를 다시 적지 않는다. 두 곳에 적으면 반드시 어긋난다. 「세부」의 착수 체크리스트는 그 항목 **안에서의** 진척만 나타내며, 항목 자체의 상태는 아래 「열린 항목」에서만 관리한다.

> GitHub는 GFM 사양에 따라 `[ ]`와 `[x]`만 실제 체크박스로 렌더링한다. `[~]`, `[!]`, `[-]`는 글자 그대로 보인다. 체크박스 위젯보다 상태 구분이 유용하다고 보고 이 표기를 택했다. 편집기에서 상태를 바꿀 때는 위젯 클릭이 아니라 글자를 직접 고친다.

---

## 열린 항목

### 정리·품질·운영

- [!] **[T-010](#t-010--프로젝트-crud-경로-이중화-정리)** 프로젝트 CRUD 경로 이중화 정리 — 제품 판단 필요
- [ ] **[T-011](#t-011--테스트-커버리지-확장)** 테스트 커버리지 확장
- [ ] **[T-012](#t-012--versioned-migration-부재)** versioned migration 부재
- [ ] **[T-013](#t-013--db-credential-최소권한-분리)** runtime pool과 schema admin의 credential 분리
- [!] **[T-014](#t-014--next-envdts와-tsconfig-include-정리)** `next-env.d.ts`와 tsconfig `include` 정리 — 판단 필요

### 9단계 — digest/report export

D0가 나머지 전부의 선행이다. 순서를 건너뛰면 snapshot 계약이 두 벌이 된다.

- [ ] **[T-015](#t-015--d0-versioned-digestsnapshot)** D0 versioned `DigestSnapshot` + privacy fixture
- [ ] **[T-016](#t-016--d1-manual-json-preview)** D1 admin/superuser용 manual JSON preview — 선행 T-015
- [ ] **[T-017](#t-017--d2-docxpptx-export)** D2 동일 snapshot 기반 DOCX/PPTX export — 선행 T-015
- [ ] **[T-018](#t-018--d3-scheduler-운영-기반)** D3 scheduler token·dry-run·migration·run ledger — 선행 T-012, T-017
- [ ] **[T-019](#t-019--d4-download-only-운영)** D4 download-only 운영 + artifact retention — 선행 T-018
- [!] **[T-020](#t-020--d5-delivery-검토)** D5 consent·threat model 승인 후 delivery 검토 — 선행 T-019

### 10단계 — 배포

- [ ] **[T-021](#t-021--synology-nas-배포-준비)** Synology NAS 배포 준비

---

## 세부

### T-010 — 프로젝트 CRUD 경로 이중화 정리

**분류** 정리

`src/features/task-workspace`와 `src/features/project-manage`가 같은 프로젝트 CRUD 기능을 갖는다.

| 경로 | 화면 | 권한 | 비고 |
| --- | --- | --- | --- |
| `task-workspace`의 3개 action | 없음 | 관리자 이상 (T-007에서 보강) | `app/tasks/actions.ts`가 어댑터로 export |
| `project-manage`의 `*ProjectAdminAction` | `/admin/projects` | 관리자 이상 | 파기 확인 절차 포함 |

T-007이 권한 구멍은 막았지만 중복 자체는 남아 있다. `/tasks`에 프로젝트 폼을 되살릴 계획이 없다면 task-workspace 쪽 3개 action과 `app/tasks/actions.ts` 어댑터를 지워 공격 표면을 하나로 줄인다.

**보류 사유.** 삭제는 되돌리기 쉽지만 "앞으로 `/tasks`에 프로젝트 폼을 둘 것인가"는 제품 판단이다. 결정되면 바로 착수할 수 있다.

착수 체크리스트:

- [ ] `/tasks`에 프로젝트 폼을 두지 않기로 확정
- [ ] `src/features/task-workspace`의 project CRUD action 3개 제거
- [ ] `app/tasks/actions.ts`의 어댑터 3개 제거
- [ ] `npm test`의 "프로젝트 CRUD server action은 관리자 이상만" 테스트를 `/admin/projects` 대상으로 이관
- [ ] `docs/PROJECT_MAP.md`의 경로 표 갱신

---

### T-011 — 테스트 커버리지 확장

**분류** 품질

현재 하네스(T-009)는 가시성·권한 경계에 집중되어 있다. 우선순위 순으로:

- [ ] 파일 업로드 경로 경계 — traversal, 크기 제한, MIME/disposition
- [ ] task/project CRUD의 날짜·계층 규칙 — 시작일/종료일 역전, depth·order 일관성
- [ ] admin 화면 action — 역할 부여 경계(`guest`·`member`만 부여 가능)

HTTP 계층(미들웨어·OAuth 로그인)과 캐시 무효화는 현재 하네스 구조상 범위 밖이다. 이것까지 검증하려면 별도 도구가 필요하므로 이 항목에 섞지 않는다.

---

### T-012 — versioned migration 부재

**분류** 운영

`src/shared/server/database-admin`이 `CREATE TABLE`과 일부 `ALTER ADD`만 수행하고 migration ledger나 rollback 이력이 없다.

T-018(D3)이 이것을 전제로 하므로 9단계 진입 전에 해결하는 편이 낫다.

착수 체크리스트:

- [ ] migration ledger 테이블과 버전 규약 정의
- [ ] 기존 `CREATE TABLE`·`ALTER ADD` 경로를 versioned migration으로 이관
- [ ] idempotent upgrade, 기존 데이터 backfill, FK/index 설계 확인
- [ ] rollback 절차 정의
- [ ] 테스트 DB(3307)에서 fresh install과 기존 DB upgrade 양쪽 검증

---

### T-013 — DB credential 최소권한 분리

**분류** 보안

runtime pool과 schema admin이 같은 `DB_*` credential을 쓴다. 평상시 애플리케이션 질의가 DDL 권한을 들고 다닌다는 뜻이다. 계정을 분리하고 runtime 쪽에서 DDL 권한을 뺀다.

T-018(D3)의 "최소권한" 요구와 같은 작업이다.

착수 체크리스트:

- [ ] schema 전용 계정과 runtime 계정 분리, env 키 추가
- [ ] runtime 계정에서 DDL 권한 제거
- [ ] `src/shared/server/database-admin`이 schema 계정을 쓰도록 변경
- [ ] `env.example`과 `docs/HARNESS_MAP.md` 7절 env 표 갱신

---

### T-014 — `next-env.d.ts`와 tsconfig `include` 정리

**분류** 정리

`next-env.d.ts`가 `.gitignore` 대상인데 `tsconfig.json`의 `include`에는 남아 있다. 외장 볼륨에서 생기는 AppleDouble(`._next-env.d.ts`)과 함께 정리 대상인지 판단한다.

**보류 사유.** 현재 동작에 문제가 없어 급하지 않고, Next가 이 파일을 재생성하는 방식과 얽혀 있어 건드릴 때 얻는 것이 무엇인지 먼저 정해야 한다.

착수 체크리스트:

- [ ] 정리해서 얻는 것이 무엇인지 확정(없으면 이 항목을 닫는다)
- [ ] `tsconfig.json` `include` 조정 후 `npm run typecheck`·`build` 재확인
- [ ] AppleDouble(`._next-env.d.ts`) 처리 방침 결정

---

### 9단계 — Scheduled project digest + DOCX/PPTX report export

상세 계약과 게이트는 [PROJECT_DIGEST_REPORT_PLAN.md](PROJECT_DIGEST_REPORT_PLAN.md)를 따른다. 아래는 그 문서의 D0~D5에 대응한다.

전 단계에 걸치는 제약(AGENTS.md 9·10항):

- scheduled digest는 기본 **dry-run/download-only**다. `SubmissionVisibilityFilter`, machine token, DB idempotency ledger 없이 활성화하지 않는다.
- report renderer는 **동일한 versioned snapshot**을 사용한다. DOCX는 `docx`, runtime PPTX는 브라우저 없는 `pptxgenjs` 직접 생성을 쓴다.

#### T-015 — D0 versioned `DigestSnapshot`

현재 DB 사실만 담는 versioned snapshot과 privacy fixture. 이후 D1·D2가 모두 이 snapshot 하나를 소비하므로 먼저 확정한다.

#### T-016 — D1 manual JSON preview

**선행** T-015

admin/superuser용 수동 JSON 미리보기.

#### T-017 — D2 DOCX/PPTX export

**선행** T-015

T-015의 snapshot을 그대로 쓰는 export와 권한 확인 다운로드. 다운로드 경로는 T-005의 viewer-aware 조회 규약을 따라야 한다.

#### T-018 — D3 scheduler 운영 기반

**선행** T-012, T-017

scheduler token, dry-run, MariaDB versioned migration, 최소권한 계정, run ledger/idempotency. T-012·T-013과 범위가 겹치므로 함께 설계한다.

#### T-019 — D4 download-only 운영

**선행** T-018

download-only 운영과 artifact retention.

#### T-020 — D5 delivery 검토

**선행** T-019

membership/recipient consent와 threat model 승인 이후에만 delivery를 검토한다. 승인 전에는 착수하지 않는다.

---

### T-021 — Synology NAS 배포 준비

**분류** 10단계

착수 체크리스트:

- [ ] 배포 대상 환경 정의(아키텍처, Node 버전, MariaDB 위치)
- [ ] 빌드·기동 절차 정리
- [ ] env·볼륨 경계 정의 — `UPLOAD_DIR`, `LOG_DIR`, DB 자격 증명
- [ ] 백업·복구 절차와 로그 보존 기간 확정

---

## 참고 문서

- [COMPLETED_LOG.md](COMPLETED_LOG.md) — 완료 항목과 그 배경
- [PRODUCT_SPEC.md](PRODUCT_SPEC.md) — 제품 정의·MVP 범위·DB 설계
- [MASTER_PLAN.html](MASTER_PLAN.html) — 운영 마스터 플랜(사람용)
- [PROJECT_MAP.md](PROJECT_MAP.md) — 코드 탐색 지도
- [ARCHITECTURE.md](ARCHITECTURE.md) — 인증·인가·가시성·데이터 경계
- [HARNESS_MAP.md](HARNESS_MAP.md) — 실행·검증 하네스
- [PROJECT_DIGEST_REPORT_PLAN.md](PROJECT_DIGEST_REPORT_PLAN.md) — 9단계 digest/report 계약
- [../AGENTS.md](../AGENTS.md) — AI 에이전트 가이드

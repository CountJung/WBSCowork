# WBS 태스크 — 진행 목록

> **살아있는 문서** — 단계 범위, 검증 절차, 블로커가 바뀔 때마다 업데이트하십시오.
> 최종 검토: 2026-10-10 · 다음 번호: **QLT-018 / RPT-021 / OPS-033 / PRD-045**

완료된 항목은 [COMPLETED_LOG.md](COMPLETED_LOG.md)로 옮긴다. 이 문서에는 열린 항목만 남긴다.

---

## ID 규칙

- 형식은 `섹션-###`이며 전체 ID가 고유하다. `QLT` 정리·품질·운영 기반, `RPT` digest/report, `OPS` 배포·운영 기능, `PRD` 팀 업무 제품 개선을 뜻한다.
- 2026-10-09 전환에서 기존 숫자는 유지했다. 예: `T-010` → `QLT-010`, `T-033` → `PRD-033`. 전체 대응은 [이전 번호 대응표](TASK_ID_MAP.md)에 있다. 기존 커밋/문서의 T 번호도 그 표로 찾는다.
- 새 항목은 해당 섹션의 다음 번호를 쓰고 그 값만 1 올린다. 다른 섹션의 숫자와 같아도 접두사가 다르면 별도 ID다. 번호는 재사용하지 않는다.
- 완료하면 [COMPLETED_LOG.md](COMPLETED_LOG.md)로 옮기되 전체 ID를 유지한다. 분류를 바꾸더라도 발급된 ID는 바꾸지 않는다.
- 항목을 쪼개면 원래 항목에 후속 ID를 남기고 새 번호를 발급한다. 하위 번호(`QLT-010a`)는 만들지 않는다.
- 세부 착수 체크리스트에는 별도 ID를 주지 않는다. 이전 heading 링크는 alias anchor로 유지한다.

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

### 제품 목표 — 주제에서 팀 산출물 완료까지

사용자의 2026-10-09 설명을 기준으로 현재 코드를 검토했다. **프로젝트/WBS·단일 담당자·파일 제출·댓글 공유는 이미 구현**되어 있으며, 아래는 팀이 수행·보완·완료를 판단하도록 연결하는 추가 제품 범위다. 근거와 정책 결정, 전체 인수 시나리오는 [팀 업무 개선안](TEAM_WORKFLOW_PLAN.md)에 있다. P0 구현과 합성 인수 검증을 완료하고 version9에 게시했다. [인수 결과와 한계](P0_ACCEPTANCE_2026-10-09.md), [사용 안내](TEAM_WORKFLOW_GUIDE.md)를 함께 본다.

**P0 완료 (2026-10-09)**

PRD-033~039 및 PRD-044는 [완료 기록](COMPLETED_LOG.md#prd-033--일반-팀원의-프로젝트-전환-2026-10-09)으로 이동했다. 실제 두 Google 계정의 브라우저 협업은 미실행이며, 두 구성원/권한 검증은 격리 Worker·MariaDB 결과다. 별도 차단된 저장소 경합 검사는 QLT-015, 일회성 fixture503 원인 확인은 QLT-016에서 추적하며 통과로 계산하지 않는다.

**P1 완료 (2026-10-09)**

PRD-040~043은 [완료 기록](COMPLETED_LOG.md#prd-040--주제-현황과-선후행-차단-2026-10-09)으로 이동했고 version10에 게시했다. [P1 인수 결과](P1_ACCEPTANCE_2026-10-09.md)와 [사용 안내](TEAM_WORKFLOW_GUIDE.md)를 함께 본다. 검색/알림은 실제 기존 세션과 모바일에서 읽기 확인했고, 자료가 채워진 다중 사용자·템플릿 브라우저 인수의 미실행 범위는 문서에 명시했다.

현재 명시된 P0/P1 제품 항목 중 열린 항목은 없다. 기존 OPS-032 보안 유지보수와 아래 엔지니어링/운영 백로그는 별도로 남는다. 외부 알림은 RPT-020 승인 계약을 따르며 AI 자동 분해·배정은 추가 요청 범위다.


### 정리·품질·운영

<a id="t-010--프로젝트-crud-경로-이중화-정리"></a>
<a id="qlt-010--프로젝트-crud-경로-이중화-정리"></a>
<a id="t-014--next-envdts와-tsconfig-include-정리"></a>
<a id="qlt-014--next-envdts와-tsconfig-include-정리"></a>
<a id="t-012--versioned-migration-부재"></a>
<a id="qlt-012--versioned-migration-부재"></a>
<a id="t-011--테스트-커버리지-확장"></a>
<a id="qlt-011--테스트-커버리지-확장"></a>
완료: [QLT-017 native 실행·설정 경계](COMPLETED_LOG.md#qlt-017--native-esm-실행과-schema-설정-비노출-2026-10-10), [QLT-012 native versioned migration](COMPLETED_LOG.md#qlt-012--native-versioned-migration-2026-10-09), [QLT-011 테스트 경계 확장](COMPLETED_LOG.md#qlt-011--날짜계층첨부역할-회귀-확장-2026-10-09), [QLT-010 프로젝트 CRUD 중복 정리](COMPLETED_LOG.md#qlt-010--프로젝트-crud-단일화-2026-10-09), [QLT-014 타입 생성물 정리](COMPLETED_LOG.md#qlt-014--필요한-next-타입-유지와-잔재-제외-2026-10-09).


- [!] **[QLT-013](#qlt-013--db-credential-최소권한-분리)** runtime pool과 schema admin의 credential 분리 — 코드 지원 완료, 실제 계정·권한 적용/검증 승인 대기
- [!] **QLT-015** 별도 저장소 정리 경합 동적 검증 — 플랫폼 검토로 차단된 두 cleanup runner 정지/재개 시나리오는 미실행. 현재 정적 검토·허용된 회귀 통과와 구분하며 우회/재시도하지 않는다. 허용된 검증 범위가 달라지기 전에는 보류한다.
- [ ] **QLT-016** Worker fixture의 간헐적 HTTP503 원인 확인 — UI 버튼 변경 후 기존 동시 검토 단계 첫 실행503, 동일 명령 재실행412 PASS. P1 검색 단계에서도 같은 동시 승인에서503이 재발했고 별도 재실행455 PASS였다. 합성 실패 응답 진단을 추가했지만 원인을 고쳤다고 주장하지 않는다. 정상 테스트 요청/로그 범위에서 하네스 환경과 재현성을 확인하며 차단된 QLT-015 시나리오는 포함하지 않는다.

### 9단계 — digest/report export

D0가 나머지 전부의 선행이다. 순서를 건너뛰면 snapshot 계약이 두 벌이 된다.

- [ ] **[RPT-015](#rpt-015--d0-versioned-digestsnapshot)** D0 versioned `DigestSnapshot` + privacy fixture
- [ ] **[RPT-016](#rpt-016--d1-manual-json-preview)** D1 admin/superuser용 manual JSON preview — 선행 RPT-015
- [ ] **[RPT-017](#rpt-017--d2-docxpptx-export)** D2 동일 snapshot 기반 DOCX/PPTX export — 선행 RPT-015
- [ ] **[RPT-018](#rpt-018--d3-scheduler-운영-기반)** D3 scheduler token·dry-run·migration·run ledger — 선행 QLT-012, RPT-017
- [ ] **[RPT-019](#rpt-019--d4-download-only-운영)** D4 download-only 운영 + artifact retention — 선행 RPT-018
- [!] **[RPT-020](#rpt-020--d5-delivery-검토)** D5 consent·threat model 승인 후 delivery 검토 — 선행 RPT-019

### 10단계 — 배포

- [!] **OPS-031** native 버그 수명주기 전체·영구 삭제 검증 — 기능 게시와 승인된 실환경 합성 제보 #1의 검증/휴지통/복원·영구 삭제는 [완료분 기록](COMPLETED_LOG.md#ops-031--버그-수명주기-게시와-승인된-실환경-정리-완료분)으로 분리했다. 남은 것은 별도 승인 대기 중인 격리 MariaDB의 파기 포함 전체 수명주기·경합 검증이다. 비파괴 native 16조건, D1/Worker 결과나 P1 관계 교체 권한 승인을 native 파기 검증 완료/승인으로 간주하지 않는다. QLT-015의 차단된 저장소 경합 및 QLT-016의 미해결 fixture503은 별도 항목이다.
- [ ] **OPS-032** 남은 의존성 보안 유지보수 — OPS-030은 실제 Worker RSC decoder의 특정 advisory만 해결했다. NextAuth4.24.15, native MariaDB3.5.3, Next/이미지·build-only tooling 등은 실제 실행 경로와 호환성을 구분해 검토한다. 전체 npm audit 해소를 주장하거나 일괄 major override를 하지 않는다.



- [ ] **[OPS-021](#ops-021--synology-nas-배포-준비)** Synology NAS 배포 준비

---

## 세부


<a id="t-033--일반-팀원의-프로젝트-전환"></a>
<a id="prd-033--일반-팀원의-프로젝트-전환"></a>
완료: [PRD-033 일반 팀원의 프로젝트 전환](COMPLETED_LOG.md#prd-033--일반-팀원의-프로젝트-전환-2026-10-09).


<a id="t-034--주제-목표와-카드별-완료-기준"></a>
<a id="prd-034--주제-목표와-카드별-완료-기준"></a>
완료: [PRD-034 주제 목표와 카드별 완료 기준](COMPLETED_LOG.md#prd-034--주제-목표와-카드별-완료-기준-2026-10-09).


<a id="t-035--수행-가능한-담당자와-책임-분담"></a>
<a id="prd-035--수행-가능한-담당자와-책임-분담"></a>
완료: [PRD-035 수행 가능한 담당자와 책임 분담](COMPLETED_LOG.md#prd-035--수행-가능한-담당자와-책임-분담-2026-10-09).


<a id="t-036--업무-상태와-실제-진척"></a>
<a id="prd-036--업무-상태와-실제-진척"></a>
완료: [PRD-036 업무 상태와 실제 진척](COMPLETED_LOG.md#prd-036--업무-상태와-실제-진척-2026-10-09).


<a id="t-037--원본이-남는-산출물-버전"></a>
<a id="prd-037--원본이-남는-산출물-버전"></a>
완료: [PRD-037 원본이 남는 산출물 버전](COMPLETED_LOG.md#prd-037--원본이-남는-산출물-버전-2026-10-09).


<a id="t-038--제출-검토-보완-재제출-승인"></a>
<a id="prd-038--제출-검토-보완-재제출-승인"></a>
완료: [PRD-038 제출 검토 보완 재제출 승인](COMPLETED_LOG.md#prd-038--제출-검토-보완-재제출-승인-2026-10-09).


<a id="t-039--내-업무와-내-검토-대기"></a>
<a id="prd-039--내-업무와-내-검토-대기"></a>
완료: [PRD-039 내 업무와 내 검토 대기](COMPLETED_LOG.md#prd-039--내-업무와-내-검토-대기-2026-10-09).


<a id="t-040--주제-현황과-선후행-차단"></a>
<a id="prd-040--주제-현황과-선후행-차단"></a>
완료: [PRD-040 주제 현황과 선후행 차단](COMPLETED_LOG.md#prd-040--주제-현황과-선후행-차단-2026-10-09).

<a id="t-041--주제별-업무-분해-템플릿"></a>
<a id="prd-041--주제별-업무-분해-템플릿"></a>
완료: [PRD-041 주제별 업무 분해 템플릿](COMPLETED_LOG.md#prd-041--주제별-업무-분해-템플릿-2026-10-09).

<a id="t-042--업무와-산출물-검색"></a>
<a id="prd-042--업무와-산출물-검색"></a>
완료: [PRD-042 업무와 산출물 검색](COMPLETED_LOG.md#prd-042--업무와-산출물-검색-2026-10-09).

<a id="t-043--행동이-필요한-인앱-알림"></a>
<a id="prd-043--행동이-필요한-인앱-알림"></a>
완료: [PRD-043 행동이 필요한 인앱 알림](COMPLETED_LOG.md#prd-043--행동이-필요한-인앱-알림-2026-10-09).

<a id="t-044--팀-업무-전체-흐름-인수-검증"></a>
<a id="prd-044--팀-업무-전체-흐름-인수-검증"></a>
완료: [PRD-044 팀 업무 전체 흐름 인수 검증](COMPLETED_LOG.md#prd-044--팀-업무-전체-흐름-인수-검증-2026-10-09).

---


<a id="t-013--db-credential-최소권한-분리"></a>

### QLT-013 — DB credential 최소권한 분리

**분류** 보안

코드는 runtime `DB_*`와 명시적 schema `DB_SCHEMA_*` 연결을 분리했고 누락 시 fallback하지 않는다. 남은 것은 운영자가 별도 identity를 안전하게 구성하고 runtime 계정의 불필요한 DDL/ledger 변경 권한을 제거·검증하는 단계다. 현재 운영 계정이 실제로 제한됐다고 주장하지 않는다.

RPT-018(D3)의 "최소권한" 요구와 같은 작업이다.

착수 체크리스트:

- [x] schema 전용 env 키와 별도 연결 경로 구현 (운영 계정 생성/구성은 대기)
- [ ] runtime 계정에서 DDL 권한 제거
- [x] `src/shared/server/database-admin`의 명시적 DDL만 schema 계정 사용; readiness는 runtime 유지
- [x] `env.example`과 `docs/HARNESS_MAP.md` env 계약 갱신
- [ ] 실제 제한 계정으로 DML 허용·DDL/ledger 변경 거부를 검증 (계정/권한 변경 승인 필요)

코드/운영 경계와 남은 검증: [Native DB 운영](NATIVE_DATABASE_MIGRATIONS.md). 단위 검증을 실제 최소권한 적용으로 표시하지 않는다.

---

### 9단계 — Scheduled project digest + DOCX/PPTX report export

상세 계약과 게이트는 [PROJECT_DIGEST_REPORT_PLAN.md](PROJECT_DIGEST_REPORT_PLAN.md)를 따른다. 아래는 그 문서의 D0~D5에 대응한다.

전 단계에 걸치는 제약(AGENTS.md 9·10항):

- scheduled digest는 기본 **dry-run/download-only**다. `SubmissionVisibilityFilter`, machine token, DB idempotency ledger 없이 활성화하지 않는다.
- report renderer는 **동일한 versioned snapshot**을 사용한다. DOCX는 `docx`, runtime PPTX는 브라우저 없는 `pptxgenjs` 직접 생성을 쓴다.

<a id="t-015--d0-versioned-digestsnapshot"></a>

#### RPT-015 — D0 versioned `DigestSnapshot`

현재 DB 사실만 담는 versioned snapshot과 privacy fixture. 이후 D1·D2가 모두 이 snapshot 하나를 소비하므로 먼저 확정한다.

<a id="t-016--d1-manual-json-preview"></a>

#### RPT-016 — D1 manual JSON preview

**선행** RPT-015

admin/superuser용 수동 JSON 미리보기.

<a id="t-017--d2-docxpptx-export"></a>

#### RPT-017 — D2 DOCX/PPTX export

**선행** RPT-015

RPT-015의 snapshot을 그대로 쓰는 export와 권한 확인 다운로드. 다운로드 경로는 QLT-005의 viewer-aware 조회 규약을 따라야 한다.

<a id="t-018--d3-scheduler-운영-기반"></a>

#### RPT-018 — D3 scheduler 운영 기반

**선행** QLT-012, RPT-017

scheduler token, dry-run, MariaDB versioned migration, 최소권한 계정, run ledger/idempotency. QLT-012·QLT-013과 범위가 겹치므로 함께 설계한다.

<a id="t-019--d4-download-only-운영"></a>

#### RPT-019 — D4 download-only 운영

**선행** RPT-018

download-only 운영과 artifact retention.

<a id="t-020--d5-delivery-검토"></a>

#### RPT-020 — D5 delivery 검토

**선행** RPT-019

membership/recipient consent와 threat model 승인 이후에만 delivery를 검토한다. 승인 전에는 착수하지 않는다.

---

<a id="t-021--synology-nas-배포-준비"></a>

### OPS-021 — Synology NAS 배포 준비

**분류** 10단계

착수 체크리스트:

- [ ] 배포 대상 환경 정의(아키텍처, Node 버전, MariaDB 위치)
- [ ] 빌드·기동 절차 정리 — native Webpack 오프라인 폰트 fixture 빌드는 확인했으나 NAS 기본 Turbopack/정상 폰트 다운로드는 미확인이다. fixture의 font URL 실패와 동적 파일 NFT 추적 경고는 [하네스 기록](HARNESS_MAP.md#2026-10-10-native-통합-준비)을 따른다.
- [ ] env·볼륨 경계 정의 — `UPLOAD_DIR`, `LOG_DIR`, DB 자격 증명
- [ ] 백업·복구 절차와 로그 보존 기간 확정

---

### OPS-022 — 클라우드 검증 환경의 빌드·인증 전제 확정

완료: [Sites Worker 전환 및 공개 게시](COMPLETED_LOG.md#ops-022--sites-worker-전환-및-공개-게시-2026-10-08). 기존 heading은 이전 링크 호환을 위해 유지한다.

초기 SHA `2f6b74d7b77106d38ad914eee14e1e073c61b039`의 저장된 클라우드 환경 실측은 [CLOUD_INSTALL_REPORT_2026-10-08.md](CLOUD_INSTALL_REPORT_2026-10-08.md)에 그대로 보존한다. 그 보고서의 Google Fonts 다운로드 실패, 오프라인 fixture 빌드, `NO_SECRET` 500, 47건 테스트 및 디스크 수치는 **당시 해당 환경**의 결과다. 이후 Sites 게시·인증 완료 여부나 현재 환경의 측정값으로 해석하지 않는다.

현재 공개 Site version10과 source `3b4af81`의 게시 결과·인증 경계·브라우저 확인 범위는 [P1 인수 결과](P1_ACCEPTANCE_2026-10-09.md#게시-및-데이터-보존)에 있다. 실제 다중 Google 계정 협업과 미실행 native 파기·차단된 경합 검증은 이 완료에 포함하지 않는다.

---

### OPS-023 — Sites 배포 환경과 Google OAuth 호환성 검증

완료: [인증 후 보호 화면 실환경 브라우저 검증](COMPLETED_LOG.md#ops-023--인증-후-보호-화면-실환경-브라우저-검증-2026-10-08). 기존 heading은 이전 링크 호환을 위해 유지한다.

기존 Google OAuth/NextAuth v4와 역할·비공개 자료 정책을 유지한 Worker 빌드·HTTP 검증, D1/R2 전환, 공개 게시 및 소유자의 실제 Google 로그인 후 보호 화면 확인을 완료했다. [초기 preflight](SITES_PREFLIGHT_2026-10-08.md)의 비공개·미게시·미검증 문구는 전환 전 기록이며 현재 상태가 아니다. [실환경 QA](SITES_LIVE_QA_2026-10-08.md)와 [최신 게시/검증 한계](P1_ACCEPTANCE_2026-10-09.md)를 함께 본다.

기존 운영 데이터·역할의 자동 이전이나 실제 타인 계정의 권한 변경을 수행했다는 뜻은 아니다. 합성 Worker 역할 검사, 실제 소유자 세션 확인, 다중 실계정 미실행 범위를 구분한다.

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

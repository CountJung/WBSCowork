# WBS 태스크 — 진행 목록

> **살아있는 문서** — 단계 범위, 검증 절차, 블로커가 바뀔 때마다 업데이트하십시오.
> 최종 검토: 2026-10-09 · 다음 번호: **QLT-017 / RPT-021 / OPS-033 / PRD-045**

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

**P1: 핵심 흐름 이후의 운영 편의**

- [~] **[PRD-040](#prd-040--주제-현황과-선후행-차단)** 주제 현황·지연·실제 선후행/차단 — 코드·D1/Worker 검사 완료, native·최종 게시/브라우저 인수 진행
- [~] **[PRD-041](#prd-041--주제별-업무-분해-템플릿)** 주제별 수동 업무 분해 템플릿 — 코드·D1/Worker 검사 완료, native·최종 게시/브라우저 인수 진행
- [~] **[PRD-042](#prd-042--업무와-산출물-검색)** 업무·산출물 검색 및 필터 — 코드·D1/Worker 검사 완료, native·최종 게시/브라우저 인수 진행
- [~] **[PRD-043](#prd-043--행동이-필요한-인앱-알림)** 배정·검토·보완 요청의 인앱 알림 — 선행 PRD-035, PRD-038, PRD-039

P0의 목표·배정·상태·버전·검토·개인 업무를 기반으로 다음 제품 작업은 P1에서 선택한다. 기존 OPS-032 보안 유지보수와 엔지니어링 백로그는 병행한다. 외부 알림 발송은 RPT-020의 승인 범위를 따르고, AI 자동 분해·자동 배정은 필수 범위에 넣지 않는다.


### 정리·품질·운영

<a id="t-010--프로젝트-crud-경로-이중화-정리"></a>
<a id="qlt-010--프로젝트-crud-경로-이중화-정리"></a>
<a id="t-014--next-envdts와-tsconfig-include-정리"></a>
<a id="qlt-014--next-envdts와-tsconfig-include-정리"></a>
<a id="t-012--versioned-migration-부재"></a>
<a id="qlt-012--versioned-migration-부재"></a>
<a id="t-011--테스트-커버리지-확장"></a>
<a id="qlt-011--테스트-커버리지-확장"></a>
완료: [QLT-012 native versioned migration](COMPLETED_LOG.md#qlt-012--native-versioned-migration-2026-10-09), [QLT-011 테스트 경계 확장](COMPLETED_LOG.md#qlt-011--날짜계층첨부역할-회귀-확장-2026-10-09), [QLT-010 프로젝트 CRUD 중복 정리](COMPLETED_LOG.md#qlt-010--프로젝트-crud-단일화-2026-10-09), [QLT-014 타입 생성물 정리](COMPLETED_LOG.md#qlt-014--필요한-next-타입-유지와-잔재-제외-2026-10-09).


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

- [~] **OPS-031** 버그 검증 완료·휴지통·영구 삭제 — 관리자 검증/휴지통/복원, SU 전용 현재 버전·전체 이력 지문·제목 확인 영구 삭제를 정식 기능으로 구현한다. 원문·이력은 최종 삭제 전 보존하고 최소 삭제 증빙은 별도 보존한다. 격리 D1/Worker 회귀·독립 안전성 검토·기존 MariaDB additive upgrade 포함. 실환경 합성 제보 #1의 검증/휴지통/복원은 승인된 테스트 범위이며 영구 삭제는 최신 정확한 대상을 보고한 뒤 별도 승인한다.
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

### PRD-040 — 주제 현황과 선후행 차단

**우선순위 P1 · 선행 PRD-035, PRD-036, PRD-038.** 기존 프로젝트/상위 작업 묶음을 활용하며 별도 대시보드 체계를 중복 만들지 않는다.

완료 기준:
- PRD-036의 기본 상태 요약을 확장하여 미배정·지연·선후행 차단을 함께 보여주고 각 숫자에서 해당 카드로 이동한다.
- 업무 분해 계층과 “A가 끝나야 B 시작”을 별도로 표현한다. 실제 의존성은 순환/다른 프로젝트의 무권한 참조를 거부하고 차단 사유·해제 근거를 보여준다.
- 날짜 변경/완료/재오픈 후 요약이 일치한다. 초기 범위에서는 복잡한 가중치·자동 일정 재배치를 넣지 않는다.

<a id="t-041--주제별-업무-분해-템플릿"></a>

### PRD-041 — 주제별 업무 분해 템플릿

**우선순위 P1 · 선행 PRD-034~PRD-036.** 수동 카드 생성은 이미 가능하다. 반복 주제의 준비 비용을 줄인다.

완료 기준:
- 예시 주제 템플릿에 업무 계층·설명·기대 산출물·완료 기준·상대 기한을 담고, 생성 전 미리보기에서 담당자/날짜/불필요 카드를 수정할 수 있다.
- 복제 후 원본 템플릿 변경이 생성된 업무를 바꾸지 않으며, 기존 사용자/비공개 파일·권한을 무심코 복제하지 않는다. 반복 실행 시 의도치 않은 중복 생성도 막는다.
- AI 자동 분해·자동 배정 없이 수동 템플릿만으로 인수한다. AI 보조는 이후 명시적으로 요청될 때 별도 검토한다.

<a id="t-042--업무와-산출물-검색"></a>

### PRD-042 — 업무와 산출물 검색

**우선순위 P1 · 선행 PRD-035~PRD-038.** 버그 검색은 이미 있으나 업무/산출물 검색은 없다.

완료 기준:
- 업무 제목·설명, 제출 본문·파일명·작성자와 프로젝트/담당자/기한/상태 필터를 지원한다. 최신본/승인본/이전 버전의 검색 포함 규칙을 표시한다.
- 결과·snippet·건수·페이지네이션을 SQL 조회 단계에서 권한에 맞게 제한한다. 볼 수 없는 private 자료와 조회 권한 없는 프로젝트의 존재가 검색으로 드러나지 않는다.
- 먼저 저장된 텍스트/파일명 검색을 구현한다. 파일 내용 OCR·외부 문서 수집·벡터 검색은 필수 범위가 아니다.

<a id="t-043--행동이-필요한-인앱-알림"></a>

### PRD-043 — 행동이 필요한 인앱 알림

**우선순위 P1 · 선행 PRD-035, PRD-038, PRD-039.** 별도 이메일/메신저 발송 없이 다음 행동을 알려준다.

완료 기준:
- 배정·검토 요청·보완 요청·승인/관련 피드백에 대해 대상자별 읽지 않은 알림과 해당 카드/버전 링크가 있다. 전체 변경을 모두에게 뿌리지 않는다.
- 중복 이벤트 재처리에도 같은 알림이 쌓이지 않는다. 재배정/권한 회수 이후에는 알림 제목·요약·직접 링크로 이전 자료가 노출되지 않는다.
- 알림과 보존할 업무 검토 이력을 구분한다. 외부 발송·정기 digest·새 OAuth 권한은 이 작업에서 활성화하지 않고 기존 RPT-020과 별도 승인 계약을 따른다.

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
- [ ] 빌드·기동 절차 정리
- [ ] env·볼륨 경계 정의 — `UPLOAD_DIR`, `LOG_DIR`, DB 자격 증명
- [ ] 백업·복구 절차와 로그 보존 기간 확정

---

### OPS-022 — 클라우드 검증 환경의 빌드·인증 전제 확정

**분류** 환경 / 배포 전제 (2026-10-08)

SHA `2f6b74d7b77106d38ad914eee14e1e073c61b039`의 격리 검증 결과는
[CLOUD_INSTALL_REPORT_2026-10-08.md](CLOUD_INSTALL_REPORT_2026-10-08.md)에 기록했다.

- 기본 `npm run build`는 Google Fonts Roboto 다운로드 실패로 exit 1이다. 공식 Google fonts 저장소의 실제 폰트와 별도 response fixture를 쓰는 오프라인 Turbopack 빌드는 exit 0이다. 이 환경 보완은 원본 소스 변경이나 기본 빌드의 네트워크 성공을 뜻하지 않는다.
- 자격증명을 사용·생성하지 않은 production HTTP 검사에서 `/privacy`는 200이고 인증 의존 경로는 NextAuth `NO_SECRET`로 500이다. 배포 담당자는 승인된 호스팅과 기존 OAuth callback/secret 전달 방식을 확정해야 한다. 기존 `users.role` 유지에는 기존 DB 연결 또는 별도 승인된 이전이 필요하다.
- Linux native DB 탐지의 `spawnSync('command', ['-v', ...])`는 `ENOENT`다. 환경 전용 shim을 별도 준비했고 앱/기존 하네스는 수정하지 않았다. 정식 지원을 결정할 때 Linux 탐지를 보완한다.
- Node 26 `mock.module()`의 `ExperimentalWarning`은 테스트 계약의 현재 한계다. suppression 없이 로그를 보존했다.
- MariaDB 컨테이너는 `io_uring` EPERM 후 libaio로 동작한다. 디스크 DB의 `max_open_files` 상한 경고도 기록했다. 47건 테스트는 통과했고 호스트 보안·sysctl·리소스 설정은 변경하지 않았다. 운영 DB 요구량은 대상 호스팅에서 다시 확인한다.
- npm 11.20의 최초 설치 훅 미승인 경고는 별도 고정 버전 설정과 `npm rebuild esbuild sharp unrs-resolver`로 보완했다. 원본 package/lock은 그대로다.

외부 게시, 실제 Google 로그인, 인증된 production HTTP 역할 매트릭스, 운영 DB와 브라우저 검증은 이 작업 범위에서 미실행이다.

---

### OPS-023 — Sites 배포 환경과 Google OAuth 호환성 검증

**분류** Sites 게시 / 환경 준비 (2026-10-08)

[SITES_PREFLIGHT_2026-10-08.md](SITES_PREFLIGHT_2026-10-08.md)에 기술 제약, 검증 결과와 남은 작업을 기록했다. `feat/sites-deployment` 브랜치에 실측 체크포인트를 push했고 main은 원본 SHA를 보존한다.

- Sites용 빌드·배포 환경을 준비한 뒤 작은 인증 검증본부터 실행한다.
- Google OAuth/NextAuth v4의 실제 Worker 호환성과 외부 사용자 접근 범위는 미확인이다. 인증 경로가 성립한 뒤에만 D1/R2 전체 전환한다.
- 실제 OAuth callback/secret 전달, 기존 데이터·role 이전, 유료 서비스는 별도 사용자 판단 지점이다. 인증 우회·ChatGPT 로그인 대체·개발 포트의 게시 대체를 하지 않는다.
- `wbscowork` 사이트 등록과 예약 origin 확인은 완료했고 프로젝트 ID를 `.openai/hosting.json`에 보존했다. 초기 비공개·미게시 상태를 유지한다.
- Worker 빌드·HTTP, D1/R2 전환, 실제 Google 로그인과 배포는 미실행이다.

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

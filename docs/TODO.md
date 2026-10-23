# 현재 상태와 열린 작업

이 문서는 **지금 어디까지 왔고 다음 무엇을 해야 하는가**를 소유한다. 단계/완료 게이트는 [MASTER_PLAN](MASTER_PLAN.html), 과거 근거는 [COMPLETED_LOG](COMPLETED_LOG.md), 상세 digest 설계는 [계획](PROJECT_DIGEST_REPORT_PLAN.md)에 있다.

최종 검토: 2026-10-23 · 다음 번호: **QLT-024 / RPT-021 / OPS-038 / PRD-051**

## 현재 상태

| 구분 | 확인된 상태 | 다음 경계 |
| --- | --- | --- |
| 제품 | 기반 WBS/FSD와 팀 업무 P0/P1, 버그/스크린샷 구현 완료 | 실제 다중 Google 계정·채워진 UI 인수는 합성 검증과 별개 |
| Git 소스 | QLT-019 import 수정·봉사활동 저장 기반에 팀장/직접 완료 기능을 후속 구현 | 이번 소스 검증은 HARNESS_MAP, 운영 반영 여부는 게시 원장으로 구분. main/sites 기본 build 차이 유지 |
| 운영 게시 | 기존 public Sites version14, source41059c8의 terminal succeeded 확인 | [게시 원장](COMPLETED_LOG.md#sites-게시-원장). 사용자 신규 첨부·새로고침·다운로드 PASS. 운영 수정 시 추가 첨부는 미검증. NAS 배포 없음 |
| 최근 검증 | QLT-021 핵심 삭제 오판은 실제 Google 세션의 운영 UI 인수 PASS | [검증 기준선](HARNESS_MAP.md#검증-기준선). 신규 업로드는 통과했으나 추가 첨부·운영 파일 삭제는 미검증이며 QLT-022와 다른 열린 항목 유지 |
| 후속 계획 | digest/report D0–D5 미구현, 실제 NAS 적용/인수 미완료 | D0부터 순서대로 진행, delivery는 별도 동의·승인 |
| 봉사활동 | 확정 정책의 프로젝트/팀 관리·팀장 범위 업무·직접 완료를 구현하고 로컬/합성 인수 완료 | 기존 업무/협업 업무 제출 필수와 private 계약 유지. 운영 schema/사이트·실 Google 인수는 미반영/미실행 |

## 열린 항목

`[ ]` 대기, `[~]` 진행, `[!]` 외부/판단 대기다. 각 항목의 상태·남은 부분·다음 행동은 이 표 한 곳에서만 관리한다.

| ID | 상태 | 남은 일·다음 행동 | 계약/근거 |
| --- | --- | --- | --- |
| QLT-013 | [!] | runtime/schema credential 코드 분리는 완료. 실제 최소권한 계정의 DML 허용·DDL/ledger 거부는 운영자 승인/대상 확인 후 검증 | [Native 운영](NATIVE_DATABASE_MIGRATIONS.md) |
| QLT-015 | [!] | 플랫폼 검토로 차단된 두 cleanup runner 정지/재개 경합은 미실행. 허용 범위가 달라지기 전 우회·재시도하지 않음 | [검증 한계](HARNESS_MAP.md#검증-기준선) |
| QLT-016 | [ ] | Worker 동시 form의 간헐503 원인 확인. 재실행 통과를 원인 해결로 바꾸지 않음 | [검증 기준선](HARNESS_MAP.md#검증-기준선) |
| QLT-020 | [ ] | Native 첨부 bug의 durable 파일 정리 도입. 그전 영구 삭제는 fail-closed 유지 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| QLT-022 | [!] | version14 연결 실패 안내·초안 보존과 사용자 브라우저 신규 첨부·새로고침·다운로드는 통과했다. 수정으로 첨부를 추가하는 운영 경로는 미검증이며 로컬 회귀만 통과. 최초 연결 실패 원인은 미확정으로 자동화 파일 전달 한계와 앱 원인을 구분한다. 생성된 사용자 자료는 보존하며 삭제는 미승인 | [관측·미확인 경계](HARNESS_MAP.md#제출물-첨부-운영-오류-qlt-022) |
| OPS-021 | [~] | NAS 소스/업데이트 절차는 준비됨. 실제 플랫폼·백업·기본 build·대상 릴리스 migration 적용·기동·자료/역할/수동 인수는 운영자가 수행. 기존 NFT warning도 유지 | [운영 안내](NAS_UPDATE_GUIDE.md) |
| OPS-031 | [!] | Native bug purge 포함 전체 수명주기/두 isolation-level 경합 검증은 별도 승인 대기. 비파괴16조건·Sites 삭제 완료와 구분 | [완료 범위](COMPLETED_LOG.md#실환경-qa와-삭제-승인-경계) |
| OPS-032 | [ ] | Next/NextAuth/MariaDB 등 남은 dependency advisory를 실제 native/Worker 사용 경로별 검토. 전체 npm audit 해결이나 강제 major override를 주장하지 않음 | [보안 근거](COMPLETED_LOG.md#보안-패치와-활성-decoder) |
| OPS-033 | [!] | 레이아웃 실사이트의 전체6개 너비·관리자/버그 UI 인수. 부모 Chrome의 홈/tasks1188×761 확인은 부분 근거 | [접속 경계](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크) |
| OPS-034 | [!] | 과거 환경의 host 추가 승인·차단 기록 보존. version13 게시 점검 환경은 기존 proxy CONNECT200·익명 GET smoke 통과. 정책 파일/플랫폼 설정 적용 자체는 직접 미확인으로 환경별 결과를 구분 | [접속 기준선](HARNESS_MAP.md#브라우저와-운영-연결) |
| OPS-035 | [!] | version12 스크린샷의 실제 운영 UI 인수. 합성Chromium1280/390 결과와 구분하고 운영 제보 생성/삭제를 임의로 하지 않음 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| RPT-015 | [ ] | D0 versioned DigestSnapshot·privacy fixture·stable hash | [D0–D5 계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-016 | [ ] | D1 manual JSON preview; RPT-015 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-017 | [ ] | D2 동일 snapshot의 DOCX/PPTX; RPT-015 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-018 | [ ] | D3 scheduler token/dry-run/별도 schema/run ledger; QLT-012 완료 계약과 RPT-017 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-019 | [ ] | D4 download-only/retention; RPT-018 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-020 | [!] | D5 recipient consent·visibility/threat model 확정 후 delivery 검토; RPT-019 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |

## 봉사활동 확장 작업

PRD-046 정책 확정과 PRD-047~050/QLT-023의 코드·로컬/합성 게이트를 완료해 열린 큐에서 이관했다. 단계/게이트는 [MASTER_PLAN](MASTER_PLAN.html#volunteering), 현재 계약은 [ARCHITECTURE](ARCHITECTURE.md#봉사활동-확장-계획), 고유 완료 근거는 [COMPLETED_LOG](COMPLETED_LOG.md#봉사활동-팀과-직접-완료-인수), 실행 scope는 [HARNESS_MAP](HARNESS_MAP.md#봉사활동-팀장과-직접-완료-검증)가 소유한다.

완료 범위는 양 DB·서버 권한/완료 workflow·실제 로컬 Worker와 hydrated desktop/mobile의 합성 인수다. 운영 migration·실제 계정 권한 변경·Google 로그인·운영 사이트 인수·게시/배포는 포함하지 않으며 기존 열린 운영 항목을 닫지 않는다. 운영의 프로젝트5/작업7·사용자 첨부는 보존한다. QLT-019는 [import 기록](COMPLETED_LOG.md#qlt-019-google-provider-import)을 따른다.

## ID와 갱신 규칙

- QLT(품질), RPT(digest), OPS(운영), PRD(제품)의 다음 번호를 해당 섹션에서만 올리고 재사용하지 않는다. 기존 T 번호는 [TASK_ID_MAP](TASK_ID_MAP.md)의 영구 대응을 따른다.
- 긴 작업은 고정 자식/세부항목으로 나누고 완료 n/전체·진행 중·남은 이유·다음 행동을 매 회차 갱신한다. 구현/검증 대기/실패/외부 대기를 구분한다. 닫힌 항목은 이유·고유 검증 근거만 COMPLETED_LOG에 남기고 큐에서 제거한다.
- QLT-021은 코드·로컬 회귀에 이어 운영의 핵심 삭제 오판 인수를 완료했다. 대상별 승인·정리 근거는 [완료 기록](COMPLETED_LOG.md#qlt-021-운영-인수와-승인된-합성-정리)에만 둔다. 첨부 관련 미완료는 QLT-022로 분리하며 새 날짜별 보고서를 만들지 않는다.

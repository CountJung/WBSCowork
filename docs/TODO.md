# 현재 상태와 열린 작업

이 문서는 **지금 어디까지 왔고 다음 무엇을 해야 하는가**를 소유한다. 단계/완료 게이트는 [MASTER_PLAN](MASTER_PLAN.html), 과거 근거는 [COMPLETED_LOG](COMPLETED_LOG.md), 상세 digest 설계는 [계획](PROJECT_DIGEST_REPORT_PLAN.md)에 있다.

최종 검토: 2026-10-21 · 다음 번호: **QLT-022 / RPT-021 / OPS-038 / PRD-046**

## 현재 상태

| 구분 | 확인된 상태 | 다음 경계 |
| --- | --- | --- |
| 제품 | 기반 WBS/FSD와 팀 업무 P0/P1, 버그/스크린샷 구현 완료 | 실제 다중 Google 계정·채워진 UI 인수는 합성 검증과 별개 |
| Git 소스 | main(NAS) / sites(Worker) 두 branch. QLT-021 수정은 main ddcedd6 / sites c1c55da에 반영 | 이 문서 정리는 이 소스를 기준으로 하며 앱 로직을 바꾸지 않음 |
| 운영 게시 | 마지막 확인은 public Sites version12, source0d1a1a3, env revision11 | QLT-021의 Git 반영은 사이트 재게시/NAS 배포를 뜻하지 않음. 확인된 게시 원장은 COMPLETED_LOG |
| 최근 검증 | QLT-021 회차: D1 57 / MariaDB52, action8, unit119, visibility33, Worker257 PASS | 다른 환경의 QLT-019, 아래 미실행/운영 항목은 닫지 않음. 이번 문서 작업의 검증은 HARNESS_MAP에 별도 기록 |
| 후속 계획 | digest/report D0–D5 미구현, 실제 NAS 적용/인수 미완료 | D0부터 순서대로 진행, delivery는 별도 동의·승인 |

## 열린 항목

`[ ]` 대기, `[~]` 진행, `[!]` 외부/판단 대기다. 각 항목의 상태·남은 부분·다음 행동은 이 표 한 곳에서만 관리한다.

| ID | 상태 | 남은 일·다음 행동 | 계약/근거 |
| --- | --- | --- | --- |
| QLT-013 | [!] | runtime/schema credential 코드 분리는 완료. 실제 최소권한 계정의 DML 허용·DDL/ledger 거부는 운영자 승인/대상 확인 후 검증 | [Native 운영](NATIVE_DATABASE_MIGRATIONS.md) |
| QLT-015 | [!] | 플랫폼 검토로 차단된 두 cleanup runner 정지/재개 경합은 미실행. 허용 범위가 달라지기 전 우회·재시도하지 않음 | [검증 한계](HARNESS_MAP.md#검증-기준선) |
| QLT-016 | [ ] | Worker 동시 form의 간헐503 원인 확인. 재실행 통과를 원인 해결로 바꾸지 않음 | [검증 기준선](HARNESS_MAP.md#검증-기준선) |
| QLT-019 | [ ] | 과거 Node24/26의 GoogleProvider import 실패를 환경별로 분리해 재현성 확인. QLT-021 회차119/33 통과 환경에서는 미재현이며 모든 환경의 해결로 확대하지 않음 | [하네스](HARNESS_MAP.md#검증-기준선) |
| QLT-020 | [ ] | Native 첨부 bug의 durable 파일 정리 도입. 그전 영구 삭제는 fail-closed 유지 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| OPS-021 | [~] | NAS 소스/업데이트 절차는 준비됨. 실제 플랫폼·백업·기본 build·v1–v9 적용·기동·자료/역할/수동 인수는 운영자가 수행. 기존 NFT warning도 유지 | [운영 안내](NAS_UPDATE_GUIDE.md) |
| OPS-031 | [!] | Native bug purge 포함 전체 수명주기/두 isolation-level 경합 검증은 별도 승인 대기. 비파괴16조건·Sites 삭제 완료와 구분 | [완료 범위](COMPLETED_LOG.md#실환경-qa와-삭제-승인-경계) |
| OPS-032 | [ ] | Next/NextAuth/MariaDB 등 남은 dependency advisory를 실제 native/Worker 사용 경로별 검토. 전체 npm audit 해결이나 강제 major override를 주장하지 않음 | [보안 근거](COMPLETED_LOG.md#보안-패치와-활성-decoder) |
| OPS-033 | [!] | 레이아웃 실사이트의 전체6개 너비·관리자/버그 UI 인수. 부모 Chrome의 홈/tasks1188×761 확인은 부분 근거 | [접속 경계](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크) |
| OPS-034 | [!] | 정확한host 한 개 outbound 추가는 사용자 승인 완료, 플랫폼 관리 경로 접근/적용 대기. 환경 republish 후 새 작업에서 기존 proxy를 유지해 재진단 | [최소 조치](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크) |
| OPS-035 | [!] | version12 스크린샷의 실제 운영 UI 인수. 합성Chromium1280/390 결과와 구분하고 운영 제보 생성/삭제를 임의로 하지 않음 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| RPT-015 | [ ] | D0 versioned DigestSnapshot·privacy fixture·stable hash | [D0–D5 계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-016 | [ ] | D1 manual JSON preview; RPT-015 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-017 | [ ] | D2 동일 snapshot의 DOCX/PPTX; RPT-015 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-018 | [ ] | D3 scheduler token/dry-run/별도 schema/run ledger; QLT-012 완료 계약과 RPT-017 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-019 | [ ] | D4 download-only/retention; RPT-018 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-020 | [!] | D5 recipient consent·visibility/threat model 확정 후 delivery 검토; RPT-019 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |

## ID와 갱신 규칙

- QLT(품질), RPT(digest), OPS(운영), PRD(제품)의 다음 번호를 해당 섹션에서만 올리고 재사용하지 않는다. 기존 T 번호는 [TASK_ID_MAP](TASK_ID_MAP.md)의 영구 대응을 따른다.
- 긴 작업은 고정 자식/세부항목으로 나누고 완료 n/전체·진행 중·남은 이유·다음 행동을 매 회차 갱신한다. 구현/검증 대기/실패/외부 대기를 구분한다. 닫힌 항목은 이유·고유 검증 근거만 COMPLETED_LOG에 남기고 큐에서 제거한다.
- QLT-021은 코드 수정/로컬 회귀 완료로 여기서 제거했다. 실제 배포 여부는 위 운영 상태와 게시 원장을 따른다. OPS-037 문서 간소화 결과도 기존 완료 기록에 남기며 새 날짜별 보고서를 만들지 않는다.

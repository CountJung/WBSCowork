# 현재 상태와 열린 작업

이 문서는 **지금 어디까지 왔고 다음 무엇을 해야 하는가**를 소유한다. 단계/완료 게이트는 [MASTER_PLAN](MASTER_PLAN.html), 과거 근거는 [COMPLETED_LOG](COMPLETED_LOG.md), 상세 digest 설계는 [계획](PROJECT_DIGEST_REPORT_PLAN.md)에 있다.

최종 검토: 2026-10-23 · 다음 번호: **QLT-030 / RPT-021 / OPS-038 / PRD-058**

## 현재 상태

| 구분 | 확인된 상태 | 다음 경계 |
| --- | --- | --- |
| 제품 | 기반 WBS/FSD와 팀 업무 P0/P1, 버그/스크린샷 구현 완료 | 실제 다중 Google 계정·운영의 채워진 UI 인수는 로컬 합성 검증과 별개 |
| Git 소스 | 현재 구현 소스 mainbd6f4ef/sites5032410 푸시·remote ls-remote 확인. 기존 게시 sourceccabf81와 후속 문서 HEAD 구분 | 이번 소스 검증은 HARNESS_MAP, 운영 반영 여부는 게시 원장으로 구분. main/sites 기본 build 차이 유지 |
| 운영 게시 | 기존 public Sites version18, sourceccabf81의 terminal succeeded와 active/latest·deployment 일치 재조회 확인 | [게시 원장](COMPLETED_LOG.md#sites-게시-원장). 첨부 미리보기/SU 보강 반영·기존7표 보존, 이번 schema/migration0. 코딩 CONNECT403 재시도0. 별도 허용 Work 브라우저의 기존 SU 세션에서 텍스트 미리보기 부분 PASS, 탐색 hydration 결함은 QLT-027 양 runtime 인수·version18 게시 완료, 같은 허용 Work 브라우저의 관측 범위 재인수 PASS. NAS 배포 없음 |
| 최근 검증 | QLT-021 핵심 삭제 오판은 실제 Google 세션의 운영 UI 인수 PASS | [검증 기준선](HARNESS_MAP.md#검증-기준선). 신규 업로드는 통과했으나 추가 첨부·운영 파일 삭제는 미검증이며 QLT-022와 다른 열린 항목 유지 |
| 이번 구현 순서 | QLT-016/029와 RPT-015/017은 독립 로컬 검증 완료 이관. QLT-028/020·OPS-032와 RPT-016/018/019의 외부 인수 게이트 유지 | 구현 소스·최종 검증·main/sites 푸시 완료, 후속 문서 반영 대기. 운영 v18 유지·중간 게시0, 전체 마무리 후 최종 게시 준비. D5 외부 발송·운영 예약 활성화·NAS/실계정/보안/영구 삭제는 제외 |
| 봉사활동 | 확정 정책의 프로젝트/팀 관리·팀장 범위 업무·직접 완료를 구현하고 로컬/합성 인수·version15 게시 완료 | 기존 업무/협업 업무 제출 필수·private 계약과 사용자 자료 표본 보존. 실제 운영 UI·Google 인수와 R2 bytes 대조는 미실행 |
| UX·프로젝트 바인딩 | 확정된 다중 소속·SU 전역/지정 프로젝트 admin 정책으로 UI·SQL scope 구현·Worker/Native strict UI와 기존 봉사 회귀 완료 | 기존 Sites version16 게시 완료. 계정 role/소속 자동 부여0·기존7표 보존; 확정 admin 관리 축소는 게시 코드 정책으로 적용 |
| 제출물 첨부 미리보기 | PRD-056/057·QLT-025/026의 Native/Worker371조건·실제 게시 artifact와 version17 게시 확인 완료 | 부모 Work의 상세/버전 텍스트 미리보기와 SU 참여자·담당자·검토자 후보 제외 부분 PASS. 탐색 React418/초기 표시는 QLT-027 운영 재인수 완료; 팀장 후보 UI·새 Google 인증·원본 bytes 대조는 미검증 |

## 열린 항목

`[ ]` 대기, `[~]` 진행, `[!]` 외부/판단 대기다. 각 항목의 상태·남은 부분·다음 행동은 이 표 한 곳에서만 관리한다.

| ID | 상태 | 남은 일·다음 행동 | 계약/근거 |
| --- | --- | --- | --- |
| QLT-013 | [!] | runtime/schema credential 코드 분리는 완료. 실제 최소권한 계정의 DML 허용·DDL/ledger 거부는 운영자 승인/대상 확인 후 검증 | [Native 운영](NATIVE_DATABASE_MIGRATIONS.md) |
| QLT-015 | [!] | 플랫폼 검토로 차단된 두 cleanup runner 정지/재개 경합은 미실행. 허용 범위가 달라지기 전 우회·재시도하지 않음 | [검증 한계](HARNESS_MAP.md#검증-기준선) |
| QLT-020 | [!] | Native v13 durable staging·가역 quarantine/retry/restore·SU 관리 경로 구현/격리 검증 중. 최종 schema 격리40 PASS 후 실제 화면/운영 인수 대기, 영구 삭제·첨부 bug purge fail-closed 유지 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| QLT-022 | [!] | version14 연결 실패 안내·초안 보존과 사용자 브라우저 신규 첨부·새로고침·다운로드는 통과했다. 수정으로 첨부를 추가하는 운영 경로는 미검증이며 로컬 회귀만 통과. 최초 연결 실패 원인은 미확정으로 자동화 파일 전달 한계와 앱 원인을 구분한다. 생성된 사용자 자료는 보존하며 삭제는 미승인 | [관측·미확인 경계](HARNESS_MAP.md#제출물-첨부-운영-오류-qlt-022) |
| QLT-028 | [!] | Home 함수 직렬화 RED500의 href anchor 최소 수정·Native build/SSR7 PASS. 별도 Chromium OS sandbox helper 차단으로 UI 미인수, secret0 정적 인증 cache 추가 결함의 force-dynamic 보완·최종 HTTP16 PASS 후 브라우저 인수 대기 | [진행 근거](HARNESS_MAP.md#남은-품질과-digest-구현-진행) |
| OPS-021 | [~] | NAS 소스/업데이트 절차는 준비됨. 실제 플랫폼·백업·기본 build·대상 릴리스 migration 적용·기동·자료/역할/수동 인수는 운영자가 수행. 기존 NFT warning도 유지 | [운영 안내](NAS_UPDATE_GUIDE.md) |
| OPS-031 | [!] | Native bug purge 포함 전체 수명주기/두 isolation-level 경합 검증은 별도 승인 대기. 비파괴16조건·Sites 삭제 완료와 구분 | [완료 범위](COMPLETED_LOG.md#실환경-qa와-삭제-승인-경계) |
| OPS-032 | [!] | PPTX 하위 image-size2.0.4 scoped override·호환 검사/양 build 후 production audit0, 전체23(high18/moderate4/low1) 잔여 검토. 최종 전체294·양 build/호환·compiled OOXML18 PASS·전체 취약점 해소 아님. Native trace13경고·NAS 포장 게이트 미확인 | [보안 근거](COMPLETED_LOG.md#보안-패치와-활성-decoder) |
| OPS-033 | [!] | 레이아웃 실사이트의 전체6개 너비·관리자/버그 UI 인수. 부모 Chrome의 홈/tasks1188×761 확인은 부분 근거 | [접속 경계](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크) |
| OPS-034 | [!] | 코딩 실행기의 기존 CONNECT403/Domain forbidden·해당 policy rule 부재 경계로 운영 GET/UI 재시도0. 별도 허용 Work 브라우저의 v17 미리보기·v18 QLT-027 재인수 PASS는 별개 경로다. 과거 host 승인/차단과 version13 환경의 CONNECT200·익명 GET 성공을 보존하며 환경별 결과를 구분. 제한 우회 없음 | [최신 경계](HARNESS_MAP.md#version18-허용-work-브라우저-재인수) |
| OPS-035 | [!] | version12 스크린샷의 실제 운영 UI 인수. 합성Chromium1280/390 결과와 구분하고 운영 제보 생성/삭제를 임의로 하지 않음 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| RPT-016 | [!] | D1 manual preview 구현·소스 workflow/compiled route 인수 완료. Chromium OS sandbox helper 차단으로 실제 화면/키보드·모바일 인수 대기; 소스 구현을 미구현으로 되돌리지 않음 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-018 | [!] | D3 기존 runner의 Native v14/D1 0017 ledger·비활성 기본 scheduler 구현/소스 검증. 로컬 ledger/compiled 인수 완료 후 runtime DDL 거부 실증·운영 조건 확인 대기, 운영 예약 활성화0; QLT-012/RPT-017 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-019 | [!] | D4 인가 download/만료404·가역 quarantine 구현/소스 검증, 소스/compiled 인수 완료 후 실제 NAS 권한/free-space/atomic rename·운영 저장소 인수 대기; RPT-018 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-020 | [!] | D5 recipient consent·visibility/threat model 확정 후 delivery 검토; RPT-019 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |

## 첨부 미리보기와 환경 슈퍼관리자

PRD-056/057·QLT-025/026은 소스/양 DB·Native와 exact Worker artifact의 로컬 인수, version17 게시 상태·기존7표/환경 보존 확인을 마쳐 열린 큐에서 이관했다. 지원 형식/제한·SU 계약은 [ARCHITECTURE](ARCHITECTURE.md#제출물-첨부-미리보기-확장), 고유 구현 근거는 [COMPLETED_LOG](COMPLETED_LOG.md#첨부-미리보기와-su-불변성-구현), 실제 검증·미확인 범위는 [HARNESS_MAP](HARNESS_MAP.md#제출물-첨부-미리보기-검증)을 따른다.

팀장 후보 UI 직접 검증은 로컬 브라우저 흐름에 포함되지 않았고 별도 서버 회귀만 통과했다. 후속 허용 Work 브라우저의 기존 SU 세션에서 실제 attachment7의 제출 상세/버전 미리보기·한글·bounded scroll/줄바꿈과 SU의 참여자/담당자/검토자 후보 제외를 확인했다. 선택 저장/권한 변경은 없었고 새 Google 인증·전체 형식/화면·팀장 후보 UI·독립 R2 inventory/원본 bytes 대조 인수를 뜻하지 않는다. 탐색 React418·시간/인증 초기 표시는 [QLT-027 관측](HARNESS_MAP.md#qlt-027-운영-관측과-재현)의 version18 운영 재인수까지 완료해 [완료 이력](COMPLETED_LOG.md#sites-게시-원장)으로 이관했다. 운영 요청 재시도/제한 우회·실제 계정 role/환경 변경·영구 삭제 없이 프로젝트5/업무7·제출물5/첨부7 metadata를 보존했다. 이번 schema/migration·NAS 배포는 없고, 후속 문서 commit은 현재 version18에 게시한 sourceccabf81를 바꾸거나 앱 재게시를 뜻하지 않는다.

## 봉사활동 확장 작업

PRD-046 정책 확정과 PRD-047~050/QLT-023의 코드·로컬/합성 게이트를 완료해 열린 큐에서 이관했다. 단계/게이트는 [MASTER_PLAN](MASTER_PLAN.html#volunteering), 현재 계약은 [ARCHITECTURE](ARCHITECTURE.md#봉사활동-확장-계획), 고유 완료 근거는 [COMPLETED_LOG](COMPLETED_LOG.md#봉사활동-팀과-직접-완료-인수), 실행 scope는 [HARNESS_MAP](HARNESS_MAP.md#봉사활동-팀장과-직접-완료-검증)가 소유한다.

PRD/QLT 완료 범위는 양 DB·서버 권한/완료 workflow·실제 로컬 Worker와 hydrated desktop/mobile의 합성 인수다. 이후 명시 승인으로 version15 게시와 D1 migration을 확인했지만 실제 계정 역할 부여·Google 로그인·운영 UI 인수는 수행하지 않았으며 기존 열린 운영 항목을 닫지 않는다. 운영 프로젝트5/작업7과 사용자 첨부 metadata의 기존 값 보존을 확인했고 게시 후 R2 bytes 대조는 미실행이다. QLT-019는 [import 기록](COMPLETED_LOG.md#qlt-019-google-provider-import)을 따른다.

## UX 재설계와 프로젝트 바인딩

PRD-051~055와 QLT-024의 소스·로컬 인수를 완료해 열린 큐에서 이관했다. [결정 기록](COMPLETED_LOG.md#ux-시안과-프로젝트-권한-정책-확정), [구현·인수 범위](COMPLETED_LOG.md#ux와-프로젝트-바인딩-구현), [실측 하네스](HARNESS_MAP.md#ux-바인딩-구현과-회귀-검증)를 따른다. 기존 PRD-047~050/QLT-023과 자료·검토/직접 완료 계약은 보존한다.

승인된 main/sites 기능 소스 반영·푸시와 기존 Sites version16의 terminal succeeded/active·latest 재조회, D1 0016 효과·기존7표/공개 범위·환경 보존 확인까지 완료했다. exact 게시 소스와 아티팩트·복구 참조는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장), CI 조회 거부와 운영 미검증 경계는 [검증 기록](HARNESS_MAP.md#version16-게시와-운영-검증-경계)이 소유한다. 후속 문서 commit은 이미 게시한 앱의 소스 SHA를 바꾸거나 새 게시를 뜻하지 않는다.

실제 계정 role/소속 자동 부여는 없고 프로젝트5/업무7·제출물5/첨부7 metadata를 보존했다. 일반 admin 관리 범위 축소는 확정 정책의 게시 코드 변경이며 계정 role 행 변경과 구분한다. 실제 R2 inventory/bytes 다운로드·운영 UI/Google은 미검증이며 기존 CONNECT403 제한을 재시도/우회하지 않았다. Native v12의 실제 NAS 적용도 수행하지 않았다.

## ID와 갱신 규칙

- QLT(품질), RPT(digest), OPS(운영), PRD(제품)의 다음 번호를 해당 섹션에서만 올리고 재사용하지 않는다. 기존 T 번호는 [TASK_ID_MAP](TASK_ID_MAP.md)의 영구 대응을 따른다.
- 긴 작업은 고정 자식/세부항목으로 나누고 완료 n/전체·진행 중·남은 이유·다음 행동을 매 회차 갱신한다. 구현/검증 대기/실패/외부 대기를 구분한다. 닫힌 항목은 이유·고유 검증 근거만 COMPLETED_LOG에 남기고 큐에서 제거한다.
- QLT-021은 코드·로컬 회귀에 이어 운영의 핵심 삭제 오판 인수를 완료했다. 대상별 승인·정리 근거는 [완료 기록](COMPLETED_LOG.md#qlt-021-운영-인수와-승인된-합성-정리)에만 둔다. 첨부 관련 미완료는 QLT-022로 분리하며 새 날짜별 보고서를 만들지 않는다.

# 검증·외부 조건 대기

이 문서는 구현 뒤 남은 실제 인수, 운영자 준비, 정책·권한·환경 대기의 정본이다. 새 구현 작업은 [TODO](TODO.md), 완료한 범위는 [COMPLETED_LOG](COMPLETED_LOG.md), 실행 방법·과거 검증은 [HARNESS_MAP](HARNESS_MAP.md)을 따른다. 대기 항목을 완료로 올리지 않는다.

최종 분류: 2026-11-13. 기존 24개 ID와 고유 근거를 보존했고 후속 구현의 미검증 조건을 추가한다. 행의 과거 날짜·환경·미검증 경계는 이번 검증 결과가 아니다. `[~]`는 부분 완료 뒤 인수 대기, `[!]`는 외부 조건/판단 대기다. 조건이 충족되면 필요한 작업만 TODO로 이동하며 양쪽에서 상태를 중복 소유하지 않는다.

## 대기 항목

| ID | 상태 | 남은 일·재개 조건 | 계약/근거 |
| --- | --- | --- | --- |
| QLT-041 | [~] | 활성 경로 함수와 관리자 aria-current 구현·5개 경로 회귀/정적·빌드 PASS. 실제 키보드·접근성 트리/스크린리더 확인 및 게시 대기 | [검증](HARNESS_MAP.md#활성-메뉴-qlt-041) |
| PRD-070 | [~] | 중복 상단 공통/관리자 메뉴를 Drawer 단일 탐색으로 통합하고 상단 프로젝트 문맥 표시를 유지했다. 소스 검증 완료, 실제 주요 경로·역할·키보드/resize 인수와 운영 게시 미완료 | [검증](HARNESS_MAP.md#탐색-위계-통합-prd-070) |
| PRD-069 | [~] | 좌측 desktop304px/md900·mobile top 구현, lint/type/FSD/Worker build·unit PASS. Chromium socket EPERM으로 실제 geometry·resize·focus/BackForward 인수 미실행. 운영 게시·다른 역할/실기기 인수 전 허용 브라우저 환경에서 test:ui:layout 재실행 | [이번 검증](HARNESS_MAP.md#데스크톱-좌측-메뉴-prd-069) |
| PRD-068 | [~] | 구현·로컬 인수·v30 게시/보존 확인 완료. 남은 일: 실제 로그인 브라우저의 투표/선택 변경/마감 결과, 역할별 접근과 모바일·키보드·오류 흐름 인수. 미실행 범위를 완료 처리하지 않음 | [요구·완료 조건](#프로젝트별-기간제-투표-prd-068) |
| QLT-013 | [!] | runtime/schema credential 코드 분리는 완료. 실제 최소권한 계정의 DML 허용·DDL/ledger 거부는 운영자 승인/대상 확인 후 검증 | [Native 운영](NATIVE_DATABASE_MIGRATIONS.md) |
| QLT-015 | [!] | 플랫폼 검토로 차단된 두 cleanup runner 정지/재개 경합은 미실행. 허용 범위가 달라지기 전 우회·재시도하지 않음 | [검증 한계](HARNESS_MAP.md#검증-기준선) |
| QLT-020 | [!] | Native v13 durable staging·가역 quarantine/retry/restore·SU 관리 경로 구현/격리 검증 중. 최종 schema 격리40 PASS 후 실제 화면/운영 인수 대기, 영구 삭제·첨부 bug purge fail-closed 유지 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| QLT-022 | [!] | version14 연결 실패 안내·초안 보존과 사용자 브라우저 신규 첨부·새로고침·다운로드는 통과했다. 수정으로 첨부를 추가하는 운영 경로는 미검증이며 로컬 회귀만 통과. 최초 연결 실패 원인은 미확정으로 자동화 파일 전달 한계와 앱 원인을 구분한다. 생성된 사용자 자료는 보존하며 삭제는 미승인 | [관측·미확인 경계](HARNESS_MAP.md#제출물-첨부-운영-오류-qlt-022) |
| QLT-028 | [!] | Home 함수 직렬화 RED500의 href anchor 최소 수정·Native build/SSR7 PASS. 별도 Chromium OS sandbox helper 차단으로 UI 미인수, secret0 정적 인증 cache 추가 결함의 force-dynamic 보완·최종 HTTP16 PASS 후 브라우저 인수 대기 | [진행 근거](HARNESS_MAP.md#남은-품질과-digest-구현-진행) |
| QLT-031 | [!] | P1: 소스·양 DB·compiled HTTP 완료, 운영 Chrome1165px/envSU에서4종 준비표 저장·재조회/식사 수량·필수값 오류 초안 보존·Enter/Space·취소 부분 PASS. 실제360/390/768/1280/1440px·팀장 역할/범위·미관측 키보드/초점·뒤로가기/반복클릭 등 잔여 게이트 유지. 합성 project6/팀1~4/준비표v1 보존, 영구 삭제하지 않음 | [운영 검토·남은 범위](HARNESS_MAP.md#version20-허용-chrome-운영-준비표-검토) |
| QLT-032 | [~] | P1·PRD059 구현/게시 및 부모 v29 관측 인수 완료: 고유20장 실제 로딩·캡션/alt·Enter/Space·원본 새탭·구성원/게스트 읽기 안내·일반 창500px CSS viewport 가로넘침0 PASS. 남은 범위는 실제 휴대폰/touch·Safari·500px 외 좁은 화면, 역할별 별도 로그인·영상재생 및 보고되지 않은 수화/콘솔 관측이다. 기존 Worker strict와 실제 브라우저 근거를 구분하고 관측 외 전체 모바일/역할 인수로 확대하지 않음 v30 SU 읽기/500px 관측은 [제한된 결과](HARNESS_MAP.md#프로젝트-기간제-투표-구현-검증) 참조. | [실제 브라우저 범위](HARNESS_MAP.md#version29-부모-브라우저-이미지-가이드-인수) |
| PRD-064 | [!] | P1·S4: version23 게시·정확 source/deployment 및 업무 자료/설정 보존 대조 완료. 감사로그 만료4건/추가7건은 기존 정책에 따른 차이로 기록. 부모 허용 Chrome의 유형별 홈·탐색·편집기 열기/취소 데스크톱 읽기 부분 PASS. 저장/미디어 업로드·touch/Safari 등 QLT033 잔여를 전체 인수로 확대하지 않음. NAS/MariaDB 실행 검증은 사용자 담당이며 Sites 게시 차단 조건이 아님 | [게시·검증](HARNESS_MAP.md#version23-독립-프로젝트-포털-게시) |
| QLT-033 | [!] | P0: D1 portal64/media46·compiled Worker45조건/66요청·호환 build/정적 검사 및 version23 게시 완료. 부모 클라우드 Chrome의 데스크톱 유형별 홈/사이드바·4팀 편집기 열기/취소·Enter/skip 포커스·Back/Forward 부분 PASS. v27 project6/team4 레크 저장/재조회·복원만 관측 PASS이며 v28 SU 한 팀의 private PNG 업로드/수정/다운로드는 부분 PASS. 식단 저장/실패 초안·권한 회수/다른역할·미디어 다른형식/새 private 공유·touch/Safari/미관측 키보드는 미검증 유지. v24 좁은 Chrome 화면/메뉴 관측 범위는 QLT034 참조. 기존 프로젝트404 신고는 사용자가 권한 없는 계정 테스트였다고 확인해 의도된 접근 차단으로 해소했으며 별도 코드 수정은 없음([확인 근거](HARNESS_MAP.md#기존-프로젝트-404-신고-조사)). NAS/MariaDB 추가 준비·접속 복구·실행 검증은 사용자 담당이며 변경 전 Native 결과는 참고만 유지 | [게이트](HARNESS_MAP.md#독립-프로젝트-포털-검증-계획) |
| QLT-034 | [!] | P0·M2: unit296(action33/unit263)·focused18/SSR7/event AST4·lint/type/FSD·Worker/Native 호환 build와 compiled Worker47조건/66요청 PASS(범위 중복 합산 금지). 부모 Chrome 창 resize/확대 기반360/390/768 CSS 화면·메뉴 열기/닫기/outside/Escape·focus 복원/양방향 trap·프로젝트 전환/BackForward 관측 PASS. 실제 touch/Safari·미디어 업로드 UI·저장/실패 초안 등은 미검증이며 전체 모바일 PASS로 확대하지 않음. version24/source·deployment와 fresh35표474행 기준 보존 대조 완료(업무34표 동일·audit INFO8 추가). 앱 출처 console 오류/경고0은 수집 표본에 한정하며 새 로그인/역할 인수는 아님. NAS/MariaDB 실행은 사용자 담당 | [검증·한계](HARNESS_MAP.md#모바일-우선-탐색-구현-검증) |
| QLT-035 | [!] | P1·F2: full unit302(action33/unit269),backend21/UI SSR14·D1 source91·최종 compiled69조건88요청·호환 build/정적 PASS(범위 중복 합산 금지). 최소 저장/재조회/공유·선택 유무·invalid400·기존 상세/공유 receipt 보존은 합성 인수. 부모의 v25 식단 읽기·상세 toggle/Space·Enter·취소/재열기·360/390/768 CSS 화면 부분 PASS. 실제 submit/최소입력 저장·공유/create·phone touch/Safari는 미검증이며 최소저장/공유 PASS는 로컬 서버 근거와 구분. main/sites 푸시·version25 게시 및 fresh35표537→542행 보존 대조 완료(업무34표/기존 audit504행 동일·INFO5 추가), 기존 표시값/저장v1 보존 관측·운영 저장/권한변경0. NAS/MariaDB 실행은 사용자 담당 | [검증·복구 한계](HARNESS_MAP.md#식단-간소화-구현-검증) |
| QLT-036 | [!] | P1·T2: pure model14·기존 guide14·full unit316(action33/unit283)·최종 Worker/Native 호환 build·lint/type/FSD PASS(DB 미실행). 최종 SSR31·compiled Worker81조건104요청 PASS, 부모의 실제 day/week/date·겹침/5분/자정·Dialog 키보드/초점/Escape·CSS359/390/768 가로넘침0 부분 PASS. 후속v27 합성 일정 저장/재조회·주간/익일 상세·키보드와 원본 복원 관측 PASS, 저장 실패 QLT037은 해소. 실제 phone/Safari·다른 역할·관측 외 인수는 미검증. 지원 로컬 게이트/양 브랜치 반영·시간표 포함version26 게시 완료, 기존v26 CSS359/390/768 읽기 관측과 이번v27 저장 인수를 구분하고 미관측 화면/역할·기존 주소 라우팅은 별도 확인. NAS/MariaDB 실행 사용자 담당·이미지 전송0 | [검증 경계](HARNESS_MAP.md#레크레이션-시간표-구현-검증) |
| QLT-038 | [~] | P1 코드/지원 검증 완료: envSU전역·지정admin팀소속 없이 프로젝트 모든팀·팀장ownteam/일반역할/미지정admin 기존정책 유지, authSQL/API 변경0. 확인된 media→prep404 탐색 링크만 gallery로 수정·서버 canManage 기반 빈 미디어 관리CTA/관리카드anchor·읽기전용 안내 보완. SSR4/unit334·D1 prep211/media82/presentation104·compiled123/176·최종 호환 build/정적 PASS. main/sites 반영·version28 게시/대조 완료. 실제 SU(PM0)의 media팀 생성·private PNG 업로드/수정/재조회/바이트 다운로드·관리/홈/활동 링크는 부분 PASS. 일반 admin/다른 계정 UI는 서버 회귀만 통과, 이번 모바일·새OAuth 미검증. 합성 team5/media1v2 보존·가역정리기능/영구삭제 없음 v30 SU 읽기/500px 관측은 [제한된 결과](HARNESS_MAP.md#프로젝트-기간제-투표-구현-검증) 참조. | [실제 역할행렬/한계](HARNESS_MAP.md#프로젝트팀-관리-접근-감사-qlt-038) |
| OPS-021 | [~] | NAS 소스/업데이트 절차 준비: 과거 v1–v9·관리표16개 고정 안내를 대상 릴리스 manifest 전체 적용·pending0/readiness 기준으로 수정. 실제 플랫폼·백업·기본 build·migration 적용·기동·자료/역할/수동 인수는 운영자 담당이며 이번 NAS/MariaDB 실행0. 기존 NFT warning 유지 | [운영 안내](NAS_UPDATE_GUIDE.md) |
| OPS-031 | [!] | Native bug purge 포함 전체 수명주기/두 isolation-level 경합 검증은 별도 승인 대기. 비파괴16조건·Sites 삭제 완료와 구분 | [완료 범위](COMPLETED_LOG.md#실환경-qa와-삭제-승인-경계) |
| OPS-032 | [!] | PPTX 하위 image-size2.0.4 scoped override 유지. 2026-11-05 Next16.4.5 패치 후 production audit0, 전체28(high12/moderate15/low1)은 패치 전과 항목까지 동일하며 잔여 검토. Vinext 등 devDependency의 Worker 번들 포함 가능성을 production audit에서 제외하지 말고 별도 분석해야 함. Native trace13경고·실제 NAS 포장 게이트 미확인 | [최신 감사/경계](HARNESS_MAP.md#nextjs-2026년-11월-보안-패치-검증), [과거 보안 근거](COMPLETED_LOG.md#보안-패치와-활성-decoder) |
| OPS-033 | [!] | 레이아웃 실사이트의 전체6개 너비·관리자/버그 UI 인수. 부모 Chrome의 과거 홈/tasks1188×761 및 v19 탐색/보고서1165×757은 부분 근거이며 전체 폭 인수 아님 | [접속 경계](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크) |
| OPS-034 | [!] | 코딩 실행기의 기존 CONNECT403/Domain forbidden·해당 policy rule 부재 경계로 운영 GET/UI 재시도0. 별도 허용 Work 브라우저의 v17 미리보기·v18 QLT-027·v19 읽기 검토 PASS는 별개 경로다. 과거 host 승인/차단과 version13 환경의 CONNECT200·익명 GET 성공을 보존하며 환경별 결과를 구분. 제한 우회 없음 | [최신 경계](HARNESS_MAP.md#version19-허용-chrome-운영-읽기-검토) |
| OPS-035 | [!] | version12 스크린샷의 실제 운영 UI 인수. 합성Chromium1280/390 결과와 구분하고 운영 제보 생성/삭제를 임의로 하지 않음 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| RPT-016 | [!] | D1 manual preview의 소스/compiled 및 v19 허용 Chrome1165×757 운영 desktop 미리보기 PASS. 좁은 viewport·키보드 인수는 미검증이며 Native Chromium sandbox 차단과 구분. 실제 운영 생성·다운로드·예약저장·보관/다른 역할은 미검증. 기간 오류 안내는 QLT-030 | [운영 범위/한계](HARNESS_MAP.md#version19-허용-chrome-운영-읽기-검토) |
| RPT-018 | [!] | D3 기존 runner의 Native v14/D1 0017 ledger·비활성 기본 scheduler 구현/소스 검증. 로컬 ledger/compiled 인수 완료 후 runtime DDL 거부 실증·운영 조건 확인 대기, 운영 예약 활성화0; QLT-012/RPT-017 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-019 | [!] | D4 인가 download/만료404·가역 quarantine 구현/소스 검증, 소스/compiled 인수 완료 후 실제 NAS 권한/free-space/atomic rename·운영 저장소 인수 대기; RPT-018 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |
| RPT-020 | [!] | D5 recipient consent·visibility/threat model 확정 후 delivery 검토; RPT-019 선행 | [계획](PROJECT_DIGEST_REPORT_PLAN.md) |

## 프로젝트별 기간제 투표 (PRD-068)

단일 선택·익명 집계·기간 중 변경·마감 후 결과 공개를 구현해 v30에 게시했다. 정책·권한/저장 계약은 [ARCHITECTURE](ARCHITECTURE.md#프로젝트별-기간제-투표), 단계는 [계획](MASTER_PLAN.html#project-voting), 완료된 검증은 [하네스](HARNESS_MAP.md#프로젝트-기간제-투표-구현-검증)를 따른다.

남은 완료 조건은 실제 인증 세션에서 투표/선택 변경·새로고침 유지·기간 경계/마감 결과·허용/거부 역할·모바일/키보드/실패 안내를 확인하는 것이다. 부모의 기존 SU 읽기·500px 관측만 통과했고 이 실행기는 브라우저 제어를 지원하지 않아 나머지 인수를 대기로 유지한다. 실제 계정/소속 변경·운영 사용자 자료 수정·NAS 실행은 포함하지 않는다.


## 재개 원칙

기존 운영 세션이 허용된 경우 읽기 관측부터 진행한다. 다른 계정·실기기·NAS·보안 설정·외부 발송 등 필요한 조건은 항목별 경계를 따른다. 과거 Mac 잠금/특정 실행기의 네트워크 제한을 현재 모든 환경의 장애로 추정하지 않는다. 실제로 확인한 범위만 갱신한다.

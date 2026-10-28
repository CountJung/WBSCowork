# 현재 상태와 열린 작업

이 문서는 **지금 어디까지 왔고 다음 무엇을 해야 하는가**를 소유한다. 단계/완료 게이트는 [MASTER_PLAN](MASTER_PLAN.html), 과거 근거는 [COMPLETED_LOG](COMPLETED_LOG.md), 상세 digest 설계는 [계획](PROJECT_DIGEST_REPORT_PLAN.md)에 있다.

최종 검토: 2026-10-28 · 다음 번호: **QLT-038 / RPT-021 / OPS-041 / PRD-068**

## 현재 상태

| 구분 | 확인된 상태 | 다음 경계 |
| --- | --- | --- |
| 제품 | 기반 WBS/FSD와 팀 업무 P0/P1, 버그/스크린샷 구현 완료 | 실제 다중 Google 계정·운영의 채워진 UI 인수는 로컬 합성 검증과 별개 |
| Git 소스 | Origin 보강 main5405b3ea7648d541fe55f66ed6e6b3dc11473116/sites·공식 source1747737e649533aee47cc29e35c82289c30dee6d 원격 반영·version27 게시 확인 | 후속 문서 HEAD와 게시 source 구분. 양 SHA CI statuses[]는 CI 통과가 아님 |
| 운영 게시 | public Sites version27/source1747737 succeeded·반환 URL https://wbscowork.count-sungjin.chatgpt.site 은 고정 origin과 일치 | [게시 원장](COMPLETED_LOG.md#sites-게시-원장). fresh35표485→485행 모든 canonical 멀티셋 동일·설정 불변. 후속 부모의 준비표 저장/재조회·버전 편집 복원 인수 PASS. 기존 cometgnome 라우팅·실제 touch/Safari/다른 역할은 별도 잔여 |
| 독립 프로젝트 포털 | PRD-060~063 소스 구현·D1 source64/미디어D1·R2 source46·compiled Worker45조건/66요청 PASS. 양 build·lint/type/FSD PASS, version23 게시 완료·부모 클라우드 데스크톱 읽기 부분 PASS | 새 포털만 엄격 소속 격리·독립 홈/유형별 표시/사이드바, 기존 준비표 재사용과 프로젝트 내부 미디어 도구. 기존 legacy WBS/private·실계정·실제 자료 보존. NAS/MariaDB 실행 검증은 사용자 담당으로 이번 게이트에서 제외하며 v27 project6/team4 레크 저장/재조회·원본 복원은 [관측 범위](HARNESS_MAP.md#version27-부모-저장과-버전-편집-복원-인수)만 PASS이며 식단 저장/미디어 업로드·타역할/새 private 공유·touch/Safari·가이드 이미지는 별도 미검증으로 유지. 좁은 Chrome 화면의 후속 부분 관측은 QLT034 참조. 프로젝트 생성→관리자 지정→팀 구성→공유 자료 준비의 시작 체크리스트는 미확정 제안이며 계획/구현으로 확정하지 않음 |
| 모바일 우선 탐색 | PRD-065 소스 구현·QLT-034 지원 로컬 검사/최종 build 통과, version24 게시·부모 Chrome의360/390/768 CSS 화면과 메뉴 관측 범위 PASS | 기본 닫힌 상단 햄버거·본문 전체폭·메뉴 중복 축소와360/390/768px 도구 배치 구현. compiled47조건/66요청과 Chrome 창 resize/확대 기반 메뉴·키보드/좁은 화면 부분 PASS, 실제 touch/Safari/미디어 업로드는 미검증으로 구분하고 실제 자료/권한/공개범위/schema 변경0·NAS 검증은 사용자 담당 |
| 식단 간소화 | PRD-066 소스·지원 로컬 검사/최종 build 완료, version25 게시·부모의 식단 읽기/토글·좁은 CSS 화면 부분 PASS, QLT-035 저장/공유 등 잔여 | 날짜·메뉴·진행상태 필수(planned=준비 전 기본)로 시작, 나머지는 선택/상세정보 기본 접힘. 기존 자료/버전·공유·권한 보존·meal nullable 정규화/SQL migration0.새 문서 저장 후 구validator로 단순 복귀 시 조회503 가능·호환 reader 유지 필요 |
| 레크레이션 시간표 | PRD-067 소스 구현·기초 검증 완료, QLT-036 지원 로컬 인수 완료·version26 게시·부모의 day/week·날짜/겹침/5분/자정·키보드/기존 좁은 CSS 화면과 v27 합성 저장/재조회·원본 복원 범위 PASS | 기존 날짜/시각/소요/순서의 파생 일간·주간 UI·읽기 전용 상세. 새 라이브러리/schema/API·서버 권한 변경0, 부모 CSS359/390/768·Dialog 초점/Escape 부분 PASS·실제 phone touch/Safari·다른 역할 인수는 잔여. 시간표 소스 양 브랜치 푸시 완료. 새 명시 승인으로 기존 게시 보류를 해제했으며 QLT030과 통합해 같은 siteID의 version26 게시 완료·관측 외 실기기/역할 인수는 QLT036 잔여 |
| 보고서 기간 안내 | QLT-030 소스·지원 로컬 검증 완료, version26 게시·부모의 구체 오류/aria·초점/정상 preview 인수 PASS | 역전/31일 초과의 구체 입력 안내와 정상기간 복원 경로를 보완. 관측 범위 인수 완료·생성/별도 취소 원인과 구분, 보고서 미리보기 취소 원인을 해결한 것이 아님 |
| 준비표 저장403 | QLT-037 source/합성 GREEN·version27 게시 후 부모의 합성 레크 저장/재조회·원본 버전 편집 복원/이력 보존 인수 완료 | 추가 합성행은 일반 버전 편집으로 제외했으며 영구삭제가 아님. 원본 값·v1/v2 이력/공개범위 보존, 운영 저장 인수는 [완료 근거](COMPLETED_LOG.md#완료-색인) 참조·다른 역할/실기기·R2 bytes는 별도 잔여 |
| 최근 검증 | QLT-021 핵심 삭제 오판은 실제 Google 세션의 운영 UI 인수 PASS | [검증 기준선](HARNESS_MAP.md#검증-기준선). 신규 업로드는 통과했으나 추가 첨부·운영 파일 삭제는 미검증이며 QLT-022와 다른 열린 항목 유지 |
| 선행 로컬 구현 | QLT-016/029와 RPT-015/017은 독립 로컬 검증 완료 이관. QLT-028/020·OPS-032와 RPT-016/018/019의 외부 인수 게이트 유지 | 구현 소스·추가 compiled33·main/sites 푸시와 기존 Sites v19 게시 완료. 최초 거부와 새 승인 후1회 배포·보존 확인은 [승인/게시 이력](HARNESS_MAP.md#version19-승인과-운영-배포)을 따른다. D5 외부 발송·운영 예약 활성화·NAS/실계정/보안/영구 삭제는 제외 |
| 팀별 공통 준비표 | PRD-058 소스·양 DB·compiled HTTP 완료, QLT-031 운영 envSU/1165px 부분 인수 PASS·모바일/실제 팀장 등 잔여 | exact 게시 checkout build/compiled30·34HTTP 후 같은 저장v20 배포 완료. [최초 거부·새 승인/배포](HARNESS_MAP.md#version20-승인과-운영-배포), 기존 실제 사용자 기록/권한·NAS 변경 없음. 부모가 만든 합성 project6/팀1~4/준비표v1은 보존하며 실제 화면 잔여는 QLT-031로 유지 |
| 역할별 웹 사용설명서 | PRD-059 공통/5역할/11기능 설명과 공개 정적 경로 구현 중, QLT-032 실스크린샷/화면 인수 대기 | 공통 시작→역할 선택→기능 상세의 쉬운 단계·예시·저장 확인/오류 대응. 현재 서버 권한 대조 완료, 과거11장 전송 실패와 별개로 새 v23 캡처20JPG ZIP도 공식 소비자 전송 실패·실제 수신0. 사용자 직접 첨부도 완료됐으나 공식 실행기 전송1회 실패·파일0, 전달 경로 복구/새 지원 근거 대기·가짜 이미지0. 추가 전송 재시도0·v23 캡처는 모바일 UI 변경 후 구버전일 수 있어 수신 시 재대조 필요. Native/Worker 최신 text35조건/51페이지 PASS·전체 strict는 이미지 누락 실패. 문구 보완v22 게시·기존SU/1180px 집중 재검토 PASS, v21 envSU1180px 부분 검토는 과거 별도 근거. 이미지 포함 최종 완료/게시 준비 아님·권한 변경 없음 |
| 봉사활동 | 확정 정책의 프로젝트/팀 관리·팀장 범위 업무·직접 완료를 구현하고 로컬/합성 인수·version15 게시 완료 | 기존 업무/협업 업무 제출 필수·private 계약과 사용자 자료 표본 보존. 실제 운영 UI·Google 인수와 R2 bytes 대조는 미실행 |
| UX·프로젝트 바인딩 | 확정된 다중 소속·SU 전역/지정 프로젝트 admin 정책으로 UI·SQL scope 구현·Worker/Native strict UI와 기존 봉사 회귀 완료 | 기존 Sites version16 게시 완료. 계정 role/소속 자동 부여0·기존7표 보존; 확정 admin 관리 축소는 게시 코드 정책으로 적용 |
| 제출물 첨부 미리보기 | PRD-056/057·QLT-025/026의 Native/Worker371조건·실제 게시 artifact와 version17 게시 확인 완료 | 부모 Work의 상세/버전 텍스트 미리보기와 SU 참여자·담당자·검토자 후보 제외 부분 PASS. 탐색 React418/초기 표시는 QLT-027 운영 재인수 완료; 팀장 후보 UI·새 Google 인증·원본 bytes 대조는 미검증 |

## 열린 항목

`[ ]` 대기, `[~]` 진행, `[!]` 외부/판단 대기다. 각 항목의 상태·남은 부분·다음 행동은 이 표 한 곳에서만 관리한다.

이번 순차 진행은 **[!] 항목을 제외**한다. 다만 이후 사용자가 명시 승인한 운영 준비표 저장403 버그 QLT037은 별도 P0 수정 예외로 진행했고 v27 운영 저장/복원 인수까지 완료 이관했다. PRD059는 QLT032 이미지 차단, PRD060~063은 QLT033, PRD065/066/067은 각 QLT034/035/036의 남은 인수에 연결돼 이미 구현한 소스를 반복하지 않는다. OPS021 NAS 실행은 사용자 담당이다. 독립 실행한 QLT030은 지원 로컬 검증/시간표 통합 version26 게시를 마쳤고 부모의 기간 오류/초점·정상 미리보기 관측 인수까지 완료했다. 새/기존 주소 라우팅 잔여는 해소된 QLT037 저장 버그와 구분한다. 다른 ! 조사·판단과 보고서 preview canceled 원인 추측 수정·스크린샷 전달 재시도는 하지 않는다. 기존 기술/자료·권한/env/public을 보존하고 부모 허용 Chrome 검토 결과를 별도 인수로 남긴다.

| ID | 상태 | 남은 일·다음 행동 | 계약/근거 |
| --- | --- | --- | --- |
| QLT-013 | [!] | runtime/schema credential 코드 분리는 완료. 실제 최소권한 계정의 DML 허용·DDL/ledger 거부는 운영자 승인/대상 확인 후 검증 | [Native 운영](NATIVE_DATABASE_MIGRATIONS.md) |
| QLT-015 | [!] | 플랫폼 검토로 차단된 두 cleanup runner 정지/재개 경합은 미실행. 허용 범위가 달라지기 전 우회·재시도하지 않음 | [검증 한계](HARNESS_MAP.md#검증-기준선) |
| QLT-020 | [!] | Native v13 durable staging·가역 quarantine/retry/restore·SU 관리 경로 구현/격리 검증 중. 최종 schema 격리40 PASS 후 실제 화면/운영 인수 대기, 영구 삭제·첨부 bug purge fail-closed 유지 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| QLT-022 | [!] | version14 연결 실패 안내·초안 보존과 사용자 브라우저 신규 첨부·새로고침·다운로드는 통과했다. 수정으로 첨부를 추가하는 운영 경로는 미검증이며 로컬 회귀만 통과. 최초 연결 실패 원인은 미확정으로 자동화 파일 전달 한계와 앱 원인을 구분한다. 생성된 사용자 자료는 보존하며 삭제는 미승인 | [관측·미확인 경계](HARNESS_MAP.md#제출물-첨부-운영-오류-qlt-022) |
| QLT-028 | [!] | Home 함수 직렬화 RED500의 href anchor 최소 수정·Native build/SSR7 PASS. 별도 Chromium OS sandbox helper 차단으로 UI 미인수, secret0 정적 인증 cache 추가 결함의 force-dynamic 보완·최종 HTTP16 PASS 후 브라우저 인수 대기 | [진행 근거](HARNESS_MAP.md#남은-품질과-digest-구현-진행) |
| QLT-031 | [!] | P1: 소스·양 DB·compiled HTTP 완료, 운영 Chrome1165px/envSU에서4종 준비표 저장·재조회/식사 수량·필수값 오류 초안 보존·Enter/Space·취소 부분 PASS. 실제360/390/768/1280/1440px·팀장 역할/범위·미관측 키보드/초점·뒤로가기/반복클릭 등 잔여 게이트 유지. 합성 project6/팀1~4/준비표v1 보존, 영구 삭제하지 않음 | [운영 검토·남은 범위](HARNESS_MAP.md#version20-허용-chrome-운영-준비표-검토) |
| PRD-059 | [~] | P1: 공통 시작→5역할→11기능/45조합의 쉬운 단계·예시·저장 확인·오류 대응과 AppShell/Drawer 진입 구현. 현재 서버 역할 대조·model11/unit286 checkpoint PASS. 과거11JPG와 별개로 사용자 승인 후 재개한 v23 캡처20JPG ZIP도 소비자 전송 실패·파일0/빈 manifest, 사용자 직접 첨부 후에도 실행기 전송 실패·전달 경로 복구 대기([최신 전달 경계](HARNESS_MAP.md#v23-가이드-캡처-zip-소비자-전달-차단)). 이미지 없는 텍스트 중간v21은 게시·envSU1180px 검토 PASS. 메뉴/실제 버튼 순서·교육용 읽기 전용8페이지·UTC 예시 문구를 로컬 보완해 model14/정적·양 build·각 text35/51페이지 HTTP PASS, 전체 strict 이미지 gate 실패 유지·v22 게시·기존SU/1180px 텍스트 집중 재검토 PASS다. 자산/개인정보 픽셀 검토 전 이미지 포함 최종 완료/게시 준비 판정 금지 | [사용 안내 책임](TEAM_WORKFLOW_GUIDE.md) |
| QLT-032 | [!] | P1·PRD-059 선행: 사용자가 새 `WBSCowork-v23-screenshot-guide-20261027.zip`을 현재 대화에 직접 첨부했으나 새 첨부 대상 공식 전송1회도 download failed·실제 수신0. 재첨부 요청을 반복하지 않고 공식 실행기 전달 경로 복구/새 지원 근거 대기·추가 재시도/우회 금지. ZIP/픽셀 검토 미완료. v21 부모 envSU1180px의 역할 안내/Enter목차·skip포커스/복귀·가로넘침·앱오류 부분 PASS. 이미지 자체0이므로 깨진img0을 실제 이미지 인수로 쓰지 않음. 좁은 모바일·실제 다른역할·비로그인 공개접근 미검증, 전체 strict는 이미지 누락 실패 유지. 문구보완v22 로컬 text35/51페이지 PASS·전체 이미지 gate 미완료, v22 기존SU/1180px에서 문구·목차·복귀·가로넘침·콘솔 집중 재검토 PASS | [운영 부분 인수/한계](HARNESS_MAP.md#version22-허용-chrome-집중-재검토) |
| PRD-060 | [~] | P0·S0 소스/D1·게시 완료, QLT033 실제 화면 인수 잔여: 새 portal의 로그인+현재 활성 프로젝트 소속 또는 검증된 envSU 접근을 서버/SQL에 강제. 관리자도 지정 프로젝트만. legacy WBS 접근·기존 private 자료·역할/소속 자동 부여0을 보존하고 A/B 직접URL/API·회수 후 요청 거부가 완료 조건 | [격리 계약](ARCHITECTURE.md#독립-프로젝트-포털-설계) |
| PRD-061 | [~] | P1·S1 소스/D1·게시 및 유형별 홈 데스크톱 읽기 PASS, 실제 touch/Safari 등 QLT033 잔여;060 선행: 독립 프로젝트 홈/유형별 layout·봉사활동 presentation형 요약 구현. 이름·맥락·허용된 팀/업무만 표시하고 비소속 count/요약 누출0·직접 링크/복귀가 완료 조건 | [단계](MASTER_PLAN.html#project-portal) |
| PRD-062 | [~] | P1·S2 소스·게시 및 사이드바/편집기 열기·취소·WBS 복귀 데스크톱 PASS, v27 project6/team4 레크 저장/재조회·복원은 QLT037 관측 범위 PASS·식단/다른 역할 저장·touch/Safari 등 QLT033 잔여;060~061 선행: 프로젝트 사이드바·팀/업무 탐색과 기존 식사/레크 준비표 편집 재사용. 현재 팀장/관리 범위·식사 계산/일정·불변 이력·기존 WBS 완료 계약 보존을 검증하고 좁은 Chrome 화면은 QLT034 관측 범위만 해소하고 실제 touch/Safari는 미인수로 남김 | [재사용 지도](PROJECT_MAP.md#독립-프로젝트-포털-구현-계획) |
| PRD-063 | [~] | P1·S3 소스/D1·게시 완료, QLT033 실제 화면 인수 잔여;060~062 선행: 미디어팀 사진첩/영상 도구·프로젝트 내부 공개/현재팀 private 구현. media7번째 kind·private 기본/명시 준비표 revision 공유·현재 팀/지정admin/SU·미디어만 작성자 예외·프로젝트 전출 차단·사진8MiB/영상20MiB/1파일·삭제API0의 보수적MVP를 구현. 서버파일검증·매 요청 인가·기존자료 새 공개0·인터넷공개0이 완료 조건 | [MVP 계약](ARCHITECTURE.md#독립-프로젝트-포털-설계) |
| PRD-064 | [!] | P1·S4: version23 게시·정확 source/deployment 및 업무 자료/설정 보존 대조 완료. 감사로그 만료4건/추가7건은 기존 정책에 따른 차이로 기록. 부모 허용 Chrome의 유형별 홈·탐색·편집기 열기/취소 데스크톱 읽기 부분 PASS. 저장/미디어 업로드·touch/Safari 등 QLT033 잔여를 전체 인수로 확대하지 않음. NAS/MariaDB 실행 검증은 사용자 담당이며 Sites 게시 차단 조건이 아님 | [게시·검증](HARNESS_MAP.md#version23-독립-프로젝트-포털-게시) |
| QLT-033 | [!] | P0: D1 portal64/media46·compiled Worker45조건/66요청·호환 build/정적 검사 및 version23 게시 완료. 부모 클라우드 Chrome의 데스크톱 유형별 홈/사이드바·4팀 편집기 열기/취소·Enter/skip 포커스·Back/Forward 부분 PASS. v27 project6/team4 레크 저장/재조회·복원만 관측 PASS이며 식단 저장/실패 초안·권한 회수/다른역할·미디어 업로드/새 private 공유·touch/Safari/미관측 키보드는 미검증 유지. v24 좁은 Chrome 화면/메뉴 관측 범위는 QLT034 참조. 기존 프로젝트404 신고는 사용자가 권한 없는 계정 테스트였다고 확인해 의도된 접근 차단으로 해소했으며 별도 코드 수정은 없음([확인 근거](HARNESS_MAP.md#기존-프로젝트-404-신고-조사)). NAS/MariaDB 추가 준비·접속 복구·실행 검증은 사용자 담당이며 변경 전 Native 결과는 참고만 유지 | [게이트](HARNESS_MAP.md#독립-프로젝트-포털-검증-계획) |
| PRD-065 | [~] | P0·M0/M1 소스 완료: 모든 폭 상단 햄버거·기본 닫힘/선택/경로 이탈·popstate 닫힘, top Drawer/닫기·현재 프로젝트/전환·본문 전체폭·중복 메뉴 축소를 구현. 식단/체크리스트768px이하1열·긴 라벨/파일명 줄바꿈·44px controls·미디어 폭 보완. 서버 권한/저장·취소 콜백 변경0. version24 게시와 부모 Chrome의360/390/768 CSS 화면·메뉴/초점 관측 범위 PASS, 실제 touch/Safari·미디어 업로드 등은 QLT034 잔여 | [단계](MASTER_PLAN.html#mobile-first) |
| QLT-034 | [!] | P0·M2: unit296(action33/unit263)·focused18/SSR7/event AST4·lint/type/FSD·Worker/Native 호환 build와 compiled Worker47조건/66요청 PASS(범위 중복 합산 금지). 부모 Chrome 창 resize/확대 기반360/390/768 CSS 화면·메뉴 열기/닫기/outside/Escape·focus 복원/양방향 trap·프로젝트 전환/BackForward 관측 PASS. 실제 touch/Safari·미디어 업로드 UI·저장/실패 초안 등은 미검증이며 전체 모바일 PASS로 확대하지 않음. version24/source·deployment와 fresh35표474행 기준 보존 대조 완료(업무34표 동일·audit INFO8 추가). 앱 출처 console 오류/경고0은 수집 표본에 한정하며 새 로그인/역할 인수는 아님. NAS/MariaDB 실행은 사용자 담당 | [검증·한계](HARNESS_MAP.md#모바일-우선-탐색-구현-검증) |
| PRD-066 | [~] | P1·F0/F1 소스 완료: 날짜/메뉴/상태(planned=준비 전 기본)·식단 선택 상세 기본 접힘을 editor/read/공유 presentation에 적용. meal/people/amount nullable·unit/notes 빈문자·checks 빈배열, 미입력 수량은 계산/출력 생략하되 실제0 유지. 다른 kind strict/현재 권한·CAS/선택 snapshot·기존 원문/버전 보존. SQL migration/기존 JSON 자동변환0, version25 게시·부모의 필수/선택 표시·상세 toggle/키보드·좁은 화면 읽기 부분 PASS, 실제 submit/최소저장·공유는 QLT035 잔여 | [식단 계약](ARCHITECTURE.md#활동팀-공통-준비표-설계) |
| QLT-035 | [!] | P1·F2: full unit302(action33/unit269),backend21/UI SSR14·D1 source91·최종 compiled69조건88요청·호환 build/정적 PASS(범위 중복 합산 금지). 최소 저장/재조회/공유·선택 유무·invalid400·기존 상세/공유 receipt 보존은 합성 인수. 부모의 v25 식단 읽기·상세 toggle/Space·Enter·취소/재열기·360/390/768 CSS 화면 부분 PASS. 실제 submit/최소입력 저장·공유/create·phone touch/Safari는 미검증이며 최소저장/공유 PASS는 로컬 서버 근거와 구분. main/sites 푸시·version25 게시 및 fresh35표537→542행 보존 대조 완료(업무34표/기존 audit504행 동일·INFO5 추가), 기존 표시값/저장v1 보존 관측·운영 저장/권한변경0. NAS/MariaDB 실행은 사용자 담당 | [검증·복구 한계](HARNESS_MAP.md#식단-간소화-구현-검증) |
| PRD-067 | [~] | P1·T0/T1 소스 완료: recreation 파생 일간/월요일 시작 주간·날짜/이전다음오늘/첫일정·미지정시간/0분/자정넘김·lane/실제겹침 텍스트와 읽기전용 Dialog. 좁은 화면 day 기본·넓은 화면 수화 후 week, 내부 bounded scroll/전체목록·편집 draft/읽기/상세 presentation 재사용·홈3개 요약 유지. 원문/normalizer/API·권한·package/lock/schema 변경0, 후속 부모의 시간표 클릭/Dialog 초점·좁은 CSS 화면 및 v27 레크 저장/복원은 관측 범위 PASS·실제 phone/Safari/타역할 등 QLT036 잔여 | [표시 계약](ARCHITECTURE.md#레크레이션-시간표-표시-계약) |
| QLT-036 | [!] | P1·T2: pure model14·기존 guide14·full unit316(action33/unit283)·최종 Worker/Native 호환 build·lint/type/FSD PASS(DB 미실행). 최종 SSR31·compiled Worker81조건104요청 PASS, 부모의 실제 day/week/date·겹침/5분/자정·Dialog 키보드/초점/Escape·CSS359/390/768 가로넘침0 부분 PASS. 후속v27 합성 일정 저장/재조회·주간/익일 상세·키보드와 원본 복원 관측 PASS, 저장 실패 QLT037은 해소. 실제 phone/Safari·다른 역할·관측 외 인수는 미검증. 지원 로컬 게이트/양 브랜치 반영·시간표 포함version26 게시 완료, 기존v26 CSS359/390/768 읽기 관측과 이번v27 저장 인수를 구분하고 미관측 화면/역할·기존 주소 라우팅은 별도 확인. NAS/MariaDB 실행 사용자 담당·이미지 전송0 | [검증 경계](HARNESS_MAP.md#레크레이션-시간표-구현-검증) |
| OPS-021 | [~] | NAS 소스/업데이트 절차는 준비됨. 실제 플랫폼·백업·기본 build·대상 릴리스 migration 적용·기동·자료/역할/수동 인수는 운영자가 수행. 기존 NFT warning도 유지 | [운영 안내](NAS_UPDATE_GUIDE.md) |
| OPS-031 | [!] | Native bug purge 포함 전체 수명주기/두 isolation-level 경합 검증은 별도 승인 대기. 비파괴16조건·Sites 삭제 완료와 구분 | [완료 범위](COMPLETED_LOG.md#실환경-qa와-삭제-승인-경계) |
| OPS-032 | [!] | PPTX 하위 image-size2.0.4 scoped override·호환 검사/양 build 후 production audit0, 전체23(high18/moderate4/low1) 잔여 검토. 최종 전체294·양 build/호환·compiled OOXML18 PASS·전체 취약점 해소 아님. Native trace13경고·NAS 포장 게이트 미확인 | [보안 근거](COMPLETED_LOG.md#보안-패치와-활성-decoder) |
| OPS-033 | [!] | 레이아웃 실사이트의 전체6개 너비·관리자/버그 UI 인수. 부모 Chrome의 과거 홈/tasks1188×761 및 v19 탐색/보고서1165×757은 부분 근거이며 전체 폭 인수 아님 | [접속 경계](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크) |
| OPS-034 | [!] | 코딩 실행기의 기존 CONNECT403/Domain forbidden·해당 policy rule 부재 경계로 운영 GET/UI 재시도0. 별도 허용 Work 브라우저의 v17 미리보기·v18 QLT-027·v19 읽기 검토 PASS는 별개 경로다. 과거 host 승인/차단과 version13 환경의 CONNECT200·익명 GET 성공을 보존하며 환경별 결과를 구분. 제한 우회 없음 | [최신 경계](HARNESS_MAP.md#version19-허용-chrome-운영-읽기-검토) |
| OPS-035 | [!] | version12 스크린샷의 실제 운영 UI 인수. 합성Chromium1280/390 결과와 구분하고 운영 제보 생성/삭제를 임의로 하지 않음 | [버그 계약](BUG_REPORTS.md#스크린샷) |
| RPT-016 | [!] | D1 manual preview의 소스/compiled 및 v19 허용 Chrome1165×757 운영 desktop 미리보기 PASS. 좁은 viewport·키보드 인수는 미검증이며 Native Chromium sandbox 차단과 구분. 실제 운영 생성·다운로드·예약저장·보관/다른 역할은 미검증. 기간 오류 안내는 QLT-030 | [운영 범위/한계](HARNESS_MAP.md#version19-허용-chrome-운영-읽기-검토) |
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

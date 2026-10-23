# 완료·결정·검증 이력

이 문서는 **끝난 일의 고유 근거와 게시/복구 기록**을 소유한다. 현재 값/열린 일은 [TODO](TODO.md), 규범은 [ARCHITECTURE](ARCHITECTURE.md), 명령/최신 기준선은 [HARNESS_MAP](HARNESS_MAP.md), 운영 절차는 [NAS_UPDATE_GUIDE](NAS_UPDATE_GUIDE.md)에서만 관리한다. 과거 결과는 이번 회차 실행으로 합산하지 않는다.

## 완료 색인

| ID/시기 | 원인·결정·완료 범위 |
| --- | --- |
| QLT-016/029·RPT-015/017, 2026-10-23 | 동시 요청 admission과 Miniflare 원 Response GC의 별개 원인을 재현·최소 수정하고 각 회귀를 완료. 현재 schema 기반 snapshot·양 DB collector와 동일 snapshot DOCX/PPTX의 compiled 인수. [완료·한계](#품질-원인-수정과-digest-snapshot-기반), 남은 UI/NAS·운영은 TODO 유지 |
| OPS-038, 2026-10-23 | 최초 배포 자동 승인 거부는 보존. 사용자 새 직접 승인 뒤 같은 저장v19의 미실행 확인→1회 배포 재시도 terminal succeeded·active/latest19와 D1 추가3표/기존23표·설정 보존 확인. [승인/배포 근거](HARNESS_MAP.md#version19-승인과-운영-배포), 운영 UI/새 OAuth는 별도 |
| QLT-001/002, 2026-08 | ESLint 기준선, FSD M0~M5 완료. root app 조립과 public API로 이동하고 components/lib/models 호환층 제거. URL/권한/SQL 변경과 구조 이동을 분리 |
| QLT-003~007, 2026-09 | private 파생 댓글/첨부 props 유출, ownership 없는 mutation, unscoped 단건, 경로 로그, task route의 project 관리 권한을 수정. SQL viewer/IdScope·상위 관계·작성자/admin·canonical project 경로를 강제 |
| QLT-008/009 | node --import tsx로 loader 경고 정리, 실제 인가 경로의 node:test visibility fixture 도입. synthetic session은 실제 OAuth가 아님 |
| QLT-010/011/014, 2026-10-09 | 중복 project actions3개 제거, 날짜/계층/path/MIME/역할 경계 회귀, Next 생성 타입 include 보존·AppleDouble exclude. 권한/생성 타입 삭제로 검사를 통과시키지 않음 |
| QLT-012/013/017 | native version/name/checksum·lock·postcondition·명시 schema identity 구현; ESM CLI 복구와 protected schema key 비노출/파일 원문 보존8조건 확인. 실제 운영 계정 최소권한 적용/검증은 TODO QLT-013 |
| OPS-022/023/025/026, 2026-10-08 | 기존 Google/역할/MUI를 Worker+D1/R2로 전환, 실제 owner 로그인, hosted 관리자 표시·비밀값 미노출/5일 감사·프로젝트 파기/공유 계정 수명주기 안내. NAS/사이트 실제 인수와 합성 fixture를 분리 |
| OPS-027/028/029/031 | 독립 bug archive·불변 원문·version/token atomic event와 검증/휴지통/복원/정확한 SU purge. exact f31f9dc native 검증, d631e51 native 비파괴16과 D1 lifecycle58/Worker217. native purge/isolation 경합은 미실행 |
| OPS-030 | React19.2.8 active decoder 패치와 version4 게시. 해당 advisory 해결이며 전체 audit 해소 아님 |
| PRD-033~039/044 | 프로젝트 전환·목표/완료 기준·책임/실행·산출물 revision·선택 version 검토/내 업무와 pending UI. P0 version9, 특정 버전/현재 권한·자체 승인 배제·원문/파일 보존 |
| PRD-040~043 | 같은 프로젝트 선후행 graph CAS, versioned 수동 template, SQL 권한 검색, 수신자 event 기반 인앱 알림. 외부 전송/AI/권한 부여 없음. P1 version10 |
| QLT-018, 2026-10-19 | lg/xl 폭 불일치·수축 메뉴·긴 이름·80px 곱셈 반경을 xl 공통/반응형 두 행/Drawer/nowrap/ellipsis/4px 단위로 수정. baseline6조건30실패 → hydrated6너비48 PASS, 양쪽 build/auth18 통과 |
| OPS-034 네트워크 하네스 | 기존 proxy/정책 read-only 진단, CONNECT403과 site HTTP403 구분, 익명 GET-only smoke, browser loopback guard와 합성12조건. 플랫폼 host 추가 승인과 실제 적용은 별개; 현 환경 적용 대기 |
| PRD-045, 2026-10-20 | bug 본문+private screenshot 3×2MiB, preview/remove/실패 초안 유지/detail/refresh, MIME bytes·권한·lease/rollback. 0013/native v9 additive. version12 게시. native 첨부 purge는 QLT-020 미해결 |
| OPS-036, 2026-10-20 | 아래 archive6개 검증 후5개 임시 remote branch atomic 삭제. main/sites2개, 공통 code/schema/test/document와 기본 build 차이 보존. NAS 배포/Sites 재게시 없음 |
| PRD-047~050/QLT-023, 2026-10-23 | 확정 정책의 단일 팀장·팀 범위 업무·직접 완료와 UI, 기존 자료/제출 필수/private 보존을 구현하고 로컬/합성 인수. [완료 범위](#봉사활동-팀과-직접-완료-인수), 실측은 [하네스](HARNESS_MAP.md#봉사활동-팀장과-직접-완료-검증). 운영 migration/실 Google/게시 미실행 |
| PRD-046, 2026-10-23 | 사용자 확정: 팀당 팀장 1명, 신규 봉사 업무는 제출 선택/직접 완료, 현재 담당자·해당 팀장·관리자의 직접 완료. 기존 협업/기존 업무 제출 의무와 private 권한은 유지. [결정 근거](#prd-046-봉사활동-정책-확정) |
| PRD-056/057·QLT-025/026, 2026-10-23 | 안전한 현재/과거 파일 미리보기와 env SU 유지·신규 배정 제외 구현. Native/실제 Worker artifact의 로컬 인수 및 version17 게시 상태·7표 보존 확인 완료. [구현 범위](#첨부-미리보기와-su-불변성-구현), 팀장 후보 UI·운영 UI/Google 인수는 미확인 |
| QLT-027, 2026-10-23 | 시간대 미지정의 React418과 별개 초기 인증 flash 수정, 양 runtime/게시 검증 후 같은 허용 Work Chrome의 v18 관측 범위 운영 재인수 완료. [운영 인수 근거](HARNESS_MAP.md#version18-허용-work-브라우저-재인수) |
| PRD-052/053/055·QLT-024, 2026-10-23 | 프로젝트 요약/선택 상세·폼/위험 확인, SU 다중 소속/전환·지정 admin SQL scope와 비파괴 이행을 구현. 허용오차 없는 Worker/Native 새5폭·기존 봉사 회귀의 로컬 인수 완료. [완료 범위](#ux와-프로젝트-바인딩-구현), 운영 게시/실 Google·운영 UI는 별도 |
| PRD-051/054, 2026-10-23 | 프로젝트 요약→상세/댓글 IA의 정적 A/B 시안5폭 렌더 후 A를 채택. 사용자 확정 정책은 다중 소속·SU 전역/지정 프로젝트 admin·기존 읽기 유지·제한 프로젝트 탈퇴 후 본인 자료 차단이다. [결정 범위](#ux-시안과-프로젝트-권한-정책-확정), 실제 앱 인수는 아래 별도 완료 근거와 구분 |
| QLT-019, 2026-10-23 | Node ESM과 bundler의 실제 GoogleProvider default export 형태 차이를 정규화하고 테스트 Google 설정을 합성 값으로 고정. 원인/완료 경계는 [아래](#qlt-019-google-provider-import), 실행 결과는 [하네스](HARNESS_MAP.md#봉사활동-저장-기반과-auth-import-검증) |
| QLT-021, 2026-10-21 | D1 총 변경 수를 부모 삭제 수로 오인. DELETE RETURNING의 요청 id rowset과 commit 후 followup 분리. main ddcedd6/sites c1c55da, DB109/action8/unit119/visibility33/Worker257, 양쪽 build/lint/types/FSD PASS. 후속 version13의 핵심 삭제 오판 운영 인수는 아래 별도 기록. NAS 적용·첨부 인수는 포함하지 않음 |

과거 네트워크 기록의 제목 QLT-020은 당시 잘못 중복 사용된 표기다. 현재 TODO의 QLT-020은 native 첨부 bug 파일 정리를 뜻하며 번호를 다시 발급하지 않는다. QLT-015, OPS-021/031/032/033/034/035는 이 완료 색인으로 닫히지 않는다. QLT-019의 과거 실패는 보존하며 후속 수정은 아래 별도 근거다.

## 품질 원인 수정과 digest snapshot 기반

QLT-029는 Miniflare wrapper가 공유한 undici 원 Response의 GC 취소를 재현하고 즉시1회 drain·독립 snapshot을 보관하도록 test transport를 수정했다. QLT-016은 작은 동시 form의 과도한 예약503을 재현한 뒤 개수/전체 bytes admission과 실제 초과 거부를 보완했다. eager 큰 요청의 별도 전송 ECONNRESET 경계는 남아 있으며 서버 거부·Retry-After와 첫 파일 보존을 검증한 범위를 넘겨 해결로 주장하지 않는다.

RPT-015는 현재 업무 상태·프로젝트 scope·revision 모델을 반영한 versioned/bounded snapshot·privacy·동일 hash와 양 DB collector 기반을 인수했다. 보고서 ledger/렌더/수직 소스 검증은 별도 범위이며 실제 화면·runtime DDL·NAS/운영 예약을 이 완료로 대신하지 않는다. RPT-017은 동일 snapshot DOCX/PPTX를 직접 생성해 compiled route의 OOXML·bytes/SHA·R2 metadata/현재 권한과 idempotency를 인수했다. Vinext의 chunked framing을 정확한 wire 계약으로 검사했고 시각 OOXML/브라우저·실제 NAS 인수는 별도다. 실제 수치·경고와 남은 게이트는 [하네스](HARNESS_MAP.md#남은-품질과-digest-구현-진행)가 소유한다. 로컬 구현 당시 운영은 version18 유지·중간 게시0이었으며 실제 자료/계정/환경·영구 삭제는 변경하지 않았다. 홈 수정 mainc9003a8/siteseb0adb1, 품질 묶음 main5230bb2/sites67263f3, 보고서 main `bd6f4efea7f78221e4d7a2597a01497ffbfd0acc`/sites `5032410a5b5117daabf709ce17514f63af3eeb99`까지 푸시·remote ls-remote를 확인했다. 공통 소스와 기본 build 차이를 보존했으며 게시 완료나 후속 문서 HEAD로 해석하지 않는다.

## 첨부 미리보기와 SU 불변성 구현

PRD-056은 기존 저장·인가 경로를 재사용해 제출 상세/버전 이력의 공통 첨부 컴포넌트에서 지원 파일을 요청할 때만 미리보기하도록 구현했다. 텍스트는 bounded UTF-8 prefix와 잘림 안내·raw text만 표시하고 raster는 allowlist·기본 signature/해상도 검사를 거친다. 지원 불가/손상/크기 초과와 읽기 실패는 기존 다운로드·재시도 안내로 처리하며 원본·불변 버전·private/프로젝트 인가를 유지한다. 상세 형식/제한은 ARCHITECTURE가 소유한다.

PRD-057은 검증된 로그인 identity와 현재 env의 SU 이메일로 effective role/SU를 다시 계산해 오래된 DB role·JWT/session flag·소속으로 강등되지 않게 했다. SU를 새 담당자·팀장·명단 후보와 서버 배정에서 제외하되 기존 배정/자료·명시적 전역 관리 조회는 보존한다. 실제 계정 role/소속·환경을 바꾼 것이 아니다.

소스/양 DB와 Native·exact Worker artifact의 실제 현재/과거 파일·형식/실패·권한 회수·SU stale guest/소속0·기존 배정 보존을 인수했다. 합성 seed 보정과 기대된 권한 거부는 제품 결함과 구분했으며 정확한 실행 수치·artifact·팀장 후보 UI 미검증은 [하네스](HARNESS_MAP.md#제출물-첨부-미리보기-검증)가 소유한다. 이후 version17 terminal 성공·active/latest 및 기존7표/설정 보존을 확인했다. 로컬/게시 상태 확인은 팀장 후보 UI 직접 검증·운영 UI/Google·R2 bytes 인수를 뜻하지 않는다.

## UX 시안과 프로젝트 권한 정책 확정

PRD-051은 프로젝트 요약→업무/제출 상세→댓글 IA의 정적 A/B 비교 시안을5폭으로 렌더하고 부모가360px 이미지를 직접 검토해 단계형 단일 흐름 A를 채택한 결정이다. 좁은 패널 B의 줄바꿈과 비교했으며 실제 앱의 새5폭·키보드/접근성 인수를 대신하지 않는다. 기존 WBS 상하위/선행·간트/집계와 영구 삭제 확인 계약을 보존한다.

PRD-054에서 사용자는 다중 프로젝트 소속을 채택하고 관리자 전역 예외를 축소했다. SU만 프로젝트 소속/접근 제한을 설정하며 SU만 전체를 관리하고 admin은 지정 프로젝트만 관리한다. 기존 프로젝트는 인증 읽기를 유지하고 SU가 영향 미리보기·확인 후 제한한다. 제한 프로젝트에서 소속을 해제하면 본인 과거 자료도 접근 차단하되 기록은 보존하며 진행 담당 업무·팀장은 재배정/해임 후 해제한다. 실제 계정/명단을 추정 배정하지 않는다. 현재 계약은 [ARCHITECTURE](ARCHITECTURE.md#범용-프로젝트-바인딩의-정책과-이행), 소스 구현/최종 인수·게시 상태는 [TODO](TODO.md#ux-재설계와-프로젝트-바인딩)가 소유한다.

## UX와 프로젝트 바인딩 구현

PRD-052/053은 단일 열 업무 요약→선택 업무/제출 상세→댓글 흐름, 내용 너비 칩·필수/완료 전 필요/선택과 조건부 상태 근거, 보조 수정과 시작 후 삭제 확인을 구현했다. 기존 query/집중 URL·팀/개인 큐 복귀, WBS 상하위/선행·간트/집계와 원문·버전/파일·영구 삭제 경고/서버 확인 계약을 유지한다.

PRD-055는 기존 명단/workspace CAS·event를 모든 프로젝트 유형에 재사용하고 SU 소속/접근 설정·영향 미리보기와 지정 프로젝트 admin 관리, 현재 DB identity/역할·소속과 자원 visibility/ownership을 교차하는 서버/SQL scope를 구현했다. Native v12/D1 0016은 인증 읽기 기본값을 보존하는 접근 모드만 추가하며 계정 role/명단을 자동 부여하지 않는다. 제한 프로젝트의 과거 본인 자료도 탈퇴 후 차단하는 사용자 확정 정책을 따른다.

소스·양 DB·Worker HTTP와 실제 Worker/Native 앱의 새5폭/두 테마, 기존 봉사 UI의 최종 로컬 인수를 완료했다. 초기 대비 허용오차·긴 option clip·상태 폼 표시·client checkbox/FCL·검토 승인 done 표시를 보완하고 같은 bundle을 재검증했다. 정확한 실행 범위·원인/실패와 재실행 결과·예상404/취소 요청의 구분은 [하네스](HARNESS_MAP.md#ux-바인딩-구현과-회귀-검증)가 소유한다. QLT-024는 로컬 합성 게이트 완료이며 전체 WCAG 인증·실기기/실 Google·운영 UI나 게시 성공을 뜻하지 않는다. 로컬 인수 시점에는 운영 version15와 실제 계정 role/명단·사용자 자료를 유지했다. 이후 version16 게시와 보존 확인은 아래 게시 원장의 별도 근거를 따른다.

## 봉사활동 팀과 직접 완료 인수

PRD-047~050/QLT-023은 프로젝트 유형·참여자·활동 종류/실제 팀·복수 팀 참여, 관리자에 의한 단일 팀장 교체, 팀 범위 업무 생성/배정/진행, 신규 봉사 업무의 직접 완료/선택 제출과 기존 업무/협업의 제출 필수 보존을 구현했다. Native v11/Drizzle0015는 v10/0014 위에 단일 팀장 pointer·완료자/시각만 추가하고 과거 자료/판정·private 계약을 유지한다. 중복 과거 팀장을 임의 선출하지 않는 fail-closed와 현재 역할·소속·canonical pointer를 재검사하는 SQL scope를 채택했다.

관리자 프로젝트/팀 관리와 작업 화면의 범위별 생성/편집·팀 필터·완료 방식·완료/재개 이력을 구현했다. 실제 hydrated 로컬 브라우저에서는 프로젝트 참여자/팀장 관리, 업무 생성·배정·완료/재개·권한 표시·선택 파일을 검증했다. SPA 명단 변경 후 select 초기화/행 제거와 private TXT·완료 기록의 새로고침 영속화를 확인했다. 업무 편집과 팀 필터 직접 조작은 이 브라우저 흐름에서 실행하지 않았으며 구현 범위와 클릭 인수 범위를 구분한다. 합성 권한·DB·Worker/브라우저 결과와 정확한 bundle 근거는 [하네스](HARNESS_MAP.md#봉사활동-팀장과-직접-완료-검증)에만 둔다.

이 완료는 코드·로컬/합성 게이트이며 운영 migration·실제 계정 역할 부여·실 Google 로그인·실사이트 인수·게시/배포를 포함하지 않는다. 기존 public Sites version14와 프로젝트5/작업7·사용자 자료를 보존했다. 운영 적용은 기존 백업·명시 대상/승인·최종 게시 결과 확인 절차를 별도로 따른다.

## PRD-046 봉사활동 정책 확정

사용자가 팀당 팀장 한 명, 봉사활동 새 업무의 제출물 선택, 직접 완료 가능자를 담당자·해당 팀장·관리자로 명시했다. 팀장은 전역 계정 등급이 아닌 팀 범위 역할이며 기존 업무의 제출 필수와 비공개 제출물 조회 계약은 유지한다. 이 결정은 기능/운영 인수 완료가 아니며 현재 계약은 [ARCHITECTURE](ARCHITECTURE.md#봉사활동-확장-계획), 단계별 검증 상태는 [TODO](TODO.md#봉사활동-확장-작업)를 따른다.

## QLT-019 Google Provider import

Node ESM은 NextAuth4 Babel CJS provider를 `{default: 함수}`로, Next/Vite interop은 함수로 전달했다. 실제 provider를 두 형태에서 정규화하고 OAuth 설정·PKCE/state 검사는 유지했다. 테스트는 configured/unconfigured provider 초기화를 별도 subprocess에서 확인하고 기존 로컬 Google 설정 대신 합성 값을 주입한다. 실패 재현 뒤 회귀와 통합 unit/action/visibility를 통과했으며 정확한 환경·실행 scope는 [하네스](HARNESS_MAP.md#봉사활동-저장-기반과-auth-import-검증)에 둔다. 실제 Google 로그인·운영 게시 성공을 의미하지 않는다.

## Sites 게시 원장

Site ID `appgprj_6ac75dba14348191801b002e0f2a0937`, origin https://wbscowork.cometgnome.chatgpt.site . 기존 public/환경 revision11을 유지했다. 아래는 저장소에 보존된 확인 결과이며 문서 편집이 새 게시를 만들지 않는다.

| version/시각(UTC) | 실제 게시 source | 결과/고유 근거 |
| --- | --- | --- |
| 1 · 2026-10-08 10:32:16 | 9938b584c08f805f1321061643a1b3fb6339260e | succeeded, deployment appgdep_6ac7712050308191955deb33769f87fa; 기존 ID, main2f6b74d 보존 |
| 2 · 10-08 13:27:53 | 8fc2cc69cdc8548739ae9ae2ed208ebc6fe47ce7 | hosted admin D1/R2/권한·보존 표시, appgdep_6ac79a4f82888191b8617754bdb85177 |
| 3 · 10-08 14:23:10 | f294edd620bee5cc557989a690e95dddfefb1354 | bug archive, appgdep_6ac7a743cd608191882d9a80fc0d84dd |
| 4 · 10-08 15:13:05 | 9a5367d607ce9a515b794d9a963a673a404a00f9 | decoder19.2.8, appgdep_6ac7b2f65b08819184da0c608035c5f8 |
| 5 · 10-08 | d631e51db980405f2dbf437116fa5d3f91b4b05a | bug lifecycle, 실제 owner의 검증/휴지통/복원 후 별도 정확한 대상 삭제 승인 |
| 6 · 10-09 | cecce92e | native migration 품질 checkpoint 게시 기록. exact metadata 미기재분은 추정하지 않음 |
| 8 · 10-09 12:07:47 | d18cef86d4b7ed9063d92d41f8b4563ec58e4602 | P0 core, D1 0005–0009 additive |
| 9 · 10-09 12:24:42 | 82d7d516ef34ed8718dbfe09d6189b7f81cacfe8 | pending UI만 후속, migration 변화 없음 |
| 10 · 10-09 18:04:25 | 3b4af81e175ca0cd889fdc2cb2f13bead9bec7b0 | succeeded, appgdep_6ac92c90e644819192a066f2b25c9d6c; D1 0010–0012, 기존13표 전체 row 동일/새3표0 |
| 11 · 10-19 04:01:18 | 0a2cbb5fc42d8917ba1a605f0e9c5b6360188962 | succeeded, appgdep_6ad5960689f881918f7dde37c3376428; 기존16표 전체 row 동일 |
| 12 · 10-20 05:51:39 | 0d1a1a3afe8680ddd7c1281b583fd9d846cc0bc1 | succeeded, appgdep_6ad701611af48191b37ff6b4a1548d2c; 기존15표 전체 row·public policy(revision2) 동일. 사용자2/기존receipt1/나머지0, 새screenshot표0 |
| 13 · 10-22 11:19:22.961 | b249c4dc525a36c4c843876625e2e0dde64c1461 | succeeded, appgdep_6ad9f0d0f3c481919846d8a5be031cc5; QLT-021 포함. public policy revision2/env revision11 유지 |
| 14 · 10-22 11:59:06.590701 | 41059c82c37d7de718a3e61b414d4ab0331e6c5a | succeeded, appgdep_6ad9fa80e2fc819183a6094e4d07563d; 첨부 transport 오류의 폼 내 안내/초안 보존 안정화. 기존 URL/public access policy revision2/env revision11 유지. 연결 실패 UI 보존 및 사용자 신규 첨부·새로고침·다운로드 PASS. 운영 수정 시 추가 첨부는 미검증 |
| 15 · 2026-10-23 04:23:10.491622 | d7550fb783b046738bf7a2d2e22aa412515bf02c | succeeded, appgdep_6adae1242adc8191b7cdd73c54537031; get_site/get_site_version 재조회 active/latest15·source·deployment 일치. 기존 URL/public policy revision2·auth_client·env revision11 entries 유지. 봉사활동과 D1 0014/0015 반영, 운영 UI 인수는 미실행 |
| 16 · 2026-10-23 08:01:01.751040 | 62b93208e1f32f2b19d58249643d5637242a8b36 | terminal succeeded, appgdep_6adb14287d548191924eba6c6d844aa3; get_site/get_site_version 재조회 active/latest16·source·deployment 일치. public policy2/auth_client/env11 유지, D1 접근 모드 추가·기존7표 전체 기존 컬럼 동일. 실 운영 GET/UI·Google은 미검증 |
| 17 · 2026-10-23 09:55:21.486616 | 7fc8d79fde1c1ad4f6d90bff9d710d4a7ac5d7a9 | appgdep_6adb2ef69d688191b5bd38ecca262b90 terminal succeeded; active/latest17·exact source/deployment 재조회 일치. public policy2/auth_client/env11 동일·기존7표 전체 동일, schema/migration0. 운영 UI/Google·R2 bytes는 미검증 |
| 18 · 2026-10-23 10:38:44.852001 | ccabf815e78d4aa43f15b12caf1c8d8a5b1577f7 | appgdep_6adb3920d4c081918b876140930c2be8 terminal succeeded; active/latest18·exact source/deployment 재조회 일치. public policy2/auth_client/env11 동일·기존7표 전체 동일, schema/migration0. 후속 같은 Work 브라우저의 QLT-027 관측 범위 재인수 PASS |
| 19 · 2026-10-23(updated12:39:08.402934) | 409f514a56dfac47932f0d3f874650f4e8b059bc | 최초 자동 승인 거부 후 새 직접 승인에 따른1회 재시도 terminal succeeded, appgdep_6adb555e05908191a189d19e2863f4cf. active/latest19·exact source/deployment 일치·기존23표/설정 동일, 새3표 각0행. 운영 UI는 미검증 |

미기재 version/검사/게시 성공을 번호 연속성으로 추정하지 않는다. version12 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_18e1378ab8f48191a6697fc282cd9022`다. 이후 확인한 version13 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_6377df9172908191b570ff1702181a8f`이며 source b249c4d에 QLT-021이 포함된다. 문서 편집이 새 게시를 수행한 것은 아니다.

version14 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_d5ff1c027aec8191a156027e98bc5df9`다. 코드 checkpoint는 GitHub main `82a8777a6ffe636c99366c81722fa9941836b2a7` / sites `41059c82c37d7de718a3e61b414d4ab0331e6c5a`이며 정상 atomic push 후 원격 SHA를 확인했다. 기본 build 차이만 보존했고 동일 sites 소스를 별도 Sites source repository의 main에 반영한 뒤 저장·게시했다. 문서만 갱신하는 후속 commit은 앱 재게시 근거가 아니다.

version15 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_22032f6377f08191bb66b0c9b280ed01`이다. 사용자 명시 승인 후 공식 Sites source repository main을 source41059c8에서 위 exact GitHub sites SHA로 fast-forward push하고 원격 일치를 확인했다. installed/cloud source helper 미가용을 확인해 [기존 게시 fallback](NAS_UPDATE_GUIDE.md#sites-게시)으로 hidden stdin/메모리 credential과 보존한 hosting manifest·dist·drizzle archive를 사용했다. 기존 사이트 ID/owner/public 범위·계정 역할·보안/환경 설정은 변경하지 않았고 NAS 배포도 하지 않았다. local/운영 검증과 보존 범위는 [하네스](HARNESS_MAP.md#version15-게시와-운영-검증-경계)가 소유한다.

version16 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_91fd504d5de88191b2e41191d1d3985b`다. 기능 commit main `b7fe96e386aba05938fd61a8822ce565a83c6551` / GitHub sites `62b93208e1f32f2b19d58249643d5637242a8b36`의 푸시·원격 HEAD를 확인하고 동일 sites SHA를 공식 source main에 반영했다. 별도 clean source clone에서 build한 실제 게시 artifact를 다시 인수해 저장·게시했다. 후속 문서 전용 HEAD는 이 exact 게시 소스와 구분하며 문서 반영 자체가 앱 재게시가 아니다. 실제 artifact QA·7표/설정 대조·운영/CI 제한은 [하네스](HARNESS_MAP.md#version16-게시와-운영-검증-경계)가 소유한다. 기존 사이트 ID/공개 범위·auth_client·환경을 유지했으며 계정 role/소속 자동 부여·NAS 배포는 하지 않았다.

version17 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_1655a01b02088191b5bd056cb28dff0e`다. 기능 main `9b07c5e2d93ac47a6256eaccf188073d62a29977` / sites·공식 source main `7fc8d79fde1c1ad4f6d90bff9d710d4a7ac5d7a9` 푸시·원격 HEAD를 확인했다. exact 단일 build의 실제 Worker artifact를 인수해 기존 사이트에 저장·게시했고 후속 조회로 source/version/deployment를 대조했다. 후속 문서 HEAD는 이 게시 코드 SHA와 구분한다. 인수·보존/CI·운영 미확인 경계는 [하네스](HARNESS_MAP.md#version17-게시와-검증-경계)가 소유한다.

version18 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_be49c22146708191b64ec65115bfaa82`다. 기능 main `3d36fa6eb8efea144a111a4efa8ca008c3b30bee` / sites·공식 source `ccabf815e78d4aa43f15b12caf1c8d8a5b1577f7`의 푸시·원격 HEAD와 게시 후 source/version/deployment를 확인했다. 시간대 미지정의 React418과 별개 초기 인증 flash를 명시 KST·서버 초기 세션 전달로 보완하고, 공개 경로 missing-secret 회귀도 null guard로 수정했다. 양 runtime47조건·최종 auth/HTTP와 기존 자료/설정 보존은 [하네스](HARNESS_MAP.md#version18-게시와-검증-경계)가 소유한다. QLT-027은 부모가 별도 허용 Chrome의 같은 로그인 세션에서 수행한 [v18 운영 재인수](HARNESS_MAP.md#version18-허용-work-브라우저-재인수)를 관측 범위에서 완료했으며 Native 홈500·간헐 응답 소비 오류는 별도 열린 항목이다. 새 OAuth·R2 bytes 인수, 계정 권한 변경·NAS 배포는 수행하지 않았다. 후속 문서 HEAD는 게시 코드 SHA와 구분한다.

version19 ID는 `appgprj_6ac75dba14348191801b002e0f2a0937~appgver_4351f6dc1888819190c8d32c0c4f6287`다. 공식 source main `409f514a56dfac47932f0d3f874650f4e8b059bc` fast-forward·원격 일치와 compiled33을 확인해 저장했다. 최초 운영 배포는 자동 승인 검토의 parent review 요구로 거부돼 v18을 유지했으며, 사용자 새 직접 승인 후 같은 저장v19가 미배포임을 확인하고1회 재시도해 terminal succeeded를 받았다. deployment/active/latest19와 D1 0017의 새3표·기존23표/설정 보존을 확인했다. 정확한 승인·거부 이력과 검증/미확인 경계는 [하네스](HARNESS_MAP.md#version19-승인과-운영-배포)가 소유한다. 저장 성공과 실제 운영 배포 성공을 구분하며 후속 문서 HEAD는 게시 source를 바꾸지 않는다.



### package와 복구 근거

- version10 archive342files/5,171,200bytes, SHA256 `06997bc7a76194663eb25874f91ec23bffca2d7b92773d816e8042420c228fd0`; version11은343files/5,171,200bytes, normalized hash `0a8936cab053f800b53e056f47abf6b4b3d2795338181bb58115707fc8e99e1a`.
- version11 source-only 첫 deployment `appgdep_6ad59501b7ac8191af20d8792878205a`는 build_output_missing_hosting_metadata로 terminal failed. 같은 SHA의 로컬 dist metadata/정확한 dist 경로 archive로 복구했다. 실패를 숨기거나 migration/권한을 변경하지 않았다.
- version12 archive350files/5,273,600bytes, normalized SHA256 `6ead63551d163a42f3051af51fd8aa8607da9a81b7f5b7134488d07202409309`. 원래 gzip1,485,966bytes, SHA256 `6b6bba6afeaa878d605c06271976bc5bce663228b26ccad3a8f887913b3c28cd`. 배포 직후 최근5분 error0은 운영 UI 인수나 차단된 요청의 Worker 도달 근거가 아니다.
- version10 초기 old menu/404·청크 import 실패는 재배포 없이 reload1회 후 정상화했다. asset 전환 시점 불일치는 가설이며 원인 확정 아님. 반복 HTTP 관찰은 네트워크 승인 취소로 수집 중단 후 재시도하지 않았다.
- version14 저장 archive는350files/5,273,600bytes, normalized content hash `sha256:46b3b742157c665ff887b4ea18ea61062b9703d6aa3d81cceefe9819f3d2cf32`다. 정상 게시 확인은 운영 첨부 인수나 최초 연결 차단 원인 해결을 증명하지 않으며 [QLT-022 검증 기록](HARNESS_MAP.md#제출물-첨부-운영-오류-qlt-022)의 남은 경계를 유지한다.
- version15 로컬 tar는5,488,640bytes, bytes SHA256 `26a6de3463ed954e158160390911f6eeedf95e7c46148570daadb3be12d81387`다. native save가 반환한 archive는353files/5,478,400bytes, content hash `956442722b10a37bc981f48e94d51f239b0c83f680e727448b59fa58c9c7449b`이며 각 반환값을 구분해 보존한다.
- version16 로컬 `wbscowork-ux-binding-62b9320.tar`는360entries/5,990,400bytes, bytes SHA256 `8fd6fd92f3860c9f1fdc1cd3fd325905e9db9b9a01afef2dd912fddc291826d9`다. server 저장 archive 반환값은360files/5,621,760bytes, hash `sha256:79f829d3941880900c5257fab14b3614c2105ac193cdaa745e86595272062f05`이며 두 tar의 bytes/hash가 같다고 해석하지 않는다. 저장된 version15는 복구 참조로 유지했고 schema down/실제 복원은 수행하지 않았다. 소속 제한 활성화 후 구형 전역 관리자 앱으로 writable rollback하는 위험은 기존 운영/권한 정본을 따른다.
- version17 입력 `wbscowork-preview-7fc8d79.tar`는362entries/6,021,120bytes, SHA256 `ad3171bf1c5ce6f4ce0bbc76010f9524f22d860cf54211eef08052f8420fc466`다. 별도 Sites `archive_storage` 반환값은362files/5,652,480bytes, hash `sha256:12826fb6617c878f4794e7b78af61c2ff69ff84a5a8be96ba85c71b9aabe22ca`, file ID `file_00000000f8c88206983915eaaa5d2e22`다. 입력 tar container와 service 저장 반환 hash/bytes를 동일하다고 주장하지 않는다. 저장된 version16은 복구 참조로 유지했고 rollback은 수행하지 않았다.
- version18 입력 `wbscowork-hydration-ccabf81.tar`는361regularfiles/6,021,120bytes, SHA256 `aa7ff43a62a26f0e286b5de298fdd6946a326648274d78d37e41ed61a0757d44`다. 모든 파일의 content hash가 검증 checkout과 일치했다. 별도 서비스 정규화 archive는361files/5,652,480bytes, SHA256 `4188a5fb0c77609a4f14db7cb03f57e12e1d9e32421cd8473f7a19691ae780e6`, file ID `file_000000003a8882068baf4589bb7613f7`다. 입력 tar container와 서비스 반환 archive의 bytes/hash를 동일하다고 주장하지 않는다. schema down/rollback은 수행하지 않았다.
- 저장 version19의 service archive 반환값은390files/6,696,960bytes, hash `sha256:12391e92fec3e0332c294bc69e63f246742a1c71253238fe95d7fbd417d3f080`이다. 입력 tar bytes와 같다고 추정하지 않는다. 저장v18 archive를 code fallback 참조로 확인했으며 DB backup 복원·자동 down은 실행하지 않았다.
- [Cloudflare의 D1 Time Travel 문서](https://developers.cloudflare.com/d1/reference/time-travel/)는 production backend의 시점 복원을 설명한다. 현재 Sites 도구에는 bookmark/export/restore가 노출되지 않아 이 사이트의 실제 bookmark 확보나 복원은 검증하지 않았다. 메모리의 사전 표본 비교는 전체 DB/R2 백업이 아니다. 새 봉사 기능이 사용된 뒤 version14 앱으로 writable rollback하면 새 팀 범위/완료 계약을 깨뜨릴 수 있으므로 forward fix를 우선하고 자동 down은 하지 않는다.
- 모든 row 비교는 기록된 표/complete page 범위이며 audit전체/R2 bucket inventory 동일성을 보장한 것이 아니다. additive 이력/선후행 도입 후 구형 writable 앱으로 rollback하면 계약을 깰 수 있어 forward fix가 기본이다.

## QLT-021 운영 인수와 승인된 합성 정리

version13 초기 게시 점검 회차의 별도 근거: 실계정 합성 자료를 만들기 전 배포 직전/직후 read-only로 audit_logs를 제외한17표의 전체 페이지를 비교해 행 내용이 같았다(users2, bug_report_purge_receipts1, 나머지15표0; has_more=false·truncated=false). 환경 변수 entries/revision11·public policy revision2·D1/R2 binding도 유지됐다. 이는 **그 두 시점의 비교**이며 이후 사용자 자료가 생성된 version14의 현재 DB나 audit 전체·R2 bucket inventory가 같다는 주장이 아니다. 당시 Sites build와 격리 삭제/HTTP·익명 GET 결과는 [하네스 기준선](HARNESS_MAP.md#검증-기준선)에 보충한다.

2026-10-22, 위 version13에서 부모 클라우드 Chrome의 기존 Google 인증·슈퍼관리자 세션으로 인수했다. 합성 프로젝트#4 `QLT021-QA-20261022-1127` / 작업#6 / 제출물#4에 본문 v1·v2와 댓글1개를 만들었다. 첨부는0개였으며 업로드 실패의 상세 관측은 [QLT-022 검증 기록](HARNESS_MAP.md#제출물-첨부-운영-오류-qlt-022)이 소유한다.

사용자의 명시적 대상별 영구 삭제 승인 뒤 11:34:38.645Z 제출물#4를 삭제했다. UI `제출물을 삭제했습니다.` / `status=success`, 알림 query를 제거한 task URL 새로고침의 제출0·댓글0, `/submissions/4`의404를 확인했다. `/admin/logs`는 INFO / tasks / `submission.delete completed`와 submissionId4/taskId6/projectId4를 표시했다. 승인받은 작업#6와 프로젝트#4도 이어 삭제한 뒤 `/tasks`의 프로젝트0·작업0·제출0·댓글0을 확인했다.

이 결과로 **하위 버전·댓글 cascade 후 실제 삭제를 실패로 오인하던 QLT-021 핵심 경로의 운영 인수는 PASS**다. 제출물 모든 버전과 댓글의 영구 삭제는 앱에서 복원할 수 없으며, 이 승인은 해당 합성 대상에 한정된다. 첨부0개였으므로 운영 첨부 bytes 삭제·R2 전체 잔여 없음·강제 refresh/audit 실패 경로는 검증하지 않았다. 후속 오류 주입은 기존 로컬 회귀 근거와 구분한다. 후속 사용자 신규 파일 업로드는 통과했으나, 운영 추가 첨부·파일 삭제는 QLT-022에서 미검증으로 구분한다.

version13 archive는349files/5,273,600bytes, content hash `sha256:3a6e12848f23d3805556e470ded0e006dba52d7fadab56b6767d25fe6b67503f`다. 반환된 저장/배포 provenance 확인과 Chrome 인수 근거를 함께 기록했으며 이 문서 단계에서는 재게시·데이터 변경·추가 테스트를 수행하지 않았다.

## P0P1 인수와 승인된 정리

P0 source d18cef86의 Worker412/quality375/auth18/unit112, native additive77, 최종 UI82d7d51의 pending 버튼7개를 확인했다. P1의 fe6cb40507bd2f45501e3139243e164e35f2b16b(선후행), ed9a9d349194ca0c1a7c5b0dbe76de75b7891a44(template), 299def9962de87ffef727fa79402067ba0711bb1(search), 최종3b4af81의 unit119/D165/Worker472/native99+관계복원4를 확인했다. 별도 SQL trace 집계 유실은 완전한 실행 trace로 주장하지 않는다.

P0 실계정1개의 실제 HTTPS 흐름은 프로젝트2개 전환/Back, 카드3개, 제출3의 v1/v2·링크·첨부·revision2 댓글, no-review완료(task3 done/version3/events3), 미완료 큐 제외·완료 필터1, leaf1/3=33%/남은2를 확인했다. desktop/492CSSpx와 light/dark/내부 Gantt scroll을 확인했다. P1 실환경은 기존 세션의 검색/알림0건, 필터URL·read/all과500/485px 읽기 확인이며 채워진 template 클릭·다중Google협업은 미실행이다.

| P0 파일 | bytes | SHA256 |
| --- | ---: | --- |
| qa-p0-v1.txt | 44 | 971f8a3c6717616aef450c568a2bc3e5be4dd7d947de7335a55f69e0d2d69137 |
| qa-p0-v2.txt | 71 | a431d1ee0947c458b1fb3ceecef5b1bb9b0e0780790867645886e28938ae3880 |

v2 뒤 과거v1 다운로드도 동일했고 metadata3행이 object2개를 가리켰다. 에이전트의 QA 파기 checkbox는 플랫폼 검토로 거부되어 중단했다. 사용자가 직접 삭제했다고 알린 뒤 2026-10-09 13:00UTC 전후 read-only로 projects2/3, tasks3–5, task_events1–5, submission3, revisions/events1–2, comment2, attachments4–6과 cleanup이 모두0임을 확인했다. 감사113(project3,12:53:32.244)/114(project2,12:53:40.715)는 정상 project.delete였다. 사용자 ID/email/role·기존 bugreceipt는 유지, 로그인/동기화 시각만 정상 갱신됐다. bucket 전체 scan이나 향후 삭제 승인이 아니다.

P1 native 첫 전체 하네스는 관계표 DELETE권한1142로 중단했다. 사용자 승인 후 새 실행DB 하나의 task_dependencies 표에만 좁게 추가해 복구 가능한 관계 교체/rollback/복원4를 확인했다. 기존119DB와 신규18/총137DB·파일·재시작 snapshot을 보존했고 최종 listener를 정지했다. 프로젝트/업무/파일/이력 purge나 다른 표·계정 권한 확대로 확대하지 않는다.

## 실환경 QA와 삭제 승인 경계

- 2026-10-08 version2: owner가 Google로그인한 동일계정/SU로 project1, tasks1/2, submissions1/2, comment1, attachments1/3(qa-public56B)/2(qa-private57B)를 검증했다. 기간/깊이0/1·수정취소/저장·공개/비공개·동명첨부2개·댓글·download cmp·1180/502px·light/dark·D1 감사/설정 유무 표시를 확인했다. 다른Google계정·role 변경·강제R2실패는 로컬 합성 범위다.
- 그 정확한 QA 목록은 별도 사용자 승인 후14:04UTC 정상 관리자 UI로 파기했다. project/task/submission/comment/attachment/cleanup0, 사용자1/admin과 audit 보존을 확인했다. R2 delete 경로 완료와 독립 bucket scan은 구분한다.
- version4 bug report1은15:15UTC created→addendum→in_progress→resolved(version4/events1–4)로 확인했다. 입력 query/fragment 제거, 원문/검토/commit보존·pending방지를 확인했다. 실제 장애 수정이 아니라 승인된 합성1건이었다.
- version5에서 verify→trash→restore→trash 후 정확한 report1/resolved/verified/trashed/version8/events1–8을 재확인하고 별도 승인된 정상 SU 제목·지문 UI로 영구 삭제했다. 본문/events가 없어지고 최소 receipt1, 기존 사용자/role/audit 보존을 read-only 확인했다. 이 report는 첨부가 없었다. backup/diagnostic 삭제나 다른 대상 승인을 보장하지 않는다.
- d631e51 native의 비파괴16조건은 당시 React19.2.6 좁은 동작 검증이다. lockfile19.2.8 전체/native purge·isolation 경합 증거로 확대하지 않는다. 별도 cleanup race는 QLT-015, 간헐503은 QLT-016에 유지한다.

## 보안 패치와 활성 decoder

GHSA-wx67-qw84-cm4g/CVE-2026-44907의 Server Functions CPU/메모리 고갈 경로를 확인하고 React/react-dom/react-server-dom-webpack만19.2.8로 고정했다. Vinext beta.5/plugin-rsc0.5.26/Google·역할을 유지했다. [React advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g), [공식 수정](https://github.com/react/react/commit/1dd4ecbdabf826f527fc9a58c05ea70375b7d170)을 근거로 active decoder의 form key 순회 후 한 번 decode를 검사했다. vendor fallback이 아닌 직접 alias 경로이며 compiled chunk 지문은 `a75c3e7add6877c6d33f32aeb7dbe8bc56abd29735f8d5ffce777743b45b764f`였다. decoder 검사는 공격/부하 요청을 운영에 보내지 않는다. 당시 audit33은 package entry 수로, 전체 advisory 해결/침해 관측이 아니다.

## 설치 용량과 환경 기록

2026-10-08 08:51:23UTC, source2f6b74d, 별도 Node26.11.1/npm11.20/MariaDB11.4.13의 설치 전 df Used864,256 →4,236,959,744byte로 추가 **4,236,095,488byte(4.236095GB/3.945171GiB)**, Available27,798,470,656byte였다. 같은 overlay를 중복 합산하지 않았고 /tmp tmpfs22,499,328byte는 디스크 증분에서 제외했다. Docker vfs/image·컨테이너 복제/metadata 잔차 약2.891GB는 구간 추정이며 du 직접 측정이 아니다. Node공식tar hash를 확인했고 기반Node/Git/Docker를 교체하지 않았다.

3307은tmpfs(실행169,480,192byte),3308디스크 datadir는 정지156,897,280byte를 보존했다. 두 컨테이너/이미지·cache·증거는 정지·보존했고 실제 운영 자료가 아니다. 같은 SHA unit14+DB33=47을 두 backend에서 확인했다. 기본 폰트403/NO_SECRET로 초기build/auth가 실패했고 공식Roboto bytes+환경전용 mock으로 별도 offlineWebpack build를 확인했다. 실제 Google/브라우저 증거로 쓰지 않는다.

같은 날 후속 게시 환경의 checkout1,096,945,664/node_modules1,083,822,080/npmcache1,020,772,352byte는 **다른 snapshot**이다. checkout+cache2,117,718,016byte(2.118GB/1.972GiB)는 중첩 node_modules를 다시 더하지 않았으며 앞4.236GB 설치 증분과 합산하지 않는다. 설치 전 기준 없는 snapshot을 추가 설치량이나 운영 서비스 비용으로 표현하지 않는다.

## OPS-036 branch archive와 복구 근거

정리 전 main0891513, 게시용31ad5cf, native UI3f62450를 조사했다. whole commit git cherry는 모두+였으나 UI3f62450/0a2cbb5의 app/src/scripts/package stable patch-id는 `2daf58344eab928f18612091412eaa23c204eec7`로 같았다. main은native0891513/3f62450 ancestry, sites는31ad5cf ancestry를 보존했다. 공통완료변경을 선별 통합해 build 기본값만 의미상 다르게 유지했다.

아래 annotated tag의 원격 peeled SHA를 먼저 확인하고 pre-push exact-tip 검사 후5개 임시 branch를 atomic 삭제했다. 강제push/보호·권한 변경/tag삭제는 없었다. 정리 후 main=`a28188e8d56bacd2cb7af9622746f31b8adf30da`, sites=`56e397c8edd9053abefafb2f37c3f70a1470d4f0`; 이는 당시 checkpoint이며 최신Git 소스를 고정하는 값이 아니다.

| 이전 branch | 원격 archive tag (공통 prefix `archive/branches/2026-10-20/`) | 원래 SHA |
| --- | --- | --- |
| feat/bug-screenshots | feat/bug-screenshots-31ad5cf | 31ad5cfa6db31051a26cc72f475e48b7540eeb8d |
| feat/sites-deployment | feat/sites-deployment-31ad5cf | 31ad5cfa6db31051a26cc72f475e48b7540eeb8d |
| fix/shared-desktop-layout | fix/shared-desktop-layout-3f62450 | 3f624501d942db22ab0cb3df699de036b3b2a43c |
| fix/shared-desktop-layout-sites | fix/shared-desktop-layout-sites-ad19c05 | ad19c05d351de967ee282389d689ffaeb14e3122 |
| fix/sites-test-network-diagnostics | fix/sites-test-network-diagnostics-de3e005 | de3e005d106c31d0e7f415b9eae9602856da54db |
| main(유지) | main-0891513 | 089151345f4221fb11e7c07adafc8748d571e319 |

당시 protected6개모두false/ruleset0/openPR0/Actions0이었다. gh API Forbidden/일부connector 관리collection 미제공으로 외부hook 전체는 미확인이다. branch정리 자체의 사이트/NAS 배포는 없었다. 복구 명령·현재운영규칙은 NAS_UPDATE_GUIDE만 소유한다.

## OPS-037 문서 간소화와 원문 복구

기준은 main ddcedd6/sites c1c55da의 공통 문서다. 현재저장소 지침과 사용자 방향에 따라 역할을 AGENTS에 등록하고 날짜별17보고서와 완료된 계획3개를 기존 정본으로 승격했다. 새로운 날짜별보고서/단순archive파일은 만들지 않는다. 미추적 사용자 자료와 기존 HTML사용자 가이드는 보존하며 앱/DB/보안/배포는 변경하지 않는다. 원본 docs-canon SKILL/검사기 부재로 그것을 실행하거나 완전 준수라고 주장하지 않는다. 외부 PredevGUI 규칙/BOM은 적용 대상에서 제외했다.

이번 결과: `docs/` **36→16개**, 전체 추적 Markdown/HTML **50→30개**, 핵심 정본 **7→7개**다. 제거20개는 날짜별17개+완료 계획3개이며 archive 사본/새 보고서는 없다. 예외9개는 Native 세부 운영·버그 도메인·미구현 digest·팀 사용법·ID 대응·사용자 자료3개·NAS/Sites 운영으로 등록했다. 읽기 순서는 AGENTS→TODO→PROJECT_MAP→관련 ARCHITECTURE/운영 계약→HARNESS_MAP이며 CLAUDE는 AGENTS 포인터다.

대체 검증은 `node scripts/check-docs.mjs --self-test`, `node scripts/check-docs.mjs`, 검사기/참조 주석의 focused ESLint와 `git diff --check` PASS다. Markdown/HTML30개·상대 링크161개·npm 명령84개, 등록16개/핵심7개를 검사했다. 두 HTML은 Python HTMLParser로 중첩 태그·종료를 확인했고 외부 runtime CDN은 없다. 사용자 HTML/빠른 참조/제작 안내와 팀 업무 가이드는 정리 전 SHA256과 동일하다. 앱·DB·schema·package/lock·hosting·보안·배포 파일은 바꾸지 않았고 제품 build/DB/운영 브라우저 검사는 이번 문서 작업에서 재실행하지 않았다. QLT-021 수정 소스와 live version12의 미게시 차이를 보존했다. 두 branch에는 같은 문서 patch만 적용하며 default build 차이를 유지한다. 커밋/원격 SHA는 Git 결과로 확인한다. 원본 canon 검사 미실행은 대체 검사 통과와 별개다.

정리 전 전체 원문은 source `c1c55da954b38f4032be3d63926bddbda603d977`에서 복구 가능하다. 아래 파일들의 고유결정/계약은 지정정본, 세부 과거 raw실측은 Git이 보존한다.

```bash
# 실제 파일을 덮지 않고 과거 원문 확인
git show c1c55da954b38f4032be3d63926bddbda603d977:docs/SITES_PUBLICATION_2026-10-08.md
```

| 통합 전 파일 | 현재 소유 정본 |
| --- | --- |
| `BRANCH_POLICY_2026-10-20.md` | [NAS_UPDATE_GUIDE.md](NAS_UPDATE_GUIDE.md#브랜치-운영과-복구) |
| `BUG_LIFECYCLE_2026-10-08.md` | [BUG_REPORTS.md](BUG_REPORTS.md#검증-휴지통-영구-삭제) |
| `BUG_SCREENSHOTS_2026-10-20.md` | [BUG_REPORTS.md](BUG_REPORTS.md#스크린샷) |
| `CLOUD_INSTALL_REPORT_2026-10-08.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#설치-용량과-환경-기록) |
| `P0_ACCEPTANCE_2026-10-09.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#p0p1-인수와-승인된-정리) |
| `P1_ACCEPTANCE_2026-10-09.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#p0p1-인수와-승인된-정리) |
| `P1_IMPLEMENTATION_PLAN.md` | [ARCHITECTURE.md](ARCHITECTURE.md#팀-업무와-검토-계약) |
| `QLT_021_SUBMISSION_DELETE_2026-10-21.md` | [ARCHITECTURE.md](ARCHITECTURE.md#제출물-삭제-결과와-후속-처리-qlt-021) |
| `SECURITY_PATCH_2026-10-08.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#보안-패치와-활성-decoder) |
| `SITES_BUG_QA_2026-10-08.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#실환경-qa와-삭제-승인-경계) |
| `SITES_LAYOUT_PUBLICATION_2026-10-19.md` | [NAS_UPDATE_GUIDE.md](NAS_UPDATE_GUIDE.md#sites-게시) |
| `SITES_LIVE_QA_2026-10-08.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#실환경-qa와-삭제-승인-경계) |
| `SITES_PREFLIGHT_2026-10-08.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#sites-게시-원장) |
| `SITES_PUBLICATION_2026-10-08.md` | [COMPLETED_LOG.md](COMPLETED_LOG.md#sites-게시-원장) |
| `SITES_TEST_NETWORK_2026-10-19.md` | [NAS_UPDATE_GUIDE.md](NAS_UPDATE_GUIDE.md#운영-접속과-테스트-네트워크) |
| `SITES_VALIDATION_2026-10-08.md` | [HARNESS_MAP.md](HARNESS_MAP.md#검증-기준선) |
| `SITES_WORKER_AUTH_2026-10-08.md` | [ARCHITECTURE.md](ARCHITECTURE.md#사이트-실행과-인증) |
| `UI_LAYOUT_2026-10-19.md` | [ARCHITECTURE.md](ARCHITECTURE.md#화면-구조) |
| `FSD_MIGRATION_PLAN.md` | [ARCHITECTURE.md](ARCHITECTURE.md#fsd-의존-경계) |
| `TEAM_WORKFLOW_PLAN.md` | [ARCHITECTURE.md](ARCHITECTURE.md#팀-업무와-검토-계약) |

### 이전 anchor 호환

아래는 과거 링크의 이동 지점이며 상태/규칙 본문을 복제하지 않는다. 상세 raw원문은 위 Git경로를 따른다.

<a id="1-id-체계-도입-이전에-인도된-기능"></a>
<a id="2-완료-항목"></a>
<a id="ops-021-준비-기록--main-native-통합-2026-10-10"></a>
<a id="ops-022--sites-worker-전환-및-공개-게시-2026-10-08"></a>
<a id="ops-023--인증-후-보호-화면-실환경-브라우저-검증-2026-10-08"></a>
<a id="ops-024--승인된-실환경-qa-데이터-정리-2026-10-08"></a>
<a id="ops-025--hosted-관리자-runtime-표시-정정-2026-10-08"></a>
<a id="ops-026--격리-worker-업무-흐름-회귀-검증-2026-10-08"></a>
<a id="ops-027--비공개-버그-제보리뷰-게시-2026-10-08"></a>
<a id="ops-028--nodemariadb-동시-검토-및-테스트-로더-호환성-2026-10-08"></a>
<a id="ops-029--버그-제보리뷰-실환경-쓰기-검증-2026-10-08"></a>
<a id="ops-030--실제-worker-rsc-decoder-보안-패치-2026-10-08"></a>
<a id="ops-031--버그-수명주기-게시와-승인된-실환경-정리-완료분"></a>
<a id="ops-036--mainnas--siteschatgpt-sites-두-브랜치-정리-2026-10-20"></a>
<a id="prd-033--일반-팀원의-프로젝트-전환-2026-10-09"></a>
<a id="prd-034--주제-목표와-카드별-완료-기준-2026-10-09"></a>
<a id="prd-035--수행-가능한-담당자와-책임-분담-2026-10-09"></a>
<a id="prd-036--업무-상태와-실제-진척-2026-10-09"></a>
<a id="prd-037--원본이-남는-산출물-버전-2026-10-09"></a>
<a id="prd-038--제출-검토-보완-재제출-승인-2026-10-09"></a>
<a id="prd-039--내-업무와-내-검토-대기-2026-10-09"></a>
<a id="prd-040--주제-현황과-선후행-차단-2026-10-09"></a>
<a id="prd-041--주제별-업무-분해-템플릿-2026-10-09"></a>
<a id="prd-042--업무와-산출물-검색-2026-10-09"></a>
<a id="prd-043--행동이-필요한-인앱-알림-2026-10-09"></a>
<a id="prd-044--팀-업무-전체-흐름-인수-검증-2026-10-09"></a>
<a id="prd-045--버그-제보-스크린샷-2026-10-20"></a>
<a id="qlt-001--eslint-기준선-확보"></a>
<a id="qlt-002--feature-sliced-design-구조-정리-8단계"></a>
<a id="qlt-003--비공개-제출물의-파생-데이터가-client-payload로-노출"></a>
<a id="qlt-004--제출물댓글-mutation에-작성자-ownership-검사-없음"></a>
<a id="qlt-005--단건-조회-getsubmissionbyid가-unscoped"></a>
<a id="qlt-006--로그-metadata에-저장-파일-경로가-남음"></a>
<a id="qlt-007--tasks-프로젝트-crud-server-action이-쓰기-역할만-확인"></a>
<a id="qlt-008--dep0205-moduleregister-deprecation-경고-해소"></a>
<a id="qlt-009--가시성권한-회귀-테스트-하네스-도입"></a>
<a id="qlt-010--프로젝트-crud-단일화-2026-10-09"></a>
<a id="qlt-011--날짜계층첨부역할-회귀-확장-2026-10-09"></a>
<a id="qlt-012--native-versioned-migration-2026-10-09"></a>
<a id="qlt-014--필요한-next-타입-유지와-잔재-제외-2026-10-09"></a>
<a id="qlt-017--native-esm-실행과-schema-설정-비노출-2026-10-10"></a>
<a id="qlt-018--공통-헤더본문-너비와-메뉴-줄바꿈-2026-10-19"></a>
<a id="qlt-020--운영-smoke와-테스트-네트워크-진단-2026-10-19"></a>
<a id="qlt-021--제출물-삭제-완료-후-실패-표시-2026-10-21"></a>
<a id="t-001--eslint-기준선-확보"></a>
<a id="t-002--feature-sliced-design-구조-정리-8단계"></a>
<a id="t-003--비공개-제출물의-파생-데이터가-client-payload로-노출"></a>
<a id="t-004--제출물댓글-mutation에-작성자-ownership-검사-없음"></a>
<a id="t-005--단건-조회-getsubmissionbyid가-unscoped"></a>
<a id="t-006--로그-metadata에-저장-파일-경로가-남음"></a>
<a id="t-007--tasks-프로젝트-crud-server-action이-쓰기-역할만-확인"></a>
<a id="t-008--dep0205-moduleregister-deprecation-경고-해소"></a>
<a id="t-009--가시성권한-회귀-테스트-하네스-도입"></a>
<a id="wbs-태스크--완료-기록"></a>
<a id="완료-목록"></a>
<a id="참고-문서"></a>
<a id="팀-업무-p0-완료-2026-10-09"></a>

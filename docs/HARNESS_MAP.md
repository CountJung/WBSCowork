# 실행·검증 하네스

이 문서는 **무엇을 어떤 조건에서 검증하고 결과를 어떻게 구분하는가**를 소유한다. 현재 열린 항목은 [TODO](TODO.md), 동작/권한은 [ARCHITECTURE](ARCHITECTURE.md), 과거 고유 실측은 [COMPLETED_LOG](COMPLETED_LOG.md)를 본다. 아래 명령은 실제 package.json/scripts를 기준으로 한다.

## 실행 전제

- lockfile 기반 npm ci와 Node22.12+ 도구체계. 실제 `.env*`는 AI 컨텍스트로 열지 않는다. native CLI가 기존 runtime 설정을 로드하는 동작과 테스트의 합성 환경 주입을 구분한다.
- main 기본 build는 native Next, sites는 Vinext다. 같은 checkout에서 두 build는 `.next/types`를 공유하므로 병렬 실행하지 않는다. Vinext stub과 기존 Next validator가 충돌하면 `node node_modules/next/dist/bin/next typegen` 후 순차 typecheck한다. 생성 타입/필수 include를 삭제해 통과시키지 않는다.
- 상태는 PASS/FAIL/미실행/건너뜀/불확실로 나눈다. 날짜·exact SHA/작업 트리·환경/명령·실제 결과·미확인 범위를 함께 기록한다. 로컬/합성·실계정·운영 게시 결과를 섞거나 여러 scope 건수를 합쳐 포괄 검증으로 표현하지 않는다.

## 명령 등록부

| 명령 | 목적과 경계 |
| --- | --- |
| `npm run dev` | native 개발 서버; 기존 APP_PORT |
| `npm run dev:debug` | native 인스펙터 개발 서버 |
| `npm run db:check` | 기본 실제 DB 연결; --validate-only는 설정 형식만 |
| `npm run build` | main native / sites Worker의 branch 기본값 |
| `npm run start` | native production; 해당 Next build 선행 |
| `npm run lint` | ESLint, error/warning0 |
| `npm run typecheck` | tsc --noEmit; 생성 타입은 빌드 후 순차 확인 |
| `npm run check:fsd` | fixture self-test5 → import graph 검사 |
| `npm test` | unit + native visibility. --require-db면 DB 없을 때 실패 |
| `npm run test:unit` | DB 없는 unit 묶음 |
| `npm run test:submission:delete` | D1+새 MariaDB DB; --d1/--maria 선택, 격리 삭제/권한/rollback |
| `npm run test:db:up` | 127.0.0.1:3307 / *_test 전용 MariaDB 기동 |
| `npm run test:db:down` | 테스트 컨테이너/datadir 폐기 포함; 현재 승인 범위 확인 |
| `npm run test:db:status` | 테스트 DB 상태만 |
| `npm run build:next` | native build 별칭 |
| `npm run dev:sites` | 로컬 Vinext 개발 |
| `npm run start:sites` | 이미 build한 Worker의 loopback local preview |
| `npm run test:sites:auth` | credential-free 실제 workerd 인증18; Google 교환 아님 |
| `npm run db:generate` | Drizzle 새 schema/migration 생성; 배포/운영 적용 아님 |
| `npm run test:sites:storage` | ephemeral D1/R2 upload/실패/참조 보호 |
| `npm run test:sites:http` | build 후 actual Worker/D1/R2 full HTTP; --bugs면 버그 범위 |
| `npm run test:sites:browser` | 기존 Worker의 합성 desktop/mobile; loopback만 |
| `npm run test:sites:submission-upload:browser` | production Worker+격리 D1/R2의 hydrated Chromium 제출 TXT 신규·수정·재조회·다운로드·연결실패 초안/파일 보존·수동 재시도; 1280/390px, loopback만 |
| `npm run test:sites:bug-screenshots` | ephemeral D1/R2 이미지·권한·rollback·lease28 |
| `npm run test:sites:bug-screenshots:browser` | build 후 Python Playwright/Chromium 첨부19; loopback만 |
| `npm run test:sites:bugs` | 독립 bug archive D1 계약 |
| `npm run test:sites:decoder` | compiled active RSC decoder fingerprint; 공격 전송 아님 |
| `npm run test:sites:quality` | Worker 날짜/계층/가시성/첨부 품질 fixture |
| `npm run db:migrate` | 기본/--status 읽기 전용; --apply만 별도 schema identity DDL |
| `npm run test:native:migrations` | loopback3307 새 *_test DB 생성·보존, additive 회귀 |
| `npm run test:sites:workflow` | 팀 업무 실제 Worker 합성 flow; 간헐503 한계 명시 |
| `npm run test:sites:p1` | 선후행/템플릿/검색/알림 D1 계약 |
| `npm run build:sites` | Vinext Worker output dist; 배포 자체 아님 |
| `npm run build:native` | native Next output .next |
| `npm run check:native:entrypoints` | 실서버 없이 CLI/합성 설정 경계8 |
| `npm run test:ui:layout` | build 후6개 너비/48조건 hydrated UI, 기본 Chromium sandbox 유지 |
| `npm run test:sites:live` | 익명 GET-only 운영 smoke; 합성 cookie/로그인/쓰기 없음 |
| `npm run diagnose:sites:network` | 기존 proxy/정책 읽기 전용 CONNECT 진단 |
| `npm run test:sites:network` | 운영 요청 없는 proxy/guard 합성12 |
| `npm run test:project:workspace` | 관리자 전용 저장 기반의 격리 D1/MariaDB command·CAS/권한/이력/보존 회귀; 운영 자료를 쓰지 않음 |
| `npm run test:volunteer:schema` | 양 DB의 봉사 저장 schema fresh/existing additive·복합 FK·default·보존·재실행 검사 |
| `npm run test:volunteer:completion-schema` | v11/0015의 단일 팀장 baseline/중복 거부·완료 metadata·기존 자료 보존을 양 DB에서 확인 |
| `npm run test:volunteer:tasks` | 봉사활동 팀 범위 관리·직접/제출 필수 완료·현재 권한·교체/탈퇴·완료/재개 이력의 격리 양 DB 회귀 |
| `npm run test:volunteer:browser` | Sites build 후 loopback Worker/D1/R2와 기본 sandbox Chromium의 실제 관리자/팀장/담당자 desktop/mobile UI·multipart 회귀 |
| `npm run test:project:binding` | SU/지정 admin·legacy/members-only·해제 후 요청·양 DB 기존 schema/자료 보존의 합성 회귀 |
| `npm run test:project:ux:browser` | Sites build 후 loopback Worker의 새5폭·요약/상세·필수/위험 조작·프로젝트 보호 UI; 실행 결과는 아래 별도 기록 |
| `npm run test:project:ux:native` | Native build 후 격리 MariaDB/로컬 파일·Next UI의 프로젝트 UX 경로; 운영/.env를 쓰지 않음 |

`node scripts/check-docs.mjs`는 저장소의 문서 등록·역할·상대 링크/anchor·명령·필수 읽기 경로를 검사한다. `--self-test`는 검사기의 유효/무효 fixture를 확인한다. 원본 docs-canon SKILL/점검기가 아닌 로컬 대체 검사이며 원본 준수 인증으로 표시하지 않는다.

## 변경별 최소 게이트

| 범위 | 필요한 증거 |
| --- | --- |
| 문서/참조만 | diff --check, 로컬 docs 검사/self-test, 링크/현재 상태/가이드 보존/앱 diff 검토. HTML은 parse·내부anchor·외부CDN 없음 확인 |
| TS/TSX/UI | lint/types/build, 관련 desktop/mobile·light/dark, focus/간트 회귀 |
| src/FSD | check:fsd + lint/types/build. URL/SQL/signature 보존과 client→server 전이 검사 |
| 역할/visibility | npm test, direct action/route, guest/member/admin/SU/anonymous × public/private/owner, metadata/bytes/count/snippet SQL scope |
| repository/schema | 실제 격리DB CRUD/transaction/권한 변경/rollback; fresh/existing additive migration, ledger/checksum/postcondition. 운영 적용은 별도 |
| 업로드/다운로드 | actual Worker/DB, MIME/bytes/size/count/path/cache, IDOR, 반복/중단/DB·R2 한쪽 실패, lease/cleanup 참조 보호 |
| 배포/운영 | native/Sites 대상 구분·보존·반환 terminal 상태·exact version/source, 실제 계정/기존 자료/브라우저 인수 별도 |

FSD는 layer-direction/cross-slice/deep-import/unknown-layer/client-server를 error로 막는다. legacy-import는 이동 중 warn이지만 M5 뒤 잔재를 허용하지 않는다. 기본 self-test5를 먼저 실행하며 --self-test/--only-repo/--json을 지원한다. 사양은 ARCHITECTURE의 FSD 검사 사양을 따른다.

## 격리 DB와 fault injection

테스트는 TEST_DB_*와 loopback3307 / *_test만 사용하며 `.env*`를 읽지 않는다. docker는 기존 mariadb image/daemon, local은 사용 가능한 설치를 선택한다. DB 없으면 npm test는 native suite 사유를 출력하고 --require-db는 실패한다. 정상 동작의 실패와 DB 부재를 혼동하지 않는다.

bootstrap은 실제 getAuthSession/action/인가를 유지하고 next-auth session 공급만 대체한다. server-only/revalidatePath는 framework 밖에서 no-op이므로 cache 갱신·실제 Google OAuth 증거가 아니다. route GET 직접 호출, 실제 workerd HTTP, hydrated Chromium은 각각 다른 층이다. visibility suite는 public/own-private/other-private·교차 project/task·파일 headers와 ownership을 비교한다.

`test:submission:delete`는 D1 meta.changes 1/3/2/4와 MariaDB affectedRows1을 실제 비교하고 RETURNING id, 현재 역할·대상 소멸·guard/RESTRICT/늦은 statement rollback을 검증한다. action8은 refresh/audit/cleanup 실패와 커밋 전/후 메시지를 분리한다. MariaDB fixture는 새 무작위 wbs_delete_*_test DB만 만들고 DROP하지 않는다. 운영 파기/권한 변경의 승인이 아니다.

Native schema readiness는 현재16개 관리 표와 schema_migrations를 확인한다. 전체 schema 계약은 NATIVE_DATABASE_MIGRATIONS가 소유하며 runtime DB identity와 schema identity를 바꾸지 않는다. DDL rollback/자동 down은 없다.

## 브라우저와 운영 연결

모든 synthetic browser 입력은 loopback만 허용하고 외부 요청을 차단한다. 기본 Chromium sandbox를 유지한다. 이 실행기의 shell sandbox에서 SUID 구성이 거부되면 정책을 변경하거나 --no-sandbox로 우회하지 않고 지원되는 승인 실행 경로/미실행 사유를 사용한다.

진단/live 명령은 HARNESS와 NAS_UPDATE_GUIDE의 proxy 경계를 유지한다. CONNECT403/Domain forbidden은 proxy_connect/exit1/live_http_completed=false이며 사이트 HTTP403과 구분한다. 인증 cookie 없이 GET만 하고 로그인 redirect를 따라가지 않는다. 플랫폼 정책/프록시/NO_PROXY/인증서를 바꾸지 않는다. version13 게시 점검 환경에서는 기존 proxy CONNECT200·익명 GET smoke가 통과했다. 정책 파일은 읽을 수 없어 플랫폼 설정 적용 자체는 미확인이며 과거 환경의403 기록과 구분한다.

## 검증 기준선

아래는 **해당 SHA·환경에서 실행한 기록**이다. 과거 로컬 회귀와 후속 실제 운영 UI 인수를 구분하며, 문서 갱신 자체가 제품 검사를 재실행했다는 뜻은 아니다. 전체 이전 원문과 복구 경로는 COMPLETED_LOG가 보존한다.

| 기준 | 실제 결과 | 범위/남은 한계 |
| --- | --- | --- |
| QLT-021, main ddcedd6/sites c1c55da, 2026-10-21 | DB109(D1 57/MariaDB52), action8, unit119, visibility33, Worker HTTP257, native/Sites build, lint/types/FSD PASS | Node24.19/MariaDB10.11.14, local fixtures. 운영 DB/삭제·새 Google 로그인·NAS/Sites 배포 미실행. 과거 QLT-019는 이 환경에서 미재현이며 다른 환경까지 닫지 않음 |
| QLT-021 초기 게시 점검, version13/source b249c4d, 2026-10-22 | Sites build·D1 삭제57·독립 action8·Worker HTTP257 PASS. 배포 후 변경 없는 동일 bundle의 격리 HTTP257 및 익명 live GET6 PASS | Node24.19.0/npm11.9.0, ephemeral D1/R2·합성 session은 운영에 전송하지 않음. 타인 삭제 거부·FK rollback/파일 보존·정상303/감사/파생행·해당 객체 삭제 확인. MariaDB/unit/visibility 재실행 아님. 후속 실계정 UI 인수와 별도 |
| QLT-021 운영 UI, version13/source b249c4d, 2026-10-22 | 실제 Google 세션으로 버전·댓글이 있는 합성 제출물의 삭제 성공/새로고침/상세404/성공 감사 확인. 핵심 삭제 오판 인수 PASS | 부모 Chrome 관측, 대상별 승인·정리 상세는 [완료 기록](COMPLETED_LOG.md#qlt-021-운영-인수와-승인된-합성-정리). 첨부0개여서 운영 파일 정리는 미검증. 첨부 오류는 QLT-022 |
| screenshot0d1a1a3, 2026-10-20 | D1/R2 28, bugD1 58, bugHTTP200/fullHTTP248, Chromium19(1280/390), layout48(6너비), auth18/network12/native additive99 PASS | unit105/108·GoogleProvider3실패, visibility/storage import실패, workflow 동시503을 당시 실패로 보존. QLT-021은 다음 회차 수정됨 |
| branch 정리 a28188e/56e397c, 2026-10-20 | main native build/CLI8, Sites build/auth18, 양쪽 lint/types/FSD, network12/screenshot28 PASS | 기본 build만 의미상 다름. 새 배포 없음. native logging 동적 NFT1 경고 |
| P0/P1, 2026-10-09 | P0 Worker412/quality375/native77; P1 unit119 / D1 65/Worker472/quality375/auth18/native99+관계복원4 | 실계정2개 협업/채워진 template browser/native purge·강등 interleaving·storage race는 미확인. 최초503과 좁은 관계 DELETE1142 실패를 성공에 합산하지 않음 |
| 초기 전환/보안/버그, 2026-10-08 | auth18, storage57, bug lifecycleD158/Worker217; React19.2.8 active decoder fingerprint | 실환경 owner1계정의 승인된 QA는 별도 기록. 전체 dependency audit 완료 아님 |

환경 기준선: 기존 native NFT 동적 logging 경고(회차에 따라1/2), Vinext proxy 감지/route static 분류, Node mock experimental, npm proxy/@esbuild-kit deprecation을 해결됐다고 주장하지 않는다. QLT-015의 차단된 두 cleanup runner 정지/재개는 미실행, QLT-016 동시503 원인은 미확정, QLT-020 native 첨부 purge는 fail-closed다. QLT-021 핵심 삭제 오판은 version13에서 운영 인수를 통과했다. 로컬의 권한·rollback·후속 오류 주입 통과를 운영에서 강제로 확인한 것으로 확대하지 않으며, 별도 첨부 실패 QLT-022는 미완료다.

version13 초기 게시 직후 `npm run test:sites:live -- --url https://wbscowork.cometgnome.chatgpt.site`는 `/`·`/privacy`·`/api/auth/session`의200 및 `/tasks`·`/admin`·`/bugs`의307→`/api/auth/signin`을 확인했다(exit0/live_http_completed=true). 로그인 redirect는 따라가지 않았다. 이는 인증된 삭제 인수가 아니며 위 후속 실계정 운영 결과를 대신하지 않는다.

## 제출물 첨부 운영 오류 (QLT-022)

대상은 2026-10-22 version13/source b249c4d의 `/tasks`, 합성 project4/task6였다. 작은 TXT 선택을 시도한 신규 제출은 `This page couldn’t load` 뒤 재조회 제출0/첨부0이었다. 본문만 생성 후 v2·댓글1은 성공했고, 수정 폼에서 TXT 추가도 같은 오류 뒤 기존 v2/첨부0을 유지했다. Chrome console 11:31:39.153Z는 `TypeError: Failed to fetch` at `app-browser-server-action-client-BUPgAzbb.js:1:2058` 및 React form error boundary를 표시했다.

지원 브라우저 API에는 Network 기록/headers가 없어 실패 요청의 status·Content-Type·requestId·cf-ray는 미확인이다. 기존 Worker 오류 조회에는 대응 오류가 없었고 주변 최근100개(11:27:19–11:31:58)는 본문 생성·수정·댓글의303/완료 로그를 반환했다. 제한·수집 지연 때문에 실패 요청의 Worker 미도달이나 원인을 확정하지 않는다. 작은 TXT를 금지하는 소스 규칙은 없으며, 직접 구성한 multipart HTTP 회귀는 hydrated Chrome의 React Action 파일 전송 경로를 입증하지 않는다.

추가 읽기 확인: 11:38:56Z 무렵 Sites 도구로 실제 D1 `DB`의 `file_cleanup_jobs`를 조회해0행, has_more=false/next_offset=null/truncated=false를 확인했다. 이는 대기 ledger가 없다는 뜻이며 **첨부 DB0·ledger0으로 R2 객체 잔여0을 증명하지 않는다**. R2 inventory/bytes는 확인하지 않았다.

version14 부모 운영 재검증에서는 전송 실패 뒤 페이지 유지·입력/선택 표시 보존·연결 끊김 안내가 PASS였고, fresh read는 제출0/첨부0이었다. 이때 표시된 `qlt022-a.txt ()`의 크기는 공란이었다. v13은 shell `/tmp` 파일을 chooser에 전달했으나 Chrome host에서 보이는지는 확인하지 못했다. v14는 cua 실행 파일시스템의 write/read/stat48bytes를 확인했지만 Chrome host와 같은 파일시스템이라는 지원 계약은 없다. chooser 계약은 “absolute paths visible to browser”이며 별도 transfer API도 없다. 파일명 표시·크기 공란은 실제 File bytes 선택 성공을 증명하지 않는다. 관측 시점 DOM `input.files=[]`도 앱 reset 가능성이 있어 최초 선택 실패나 앱 버그의 증거로 단정하지 않는다. React 내부 상태는 조회하지 않았고 Network status/headers는 지원 API에 없어 미확인이다.

이 자동화 시도의 실제 업로드 성공 인수는 파일 전달을 검증할 수 없는 한계로 차단됐으며, 최초 연결 실패의 근본 원인과 앱 원인은 미확정이다. 이후 사용자가 실제 브라우저에서 직접 선택·등록한 제출물#5 v1 / project#5 task#7 / 첨부#7 `텍스트.txt`는 UI24.6KB로 표시됐다. 부모는 새로고침 후 유지와 지원 UI 다운로드25,180bytes 성공을 확인했고 파일 내용은 열람하지 않았다. 따라서 **운영 신규 업로드·영속 유지·다운로드는 PASS**다. 수정으로 첨부를 추가하는 경로는 로컬 Chromium만 통과했으며 운영은 미검증이다.

현재 project#5 `QLT022-QA-20261022-1204` / task#7 `QLT022 합성 TXT 첨부 회귀` / 제출물#5 / 첨부#7에는 사용자 자료가 생겼으므로 보존한다. 과거 삭제 질문은 승인이 아니며 삭제는 미승인이다. 이 후속 문서 단계에서 앱 수정·게시·새 제품 테스트·삭제를 수행하지 않았다.

후속 사용자 요청으로 첨부 오류 수정·검증 및 검증 후 기존 사이트 게시가 승인됐다. 실제 게시 성공은 별도 확인하며 새 운영 영구 삭제 대상은 별도 승인 경계를 유지한다. 운영은 기존 실패 Network/Console 기록이 제공될 때 시각·상태·요청/응답 Content-Type·request/ray ID만 안전하게 수집해 Worker와 대조한다. Cookie/Authorization/OAuth 값·전체 HAR는 공유하지 않는다. 원인 후보는 브라우저/진입 구간, RSC 직렬화·디코딩,413/동시multipart503, R2/lease/DB 실패이며 현 증거로 특정하지 않는다.

구현 담당의 앱 수정 전 기준선(main ff5e830): 기존 `build:sites`는 통과했고 proxy 감지·static 분류 한계는 기존 경고로 남겼다. `scripts/test-submission-upload-browser.mjs`/`.py`는 실제 hydrated Chromium→loopback→격리 D1/R2 경로를 사용한다. 기본 실행의 Chromium SUID sandbox 초기화 실패는 환경 실패이며 앱 회귀 실패로 세지 않는다. 보안 옵션을 바꾸지 않은 동일 명령의 승인 실행에서 1280/390px TXT 신규·수정(v2)·새로고침·exact bytes 다운로드는 모두 통과했다. 최초 신규 multipart+x-rsc-action 요청은1211/1210bytes, 응답303 및 text/x-component였고 합성 D1 첨부 metadata와21byte qa.txt 저장을 확인했다. 따라서 **운영 최초 Failed to fetch의 연결 차단 원인은 미재현·미확정**이다.

로컬 연결 실패 주입은 다른 범위다. Chromium `route.abort('connectionfailed')`가 기존 React form error boundary와 입력 유지 안내 부재를 재현했다(RED). `TaskSubmissionPanel.tsx`의 신규·수정 두 폼은 onSubmit/useTransition으로 transport 거부를 잡아 폼 안에 안내하고 입력·선택 파일을 유지한다. 서버의 NEXT_REDIRECT는 router로 다시 던지고 자동 재전송은 하지 않는다. Shared SubmitButton의 선택적 pending 값은 기존 useFormStatus와 함께 쓰며 서버 권한·SQL·저장 계약은 바꾸지 않았다.

구현 담당의 최종 로컬 결과는 main ff5e830 기반의 수정 작업 트리에서 다음과 같다. 문서 담당이 제품 검사를 다시 실행한 것으로 계산하지 않는다.

| 검증·모드 | 실제 결과 | 경계 |
| --- | --- | --- |
| hydrated Chromium,1280/390px | 너비별8시나리오 PASS: 신규·수정v2·exact bytes 다운로드/새로고침, 생성 연결 실패 초안 보존/수동 재시도1행, 수정 연결 실패 기존v2·초안 보존/수동 재시도v3, HTTP503 주입 시 초안 보존·uncaught 없음, 가로 overflow 없음 | 실제 Chrome 파일 포함 Action과 로컬 연결·응답 실패 주입. 운영 최초 연결 차단은 미재현 |
| 격리 D1/R2 영속 상태 대조 | 합성 제출4건의 revision3/1/3/1, 버전 첨부 metadata14건과 참조 bytes, hydrated multipart+x-rsc-action 성공 응답303의8요청 확인 | metadata 참조 수와 고유 R2 객체 수를 같은 값으로 세지 않음 |
| native/Sites build | 두 대상 PASS. native는 기본 Turbopack | native의 기존 logging NFT2 warning, Sites proxy 감지·static 분류 한계 유지 |
| auth/decoder/actual Worker HTTP | 인증18·active decoder·Worker HTTP257 PASS | 합성 로컬 runtime 증거, 실제 Google 로그인·운영 첨부 인수는 아님 |
| focused ESLint/Python compile/FSD/types | PASS; FSD self-test5·경계오류0. typecheck는 Vinext가 덮어쓴 Next 생성 route 타입 충돌 후 기존 Next typegen 절차로 PASS | 필수 생성 타입/include 삭제나 보안 옵션 변경으로 통과시키지 않음 |
| `npm run test:unit` | action8 PASS, unit105/108로 GoogleProvider3 FAIL | 기존 QLT-019 재현이며 전체 unit 통과가 아님 |

이 안정화는 연결 실패를 폼 안에서 처리하도록 바꾼 범위다. 서버 인가·SQL/schema·비공개 다운로드 URL은 변경하지 않았다. 동일 앱 소스의 main82a8777/sites41059c8을 푸시하고 version14 게시 succeeded를 확인했다. 정확한 source/version/deployment/archive 근거는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다. 오류 화면 대신 초안을 보존하는 개선과 사용자 신규 업로드 인수는 통과했지만, 최초 연결 실패 원인은 미확정이다. 남은 운영 추가 첨부 인수와 사용자 자료 보존·삭제 미승인 경계는 위 기록을 따르며 QLT-022를 열린 상태로 유지한다.

## 봉사활동 저장 기반과 auth import 검증

2026-10-23 기준은 main `0b2dab2` + 이번 구현 작업 트리, sites `206157d` + 같은 선별 patch다. 환경은 Node24.19.0/npm11.9.0/MariaDB11.4.13이며 실제 운영 계정/DB·파일·Sites version14/source41059c8은 변경하지 않았다. 명령은 합성 설정과 loopback의 새 `*_test` DB/격리 D1을 사용했다. 명시적 운영 migration·계정 권한 변경·재게시/배포는 실행하지 않았다.

| 명령·대상 | 실제 결과 | 범위/남은 한계 |
| --- | --- | --- |
| QLT-019 실패 재현 → import 수정의 configured/unconfigured subprocess | 기존 unit105/108·action8에서 provider 초기화3실패를 재현한 뒤 focused3 PASS | Node ESM Babel CJS의 default 객체/Next·Vite 함수 형태를 실제 provider로 처리. OAuth/PKCE/state 유지. 초기 수정 unit121/action8 PASS는 중간 scope이며 아래 통합 unit에 합산하지 않음 |
| `npm run test:project:workspace` | D1 43/MariaDB43, 합계86 PASS | 기본값/복수 팀·겸임·교체/비활성·같은 프로젝트·타팀/비참여자·현재 역할 상실/가짜 SU·동시 CAS/반복 receipt·event 실패 rollback·private 보존·팀 업무 담당자 변경 거부. 명단 역할 저장 검증이며 팀장 위임 권한 인수는 아님 |
| `npm run test:volunteer:schema` | 58 PASS | 양 DB fresh/pre-upgrade additive·기존 행/default/이력 보존·재실행과 관계 무결성. schema 명세 코드와 격리 적용이며 운영 schema 미적용 |
| `npm run test:native:migrations` | 99 PASS | 별도 Native additive suite. 전용 새 합성 DB를 보존하며 기존 운영 자료/계정 권한 검증은 아님 |
| native migration/composite FK 단위 검사 | 21 PASS | `node --import ./tests/helpers/preload.mjs --experimental-test-module-mocks --test tests/native-migrations.test.ts tests/volunteer-schema.test.ts`; 아래 전체 unit에 포함되므로 합산하지 않음 |
| `npm test -- --require-db` | unit131, action8, visibility33 각각 PASS | 저장 command model4·복합 FK6를 기존 unit runner에 포함. 제출 필수/기존 검토 경로 회귀는 포함하나 미구현 직접 완료의 성공 인수는 아님 |
| `npm run lint`, `npm run check:fsd`, `npm run typecheck` | lint PASS, FSD self-test5/경계오류0, types PASS | 최초 typecheck는 기존 Vinext 생성 route 타입 충돌로 실패했고 표준 Next typegen 후 재실행 PASS. 생성 타입/include 삭제로 우회하지 않음 |
| `npm run build:native`, `npm run build:sites` | 두 대상 production build PASS | Native 기존 logging NFT2 경고, Vinext proxy 감지/정적 route 분류 경고 유지. 배포 결과가 아님 |
| `npm run test:sites:http`, `npm run test:sites:auth` | 격리 Worker HTTP257, auth18 각각 PASS | 실제 Worker/합성 session 회귀. 실제 Google 로그인·운영 인수를 뜻하지 않음 |

해당 v10 저장 기반 회차는 관리표20개와 `schema_migrations`를 구분했다. 당시 범위는 관리자 전용 server repository/모델/schema였으며 루트 action·사용자 화면·팀장 위임 권한·직접 완료 실행은 포함하지 않았다. 모든 신규/기존 업무의 제출 필수 기본값을 유지한 당시 검증이며, 사용자 정책 확정 후 후속 구현·인수는 아래 별도 절과 구분한다.

해당 회차 문서 전담은 docs-canon 지침에 따라 기존 정본만 동기화했다. 당시 저장소 문서 검사/self-test·MASTER_PLAN HTMLParser·`git diff --check` PASS이며 문서30·등록16/핵심7·상대링크189·npm명령99를 확인했다. 별도 내용 검토로 실제 저장 기반/아직 미구현인 권한·직접 완료·UI, 정책 선택 대기, 과거 결과와 이번 검증의 구분을 확인했다. 원본 검사기는 앞선 리소스 미제공/승인 ZIP 다운로드 실패 기록 이후 이번에 추가 실행하지 않았다. 원본 canon 통과나 기능/운영 인수로 확대하지 않는다.

## 봉사활동 팀장과 직접 완료 검증

2026-10-23 후속 기준은 main `17f8d87`/sites `07b4eaa` + 이번 구현 작업 트리다. Node24.19.0/npm11.9.0/MariaDB11.4.13, 새 loopback `*_test` DB와 격리 Worker/D1/R2·합성 세션/파일만 사용한다. 운영 version14/source41059c8·프로젝트5/작업7·사용자 업로드 자료를 건드리지 않았으며 실제 Google 로그인·운영 migration·계정 권한 부여·재게시/배포는 하지 않았다.

| 명령·대상 | 실제 결과 | 범위/남은 한계 |
| --- | --- | --- |
| `npm run test:volunteer:tasks` | D1 53/MariaDB53, 합계106 PASS | 기존 업무 제출 필수·새 봉사 직접 완료/선택 제출, 담당자/현재 팀장/관리자·타팀/이전 팀장/탈퇴/역할 상실·actor 없는 쓰기 거부, 완료자/시각·재개 이력·검토/선행/시작 이력 뒤 방식 변경·rollback과 private 계약 |
| `npm run test:project:workspace` | 후속 소스 재실행86 PASS | 이전 저장 기반 suite의 회귀이며 위106 및 과거 회차86과 합산하지 않음 |
| `npm run test:volunteer:completion-schema` | 54 PASS | v11/0015 additive·현재 팀장 baseline/복수 기존 팀장 거부·완료 metadata와 원문/이력 보존. 운영 적용 성공은 아님 |
| `npm run test:volunteer:schema`, `npm run test:native:migrations` | 저장 기반58, 별도 Native99 각각 PASS | 별개 fixture scope이며 위106/54 또는 아래 unit와 합산하지 않음 |
| `npm run test:sites:p1` | 65 PASS | 기존 선후행·템플릿·검색·알림 계약 회귀 |
| `npm test -- --require-db` | unit131, action8, visibility33 각각 PASS | 초기 현재 관리자 DB 검사 위치로 unit2실패 후 수정/focused11 PASS. 이후 action mock의 named export 누락을 fixture와 맞춘 뒤 action8과 전체 suite 재실행 PASS. 실제 인가를 mock으로 대체해 성공시키지 않음 |
| `npm run lint`, `npm run check:fsd`, `npm run typecheck` | lint PASS, FSD self-test5/경계0, types PASS | 기존 Next typegen 후 순차 types 절차 유지 |
| `npm run build:native`, `npm run build:sites`, `npm run test:sites:http`, `npm run test:sites:auth` | 최종 소스 양쪽 build·auth18, Worker HTTP257 PASS | 기존 Native logging/NFT·Vinext proxy/static 분류 경고 유지. 최종 UI 안내/명단 scope·선택 state 보정 후 bundle 재빌드와 lint/types/FSD도 PASS, 동일 최종 bundle 브라우저도 아래 별도 scope로 PASS |
| `WBS_QA_ADMIN_SPA=1 node scripts/test-volunteer-browser.mjs` | 최종 bundle의 1280 light/390 dark 각18, 합계36 조건 PASS; hydrated RSC multipart POST46건 모두303 | 관리자 SPA 프로젝트/참여자/팀장 변경·select 초기화/행 제거, 업무 생성/배정·담당자/팀장 직접 완료/재개·선택 private TXT bytes·완료 metadata/이력·기존 제출 필수 거부. D1/R2 대조와 명시 reload 영속화 PASS, uncaught page error/실패 request/가로 overflow0 |

브라우저 최초 일반 shell launch는 Chromium SUID sandbox misconfigured/SIGABRT로 실패했다. 승인된 실행 경로에서 같은 기본 Chromium sandbox로 실행해 실제 흐름을 통과했으며 `--no-sandbox`나 플랫폼/권한 설정 변경은 없었다. selector/redirect 대기 보정은 QA 동기화 문제였고 앱 실패로 단정하지 않았다. readiness는 관리표21개와 별도 migration ledger를 확인한다. 최종 브라우저 실행 전후 entry SHA256 `c09b51a26cd9ed363ee83c25ded79065169eb3358690a5a100f78e5375bea211`이 동일했다. PRD-047~050/QLT-023의 코드·로컬/합성 게이트를 닫으며 운영 적용·실계정/실사이트 인수와 구분한다. 업무 편집·팀 필터의 브라우저 직접 조작은 위 최초36조건 흐름에 포함하지 않았다. 해당 과거 범위를 유지하며 후속 실제 클릭 결과는 아래 별도 scope로 기록한다.


후속 Worker 실클릭 검증은 main `cdde9e9bfde881a4d09539857ec9be4458dedebd`/sites `b9769b6`의 같은 앱 소스에서 수행했다. `node .test-artifacts/volunteer-followup/worker/focused.mjs`는 Git 미추적 임시 하네스이며 배포/상시 명령 등록이나 새 추적 테스트를 뜻하지 않는다. 기존 entry SHA256은 실행 전후 동일했고 이는 entry 비교이지 전체 bundle hash 비교는 아니다.

| 추가 검증·환경 | 실제 결과 | 범위/한계 |
| --- | --- | --- |
| Worker/D1, 기본 sandbox Chromium, 1280 light/390 dark | 실제23조건 PASS, hydrated RSC multipart POST4건 모두303 | 팀장이 자기 팀 업무의 제목·담당자4·planned 완료 방식을 제출 필수로 편집 후 reload/D1 version2 대조. 타팀 편집 UI 미노출·변조 taskId 거부와 타팀 version1 보존. 전체/팀A/팀B/공통 필터의 실제 링크 클릭 후 task ID 집합 대조. console/실패 요청/가로 overflow0 |
| Native Next/MariaDB11.4.13, loopback3307 새 합성 DB | 실제12 browser 조건 PASS, NextAction multipart POST4건 모두303·text/x-component | 1280에서는 팀장의 편집/필터/private 거부, 390에서는 담당자의 직접 완료/재개·선택 private TXT 업로드/다운로드·layout을 검증. console/page error0, request 실패는 ERR_ABORTED61건/그 외0 |

Native 절차는 같은 `cdde9e9` 소스의 `node .test-artifacts/volunteer-followup/native/run.mjs`와 사후 읽기 전용 `node .test-artifacts/volunteer-followup/native/verify.mjs`다. 기존 `.next`를 연결한 별도 server 디렉터리/합성 환경·JWT로 실제 `.env` 자동 로드를 피하고 기본 Chromium sandbox의 승인 실행 경로를 사용했다. migration11을 적용한 새 `wbs_native_browser_mvkemk84_d4f5de_test`만 사용했다.

최초 Native 임시 SQL 검사는 MariaDB BIGINT와 JS number의 strict 비교 때문에 실패했다. `bigIntAsNumber:true`로 검증 하네스를 보정한 뒤 DB/로컬 파일의 읽기 대조와 저장된 UI 결과 검사가 exit0이었다. UI의4 POST와 owner 다운로드는 다시 요청하지 않았으며 `run.mjs` 전체를 exit0으로 기록하지 않는다. 완료/재개 event의 actor3·시각·재개 사유, 현재 in_progress의 완료자/시각 NULL, private 제출 v1/29bytes 첨부의 DB·실제 파일과 앞서 확인한 owner 다운로드 bytes 일치, 팀장 본문 비노출/API404를 확인했다. launcher는 전용 DB pool 대기 후 자기 PID SIGTERM으로 종료했으며 앱 오류로 분류하지 않았다. `.next/BUILD_ID` 파일 bytes의 SHA256 `aa33b54c2a21f26f1cae9911279267c429991f432b48186b3bf1770d49716b72`는 전체 bundle hash를 뜻하지 않는다.

후속 Worker23/Native12조건은 최초36조건 및 DB/HTTP suite에 합산하지 않는다. 두 viewport에서 서로 다른 Native 흐름을 실행했으므로 동일한 전체 흐름이나 모든 Native 화면 인수로 확대하지 않는다. 앱 결함이나 코드 수정은 없었으며 임시 하네스만 사용했다. 운영 데이터·실제 Google 로그인·운영 migration·게시/배포 결과로 확대하지 않는다. 이번 문서 후속은 기존 검증 정본만 갱신하며 완료 이력/열린 TODO의 상태는 유지한다.

기능 구현 회차에는 원본 docs-canon 검사를 기존 리소스/전달 ZIP 미가용 이후 실행하지 않았다. 당시 저장소 문서 검사/self-test·수정한 두 HTML의 HTMLParser·`git diff --check` PASS이며 문서30·등록16/핵심7·상대링크200·npm명령115를 확인했다. 이번 HARNESS 후속도 저장소 문서 검사/self-test·`git diff --check` PASS이며 문서/링크/명령 수는 동일하다. 원본 canon 검사는 이번에도 미실행이다. 별도 내용 검토로 확정 정책/실제 구현/최종 합성 인수와 운영 미실행 경계, 과거 기반 회차와 이번 scope의 구분, 사용자 가이드와 현재 계약의 정합성을 확인했다. 원본 canon 준수 인증으로 확대하지 않는다.

## Version15 게시와 운영 검증 경계

사용자의 운영 게시 승인 후 source `d7550fb783b046738bf7a2d2e22aa412515bf02c`를 기존 사이트에 게시했다. terminal succeeded·정확한 version/source/deployment·active/latest 재조회와 서로 다른 package hash/복구 한계는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)에만 둔다. 이번 문서 갱신은 추가 배포가 아니다.

| 확인 대상 | 실제 결과 | 범위/미확인 |
| --- | --- | --- |
| exact 로컬 archive의 build·격리 Worker HTTP/auth·hydrated UI | build PASS, HTTP257/auth18, browser36조건·multipart POST46건 PASS | HTTP 최초 출력 디렉터리 ENOENT 뒤 디렉터리를 준비하고 같은 bundle·새 격리 fixture로 재실행257 PASS. 앱 수정 없음. 운영 UI/자산 GET 인수와 별개 |
| 운영 D1 overview·0014/0015 | 표시 표18→23, 새5표 모두0행 | projects에3개/tasks에4개 컬럼 추가, 기존 프로젝트5는 collaboration/workspace0/token NULL, 업무7은 submission_required/team·completed metadata NULL. 0015의 baseline INSERT도 DML이지만 당시 새 명단 표가 없어0행이었으며 schema-only 작업으로 표현하지 않음 |
| 게시 전후 기존6표의 old-column 전체 행 대조 | projects1(id5), tasks1(id7), submissions1(id5), submission_attachments1(id7), users2(ids1/4), submission_revisions1(id5) 모두 동일, truncation 없음 | 비교는 이6표의 기록된 시점/기존 컬럼 범위다. 새 컬럼·audit전체·전체 DB/R2 백업 또는 R2 inventory/파일 bytes의 게시 후 동일성 증명은 아님 |
| 사이트·환경/공개 범위 | 기존 public/policy revision2·owner/auth_client, env revision11의 entries 동일 | 실제 계정 역할·보안 설정·NAS 변경 없음. env/credential 내용은 기록하지 않음 |
| 최근10분 errors_only 조회 | 반환 event0 | 운영 요청 표본이 없어 운영 오류 부재·차단된 요청의 Worker 도달을 증명하지 않음 |
| 현 실행기 운영 연결 | CONNECT403 / Domain forbidden, 해당 policy rule 부재 확인 | 운영 GET·자산 로드·실 Google·운영 UI는 미실행. proxy/policy를 바꾸거나 제한을 우회하지 않음. 별도 인증 브라우저의 실제 인수는 후속 증거가 필요 |

새5표는 `project_members`/`activity_teams`/`activity_team_members`/`project_workspace_events`/`activity_team_leaders`다. 추가 컬럼과 기존 프로젝트5/업무7의 기본값은 운영 조회로 확인했다. 새 업무 생성 기본값과 무결성 제약의 실행 검증은 동일 소스의 로컬 합성 결과이며 운영에서 새 업무 생성·FK/CHECK/journal 직접 조회는 하지 않았다. 운영에 새 테스트/역할 부여/자료 삭제도 하지 않았다. 기존 사용자 첨부 metadata 보존과 게시 후 R2 inventory·실제 파일 다운로드 검증은 구분한다. 이번 원본 docs-canon 검사는 기존 미가용 경계로 미실행이다. 저장소 문서 검사/self-test·`git diff --check` PASS, 문서30·등록16/핵심7·상대링크203·npm명령115를 확인했고 별도 내용 검토로 게시 terminal 상태·보존 표본·로컬/운영 미검증 경계를 대조했다.

## UX 바인딩 설계 검토와 후속 인수

이 절의 최초 계획 검토 대상은 main `11178b02a3cf7df90c10161ba0648ac7213d666d`/sites `a84f3a130368a30b3141776e0e39fc7cfcc7a243` 기준의 계획 문서 작업이다. 문서 담당은 TaskCard/TaskSubmissionPanel·project repository·홈/tasks page·task-scope·상태 workflow·검색/개인 큐·알림의 실제 참조를 읽었다. 부모가 직접 연 노트북 PNG의 관측은 전달받았으며 문서 담당이 이미지를 직접 열거나 모바일/키보드를 재현한 증거는 아니다. 실제4:1 CSS grid라는 근거 없이 Stack/flex 구조와 관측된 여백을 구분했다.

부모가 읽은 `web-qa-testing-workflows`의 반응형/접근성 기준과 `creative-visual-production`의 시안 비교 기준을 아래 **설계 수용 조건**에 반영했다. 문서 담당이 두 스킬 원문 전체를 열람하거나 시안 생성·실제 UI QA를 실행했다고 주장하지 않는다. 제공된 docs-canon 본문을 재사용했으며 현재 원본 검사기는 미가용이다. 해당 계획 문서 회차에서는 추가 설치·앱 수정·운영 접속 재시도가 없었다.

| 당시 QLT-024 후속 계획 | 완료 조건 |
| --- | --- |
| 시안/반응형·접근성 | 360/390/768/1280/1440px별 긴 한국어 제목/파일명·다수 칩·빈 상태·라이트/다크 비교. 기본 메인의 요약/상세 경계·칩 내용 너비/줄바꿈·보조 메뉴·삭제 시작 후 확인을 확인. 페이지 가로 overflow/겹침 없음, 간트 내부 bounded scroll 구분, 키보드 순서/메뉴 Escape·초점 복귀·오류 연결·터치/대비·텍스트 의미 대조 |
| 필수/완료 조건 | 즉시 필수·완료 전 필요·선택의 외부 레이블/배지와 입력 오류 연결. 빈 산출물/완료 기준 초안 유지. direct done 메모 선택, submission_required done 근거 필수, 모든 mode blocked/reopen 사유 필수와 review 경로 조건을 실제 서버/양 DB·UI에서 비교 |
| 보호 프로젝트 scope | 합성 projectA/B·userA/B, 겸임/무소속/탈퇴·현재 역할 변경·guest 명단 참여(쓰기 승격 없음)·확정된 관리자/인증 public 예외를 명시. 홈/목록·건수·직접 URL/API/Server Action·첨부/댓글/버전·검색 count/snippet·알림/개인 큐·Gantt/집계의 허용/거부와 비노출을 대조. 해제 전 열린 화면의 다음 보호 요청과 제한 프로젝트의 본인 과거 private도 거부되는지 검사 |
| 이행/보존 | MariaDB/D1 fresh/existing 비파괴 이행 미리보기·정책별 접근 영향·SU 영향 미리보기·최신 hash/version 확인 후 활성화 검사. 기존 WBS/선행/leaf 집계·제출 필수/직접 완료·팀장·검토·원문/버전/파일과 단일 영구 삭제의 경고/서버 확인·권한을 보존. 신규 일괄 영구 삭제 인수로 확대하지 않음 |

계획 검토 당시 새5폭은 기존 layout 하네스의1920/1699/1440/1280/1024/390 결과나 과거1280/390 합성 흐름과 다른 미실행 행렬이었다. 위 표는 당시 구현 이후 검증 계획이며 신규 UX/바인딩 인수 결과가 아니다. CONNECT403/운영 UI·Google 미검증 경계는 유지했다. 해당 문서 회차는 저장소 문서 검사/self-test·MASTER_PLAN HTML 파싱·`git diff --check` PASS를 확인했다(문서30·등록16/핵심7·상대링크219·npm명령115). 별도 내용 검토로 코드와 전달 관측·제안/정책 대기·신규 미실행 인수·현재 운영 상태의 구분을 확인했다. 앱 build·제품/DB/브라우저 테스트와 운영 접속은 실행하지 않았으며 원본 canon 검사 통과로 확대하지 않는다.

### UX 바인딩 구현과 회귀 검증

기준은 main `fbe679c`/sites `e92d213`에서 진행한 작업 트리다. 아래는 구현 담당이 실제 격리 환경에서 확인한 결과다. PRD-052/053/055와 QLT-024의 소스·양 DB·Worker/Native 실제 로컬 앱 인수 및 기존 봉사 회귀를 완료했다. 결과는 `.test-artifacts/project-ux/final-qa-manifest.json`과 대조했으며 운영 게시/실 Google 인수는 포함하지 않는다.

| 범위/실행 | 확인된 결과 | 범위와 한계 |
| --- | --- | --- |
| PRD-051 비교 시안 | 정적 A/B5폭 render overflow/console0, 부모360px 직접 검토 후 A 채택 | 실제 앱 인수와 별개인 디자인 결정 |
| `npm test -- --require-db` | action32/unit132/MariaDB visibility34 각각 PASS, skip0 | SU 전역·지정 admin 관리와 미지정 admin의 legacy 읽기/private 거부를 구분 |
| 양 DB·업무 회귀 | binding151, workspace D1/MariaDB 각42, 봉사 업무 양 DB106, P1 D1 65, native workflow49 PASS | 각 하네스 scope별 결과이며 합산하지 않음. 운영 DB 검증 아님 |
| 전역 관리/버그 회귀 | SU action7·D1 repository9·MariaDB9·policy7·context6·bug D1 58·screenshots28 PASS | repository9/9 범위는 서로 다르며 통합 suite와 겹침. 본인 제보 작성/열람 보존 |
| 실제 Worker HTTP/보안 | base266·quality380·workflow474, decoder·auth18·network unit12 PASS | 기존 P1 selector를 집중 상세 탐색으로 test-only 보정하고 assertion 유지. 실 Google·운영 요청 없음 |
| 최종 정적 검사/빌드 | lint0·typecheck·FSD5 self-test/위반0, Native/Worker build PASS; 최종 하네스 Node5/Python2/ESLint5·diff 모두 exit0 | 기존 native logging/NFT·Worker proxy 환경 감지/dynamic 분류 경고를 숨기지 않음 |
| `npm run test:project:ux:browser` | 실제 Worker5폭360/390/768/1280/1440 × light/dark670조건 PASS, hydrated RSC multipart15 POST 모두303, console/pageerror/requestfailed0, exit0 | 대비132scenes/4,914 solid 샘플 strict 미달0·허용오차0. enabled contained normal/hover·파괴 text hover 필수50대상 포함, 삭제 실행0 |
| Worker bundle/응답 | dist323files/4,529,220bytes fingerprint `a8b3786dbb71a0ddb497bc80b33631dc3f9b7d1ebd0dd61e0953ad6c60f95d4d` 전후 동일 | entry `7bd8bb668a028bab07d0800dee6e57cb0d39937a604464432f27e068572cd658`; HTTP40410은 console/실패 요청0과 별도 집계이며 HTTP500은0 |
| `npm run test:project:ux:native` | 실제 Next+MariaDB11.4.13 loopback 동일5폭×2테마 strict670조건 PASS, NextAction multipart15 POST 모두303, console warning/error/pageerror0, exit0 | 동일132scenes/4,914샘플 strict 미달0·허용오차0. requestfailed1,962건은 전부 ERR_ABORTED이며 비취소 실패0 |
| Native bundle | `.next`577files/51,471,827bytes fingerprint `aeebf491037be7fcfe60a85392bd7237cdbdf801da1fa998e813fc78972c2063` 전후 동일 | BUILD_ID 파일 hash `3745a1bec3be5c77b2fa21f7b3df1b4f057b7425b39d1603af90b0ba063db959` 유지 |
| `WBS_QA_ADMIN_SPA=1 node scripts/test-volunteer-browser.mjs` | 기존1280 light/390 dark36조건 PASS, 실제 RSC multipart46 POST 모두303, exit0 | 예상된 forged project1/task3 GET404 console2건만 분리. 예상 외 console·warning/pageerror0, Worker 동일 fingerprint 유지 |


Worker/Native 실제 앱은 A/B 프로젝트의 SU 소속 부여·제한 전환·해제·legacy 복구, 지정 admin/guest/private·열린 stale form의 다음 요청 거부를 확인했다. 요약→상세/댓글·조건부 필수·긴 이름/메뉴·위험 확인/복귀를 검사했고 검토 승인 done의 현재 표시/비활성 선택·사유 재개2건은 DB 완료 metadata/event와 대조했다. 빈 초안 double click은 각각 한 건만 생성됐고 합성 원본 WBS 상하위·제출/버전·파일과 계정 role은 보존됐다. 두 runtime의 `.test-artifacts/project-ux/{worker,native}/final-evidence.json`을 보존한다. 부모는 새 UI의360 요약/1440 dark 상세 PNG를 직접 검토했으며 문서 담당은 전달 근거와 JSON을 대조했다. 대비는 단색 배경 text 샘플, 입력은 DOM/키보드/터치 에뮬레이션이며 전체 WCAG 인증·실기기 인수로 확대하지 않는다.

초기 Worker/Native620조건에는 대비 +0.03 허용오차가 있었고 각3,192 solid 샘플 중 dark 파괴 버튼3개×5폭=15샘플의4.492:1이 엄격한4.5:1에 미달했다. palette를 보완하고 허용오차를 제거했으며 최신 양 runtime의 허용오차 없는 결과는 위 표와 같다.

발견한 제품 결함과 수정도 성공 결과와 구분한다. 긴 담당자 option clip은 theme `MuiMenuItem` 줄바꿈으로, 협업 비담당자의 상태 폼 노출은 서버 실행 권한과 같은 UI 조건으로 맞췄다. 최초611 UI조건을 통과했어도 FCL console5와 stale SU form의 올바른 admin 거부303 뒤 `/admin/projects` reload500이 있어 전체 FAIL이었다. 확인 checkbox를 client leaf로 분리하고 검토 승인 done의 빈 선택 표시를 고쳤다. 당시 동결 bundle의 binding-only36/POST11에서 console/GET500 0과 거부 후 SSR200을 확인한 뒤, 이전620조건을 재실행해 기능 검증을 통과했다. 이때 남은 대비 허용오차 문제는 뒤늦게 확인했으므로 이전 통과를 엄격한 인수로 바꾸지 않는다. 초기 실패를 통과로 바꾸거나 서버 권한 거부를 앱 결함으로 기록하지 않는다.

기존 봉사 회귀의 초기 tamper 하네스 렌더 순서 오류와 정상 projectId 전송은 수정한 테스트 조건과 구분한다. 이후 console 실패는 정확한 교차 프로젝트 GET404뿐이고 React 오류0임을 확인해 해당 예상 거부만 좁게 분리했다. 최종36조건 재실행은 위처럼 통과했으며 앱 결함이나 전체 console 무시로 처리하지 않았다.

binding151은 populated D1 0015→0016/Native v11→v12의 기존 행·role·명단·private·revision·file metadata hash 보존과 legacy 기본값, native 재실행을 포함한다. D1 raw DDL 반복은 중복 컬럼으로 fail-closed하므로 완료분은 관리형 migration journal로 건너뛴다. 실제 운영 DB/R2 bytes·백업/복원 검증은 아니다.

실제 사용자 자료/계정 role·명단·환경은 변경하지 않았고 운영은 version15를 유지한다. 현재 운영 host CONNECT403 제한은 재시도/우회하지 않으며 실 Google 미검증이다. docs-canon SKILL.md 재읽기는 성공했으나 원본 `scripts/check_docs.py` 리소스 읽기는 실패해 원본 검사는 미실행이다. 문서 전담의 저장소 checker/self-test·`git diff --check`와 MASTER_PLAN/기존 사용자 HTML의 HTMLParser는 PASS(문서30·등록16/핵심7·상대링크234·npm명령120)다. 별도 내용 검토로 실제 소스 정책/역할·로컬/운영 경계, 과거 실패/엄격한 최종 인수·권한 거부/취소 요청, 완료 이관·게시 대기를 대조했다. 새 문서/보고서는 없으며 원본 canon 형식 검사 통과나 앱 테스트를 문서 담당이 실행한 것으로 주장하지 않는다. 향후 게시 결과는 별도 확인 뒤 추가한다.

## 문서 정리 검증

2026-10-21 간소화 당시 기준은 main ddcedd6/sites c1c55da와 미커밋 문서 작업 트리였다. 앱/DB/보안/배포를 바꾸지 않고 문서·필요 참조·검사기만 확인한다. docs-canon 원본은 환경에 없어 실행하지 않았고 외부 PredevGUI 규칙/BOM을 가져오지 않았다. 대체 검사는 등록 역할/읽기 경로, 전체 상대 링크/anchor, 실제 npm script, HTML 내부 링크/외부 CDN, 삭제 전 통합 매핑·untracked 보존과 두 branch의 공통 patch 적용을 확인한다. 실제 결과/파일 수는 검증 후 COMPLETED_LOG의 OPS-037에 남긴다.

2026-10-22 QLT-021 후속 문서 검증: main ff5e830/sites b249c4d를 기준으로 문서 전담 역할에서 기존 AGENTS/TODO/HARNESS_MAP/COMPLETED_LOG만 로컬 갱신했다. 개인 docs-canon SKILL.md는 읽어 적용했으나 제공된 `scripts/check_docs.py` 리소스 읽기가 실패했고 로컬 경로도 찾지 못해 **원본 형식 검사기는 미실행**이다. 저장소의 `node scripts/check-docs.mjs`는 문서30·등록16/핵심7·상대링크167·npm명령84 PASS, `git diff --check` PASS다. 별도 내용 검토로 version13의 게시 provenance/부모 Chrome 인수 근거, QLT-022의 남은 조건·승인 경계, 과거 로컬 수치와 현재 운영 결과의 분리 및 기존 고유 이력 보존을 확인했다. 이 QLT-021 문서 정리 단계에서는 제품 테스트 재실행·앱 수정·재게시·운영 데이터 변경·커밋·푸시를 수행하지 않았다.

2026-10-23 봉사활동 계획 문서 검증: main a1f244c/sites 9e48312를 기준으로 PRODUCT_SPEC/MASTER_PLAN/ARCHITECTURE/TODO와 이 검증 기록만 갱신했다. `node scripts/check-docs.mjs --self-test`, `node scripts/check-docs.mjs`, `git diff --check` PASS. 문서30·등록16/핵심7은 유지한다. docs-canon SKILL.md는 읽었으나 원본 `scripts/check_docs.py` 리소스가 제공되지 않았고, 승인된 전달 ZIP의 Library materialize 후 로컬 helper 다운로드도 `download failed`로 끝나 원본 검사는 미실행이다(다운로드 실패의 HTTP 원인은 미확인). 별도 내용 검토로 확정 방향/제안 정책, V0–V4의 ID·우선순위·의존성·완료 조건, 기존 계정/자료/검토 계약과 미구현 경계를 확인했다. 문서 전용 게이트를 적용해 앱 build·기능/DB/브라우저 테스트는 실행하지 않았으며 기능·DB·실제 권한·운영 게시를 변경하지 않는다. 검증 성공은 계획된 기능의 구현/인수 완료가 아니다.

## 환경 메모

AppleDouble `._*`는 별도 사용자 파일을 임의 삭제하지 말고 lint/types exclude와 기존 Turbopack dev cache 옵션을 유지한다. frappe-gantt CSS는 root layout에서 직접 import한다. native CLI의 APP_PORT/환경 우선순위·protected schema 설정은 기존 코드를 따른다. VS Code launch와 dev:debug는 개발 지원이며 운영 검증을 대신하지 않는다. 실측/의존성 상태를 바꾸려는 경우 해당 source와 exact 환경을 다시 확인한다.

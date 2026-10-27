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
| `npm run test:attachment:preview:browser` | Sites build 후 격리 Worker/D1/R2의 실제 파일 미리보기·현재/과거 버전·인가/실패·모바일 회귀 |
| `npm run test:attachment:preview:native` | Native build 후 loopback MariaDB/로컬 저장의 실제 파일 미리보기 Chromium 회귀 |
| `npm run test:superuser:invariants` | 합성 SU의 identity/DB role/session/소속 불변성과 신규 배정 제외를 격리 D1/MariaDB에서 확인 |

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

환경 기준선: 기존 native NFT 동적 logging 경고(회차에 따라1/2), Vinext proxy 감지/route static 분류, Node mock experimental, npm proxy/@esbuild-kit deprecation을 해결됐다고 주장하지 않는다. QLT-015의 차단된 두 cleanup runner 정지/재개는 미실행, 당시 QLT-016 동시503 원인은 미확정이었고 후속 원인 수정은 [현재 회차](#남은-품질과-digest-구현-진행)에서 구분, QLT-020 native 첨부 purge는 fail-closed다. QLT-021 핵심 삭제 오판은 version13에서 운영 인수를 통과했다. 로컬의 권한·rollback·후속 오류 주입 통과를 운영에서 강제로 확인한 것으로 확대하지 않으며, 별도 첨부 실패 QLT-022는 미완료다.

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

위 로컬 인수 회차는 실제 사용자 자료/계정 role·명단·환경과 당시 운영 version15를 유지했다. 기존 운영 host CONNECT403 제한은 재시도/우회하지 않았고 실 Google도 미검증이다. docs-canon SKILL.md 재읽기는 성공했으나 원본 `scripts/check_docs.py` 리소스 읽기는 실패해 원본 검사는 미실행이다. 문서 전담의 저장소 checker/self-test·`git diff --check`와 MASTER_PLAN/기존 사용자 HTML의 HTMLParser는 PASS(문서30·등록16/핵심7·상대링크234·npm명령120)다. 별도 내용 검토로 실제 소스 정책/역할·로컬/운영 경계, 과거 실패/엄격한 최종 인수·권한 거부/취소 요청, 완료 이관·게시 대기를 대조했다. 새 문서/보고서는 없으며 원본 canon 형식 검사 통과나 앱 테스트를 문서 담당이 실행한 것으로 주장하지 않는다. 후속 version16 게시/실제 release artifact 검증은 아래에서 구분한다.

### version16 게시와 운영 검증 경계

기능 소스 main `b7fe96e386aba05938fd61a8822ce565a83c6551` / sites·공식 source main `62b93208e1f32f2b19d58249643d5637242a8b36`를 푸시하고 원격 HEAD를 확인했다. 별도 clean `/workspace/wbs-sites-publish-20261023`의 exact sites SHA에서 build했다. Vinext BUILD_ID/hashed chunk가 기존 작업 트리 산출물과 달라 아래 **실제 게시 artifact**를 다시 인수했다. 앞선 공통 소스 Native 결과를 새로 실행한 것으로 세지 않으며 실제 NAS 배포/Native v12 운영 적용은 없다.

| 게시 artifact 검증 | 결과/범위 |
| --- | --- |
| loopback Worker 새 UI·보호 scope | 5폭×2테마670조건·실제 multipart RSC15 POST 모두303 PASS. strict 대비132scenes/4,914샘플·미달0·허용오차0·enabled/hover 필수50대상. 예상 외 console/pageerror·warning/requestfailed0 |
| 기존 봉사 UI |36조건·실제 multipart RSC46 POST 모두303 PASS. 예상 deny404 console2건만 별도 분리하고 예상 외 console/pageerror·warning0 |
| 산출물 동일성 | dist323files/4,530,026bytes fingerprint `c769abd54ab88ad881a9aba1312a8bccd7c94e03a27e6c161155faf8d6574c3b` 전후 동일; entry SHA256 `57b67ae30fa12ee9107d07888c573057def549566f63ccc5c43903b24a0c9646` |
| 실제 artifact auth/decoder | auth18·compiled decoder PASS, 실제 Google 로그인 미시도 |

문서 담당은 clone의 `.test-artifacts/release-qa/final-evidence.json`을 직접 대조했다. 두 launcher는 격리 D1/R2 합성 원문·계층·불변 revision과 exact 첨부 bytes 보존을 검사했고 운영 요청/자료를 쓰지 않았다. 전체 WCAG 인증·물리 기기/운영 UI 인수로 확대하지 않는다.

공식 게시 도구는 version16 terminal succeeded를 반환했고 후속 get_site/get_site_version이 active/latest16·exact source/deployment 일치를 확인했다. 정확한 시각·ID·archive 반환값은 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다. D1 overview는23표를 유지하며 0016 효과인 `projects.access_mode` 추가와 project5의 `legacy_authenticated`/workspace0을 운영 조회했다. D1 journal 직접 조회나 운영에서 새 프로젝트 생성·CHECK/FK 실행 검증은 아니다.

게시 전후7표의 **모든 기존 컬럼·행은 동일하고 truncation0**이다: projects1(id5), tasks1(id7), submissions1(id5), submission_attachments1(id7), submission_revisions1(id5), users2, project_members0. 계정 role/소속 자동 부여0이며 사용자 파일 metadata는 보존됐다. 실제 R2 inventory/운영 bytes 다운로드는 미검증이다. public policy revision2·auth_client·환경 revision11 entries는 값 노출 없는 대조에서 동일했다. 이7표 대조를 전체 DB/R2 백업이나 복원 검증으로 확대하지 않는다. 저장 version15를 복구 참조로 유지하고 schema down/실제 복원은 하지 않았다.

CI combined status 조회는 두 기능 SHA 각각 statuses0이었다. GitHub Actions runs API 조회는 두 SHA 모두 **Forbidden으로 거부**됐고 재시도·대체 경로 사용0이다. 따라서 CI 통과로 기록하지 않는다. 기존 CONNECT403/Domain forbidden 제한 때문에 운영 GET/자산·실 Google/UI는 재시도/우회0·미검증이다. 게시 상태·운영 schema/보존 조회와 실제 운영 브라우저 인수를 구분한다. 후속 문서 commit SHA를 이미 게시한62b9320의 앱 소스/검증 대상으로 바꾸지 않는다. 원본 canon 검사기는 여전히 미실행이다. 이번 게시 기록은 TODO/HARNESS/COMPLETED3개만 갱신했고 저장소 checker/self-test·HTML 파싱·`git diff --check` PASS(문서30·등록16/핵심7·상대링크238·npm명령120)다. 별도 내용 검토로 게시 source/후속 문서 HEAD·실제 artifact·archive 반환값·7표 보존 범위·CI 거부/운영 미검증을 대조했다.

## 제출물 첨부 미리보기 검증

PRD-056/QLT-025 시작 기준은 main `7ac68ad`/sites `0812648`, 운영 version16/source62b9320/public policy2/env11이다. 시작 시 문서 담당은 기존 이미지/PDF UI 분기·다운로드 링크와 서버 allowlist의 차이를 확인했다. 현재 구현은 제출 상세/버전 이력의 공통 AttachmentFile과 인가된 preview route를 사용한다. 후속 지원 계약은 UTF-8/BOM256KiB prefix·잘림 안내와 signature/MIME 검증 raster8MiB이며 UTF-16/EUC-KR·PDF/audio/video는 다운로드 fallback이다. HTML/SVG/Markdown/코드는 raw text만 허용한다. 아래 소스/양 runtime의 로컬 인수·실제 게시 상태와 운영 UI/Google 미검증을 구분한다.

| 검증 계약 | 확인 범위/미검증 경계 |
| --- | --- |
| 형식/안전한 표시 | 실제 구현에서 확정한 지원/미지원 MIME·이름·내용 조합, 텍스트 인코딩·크기/내용 제한·악성 HTML/스크립트 문자열·binary 오인·빈 파일을 합성 자료로 확인. 실행/외부 전송이나 원본 재작성 없이 안내/다운로드 fallback을 검증 |
| 현재/과거·인가 | legacy·다중 첨부·현재/이전 revision의 public/private, 지정 admin/SU·작성자·타인·guest·제한 프로젝트/소속 해제 후 요청의 metadata/bytes를 양 runtime에서 대조. 기존 다운로드·불변 원본/파일/검토 이력 보존 |
| 실제 화면/실패 | Chromium의 실제 파일 미리보기 열기/닫기·로딩/실패·재시도·키보드/초점·좁은 화면/긴 파일명·내용 줄바꿈/내부 스크롤과 새로고침을 확인. 서버 unit/HTTP만으로 실제 화면 인수를 대신하지 않음 |
| SU 불변성/배정 제외(QLT-026) | 검증된 SU identity+env 설정을 DB role/session flag/소속으로 강등하지 않고 새 담당·팀장·명단 후보/변조 배정에서 제외하는지 검증. 기존 배정/자료 보존과 명시적 전역 관리 조회를 대조. 비로그인/가짜 email·flag는 권한을 얻지 않음. 실제 계정 role·환경 변경 없이 합성 자료만 사용 |
| 게시/운영 | 검증한 source SHA·실제 게시 artifact·terminal 상태/active version과 기존 자료·public/env 보존을 따로 확인. 운영 CONNECT403·로그인 인계 제한에 새 근거가 없으므로 운영 요청 재시도/우회0, 실 Google/UI 미검증 유지 |

| 확인된 검증 | 결과/남은 구분 |
| --- | --- |
| `npm test -- --require-db` | 최종 실행 exit0, action33·unit157·MariaDB34 각각 PASS, skip0. preview server focused21 PASS와 중복 합산하지 않음 |
| SU 실제 DB/현재 identity | D1/MariaDB 각28, auth JWT/session5·admin repository10·audit4 PASS. SU guest/active0·private 현재/버전·댓글 작성/조회·타인 수정/미지정 admin 거부·보존 확인. 실제 계정 role/환경 변경 아님 |
| 정적 검사/Native build | lint0·typecheck·FSD5 PASS, Native build PASS. 기존 logging/NFT1 warning·Node experimental 기준선 유지 |
| `npm run test:attachment:preview:native` | fresh MariaDB11.4.13·실제 Chromium390/1280px371조건, hydrated POST1→303 PASS. 현재/과거 legacy+multi·5raster 실제 decode·raw text/실행0·권한 회수·합성30파일 SHA 보존 |
| Native SU·오류 구분 | DB guest/JWT guest·SU false/프로젝트 소속0에서도 effective admin/SU true·신규 후보 제외·기존 배정 보존 확인. 예상 deny console13, 예상 외 console/pageerror/외부 요청0, 취소173·기타 요청 실패0. 팀장 후보 UI는 이 흐름에서 미검증이며 별도 서버 회귀와 구분 |
| Native artifact | `.next`53,267,483bytes fingerprint `da11003aaf55370ae6e9786cd848cde135d9f7a2910183274b3b6c5bfd67cce0` 전후 동일, BUILD_ID 파일 SHA256 `9f2e0ab0eaae24e13a6d9ec9d86a9731cfd7d218395eda5b330bf3045e954ca2` |
| `npm run test:attachment:preview:browser` | exact source clone의 단일 build로 Worker371조건/390·1280px PASS, 실제 hydrated POST1→303. Native와 같은 파일/권한/SU 계약·합성30파일 SHA 보존. 예상 deny console13/예상 외 console·pageerror·외부 요청0, 취소13/기타 실패0 |
| Worker auth/HTTP/decoder | 실제 게시 artifact auth18·HTTP266·compiled decoder PASS. 실제 Google 로그인이나 운영 요청 인수 아님 |

최종 full224와 추가 focused 검증은 제품/Native artifact 변경 없는 test-only 회귀다. 전체 suite·각 focused 결과는 중복 합산하지 않는다.

Native의 `.test-artifacts/attachment-preview/native/result.json`/`final-evidence.json`을 문서 담당이 직접 대조했다. 최초 seed에 미완료 담당 업무가 있어 소속 회수가 정책대로 거부됐으며, 합성 담당자/기존 SU 업무를 분리해 fixture를 보정했다. 제품 결함이나 운영 자료 수정으로 처리하지 않는다. 초기 테스트의 SU 포함 기대값은 새 후보 제외 계약에 맞게 수정해 전체 재실행을 통과했다. lint는 생성 진단 파일의 unused2 warning을 발견해 제품 scripts/tests 검사를 유지한 채 generated `.test-artifacts/**`만 제외하고0 warning으로 재검증했다. 증거 파일을 수정/삭제하거나 제품 오류를 blanket disable하지 않았다.

운영 project5/task7/submission5/attachment7은 읽기 테스트용 합성 자료로 바꾸거나 삭제하지 않는다. 이번 원본 docs-canon SKILL.md 읽기는 성공했으나 제공된 `scripts/check_docs.py` 리소스 읽기1회가 실패해 원본 검사 실행은 불가다. 새 문서/보고서 없이 기존 정본과 저장소 대체 검사만 사용한다. 이번 소스/Native 인수 문서의 checker/self-test·`git diff --check`는 PASS(문서30·등록16/핵심7·상대링크249·npm명령124)다. 당시 내용 검토로 지원/SU 계약·Native 결과와 Worker/팀장 후보 UI·v16 보존 경계를 구분했다. 이후 exact Worker artifact·version17 결과는 아래에서 별도로 확인했다.

### version17 게시와 검증 경계

기능 main `9b07c5e2d93ac47a6256eaccf188073d62a29977` / sites·공식 source main `7fc8d79fde1c1ad4f6d90bff9d710d4a7ac5d7a9`를 푸시하고 원격 HEAD를 확인했다. 정확 source의 Worker build1회와 Native build1회를 구분하며 게시 clone의 release/worker `final-evidence.json`을 직접 대조했다. Worker fingerprint는325files/4,558,958bytes의 `9885b48a025a0980d09da13175572f11b21a65e858b5757e9411eff5ff69fe9c`, entry는 `9c53230f45b29615d8b57178de5f39be5e3976c22aacb37b4b93e1089a69d1ca`로 실제371조건 실행 전후 동일했다. 전체 공급 bundle 검사와 아래 게시 service의 archive 반환값은 별도 증거다. 입력 tar의362개 regular member SHA를 검증 checkout의 dist/drizzle/hosting bytes와 모두 대조했고 양쪽 hosting manifest의 project_id/DB/ATTACHMENTS도 동일했다. 허용 root만 포함해 원시 source·환경 파일·업로드 디렉터리는 없으며 입력 tar SHA는 유지됐다.

기존 사이트 version17의 terminal succeeded와 후속 get_site/get_site_version의 active/latest17·source/deployment 일치를 확인했다. 정확 시각·version/deployment ID·입력 package와 service archive 값은 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다. public policy revision2·auth_client·환경 revision11 entries는 값 출력 없이 동일함을 대조했다. D1 overview23표 유지·이번 schema/migration0이며 실제 NAS 배포는 없다.

게시 전후7표의 모든 기존 columns/rows는 동일하고 truncation0이었다: projects1(id5), tasks1(id7), submissions1(id5), submission_attachments1(id7/metadata25,180bytes), submission_revisions1(id5), users2, project_members0. 실제 계정 role/소속 자동 변경·영구 삭제는 없었다. R2 inventory/실 bytes 다운로드는 미검증이며 metadata 보존을 전체 DB/R2 백업·복원으로 확대하지 않는다. 저장 version16을 복구 참조로 유지했고 rollback은 수행하지 않았다.

QLT-025/026은 소스/양 DB·실제 Native/Worker 로컬 및 게시 상태 확인 범위로 완료했다. 팀장 후보 UI 직접 조작은 미검증이며 서버 회귀 통과와 구분한다. 게시 직후 코딩 환경의 실 Google/운영 UI는 미검증이었으며 후속 허용 Work 브라우저의 부분 인수는 아래에서 구분한다. 기존 CONNECT403 제한에 대해 코딩 환경의 운영 GET 재시도/우회0이며 물리 기기·전체 WCAG 인수도 아니다. CI는 이번 두 기능 SHA의 combined statuses0을 확인했고 기존 Actions runs Forbidden을 재시도/대체 조회하지 않았다. CI 통과로 주장하지 않는다. 후속 문서 commit은 이미 게시한7fc8d79의 소스/검증 대상이 아니며 원본 canon 검사기는 미실행이다. 이번 TODO/HARNESS/COMPLETED3개 동기화의 저장소 checker/self-test·`git diff --check`는 PASS(문서30·등록16/핵심7·상대링크249·npm명령125)다. 별도 내용 검토로 실제 release artifact/공급 tar와 service archive·게시 상태/7표 보존·미검증 UI와 CI 경계를 대조했다.

### QLT-027 운영 관측과 재현

version17/source7fc8d79의 별도 **허용 Work 브라우저·기존 SU 로그인 세션**에서 부모가 직접 관측한 결과다. 코딩 환경의 CONNECT403 제한은 그대로이며 그 경로를 재시도하지 않았다. 새 Google 인증 교환이나 아래 항목 외 전체 운영 인수로 확대하지 않는다.

| 실제 운영 관측 | 범위/결과 |
| --- | --- |
| 텍스트 미리보기 | project5/task7/submission5/attachment7의 제출 상세에서 열기/닫기/다시 열기, `/submissions/5` 버전 이력에서 열기/닫기 PASS. 한글 정상·U+FFFD0. 관측 PRE는 clientWidth=scrollWidth=1008px, clientHeight480px/scrollHeight6681px로 가로 넘침 없이 세로 bounded scroll·줄바꿈 확인. 모든 화면 폭/형식이나 원본 bytes SHA 대조가 아님 |
| SU 후보 제외 | 프로젝트 참여자·업무 담당자·검토자 후보에서 현재 SU 제외/일반 관리자 표시를 확인. 선택 저장·권한 변경0. 팀장 후보 UI 직접 검증과는 별개 |
| React418 탐색 | 홈→`/tasks?projectId=5&taskId=7#task-7`(10:04:15Z), 제출 상세·댓글→`/tasks?projectId=5&taskId=7&submissionId=5#submission-5`(10:04:30Z), 검색 결과→`/tasks?projectId=5&taskId=7`(10:06:23Z)에서 React #418 text hydration mismatch. 앱 오류는 #418로 분류했고 확장 metadata 오류는 별도 |
| 시간/초기 인증 표시 | 초기 DOM 제출 시간12:12가 hydration 후21:12로9시간 바뀌고 헤더 Google 로그인 표시 뒤 기존 인증 UI로 전환. 실제 계정 role/환경·사용자 자료 변경 없이 관찰 |

기존 v17 artifact의 실제 RED에서 timezone 미지정 Intl이 UTC SSR `오후12:12`를 Seoul `오후09:12`/New York `오전08:12`로 바꾸는 React418 원인을 확인했다. Worker와 Native 각각16건(UTC/en-US0, Seoul/ko-KR1280px5, New York/de-DE1280px6, Seoul390px5)이다. Worker RED42조건 exit0; Native는4case의 시간·인증·미리보기·탐색 재현 뒤 별도 홈 검사에서 아래 SSR500으로 exit1이므로 전체 실행 성공으로 기록하지 않는다. 양쪽 기존 artifact는 전후 불변이다. 로그인 flash는 UTC의 React4180에서도4case 모두 발생해 별개 원인으로 구분했다.

소스는 `formatAppDateTime`에 Asia/Seoul·KST, 첨부 숫자에 ko-KR을 명시하고 RootLayout의 검증된 `Session|null`을 SessionProvider 초기값으로 전달한다. UTC 저장·DB parse·중앙 인증/권한은 바꾸지 않으며 오류 억제/무시는 사용하지 않는다. 순수 시간2·실제 SSR provider4, 최초 기능 소스dbd784f의 `npm test -- --require-db` action33/unit163/MariaDB34 각각 PASS(skip0), lint/typecheck/FSD5 PASS다. 후속 NO_SECRET guard는 SSR4·lint/typecheck와 최종 auth21로 확인했으며 full230을 다시 실행했다고 해석하지 않는다. 결과를 중복 합산하지 않는다.

| 최종 수정 후 확인 | 결과/남은 구분 |
| --- | --- |
| `npm run test:hydration:timezone:native` / `npm run test:hydration:timezone:worker` | 최종 실제 Chromium 각47조건 exit0. UTC/en-US·Seoul/ko-KR·New York/de-DE1280px와 Seoul390px4case 모두 SSR=수화 `2026.10.23 오후09:12 KST`, React418/기타 console/pageerror0. desktop 로그인 flash 없음; mobile은 숨겨진 desktop DOM 포함 textContent 안정성을 확인 |
| 인증/자료 회귀 | 보호 task URL의 signed/anonymous/signed 응답200/307/200·SSR private/no-store 격리, 실제 UTF-8 미리보기/원본 다운로드200, 합성30파일·DB metadata·role 보존. 최초 `/api/auth/session` fetch0이므로 준비한 지연/503 응답은 발생하지 않았고 실패 주입 통과로 확대하지 않음 |
| 최종 Native build/artifact | build PASS·기존 NFT 경고2 유지. BUILD_ID `3Wu6NBJZ-HvvP8H3QjShM`,554files fingerprint `25ef7cc49c936e1c2eb8b3a4ca7ff311cb1c54a12b5a8a2fb14194fb8e6ba421` 전후 동일 |
| 최종 Worker build/artifact | build PASS·기존 proxy/static 분류 경고 유지.324files fingerprint `8ea870068a215c238e04378313c7055c48bf91617f891201c43093aa4cfa0273`, entry `20fb900bd24e68860994a0168fc86e1b41ed6b03f0dda8e1b30157c6af6adbd2` 전후 동일 |
| 설정 누락/부가 회귀 | 중간 missing-secret 공개 privacy NO_SECRET500을 layout의 session=null guard로 보완. 최종 auth21·정식 HTTP266·compiled decoder 모두 exit0 PASS. 공개 privacy 본문200·익명 유지·invalid cookie 권한 없음과 인증 route fail-closed 확인. 중간 HTTP 응답 소비 오류는 아래 QLT-029로 별도 유지 |

중간 Native 소스dbd784f/Worker 소스94be65a의 각47조건과 Native fixture의 파일 크기 보정 이력은 최종 artifact 인수와 구분한다. 실제 운영 재인수는 아래 게시 경계를 따른다.

### version18 게시와 검증 경계

기능 main `3d36fa6eb8efea144a111a4efa8ca008c3b30bee` / sites·공식 source `ccabf815e78d4aa43f15b12caf1c8d8a5b1577f7`의 push·ls-remote를 확인했다. 기존 Sites version18은 terminal succeeded이고 get_site active/latest18·get_site_version의 정확 source/deployment 일치를 재조회했다. 시각·ID·입력 tar와 서비스 정규화 archive는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다. 입력 tar361 regular files의 내용 hash를 검증 checkout과 모두 대조했다.

게시 전후 env revision11의5entries·public policy revision2·auth_client가 동일하며 값은 출력하지 않았다. D1 schema23표·이번 migration0. 기존7표의 모든 columns/rows를 투영 생략 없이 완전 페이지 대조해 동일함을 확인했다: projects1(id5), tasks1(id7), submissions1(id5), submission_attachments1(id7/metadata25,180bytes), submission_revisions1, users2, project_members0. 실제 R2 bytes·전체 backup은 미검증이며 계정 권한 변경·NAS 배포·코딩 proxy 재시도0이다.

QLT-027의 소스/로컬·게시 확인과 아래 별도 허용 Work 브라우저의 version18 관측 범위 재인수를 완료했다. 새 OAuth 교환·전체 운영 UI 인수로 확대하지 않는다. v18 게시 당시 QLT-028 Native 홈과 QLT-029의 최초 간헐 하네스 원인은 미해결이었고 후속 근거는 [현재 회차](#남은-품질과-digest-구현-진행)에서 구분한다. 최종 기능 두 SHA의 GitHub combined statuses는 각각0이며 CI PASS가 아니다. 기존 Actions Forbidden을 재시도하지 않았다. 후속 문서 HEAD는 이미 게시한 코드 source와 구분한다. 원본 docs-canon 검사는 미실행이다.

### version18 허용 Work 브라우저 재인수

부모가 전달한 닷프로 자체 클라우드 Chrome의 같은 로그인 세션 tab2, 2026-10-23 10:41:30–10:43:06 UTC 관측이다. 문서 담당/코딩 실행기의 운영 재접속이 아니며 기존 CONNECT403 제한을 재시도/우회하지 않았다.

프로젝트 workspace 새로고침→업무 상세→제출 상세, 검색→업무→제출, 제출 상세 직접 새로고침, `/submissions/5` 버전 이력→홈과 현재/이력 텍스트 미리보기 열기·닫기·재열기 PASS였다. 과거 실패 URL `/tasks?projectId=5&taskId=7#task-7`, `/tasks?projectId=5&taskId=7`, `/tasks?projectId=5&taskId=7&submissionId=5#submission-5`에서 신규 React418이 없고 관측 기간 앱 console warning/error0이었다.

최초 관찰부터 실제 자료 시간은 `2026.10.22 오후09:12 KST`로 유지됐고 초기 관리자/로그아웃 UI가 표시되며 Google 로그인 flash가 없었다. 버전 이력의 명시된 `12:12:22 UTC`는 같은 시점이므로 불일치가 아니다. 한글 정상·U+FFFD 없음,1008px 미리보기 폭 안에서 줄바꿈·가로 넘침 없음을 확인했다. 실제 자료·권한·세션 변경은 없었다. v17에서 확인한 SU 참여자/업무 담당자/검토자 후보 제외는 별도 기존 사실로 유지한다.

QLT-027 운영 재인수 대기는 이 관측 범위에서 해소했다. 이미지/HTML/SVG 실제 운영 파일·모바일 운영·신규 Google OAuth 교환·전체 운영 인수로 확대하지 않는다. 게시 sourceccabf81/version18과 기존 미검증 R2 bytes 경계는 유지한다.

### QLT-028 Native 홈 SSR500

기존 v17 Native artifact의 `/`에서 `Functions cannot be passed directly to Client Components` SSR500을 확인했다. 서버 `app/page.tsx`의 Button `component={Link}` 두 곳은 당시 원인 후보였고 시간대 수정에는 포함하지 않았다. 후속 최소 수정·남은 UI 인수는 [현재 회차](#남은-품질과-digest-구현-진행)에서 구분한다. client WidgetStageOverview 내부 Link를 같은 원인으로 단정하지 않는다. Native GREEN의 인증 cache 회귀는 보호 task URL을 사용해 이 미해결 홈 검사를 대신하거나 숨기지 않으며, Sites 홈 결함으로 확대하지 않는다. 조사·수정·홈 인수는 TODO의 QLT-028로 유지한다.

### QLT-029 HTTP 응답 소비 관측

source94be65a 불변 Worker의 정식 HTTP266 실행1회가 `verify-bug-http.mjs:110`의 `detail.text()`에서 Body already read로 중단됐다. 기존 검증 코드 사본에404 response의 bodyUsed/status 관측만 추가한 진단1회는266 PASS이며 해당 응답들은404/bodyUsed=false였다. 당시 최초 원인은 미확정이었고 앱을 추측 수정하지 않았다. 후속 transport GC 재현·helper 수정은 [현재 회차](#남은-품질과-digest-구현-진행)에서 구분한다. 최종 새 build의 정식 HTTP266은 exit0 PASS였으나 최초 오류의 근본 해결로 바꾸지 않는다. QLT-016의 간헐503과 다른 관측으로 QLT-029에서 원인을 추적한다.

## 남은 품질과 digest 구현 진행

이 회차는 로컬 구현·검증을 마쳤고 아래 외부 인수 게이트를 남긴다. 로컬 검증 당시 운영 version18·sourceccabf81을 유지하며 중간 게시0이었다. 후속 최종 게시 결과는 [v19 이력](#version19-승인과-운영-배포)을 따른다. 아래는 구현 담당이 전달한 소스/실DB/compiled artifact 근거이며 실제 운영 적용 성공이 아니다. 실제 사용자 project5/task7/submission5/attachment7·계정/환경·NAS와 차단된 운영 네트워크 경계를 유지한다.

| 범위 | 확인된 단계 근거/남은 경계 |
| --- | --- |
| QLT-028 | 서버 Home의 Button component NextLink 함수 직렬화 RED500을 href anchor 최소 수정(local main c9003a8, 당시 미push). 별도 secret0 품질 worktree Native build·SSR7 PASS. Python bundled browser ENOENT 뒤 기존 Chromium은 OS sandbox helper FATAL로 실행 차단, UI 미인수. 보안 disable/설정 변경·추가 재시도 없음 |
| 공개 경로 cache | secret0 build의 privacy static s-maxage31536000과 runtime 유효 member에도 익명 표시를 추가 확인. layout force-dynamic 수정·RED HTTP12와 최종 새 secret0 build HTTP16 PASS |
| QLT-029 | Miniflare transport가 undici 원 Response를 공유 stream으로 감싼 뒤 원본 GC가 stream을 cancel하는 원인 재현. 즉시1회 drain 후 독립 응답을 보관하는 test transport helper의 명시 GC9와 최종 Worker HTTP18 PASS. 원인 재현/수정 근거로 완료하며 과거 진단266 PASS를 소급 원인 해결로 쓰지 않음 |
| QLT-016 |608bytes 작은 폼2개의 pause/동시 request에서303/503 재현.4개 상한·전체22MiB 예약·unknown full 예약·declared 초과413의 admission 수정 unit7 PASS. 최종 compiled Worker18조건 PASS. eager second20MiB 전송의 Miniflare/undici write ECONNRESET은 남아 있으나 거부 측 헤더 뒤 대기하면 실제503·Retry-After2 확인, 첫20MiB/R2 객체1개 보존. 이 transport 경계를 수정했다고 주장하지 않음 |
| QLT-020 | 최종 전체 schema의 격리 MariaDB/파일40 PASS·새 unit9/관련 unit50 PASS. v13 durable lease/trigger·quarantine/retry/restore와 Native SU 관리 경로 구현, 브라우저/운영 인수는 미완료. 실제 영구 삭제0·첨부 bug purge fail-closed·기존 거부 runner0 유지 |
| OPS-032 | Next/@next/env16.4.2·NextAuth4.24.15·MariaDB3.5.4·eslint-config-next16.4.2·Vite8.1.6 및 nanoid/baseline patch 설치. PPTX 하위 image-size만2.0.4로 scoped override 후 production audit0·전체23(high18/moderate4/low1). Vinext 하위2.0.2는 변경하지 않음. 전체 advisory 해결로 확대하지 않음 |
| RPT-015~019 | model17·renderer3·collector unit11 각각 PASS, 실제 collector D1/MariaDB 각22·storage11 PASS. staged 보강 후 ledger108·소스 route/service166 PASS. 이전98/158과 중복 합산하지 않으며 compiled Worker 렌더/브라우저 인수가 아니다. 최종 compiled OOXML18 PASS, 실제 화면 인수는 차단 상태로 남는다. runtime DDL 거부 실증·운영 예약 활성화·외부 발송0. 만료 download404·가역 quarantine은 영구 삭제와 구분 |

최종 `TEST_DB_NAME=wbs_final_backlog_20261023_test npm test -- --require-db`는 action33/unit227/MariaDB34, 총294 PASS·fail/skip0이며 Experimental module mock warning만 남았다. 이전292나 focused 결과와 중복 합산하지 않는다. staged/의존성 보강 후 clean secret0 Native(Next16.4.2)·Worker build, Native HTTP16·Worker HTTP18·auth21·decoder·lint/typecheck/FSD5(0위반) PASS다. 양쪽 production source와 package/lock은 동일함을 구현 담당이 대조했다. OOXML compiled smoke 최종18 PASS다. 앞선 Native16의 최초 실패는 privacy 본문의 Google 로그인 설명을 헤더 flash로 오판한 fixture였고 header 한정 검사로 보정했다. `npm run db:check -- --validate-only` PASS는 env parsing 검사이며 실제 DB 연결 검증이 아니다.

| 실제 등록 명령 | 현재 확인 범위 |
| --- | --- |
| `npm run test:native:home` | Native SSR7 단계 근거·최종 cache HTTP16 PASS, 브라우저 차단과 분리 |
| `npm run test:http:response-lifecycle` | 강제 GC9 PASS |
| `npm run test:native:bug-quarantine` | 격리 Native DB/파일40 PASS, 추가 unit9와 구분 |
| `npm run test:reports:collector` | 실제 D1/MariaDB 각22 PASS |
| `npm run test:reports:ledger` | staged 보강 후108 PASS |
| `npm run test:reports:workflow` | staged 보강 후 소스 route/service166 PASS, compiled/browser 인수 아님 |
| `npm run test:reports:http` | 최종 compiled route/OOXML18 PASS·브라우저 인수 아님 |

Native 최종 build의13경고는 기존 logging 동적 filesystem11과 새 report storage canonicalPotentialPath/path resolve2의 Turbopack whole-project trace/포장 경고다. 임의 turbopackIgnore/경고 suppression으로 숨기지 않았고 실제 NAS 디렉터리/번들 포장·secret 비포함은 운영 게이트 미확인이다. Worker의 proxy/PLUGIN_TIMINGS·privacy 정적 route 분류 unknown/info는 Vinext 경계로 남긴다. Worker 생성 `.next` types의 기존 Native 충돌은 표준 typegen 재생성 후 tsc PASS이며 소스 오류 해결로 주장하지 않는다.

staged는 저장 전 durable 예약→verified ready CAS이며 불확정 write의 무조건 quarantine/overwrite와 stale tmp/lock 자동 삭제를 하지 않는다. 예약 fingerprint와 재렌더 불일치는 fail-closed, 만료 staged 파일 부재는 실패다. project/user RESTRICT의 별도 보존 정책 전 삭제 차단, 실제 NAS 권한/free-space·runtime DDL·시각 OOXML/브라우저 미인수를 유지한다.

image-size의 공식 GHSA2건과 registry의2.0.4를 구현 담당이 확인한 뒤 `pptxgenjs` 하위만 scoped override했다. renderer3 PASS와 별도 정상 PNG·zero-dimension ICNS/JXL/HEIF의 child process3초 내 throw 검사1 PASS, 새 Native/Worker build PASS를 호환 근거로 둔다. 텍스트 전용 보고서는 addImage/외부 이미지 parser를 사용하지 않으며 compiled OOXML18 PASS도 확인했다.

기존 `wbs_app_test`가 미공개 v14 pre-staged checksum을 보유해 최종 suite가 의도대로 fail-closed한 결과를 성공으로 바꾸지 않는다. checksum 수정·기존 DB 삭제 없이 새 고유 `wbs_final_backlog_20261023_test`에서 최종294 PASS를 확인했다.

Vinext TransformStream은 route가 설정한 Content-Length를 제거하고 chunked로 전송할 수 있다. 최종 compiled 보고서18조건은 wire 길이가 있으면 일치, 없으면 chunked·실제 bytes/SHA·MIME/CSP/nosniff를 대조해 PASS했다. 실제 DOCX/PPTX 모두 wire Content-Length=null/Transfer-Encoding=chunked였다. 처음 길이 헤더 필수 가정 실패는 QA 오판이며 제품 추가 수정은 없었다.

compiled18은 DOCX9,425/PPTX81,094bytes의 OOXML·SHA/ETag/R2 metadata, 현재 권한/공개 필터·201 생성/200 같은 요청 재전송의1run/2files를 대조했다. entry `6f781e9f29e53016491ee353c06bd2b648b6edd65a797052fe67dab15fd9fc68`,351files fingerprint `a06326312d2415b6b42662a447c62c62705e726093d7091de2d2463c4880c0c7`는 전후 불변이다. 실제 Chromium/NAS·시각 OOXML 인수와 구분한다.

구현 source main `bd6f4efea7f78221e4d7a2597a01497ffbfd0acc`/sites `5032410a5b5117daabf709ce17514f63af3eeb99`의 push·remote ls-remote를 확인했다. 공통 source/package/lock 동일·기본 build 차이를 보존한다. combined CI status는 두 SHA 각각 statuses0이며 통과가 아니다. 기존 Actions403을 재시도하지 않았다. 당시 후속 문서 HEAD와 운영 v18 source는 별개였고 이후 v19는 아래에서 구분한다.

새 명령은 현재 package에 등록돼 있음을 문서 담당이 확인했다. 새 보고서나 DDL 사본을 만들지 않고 원본 docs-canon 검사 미가용 경계를 유지한다.

### version19 승인과 운영 배포

추가 회귀만 포함한 GitHub mainffda904/sites409f514 푸시와 공식 source repository main `409f514a56dfac47932f0d3f874650f4e8b059bc`의 정상 fast-forward·ls-remote 일치를 확인했다. 최종 compiled SSR/RSC+OOXML33조건 PASS, 기존 entry6f781e9f…/351files fingerprint a0632631…는 불변이다. 수동 RSC GET307은 인증 실패가 아니라 같은 경로의 canonical `?_rsc` redirect였고 따라간 응답200을 확인했다. 실제 브라우저는 Native SUID sandbox 차단으로 미검증이며 설정 우회0이다.

최초 시도에서는 기존 사이트 version19 저장은 성공했지만 **운영 배포는 실행되지 않았다**. 대상 `deploy_site_version` 호출은 자동 승인 검토에서 다음 이유로 거부됐다: “Production deployment external commitment replacing maintainedv18; active instructions prohibit publish until parentreview”. 최신 최종 게시 위임과 충돌하는 검토 결과이며 새 근거 없이 재시도/우회하지 않았다. 당시 version19 재조회는 deployment_id=null·배포ID 없음이었다. 정확한 version/archive 식별자는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유하며 최초 저장 성공을 배포 성공으로 소급하지 않는다.

D1 0017은 CREATE3표+CREATE INDEX8개의11문장만 있고 DML/ALTER/DROP/GRANT가 없다. 최초 거부 시에는 미적용·실DB23표였으며25행 pagination으로 audit270행을 포함한 모든 표/컬럼/행을 투영 생략·잘림 없이 전후 대조해 정확히 같았다. 사용자 project5/task7/submission5/attachment7 metadata·사용자2명의 role·membership0을 보존했다. 독립 R2 inventory/원본 bytes는 조회하지 않았고 전체 backup 검증도 아니다.

public policy revision2·auth_client·env revision11의5keys는 동일하며 실제 값은 출력하지 않았다. cloud automations는 빈 배열, DIGEST_SCHEDULER_ENABLED/DIGEST_ALLOW_ARTIFACTS 설정 없음으로 예약/산출물 opt-in을 활성화하지 않았다. v18 saved archive는 code fallback 참조로 확인했으나 DB 자동 down/backup 복원을 실행한 것은 아니다. Native v13/v14/NAS 적용·영구 삭제·환경/계정 변경·코딩 proxy 재시도0이다.

최종 Worker artifact에서 dev audit23건의 취약 동작 도달 경로는 발견하지 못했다. Vinext 하위 image-size2.0.2는 build metadata 전용이며 bundle parser/import가 없고 image optimizer route의 등록0 응답302/400은 bytes parser를 호출하지 않았다. 이는 취약점 해결이나 무위험 보증이 아니며 production audit0/전체23 잔여 구분은 유지한다. 아래 새 명시 승인 전까지는 자동 거부를 승인 대기로 바꾸거나 성공으로 추정하지 않았다.

후속으로 사용자가 2026-10-23 12:38:11 UTC에 “게시해줘”라고 명시 승인했다. 같은 저장v19의 deployment_id=null을 먼저 확인한 뒤 배포1회 재시도해 terminal succeeded를 받았다. version ID는 동일하며 deployment `appgdep_6adb555e05908191a189d19e2863f4cf`, updated `2026-10-23T12:39:08.402934+00:00`, env set revision11·providerDeploymentId `site---6ac75dba14348191801b002e0f2a0937`다. saved version의 같은 deployment ID와 get_site active/latest19·public policy2/auth_client 일치를 재조회했다. 최초 거부 원인을 우회한 것이 아니라 새 직접 승인에 따라 알려진 미실행 작업만1회 재시도한 결과다. OPS-038은 이 범위에서 완료했다.

배포 후 동일 D1 binding은26표다. 기존23표의 모든 행/컬럼은 잘림 없이 전후 정확히 같았고 audit270·project5/task7/submission5/attachment7 metadata와 사용자2명 role을 보존했다. 신규 project_report_schedules/project_report_runs/project_report_artifacts는 각0행으로 0017 추가 schema 적용을 확인했다. Native v13/v14·NAS에는 적용하지 않았다. env revision11·keys5는 동일하며 DIGEST_SCHEDULER_ENABLED/DIGEST_ALLOW_ARTIFACTS 없음·cloud automations 빈 배열·예약/외부 발송0이다.

새 코드/빌드 없이 source409f514와 compiled33·기존 entry/fingerprint·saved archive hash를 그대로 게시했다. 게시 직후 독립 R2 bytes/inventory·실제 운영 브라우저 UI·신규 Google OAuth는 미검증이었으며 코딩 proxy 재시도0이다. 이후 부모의 별도 허용 브라우저 읽기 검토는 아래에서 구분한다.

### version19 허용 Chrome 운영 읽기 검토

부모가 전달한 닷프로 클라우드 Chrome의 **기존 탭2·로그인 세션,1165×757**에서 v19를 새로고침한 읽기 검토다. 코딩 실행기/문서 담당이 운영 접속을 재시도한 결과가 아니다. 기존 로그인·SU·KST 표시가 정상이고 홈→프로젝트→업무→제출/댓글, TXT 열기·닫기·재열기/한글, 댓글폼 취소, 검색0건→초기화→상세, 관리자 개요/프로젝트 관리와 복귀·브라우저 뒤로가기가 정상이다. 업무/보고서 미리보기 가로 넘침·새 앱 console warning/error·React418은 없었고 차단 결함을 발견하지 못했다.

프로젝트 관리 카드의 활동 보고서 링크로 `/admin/projects/5/reports`에 진입해 빈 보고서 목록·미리보기 열기/닫기/재실행을 확인했다. 집계 업무1/제출1/댓글0/첨부1과 첨부 본문 미포함(metadata만), 역전기간/31일 초과 차단 및 정상기간 복원 후 재실행 PASS다. 두 잘못된 기간의 안내는 모두 “요청을 처리하지 못했습니다. 입력과 현재 권한을 확인해 주세요.”라는 범용 문구여서 구체 날짜 오류 안내를 QLT-030(P2)으로 남겼다. 거부 동작 자체는 이미 통과했으며 안전한 입력 안내·정상 복원 재시도를 완료 조건으로 구분한다.

실제 사용자 기록/파일·권한·예약을 변경하지 않았다. 좁은 viewport는 브라우저 API 조절이 없어 미검증이며 키보드 인수도 완료로 확대하지 않는다. 실제 운영 보고서 생성·다운로드·예약저장·보관, 다른 역할 접근·신규 Google OAuth 교환은 미실행이다. 기존 세션 유지와 신규 로그인을 구분하며 로컬 source/compiled 검증을 이 운영 범위에 합산하지 않는다. RPT-016의 운영 desktop preview는 PASS지만 나머지 게이트는 열어둔다. QLT-028 Native UI와 OPS-033 전체 폭 인수를 Sites desktop 통과로 대신하지 않는다. 이번 문서 동기화에서 root의 docs-canon SKILL 본체 재읽기는 성공했으나 제공된 scripts/check_docs.py 리소스 읽기1회가 failed to read skill resource로 실패해 원본 검사는 실행하지 않았다. 저장소 대체 검사와 내용 검토만 수행하며 추가 설치/외부 탐색은 하지 않는다.

## 활동팀 공통 준비표 구현 검증

PRD-058의 소스·합성 DB·실제 compiled HTTP 인수는 완료했다. QLT-031의 후속 운영 envSU 부분 인수와 잔여 범위는 [허용 Chrome 검토](#version20-허용-chrome-운영-준비표-검토)로 구분한다. 로컬 인수 당시 운영은 기존v19이고 기능 게시·운영 DB/계정/사용자 파일·NAS 변경0이었다. 이후 실제 게시 결과는 [v20 승인/배포](#version20-승인과-운영-배포)에서 구분한다. 구현 담당의 checkpoint 전체 `npm test -- --require-db`는 새 전용 MariaDB에서 action33/unit242/visibility34,309 PASS·skip0이었다. 이후 소규모 model/권한/Origin 보강은 아래 focused/실제 compiled 결과로 구분하며309를 다시 실행했다고 쓰지 않는다. canonical Origin 보완 후 최종 전체 ESLint/typecheck·FSD self-test5/경계0·diff PASS를 확인했다.

| 실제 등록 명령/범위 | 확인된 결과/남은 조건 |
| --- | --- |
| `npm run test:team-preparation:schema` | Native v15/D1 0018의2표 additive·기존 migration 보존116 PASS, 기존 migration unit21 PASS는 별도 scope |
| model 단위 검사 | strict UUID/date/time 길이·trailing newline 보강 후 최종15 PASS·ESLint PASS. 기존 전체309 checkpoint를 새로 실행한 것으로 세지 않음 |
| `npm run test:team-preparation:workflow` | 최종268 PASS(Native133/D1 135), 각 GET/PUT28요청. `.test-artifacts/team-preparation-workflow`의 result/final-evidence와 새 보존 DB `wbs_team_preparation_mvl29g4m_6c7639_test` 범위. compiled Worker/화면 인수 아님 |
| `npm run test:team-preparation:http` | 최종 실제 Worker30조건/34 HTTP PASS(200×22/404×9/307×2/409×1), source와 별도 compiled 실행. entry `fe6c722b6cbf54c1a6bffab2a22185bb088277e67558816e5e8af354bcfd1d19`,359files/5,559,504bytes snapshot `e9fd9a95ea40fce2187a9baf2a346a0c9f481cd682e76b8de47b23d10c0b028b` 전후 동일 |
| `npm run test:team-preparation:native-http` | 최종 실제 Native23 PASS, 새 `wbs_prep_http_mvl2njvo_a4c63b_test`의 SSR/API/저장·재시도409/KST·현재 권한/미등록 identity404/회수404·외부 Origin+변조 XFH403을 확인 |
| build/브라우저 | 환경 파일 복사0의 별도 Native/Worker 최종 build PASS·Native 기존13 trace 경고 유지. Native Chromium SUID owner 제한에 변경 근거가 없어 재시도/우회0, 실제360px 등 좁은 화면·키보드·취소/오류 조작 인수 미실행 |

identity-change trigger 회귀에서 D1은 actor 이메일 변경 뒤 revision guard0으로 head/revision/email 모두 rollback을 확인했다. Native는 ER_CANT_UPDATE_USED_TABLE_IN_SF_OR_TRG(errno1442)로 DB 자체가 차단하며 원자 보존을 확인한 결과다. 같은0행 guard 기제라고 쓰지 않는다. 별도 GET-only3 PASS(strict ID의 final LF2·미등록 session1)는268과 중복 합산하지 않는다. 페이지는 DB identity가 사라진 오래된 인증의404를 notFound로, 익명401을 sign-in redirect로 처리하며 root focused lint/typecheck0을 확인했다.

실제 Native에서 NextRequest localhost 정규화 때문에 정상127.0.0.1 Origin이403으로 거부되는 RED를 확인했다. 설치된 Next 소스·constructor/HTTP 재현에 근거해 기존 서버 NEXTAUTH_URL.origin을 authority로 사용하고, 미설정 시 request.url fallback을 유지했다. Host/X-Forwarded-Host나 환경 설정을 바꾸지 않았다. canonical Origin focused8 PASS와 최종 Native23·Worker30은 이 보완 후 결과다.

검증 대상 제품 source fingerprint는293files의 `1f40b5f5096ee7680f8ec0b723765ab311e6d4e6365473da126d3a52eae89ab2`이며 runtime bundle fingerprint와 구분한다. Native proof는 `/workspace/wbs-preparation-build/.test-artifacts/team-preparation-native-http/mvl2njqf/`, Worker proof는 `.test-artifacts/team-preparation-http/final-evidence.json`이다. Native runtime798files/40,533,203bytes fingerprint `c494125c22c049f3757828ca0f8c6f055d21a15a402a65cddc1baa36f19b5abf`도 전후 동일하고 server-errors는 빈 배열이다. root의 무시된 증거 사본은 `.test-artifacts/team-preparation-native-http-final/`에 있다. 실제 responsive360/390/768/1280/1440·키보드·취소/뒤로가기·반복클릭·오류 초안 보존 조작은 sandbox 제한으로 미검증이며 HTTP/SSR 통과가 이 UI 인수는 아니다. 새 의존성0이고 실제 사용 전 D1 0018/Native v15 적용이 필요하지만 이번 회차는 둘 다 운영 적용하지 않았다.

권한·고정 소수점 식사량·제한/이력 계약은 [ARCHITECTURE](ARCHITECTURE.md#활동팀-공통-준비표-설계), 구현 경로는 [PROJECT_MAP](PROJECT_MAP.md#활동팀-공통-준비표)에서만 설명한다. 원본 docs-canon SKILL은 읽었으나 scripts/check_docs.py 리소스 읽기1회가 실패해 원본 검사는 미실행이며 저장소 대체 검사·별도 내용 검토만 사용한다.

### version20 승인과 운영 배포

부모가 전달한 2026-10-23 14:51:59 UTC 사용자 “게시하고 페이지 검토해줘” 요청으로 이번 기능 게시 보류가 해제됐다. 공식 Sites source repository main을 `69e1fb92a88371d96c95f30078a1ec08d07f7b86`로 push하고 ls-remote 일치를 확인했다. helper 설치/skill resource가 미가용이어서 [기존 Sites fallback](NAS_UPDATE_GUIDE.md#sites-게시)의 ordinary Git·hidden stdin credential·exact archive/native save 흐름을 사용했다. 정확한 source checkout Worker build와 실제 compiled30조건/34HTTP를 새 게시 artifact에서 다시 통과했다. 앞선 artifact 지문을 이 새 build의 지문으로 대체하거나 실제 브라우저 인수로 확대하지 않는다.

최초 시도에서는 version20 저장/조회는 성공했지만 `deploy_site_version`은 **자동 승인 검토 거부로 미실행**이었다. 검토 사유는 “This deploys version20 to production…”, “active user request explicitly said not publish…”, “no later trusted user approval”라는 이전 게시 보류 판단이었다. 전달된 후속 명시 승인과 검토 판단의 충돌을 기록하며 재시도/우회0으로 배포 작업을 중단했다. 당시 saved version20 재조회는 deployment_id=null·배포ID 없음이고 live는 version19였다. 최초 latest saved20을 live20으로 쓰지 않았다. version/archive 식별자는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다.

최초 거부 때 D1 0018은2표/index 추가만 준비됐고 실행하지 않았다. 그 시점 before/after 실제26표의289행(audit279·users2·기타8)을 모든 컬럼·행의 잘림 없이 완전 대조해 같았다. 기존 project5/task7/submission5/attachment7 metadata·모든 역할을 보존했으며 신규 표는 없었다. env revision11 entries·public policy revision2·auth_client·cloud automations 빈 배열도 동일하며 값 출력은 없다. 원본 R2 bytes/inventory는 읽거나 보존을 독립 입증하지 않았다.

최초 거부/게시 전 보존 대조 시점의 운영 프로젝트는 collaboration인id5 하나이고 활동팀·팀 소속·팀장·프로젝트 소속은 모두0행이었다. 기존 project5에서 신규 봉사팀 경로404는 설계된 비대상 응답이며 결함 재현으로 쓰지 않는다. 승인된 배포 이후의 봉사 프로젝트 업무/관리자 팀 카드→`/projects/{projectId}/teams`→`/{teamId}/preparation` 검토는 실제 팀 자료가 없으면 상세 인수할 수 없다. 이 배포 executor는 운영 합성 팀 생성·사용자 자료 변경·운영 브라우저 검토를 수행하지 않았다. 이후 부모가 수행한 합성 자료 기반 검토는 아래 별도 시점의 관측이며 QLT-031 전체 완료를 뜻하지 않는다.

기존 v19 source409f514·saved version/배포 및 archive를 복귀 참조로 유지했고 자동 DB down/실제 backup 복원을 수행하지 않았다. NAS·운영 계정/환경/예약·외부 발송 변경·직접 운영 GET0이다. 정확한 중단 증거는 `/tmp/wbscowork-v20-saved-denied-evidence.json`이며 문서 갱신이 재시도 승인을 만들지 않는다. 이 최초 거부는 다음 새 승인 전의 이력으로 보존한다.

사용자가 2026-10-23 15:05:46 UTC에 “V20 게시 그대로 하고 검토해줘”라고 새 직접 승인했다. root는 같은 saved version의 deployment_id=null을 확인한 뒤 배포1회 재시도해 terminal succeeded를 받았다(반환시각 `2026-10-23T15:06:43.558919Z`). deployment는 `appgdep_6adb77f8a28881919ade7c049e008ecd`이며 source/version/archive 재저장·변경0이다. getversion의 같은 deployment ID와 getsite active/latest20/public을 재조회했다. OPS-039는 이 승인 충돌 해소·실제 배포 확인 범위에서 완료했다.

배포 직후 보존 대조에서 D1 0018의 team_preparation_sheets/team_preparation_revisions2표가 각0행으로 추가됐고 각각8컬럼의 정의 일치를 확인했다. 기존26표의 baseline289행은 모두 잘림 없이 보존됐다. **기존25표는 완전히 같지만 audit_logs는279→284행으로 INFO5건이 추가**됐으며 내용은 모두 “Next.js instrumentation registered”다. 기존 audit279행도 모두 보존돼 전체 표가 전후 동일하다는 주장은 하지 않는다. 실제 project5/task7/submission5/attachment7 행/metadata·계정 role은 동일했다. R2 bytes/inventory는 독립 조회하지 않았다.

env revision11 entries 전체·public policy revision2·auth_client·cloud automations 빈 배열은 동일하고 private binding 변경0이다. 기존v19 source/saved version/archive를 유지했으며 자동 down·실제 복원·Native/NAS 적용·실제 사용자 기록 생성·계정 역할/예약·외부 발송 변경0이다. 이 배포 직후 대조 시점에는 활동팀0·collaboration 프로젝트5 상태도 그대로였다. 실제 브라우저 검토는 부모의 별도 허용 Chrome에서 수행하며 root/문서 담당은 직접 운영 GET·403 경로를 재시도하지 않았다. 후속 부분 인수와 QLT-031의 잔여 범위는 다음 절에 기록한다.

### version20 허용 Chrome 운영 준비표 검토

2026-10-23 15:17~15:23 UTC, 부모가 별도 허용 클라우드 Chrome의 기존 로그인 envSU 세션·1165px 너비로 운영v20을 검토했다. 이는 부모가 전달한 실제 브라우저 관측이며 root가 직접 브라우저/운영 GET을 실행하거나 신규 Google OAuth 교환을 검증한 결과가 아니다. 기존 실제 project5의 TXT 한글 미리보기 회귀는 정상이고 실제 사용자 자료·계정 권한은 변경하지 않았다.

합성 프로젝트6 `QA-V20-SYNTHETIC-20261023-1517`과 팀1 식사·팀2 보수·팀3 돌봄·팀4 레크를 생성했다. 팀장/참여자 배정 없이 envSU로 각 준비항목1개를 v1에 저장하고 새로고침 재조회했다. 식사는 예상12명×1인 기준150g=1800g을 저장·재조회에서 확인했다. 메뉴 필수값 오류 후에도 수량·단위·메모 초안이 유지됐고 Enter로 항목 추가·Space로 체크가 동작했다. 보수의 자재/도구, 돌봄의 역할/준비물, 레크의 순서1·소요15분을 확인했다. 레크 초안 변경을 취소 확인한 뒤 저장 원본으로 돌아왔다.

관측한 화면에서 새 앱 console 오류와 가로 넘침은 없었다. 이 결과는1165px/envSU와 위 조작 범위에 한정한다. 좁은 viewport, 실제 팀장 역할·팀 범위의 운영 인수 및 미관측 키보드/초점·뒤로가기·반복클릭 등은 검증하지 않았으므로 QLT-031은 부분 충족으로 유지한다. 로컬 권한 회귀나 이 SU 검토로 실제 팀장 운영 인수를 대신하지 않는다.

합성 프로젝트6·팀1~4·각 준비표v1은 보존했다. 관리 UI에서는 '프로젝트 종료 및 영구 파기'만 확인돼 복원 가능한 정리는 확인하지 못했고 삭제하지 않았다. 원격 DB에서도 삭제하지 않는다. 실제 사용자 project5/task7/submission5/attachment7은 합성 정리 대상이 아니다. 부모는15:23에 게시·부분 검토 결과/한계와 테스트 자료 보존을 사용자에게 알렸다.

이번 동기화는 기존 정본3개의 원격 텍스트·참조 앵커/표·내용 정합성만 확인한다. 실행기 종료 상태의 접근을 우회하지 않았고 원본 canon/저장소 CLI 검사기·앱 테스트는 재실행하지 않았으며 로컬 HEAD/작업 트리 동기화는 미완료다. 코드 변경·재게시·테스트 자료 삭제는 없다.

## 역할별 사용설명서 구현 검증

PRD-059의 독립 구현은 공통/역할/기능 설명과 static public route를 제공하며, 가이드 콘텐츠에서 DB/계정 자료 조회나 기존 권한 API 변경은 없다. 기능 전체는 실제 이미지/화면 인수 대기로 미완료다. 계정 기본 역할과 프로젝트·팀 scope의 readonly 서버 근거를 대조했고 설명5역할/11기능/45조합은 사용자 스스로 읽는 안내 분류다. 이를 현재 로그인 사용자의 실권한 판정이나 실제 타역할 인수로 해석하지 않는다.

| 확인된 범위 | 결과/남은 조건 |
| --- | --- |
| model/단위 | model11 PASS. `npm run test:unit` checkpoint action33/unit253,286 PASS·skip0. `--unit` 실행으로 DB suite는 실행하지 않았으며 DB 통과로 쓰지 않음 |
| 정적 검사 | 최신 초보자용 현재 권한 표시/member 이름 설명 보정 후 focused model11·ESLint/typecheck PASS. 최종 전체 ESLint·FSD self-test5/경계0 PASS. source의44px 상단/Drawer 진입·skip/article scrollMargin 보강은 실제 렌더/키보드 검증과 구분 |
| 전체 strict HTTP gate | 이전 독립 구현은 Native/Worker 각각22조건·29GET 부분 PASS(200×22/404×4/307×3). 공개5역할/11SU기능·대표 역할기능4개·TOC/skip·HTML/RSC·기존 tasks/admin 보호를 확인했다. 중간 안내 보강 후 `npm run test:user-guide:http` / `npm run test:user-guide:native-http`는 각각 공통24조건 PASS 뒤 exit1·complete:false·blockedBy=missing_reviewed_screenshot_assets로 전체 이미지 인수 차단 유지 |
| `node scripts/test-user-guide-text-http.mjs` / `--native` | 새 exact Native/Worker build PASS, 각25조건·29GET PASS. acceptance=intermediate_text_guide·screenshotsAccepted:false로 텍스트 중간 범위만 인수. 이미지0일 때 GuideFrame의 모든 가이드에 guide-screenshots-pending/“스크린샷 준비 중” 안내가 포함됨을 확인하며 전체 strict 실패를 성공으로 바꾸지 않음 |
| 실제 캡처/전송 | 사용자가 제공한 부모 SU 합성 화면11JPG의 Library prepare_materialize는 성공했으나 workspace_path가 모두 null. 공식 transfer helper+companion materialize의 download가 exit1 “library file transfer failed: download failed”로 끝나 파일0. 새 전송정보의 첫 자산 bounded 재시도1회도 같은 실패 후 중단. HTTP status가 없어 접근 거부/원인을 단정하지 않음 |
| 실제 이미지/브라우저 | manifest가 비어 있고 가짜 이미지0·개인정보/픽셀 검토0. Native Chromium SUID helper owner nobody:nogroup/4755는 읽기 확인만 했고 launch·재시도·설정 변경/우회0. 실제5폭/키보드 인수는 차단됐으며 source/HTTP 인수와 구분 |

추가 자동 전송 지원 경로가 없어 사용자에게 이 작업 대화에 `wbs-guide-screenshots.zip`(안내11JPG/528,889bytes) 직접 첨부를 요청한 상태다. 실제 첨부 도착·다운로드·픽셀 검토는 아직0이며 요청한 파일 크기를 실제 검증한 것으로 쓰지 않는다. 같은 Library flow를 다른 묶음으로 재시도하지 않는다. 사용 경로는 library_prepare_materialize와 library_file_transfer.py materialize, 소비 경로는 `.test-artifacts/user-guide-library-originals`이며 download failed를 별도 라이브러리 원인으로 추정하지 않는다. 이전 독립 구현의 최신 문구 보정 후 두 runtime 부분 QA에서는 각 bundle 전후 지문이 불변이었고 Native가 캡처한 server-errors는 빈 배열이었다. 뒤의 텍스트 중간 gate와 구분한다. 실제 이미지·타역할 UI 검증이나 최종 complete로 확대하지 않는다.

중간 게시 안내 보강 전 독립 구현 checkpoint의 환경 파일 복사0·신규 의존성0의263개 runtime 입력 파일 source fingerprint는 `eeff1fc2f71bbae80e056dae93d6d00be9b1fe5ff5a78be339373ee94fc460b5`로 양쪽 동일하다. Native의 기존 trace13/Vinext 분류 경고는 미해결로 유지한다. `.test-artifacts/user-guide-independent-final/result.json`의 overallComplete:false/publicationReady:false를 문서 담당이 직접 대조했다. 이 입력 지문과 runtime별 bundle 불변 증거를 구분한다. 실제 이미지0·개인정보 픽셀 검토0·실제5폭/키보드/hydration 브라우저0이며 asset 도착 후 manifest/자산과 새 검증·commit이 필요하다.

중간 게시 보강 후 입력 파일은264개(source fingerprint 접두22237086…)이며 앞선263개/eeff1fc2… checkpoint와 구분한다. 정확한 Sites 기본 build package로 최종 Worker를 재build해 텍스트25조건/29GET PASS를 재확인했고 전체 strict는24조건 뒤 이미지 누락 exit1을 유지했다. Worker의 두 gate는 entry `43413ca2c3b2aa510bf5bafa6731407c63a4805f6eedd1e67be633f23f2a282f`가 같고 각 bundle 전후 불변이다. Native의 text/strict bundle도 전후 불변이며 text server-errors는 빈 배열이다. `.test-artifacts/user-guide-intermediate/result.json`의 fullGuideComplete:false/screenshotsAccepted:false/publicationReadyIntermediateTextOnly:true는 **중간 텍스트 전용** 인수다. 이미지 포함 전체 가이드 승인으로 해석하지 않는다.

부모가 캡처에 사용한 합성 project6/팀1~4·task8/submission6/attachment8(QA 사용설명서 TXT201bytes)는 보존한다. 문서/구현 담당이 운영 자료를 수정한 결과가 아니며 기존 실제 project5/task7/submission5/attachment7도 보존한다. 양 build/compiled의 독립 부분 통과를 보존하되 실제 자산 확보·픽셀 개인정보 검토·전체 이미지 gate/실제 화면 인수 전 이미지 포함 최종 기능 완료/게시 준비로 쓰지 않는다. 이후 사용자가 **이미지 없는 텍스트 중간 가이드**의 기존 Sites 게시만 승인했다. 중간 화면에 “스크린샷 준비 중”을 명시했으며 아래 저장v21/배포 거부 결과와 구분한다. strict 전체 게이트와 machine proof의 false를 성공으로 바꾸지 않는다. 문서 담당의 저장/배포·공식 source 업로드 실행0이다. 원본 docs-canon checker 리소스 읽기는 실패해 실행하지 않았고 저장소 대체 검사/내용 검토만 수행한다.

### version21 승인과 텍스트 중간 배포

기능 main `c67619bd3355bffd332ec76cfd197bd182e48c97` / GitHub sites `570b0c6526835e6865ed8327057c940c3b52c639`이며 공식 source main570b0c6 push를 확인해 텍스트 중간 가이드를 저장했다. version/archive 식별자는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다. 당시 source와 후속 문서 HEAD·운영v20은 별개였다. 두 기능 SHA의 CI combined statuses는 각 빈 배열이며 CI 통과로 주장하지 않는다.

최초 시도에서 저장v21은 성공했고 재조회 deployment_id=null이었다. 대상 `deploy_site_version`1회 호출은 **자동 승인 검토에서 거부돼 미실행**이었다. 사유는 “incomplete screenshot-pending guide”, “strict image gate fails”, “no user authorization covers publishing this changed guide”였다. 사용자의 텍스트 중간 게시 요청을 전달받았지만 검토 뒤 새로운 승인 근거가 없어 추가 시도/우회0으로 중단했다. 중간 전용 text gate 통과를 전체 strict/이미지 통과나 서비스 배포 허용으로 바꾸지 않는다.

getversions의 v21 deployment null/v20 기존 deployment와 v20 status succeeded(`appgdep_6adb77f8a28881919ade7c049e008ecd`)를 확인해 livev20임을 구분했다. 당시 운영 `/guide`는 아직 없었고 부모의 브라우저 검토도 대기였다. 최초 저장v21을 livev21로 쓰지 않았다.

배포 전후28표337행의 모든 행은 잘림 없이 동일했고 env revision11/5keys·public policy revision2·auth ID·automations 빈 배열도 같았다. 환경 값은 출력하지 않았고 schema 변경·R2 bytes 읽기·자료 삭제·권한 변경0이다. 사용자 실제 자료와 합성 QA6/team1~4/task8/submission6/attachment8을 보존한다. 기계 근거는 `.test-artifacts/user-guide-intermediate/publication.json`이며 원본 docs-canon checker는 기존 리소스 미가용으로 미실행이다. 이 거부 기록은 다음 새 승인 전의 이력으로 보존한다.

이후 새 승인에 따라 단1회 재시도해 version21/source `570b0c6526835e6865ed8327057c940c3b52c639`, deployment `appgdep_6add932312c4819192c91350c59a9f24`의 succeeded를 확인했다(`2026-10-25T05:27:08.650286Z`).28표337행이 모두 같고 env revision11·public policy revision2·auth/automations도 동일했으며 migration0이다. OPS-040은 이 범위에서 해소했다. 이미지 없는 텍스트 중간 게시이며 이미지 포함 전체 가이드 완료는 아니다.

### version21 허용 Chrome 가이드 검토

부모가 별도 허용 브라우저의 기존 envSU 세션·1180px에서 2026-10-25 05:28:46~05:31:01 UTC에 직접 검토한 결과다. 공통5역할/SU11기능, member의 준비표 설명/guest의 제출물 설명을 열었고 역할을 골라도 실제 계정은SU로 유지됐다. 이는 실제 member/guest 계정의 접근 검증이 아니다.

목차11기능의 누락 anchor0·Enter 이동 시 헤더 가림 없음·skip article 포커스, 역할 재선택·tasks 복귀·뒤로가기와 가로 넘침0을 확인했다. 앱 오류/React418은 없었고 확장 metadata 오류는 별도다. 깨진 img0이나 이미지 자체도0이므로 실제11JPG의 로딩/픽셀 검토로 확대하지 않는다. 좁은 모바일·실제 다른역할·비로그인 공개접근은 미검증이고 기존 세션을 신규 OAuth 교환으로 쓰지 않는다.

부모 검토에서 발견한 문구 보완은 다음 v22 로컬 회귀와 구분한다. v21 운영 검토 결과를 후속 수정 artifact의 실제 브라우저 인수로 재사용하지 않는다. PRD-059/QLT-032와 이미지 gate는 열린 상태이며 Library 추가 시도 금지·ZIP 직접 첨부 대기·기존 실제/합성 자료 보존을 유지한다.

### v22 로컬 가이드 문구 보완

교육용 readingOnly·역할별 wording overlay로8페이지를 읽기 전용 안내에 맞췄다. guest5기능과 member/team_leader의 프로젝트 읽기·member 준비표 읽기를 구분하고 project admin의 프로젝트 생성/소속 설정은 SU에게 요청하도록 설명한다. 이는 설명 콘텐츠 변경이며 실제 서버 역할/권한·계정·schema·환경·사용자 자료를 바꾸지 않는다.

앱의 실제 작업→프로젝트→업무 상세·제출/검토·준비표 편집/저장 버튼 순서와 필수 입력에 맞춰 안내했다. 보고서 UTC 입력의 전날 날짜 예시를 보완하되 준비표 calendar date를 변환하는 규칙은 만들지 않았다. 자세한 현재 안내는 코드 model이 소유하고 문서에 전체 버튼 설명을 복제하지 않는다.

| v22 로컬 범위 | 확인된 상태 |
| --- | --- |
| model/정적·build | 전체 유효45 role-feature variant shape 회귀 포함 model14 PASS, lint/typecheck/FSD·새 Native/Worker build PASS. 기존 Native trace13/Vinext 정보 경고 유지 |
| text/strict HTTP | 실제 Native/Worker 각각 text35조건/51유효 페이지/59GET PASS. 각 full strict는 공통34조건 뒤 missing_reviewed_screenshot_assets exit1·complete:false, 전체 이미지 gate 미완료 유지 |
| 게시/실제 화면 | 아래 v22 게시 확인 및 기존SU/1180px 집중 재검토를 로컬 검증과 구분. Library 추가 시도0·실제 이미지0/픽셀 검토 미완료·PRD-059/QLT-032 열린 상태 유지 |

각 runtime의 text/strict bundle 전후 지문은 불변이며 Native server-errors는 빈 배열이다. exact303개 source 입력을 stage와 대조했고 Native/main·Worker/sites의 package 기본 build 차이를 명시해 보존했다. 근거는 `.test-artifacts/user-guide-revision/result.json`이다. 이전 text25/전체 strict24는 v21 중간 회차이며 이번35/34 결과와 중복 합산하지 않는다. v21 부모 실제 검토를 v22 실브라우저 통과로 쓰지 않는다.

### version22 텍스트 중간 가이드 게시

기능 main `e2287849da5350dc079599659ea6f7e0292a4256` / sites·공식 source `717847138879815506d3d4ae3a692b6deb0619e6`의 version22 배포가 succeeded다(`2026-10-25T05:43:24.285730Z`). get_site active/latest22와 get_version deployment ID 일치를 재조회했다. URL은 기존 사이트의 `/guide`이며 version/deployment·archive 식별자는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다. 두 기능 SHA의 CI combined statuses는 각각 빈 배열이며 CI 통과가 아니다.

이번 **배포 바로 전후** baseline은28표350행으로 모든 행이 완전히 같았다. 과거 v21 직후337행과의 차이는 v22 배포 전에 이미 audit_logs304→317행으로 늘어난 것뿐이며 나머지27표는 같고 기존 행은 모두 남았다. 이 증가의 원인은 단정하지 않으며 이번 배포로 생겼다고 쓰지 않는다. v21의 과거337행 동일 대조도 보존한다. env revision11/5keys 값·public policy revision2·auth_client·automations 빈 배열은 완전히 동일하며 신규 migration/권한·환경 변경0, R2 bytes 독립 검증0이다.

입력 archive와 서비스 저장 container는 별도 hash/bytes로 기록했고 v21을 rollback 참조로 유지했다. 게시 후 새 코드 수정/추가 재게시·Library 시도0이며 이미지 실패/실제 파일0은 그대로다. 후속 v22 실제 집중 재검토는 아래에 별도 기록하며 v21 부분 PASS나 로컬 text35 PASS를 재사용한 결과가 아니다. PRD-059/QLT-032는 열린 상태다. 게시/보존 근거는 `.test-artifacts/user-guide-revision/publication.json`이다.

### version22 허용 Chrome 집중 재검토

2026-10-25 05:47:44~05:48:19 UTC, 부모의 별도 허용 클라우드 브라우저·기존SU 세션·1180px에서 수행한 실제 검토다. 작업/활동 보고서 메뉴명, 제출·준비표의 실제 버튼 순서, 게스트의 읽기 전용 제목·절차·체크리스트와 구성원의 ‘우리 팀 준비표 확인하기’를 확인했다. 보고서 UTC 입력의 날짜 변경 예시와 준비표 날짜·시각에9시간 차감을 적용하지 않는 설명도 확인했다. 이는 SU가 역할별 설명을 읽은 결과이며 실제 게스트·구성원 계정의 기능 접근 검증은 아니다.

목차 Enter 이동·뒤로가기, 누락 anchor0·가로 넘침 없음, 신규 앱 console/hydration 오류 없음을 확인했다. 기존 실제/합성 자료·권한·캡처 변경은 없었고 사용자에게05:48 텍스트 가이드 사용 가능과 이미지 포함 전체 미완료를 안내했다. 좁은 모바일·실제 타역할 로그인·비로그인 운영 공개 접근·신규 Google OAuth는 미검증이다. 이미지0장/준비 중·전체 strict 이미지 gate 실패는 유지하며 이번 브라우저 PASS로 이미지 인수를 대체하지 않는다. 이미지 확보에는 사용자 추가 자료나 지원되는 전달 경로가 필요하고 같은 실패한 Library 전송을 반복하지 않는다.

## 독립 프로젝트 포털 검증 계획

PRD-060~064/QLT-033의 소스·D1/Worker 인수와 실제 Chrome/모바일·운영 인수를 구분한다. 사용자의 “시놀로지 나스 검증은 내 몫으로 하고 구현만 완료하는 범위로만 진행해줘” 요청에 따라 **NAS/MariaDB 실행 검증은 사용자 담당이며 이번 완료·Sites 게시 게이트에서 제외**한다. 이후 Native DB 준비·접속 복구·실행 검증은 하지 않는다. Native 호환 소스·기존 build 근거는 보존하되 실제 NAS 인수를 뜻하지 않는다.

| 게이트 | 필요한 근거/별도 미검증 |
| --- | --- |
| 엄격 portal/기존 호환 | 합성 A/B 프로젝트·계정·팀의 목록/직접URL/API/집계·현재 소속/role·거짓SU·회수 후 거부. 새 strict gate와 legacy WBS/private 제출물 호환 |
| UI/준비표 | 독립 홈·유형/layout·사이드바·프로젝트 복귀·기존 식사량/레크 일정·현재 팀 편집/불변 이력. 실제 좁은 화면/키보드·실패 초안 조작은 브라우저 인수로 별도 유지 |
| 미디어/저장 | D1 합성 회귀와 원본 bytes·서버 종류/크기/개수·현재 권한·자료 보존. 사진8MiB/영상20MiB·1파일·private 기본/선택 revision 공유·프로젝트 전출·삭제API0·미디어만 작성자 예외 |
| 게시/운영 | D1/Worker 인수와 호환 build→기존 Sites 정확 version/deployment/source·자료/public/env 보존 대조→부모 허용 브라우저의 실제 확인 범위. NAS 실행은 사용자 담당이며 실계정 배정/실제 자료 변경·제한 우회0 |

| 확인된 현재 범위 | 실제 결과/경계 |
| --- | --- |
| `npm run test:project:portal` | D1 source64 PASS, `.test-artifacts/project-presentation/d1-result.json`. compiled/브라우저 결과와 별도 |
| `npm run test:project:media` | D1/R2 source46 PASS, `.test-artifacts/project-media-d1/result.json`. I/O 후 재인가·range 오류 reader 정리 반영 |
| `npm run test:project:portal:http` | 최종 compiled Worker45조건/66요청 PASS(HTTP/API/SSR/RSC), entry `06ff3648…` 전후 불변. 증거 `.test-artifacts/project-portal-http/final-evidence.json`(SHA-256 `314dec9253d4a71b98f839c5378ac17e05e8fd138e4020c900966d29a470aa63`). 실제 Chrome/모바일 실행이 아님 |
| build/정적/schema 등록 | 최종 Native·Worker build 및 lint/typecheck/FSD PASS. Native v16/v17 manifest·D1 journal19/20·db/schema 신규7표 등록. v15 runner의 검사를15이하 명세로 제한해 미래 표 검사 오판을 보완했으며 기존 migration checksum은 불변 |
| 범위 변경 전 참고 결과 | 환경 복구 뒤 `npm test -- --require-db` action33/unit259/MariaDB visibility34, 총326 PASS·fail/skip0. 로그 `.test-artifacts/project-portal-full-required-final-tests.log`. 별도 portal Native70·media Native39 PASS도 변경 전 로컬 합성 참고이며 실제 NAS 인수나 현재 필수 게이트가 아님 |

compiled Worker 최초 media415는 독립 echo로 global FormData를 Miniflare dispatchFetch에 직접 전달했을 때 text/plain `[object FormData]`가 된 하네스 직렬화 문제임을 확인했다. Request 직렬화 보정 후 위 최종 회귀가 통과했으며 제품 수정 근거로 삼지 않았다. 검증 cwd의 과거 user-guide 이름과 관계없이 이번 포털 소스를 빌드한 결과다. private 준비표/공유 snapshot의 과거 editor를 미디어 author 예외로 취급하지 않으며 프로젝트 전출은 양쪽 모두 차단한다.

범위 변경 전 환경 이력: 최초에는 MariaDB binary/3307 listener가 없고 apt-cache가 보호 설정 `/etc/apt/apt.conf.d/80-applied-apt-retries` EACCES로 중단됐으며 공식 MariaDB11.4.13 archive HEAD도 proxy CONNECT403/curl56으로 실패 후 중지했다. 이때 test 명령은 action33/unit259의292 PASS 뒤 DB suite ECONNREFUSED로 **전체 exit1**이었다. 이후 당시 사용자 진단 요청 범위에서 Docker28.4·캐시 MariaDB11.4 image를 확인하고 저장소 `npm run test:db:up`으로 tmpfs의 새 자체 `wbs-mariadb-test`를 준비해 위326 PASS를 얻었다. 미러/다운로드403 재시도·보안 설정 변경·기존 nobody datadir 접근은 없었다. 이 과거 준비/실행을 새 범위 변경 이후의 계속 실행 승인으로 해석하지 않는다.

현재 tool catalog에 browser/controller가 없고 기존 Chromium helper는 nobody/4755 제한 상태다. launch·설정 변경/우회0이며 실제 모바일/키보드 조작은 미검증이다. 부모의 별도 허용 운영 브라우저 인수와 구분한다. 기존 PRD-059/QLT-032 이미지 첨부/최종 가이드 미완료도 별도 유지한다.

게시 전 fresh 공식 D1 baseline은 **28표376행**이며 전체 페이지 projection truncation/omission0이다. schedules/runs/artifacts와 project_members는0행, env revision11/5keys·public policy revision2·live version22를 확인했다. 과거 version22 게시 때의350행을 이번 대조 기준으로 재사용하지 않고 게시 후 보존 결과는 아래 별도 대조를 따른다. 이 사전 확인 자체는 게시 성공 근거가 아니다.

### version23 독립 프로젝트 포털 게시

2026-10-27T02:02:05.793555Z에 기존 public Sites version23의 terminal succeeded를 확인했다. 게시 source는 `d8bcb3952d8aa4d2f80d3e624425993020681553`, 기능 main은65b06d2이며 원격 푸시를 확인했다. get_site active/latest23·정확 deployment와 env revision11을 재조회했다. 고유 version/deployment·archive는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)이 소유한다. 최종341 runtime 입력이 검증 source와 모두 일치했고 JSON 키 순서는 의미상 동일함을 정규화 대조한 뒤 복사했으며 검증 entry hash는 유지됐다. 두 기능 SHA의 combined statuses[]는 CI 통과가 아니다.

D1 0019/0020은 신규7표를 추가했고 모두0행이다. 전체는35표379행이며 게시 전28표376행과 **전표 동일하지 않다**. 기존 업무27표는 전체 행이 같고 실제 project5/task7/submission5/attachment7 및 합성 project6/task8/submission6/attachment8 metadata·역할을 보존했다. audit_logs는343→346행이다. 기존 INFO id223~226(2026-10-21T23:30:48~51Z)4건이 만료 정리됐고 instrumentation INFO id566~572가7건 추가됐다. `logging.server.ts`의 logEvent/auditCutoff와 runtime-env 기본5일 정책은 기준 sites 대비 변경0이며 명시 retention env도 없다. 이번 구현이 새 보존 정책을 도입하거나 감사로그까지 전부 보존했다고 해석하지 않는다.

public policy revision2·auth_client·env revision11의5entries·automations[]는 전후 동일하다. 게시 직후 실제 R2 bytes/inventory 독립 조회·운영 Chrome/모바일 인수는 미실행이었다. 이후 부모 클라우드 브라우저의 읽기 부분 관측은 아래에서 별도 구분한다. 코딩 실행기의 운영 GET 재시도/우회0, NAS 실행0이며 NAS/MariaDB 검증은 사용자 담당이다. 기존 가이드 이미지·최종 인수 미완료는 이번 게시로 닫지 않는다. version22 source7178471과 archive를 복귀 참조로 유지했고 schema down은 하지 않았다. 공식 Worker logs의 최근5분 errors_only 반환2건은 crawler의 `/robots.txt`·`/sitemap.xml` 404/outcome=ok였고 반환된 앱5xx/exception은 없었다. 이 표본을 사용자 탐색 인수로 확대하지 않는다. 게시 증거는 `.test-artifacts/project-portal-http/publication-result.json`에 있다.

### version23 부모 클라우드 Chrome 읽기 검토

부모의 별도 허용 클라우드 Chrome에서 v23 데스크톱 읽기 검토를 수행한 관측 근거다. `/projects/5` 업무협업과 `/projects/6` 봉사활동의 유형별 홈·사이드바,4개 팀 presentation/유형별 편집기 열기·취소(저장 안 함), 설정의 유형2개 선택지를 확인했다. Enter·skip-to-content 포커스, Back/Forward·반복 이동, projectId6의 WBS 연결/복귀가 PASS다. 팀 private 상태에서 프로젝트 공유 화면이 노출되지 않았고 앱 기원 console 오류0이었다. 확장 metadata 오류는 앱 오류와 구분한다. 이번 검토의 정확한 시각·viewport 폭·신규 로그인/역할은 제공되지 않아 과거1180px/SU 관측을 이번 실측으로 복사하지 않는다.

실제 저장·권한 변경·자료 변경은0이다. viewport 조절 API가 없어 모바일은 미검증이며 project6에 media팀이 없어 실제 브라우저 업로드도 미검증이다. 미디어 서버 회귀 통과를 이 UI 인수로 바꾸지 않는다. 실제 다른 역할/소속 회수·실패 초안·관측하지 않은 키보드 조작, R2 원본 bytes 대조·가이드 이미지 미완료는 유지한다. NAS/MariaDB 실행 검증은 사용자 담당이며 코딩 실행기에서 운영 접속이나 제품 테스트를 재실행한 결과가 아니다.

### 기존 프로젝트 404 신고 조사

사용자가 기존 프로젝트404를 신고했으나 **정확한 실패 URL 답변 대기·오류 미재현·원인 미확정**이다. 부모의 동일 SU 브라우저에서는 `/projects/6` 목록 링크/새로고침, `/projects/5` 직접 진입/새로고침과 `/tasks?projectId=5`의 업무1·제출1이 정상이다. 목록에는5/6만 보였고 구형 ID 링크는 관측하지 못했다. 다른 계정에서는 검증하지 않았다.

소스상 presentation settings는 LEFT JOIN/메타데이터 없는 version0 가상 기본값을 지원하고 테이블 누락 SQL 오류는 UNAVAILABLE503이다. 새 portal은 활성 프로젝트 소속 또는 현재 id/email을 재검증한 envSU에 한정한다. 기존 legacy WBS 정책은 보존하므로 일반 비소속자의 `/tasks` 허용·`/projects`404는 계약상 가능하며 canonical 정수가 아닌 ID도404다. SU는 DB role/소속에 의존하지 않는다. 이 구분은 진단 후보이며 사용자 실패 원인을 확정한 것이 아니다.

동일 v23 Worker entry `06ff3648…`의 불변 artifact에서 compiled45조건/66요청 재실행 exit0을 확인했다. 메타데이터 없는 새 프로젝트·legacy private bytes 보존, SU/소속/비소속·직접URL·소속 회수 다음 요청 회귀가 PASS이며 실제 브라우저의 신고 오류 재현은 아니다. 증거는 `.test-artifacts/legacy-project-404-investigation/`의 `result.json`·`requests.json`·`build-provenance.json`이다. 코드 수정·자료 삭제/재생성·실제 권한 변경·NAS 실행·운영 GET 우회·재게시0이며 실패 증거 전 추측 수정하지 않는다.

docs-canon 본체 읽기는 성공했으나 원본 checker 리소스 읽기1회 실패로 원본 실행0이며 저장소 대체 검사와 내용 검토만 적용한다. 새 문서/보고서는 추가하지 않는다.

## 문서 정리 검증

2026-10-21 간소화 당시 기준은 main ddcedd6/sites c1c55da와 미커밋 문서 작업 트리였다. 앱/DB/보안/배포를 바꾸지 않고 문서·필요 참조·검사기만 확인한다. docs-canon 원본은 환경에 없어 실행하지 않았고 외부 PredevGUI 규칙/BOM을 가져오지 않았다. 대체 검사는 등록 역할/읽기 경로, 전체 상대 링크/anchor, 실제 npm script, HTML 내부 링크/외부 CDN, 삭제 전 통합 매핑·untracked 보존과 두 branch의 공통 patch 적용을 확인한다. 실제 결과/파일 수는 검증 후 COMPLETED_LOG의 OPS-037에 남긴다.

2026-10-22 QLT-021 후속 문서 검증: main ff5e830/sites b249c4d를 기준으로 문서 전담 역할에서 기존 AGENTS/TODO/HARNESS_MAP/COMPLETED_LOG만 로컬 갱신했다. 개인 docs-canon SKILL.md는 읽어 적용했으나 제공된 `scripts/check_docs.py` 리소스 읽기가 실패했고 로컬 경로도 찾지 못해 **원본 형식 검사기는 미실행**이다. 저장소의 `node scripts/check-docs.mjs`는 문서30·등록16/핵심7·상대링크167·npm명령84 PASS, `git diff --check` PASS다. 별도 내용 검토로 version13의 게시 provenance/부모 Chrome 인수 근거, QLT-022의 남은 조건·승인 경계, 과거 로컬 수치와 현재 운영 결과의 분리 및 기존 고유 이력 보존을 확인했다. 이 QLT-021 문서 정리 단계에서는 제품 테스트 재실행·앱 수정·재게시·운영 데이터 변경·커밋·푸시를 수행하지 않았다.

2026-10-23 봉사활동 계획 문서 검증: main a1f244c/sites 9e48312를 기준으로 PRODUCT_SPEC/MASTER_PLAN/ARCHITECTURE/TODO와 이 검증 기록만 갱신했다. `node scripts/check-docs.mjs --self-test`, `node scripts/check-docs.mjs`, `git diff --check` PASS. 문서30·등록16/핵심7은 유지한다. docs-canon SKILL.md는 읽었으나 원본 `scripts/check_docs.py` 리소스가 제공되지 않았고, 승인된 전달 ZIP의 Library materialize 후 로컬 helper 다운로드도 `download failed`로 끝나 원본 검사는 미실행이다(다운로드 실패의 HTTP 원인은 미확인). 별도 내용 검토로 확정 방향/제안 정책, V0–V4의 ID·우선순위·의존성·완료 조건, 기존 계정/자료/검토 계약과 미구현 경계를 확인했다. 문서 전용 게이트를 적용해 앱 build·기능/DB/브라우저 테스트는 실행하지 않았으며 기능·DB·실제 권한·운영 게시를 변경하지 않는다. 검증 성공은 계획된 기능의 구현/인수 완료가 아니다.

## 환경 메모

AppleDouble `._*`는 별도 사용자 파일을 임의 삭제하지 말고 lint/types exclude와 기존 Turbopack dev cache 옵션을 유지한다. frappe-gantt CSS는 root layout에서 직접 import한다. native CLI의 APP_PORT/환경 우선순위·protected schema 설정은 기존 코드를 따른다. VS Code launch와 dev:debug는 개발 지원이며 운영 검증을 대신하지 않는다. 실측/의존성 상태를 바꾸려는 경우 해당 source와 exact 환경을 다시 확인한다.

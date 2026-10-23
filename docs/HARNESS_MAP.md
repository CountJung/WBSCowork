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

readiness는 관리표20개와 `schema_migrations`를 구분한다. 이번 구현은 관리자 전용 server repository/모델/schema까지이며 루트 action·사용자 화면·팀장 위임 권한·직접 완료 실행은 아직 없다. 따라서 새 봉사활동 화면의 hydrated desktop/mobile 인수와 직접 완료자/시각·재개 이력 테스트는 미실행이며 PRD-048~050/QLT-023의 남은 게이트다. 모든 신규/기존 업무는 제출 필수 기본값이고 mode 값 표현만으로 직접 완료를 활성화하지 않는다.

문서 전담은 docs-canon 지침에 따라 기존 정본만 동기화했다. 저장소 문서 검사/self-test·MASTER_PLAN HTMLParser·`git diff --check` PASS이며 문서30·등록16/핵심7·상대링크189·npm명령99를 확인했다. 별도 내용 검토로 실제 저장 기반/아직 미구현인 권한·직접 완료·UI, 정책 선택 대기, 과거 결과와 이번 검증의 구분을 확인했다. 원본 검사기는 앞선 리소스 미제공/승인 ZIP 다운로드 실패 기록 이후 이번에 추가 실행하지 않았다. 원본 canon 통과나 기능/운영 인수로 확대하지 않는다.

## 문서 정리 검증

2026-10-21 간소화 당시 기준은 main ddcedd6/sites c1c55da와 미커밋 문서 작업 트리였다. 앱/DB/보안/배포를 바꾸지 않고 문서·필요 참조·검사기만 확인한다. docs-canon 원본은 환경에 없어 실행하지 않았고 외부 PredevGUI 규칙/BOM을 가져오지 않았다. 대체 검사는 등록 역할/읽기 경로, 전체 상대 링크/anchor, 실제 npm script, HTML 내부 링크/외부 CDN, 삭제 전 통합 매핑·untracked 보존과 두 branch의 공통 patch 적용을 확인한다. 실제 결과/파일 수는 검증 후 COMPLETED_LOG의 OPS-037에 남긴다.

2026-10-22 QLT-021 후속 문서 검증: main ff5e830/sites b249c4d를 기준으로 문서 전담 역할에서 기존 AGENTS/TODO/HARNESS_MAP/COMPLETED_LOG만 로컬 갱신했다. 개인 docs-canon SKILL.md는 읽어 적용했으나 제공된 `scripts/check_docs.py` 리소스 읽기가 실패했고 로컬 경로도 찾지 못해 **원본 형식 검사기는 미실행**이다. 저장소의 `node scripts/check-docs.mjs`는 문서30·등록16/핵심7·상대링크167·npm명령84 PASS, `git diff --check` PASS다. 별도 내용 검토로 version13의 게시 provenance/부모 Chrome 인수 근거, QLT-022의 남은 조건·승인 경계, 과거 로컬 수치와 현재 운영 결과의 분리 및 기존 고유 이력 보존을 확인했다. 이 QLT-021 문서 정리 단계에서는 제품 테스트 재실행·앱 수정·재게시·운영 데이터 변경·커밋·푸시를 수행하지 않았다.

2026-10-23 봉사활동 계획 문서 검증: main a1f244c/sites 9e48312를 기준으로 PRODUCT_SPEC/MASTER_PLAN/ARCHITECTURE/TODO와 이 검증 기록만 갱신했다. `node scripts/check-docs.mjs --self-test`, `node scripts/check-docs.mjs`, `git diff --check` PASS. 문서30·등록16/핵심7은 유지한다. docs-canon SKILL.md는 읽었으나 원본 `scripts/check_docs.py` 리소스가 제공되지 않았고, 승인된 전달 ZIP의 Library materialize 후 로컬 helper 다운로드도 `download failed`로 끝나 원본 검사는 미실행이다(다운로드 실패의 HTTP 원인은 미확인). 별도 내용 검토로 확정 방향/제안 정책, V0–V4의 ID·우선순위·의존성·완료 조건, 기존 계정/자료/검토 계약과 미구현 경계를 확인했다. 문서 전용 게이트를 적용해 앱 build·기능/DB/브라우저 테스트는 실행하지 않았으며 기능·DB·실제 권한·운영 게시를 변경하지 않는다. 검증 성공은 계획된 기능의 구현/인수 완료가 아니다.

## 환경 메모

AppleDouble `._*`는 별도 사용자 파일을 임의 삭제하지 말고 lint/types exclude와 기존 Turbopack dev cache 옵션을 유지한다. frappe-gantt CSS는 root layout에서 직접 import한다. native CLI의 APP_PORT/환경 우선순위·protected schema 설정은 기존 코드를 따른다. VS Code launch와 dev:debug는 개발 지원이며 운영 검증을 대신하지 않는다. 실측/의존성 상태를 바꾸려는 경우 해당 source와 exact 환경을 다시 확인한다.

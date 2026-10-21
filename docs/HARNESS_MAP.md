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

진단/live 명령은 HARNESS와 NAS_UPDATE_GUIDE의 proxy 경계를 유지한다. CONNECT403/Domain forbidden은 proxy_connect/exit1/live_http_completed=false이며 사이트 HTTP403과 구분한다. 인증 cookie 없이 GET만 하고 로그인 redirect를 따라가지 않는다. 플랫폼 정책/프록시/NO_PROXY/인증서를 바꾸지 않는다.

## 검증 기준선

아래는 **해당 SHA에서 이미 실행한 기록**이다. 이번 문서 정리에서 제품 검사를 재실행했다는 뜻이 아니다. 전체 이전 원문과 복구 경로는 COMPLETED_LOG가 보존한다.

| 기준 | 실제 결과 | 범위/남은 한계 |
| --- | --- | --- |
| QLT-021, main ddcedd6/sites c1c55da, 2026-10-21 | DB109(D1 57/MariaDB52), action8, unit119, visibility33, Worker HTTP257, native/Sites build, lint/types/FSD PASS | Node24.19/MariaDB10.11.14, local fixtures. 운영 DB/삭제·새 Google 로그인·NAS/Sites 배포 미실행. 과거 QLT-019는 이 환경에서 미재현이며 다른 환경까지 닫지 않음 |
| screenshot0d1a1a3, 2026-10-20 | D1/R2 28, bugD1 58, bugHTTP200/fullHTTP248, Chromium19(1280/390), layout48(6너비), auth18/network12/native additive99 PASS | unit105/108·GoogleProvider3실패, visibility/storage import실패, workflow 동시503을 당시 실패로 보존. QLT-021은 다음 회차 수정됨 |
| branch 정리 a28188e/56e397c, 2026-10-20 | main native build/CLI8, Sites build/auth18, 양쪽 lint/types/FSD, network12/screenshot28 PASS | 기본 build만 의미상 다름. 새 배포 없음. native logging 동적 NFT1 경고 |
| P0/P1, 2026-10-09 | P0 Worker412/quality375/native77; P1 unit119 / D1 65/Worker472/quality375/auth18/native99+관계복원4 | 실계정2개 협업/채워진 template browser/native purge·강등 interleaving·storage race는 미확인. 최초503과 좁은 관계 DELETE1142 실패를 성공에 합산하지 않음 |
| 초기 전환/보안/버그, 2026-10-08 | auth18, storage57, bug lifecycleD158/Worker217; React19.2.8 active decoder fingerprint | 실환경 owner1계정의 승인된 QA는 별도 기록. 전체 dependency audit 완료 아님 |

환경 기준선: 기존 native NFT 동적 logging 경고(회차에 따라1/2), Vinext proxy 감지/route static 분류, Node mock experimental, npm proxy/@esbuild-kit deprecation을 해결됐다고 주장하지 않는다. QLT-015의 차단된 두 cleanup runner 정지/재개는 미실행, QLT-016 동시503 원인은 미확정, QLT-020 native 첨부 purge는 fail-closed다. QLT-021은 최신 코드에서 수정됐고 version12에는 아직 게시됐다고 기록하지 않는다.

## 문서 정리 검증

기준은 main ddcedd6/sites c1c55da와 미커밋 문서 작업 트리다. 앱/DB/보안/배포를 바꾸지 않고 문서·필요 참조·검사기만 확인한다. docs-canon 원본은 환경에 없어 실행하지 않았고 외부 PredevGUI 규칙/BOM을 가져오지 않았다. 대체 검사는 등록 역할/읽기 경로, 전체 상대 링크/anchor, 실제 npm script, HTML 내부 링크/외부 CDN, 삭제 전 통합 매핑·untracked 보존과 두 branch의 공통 patch 적용을 확인한다. 실제 결과/파일 수는 검증 후 COMPLETED_LOG의 OPS-037에 남긴다.

## 환경 메모

AppleDouble `._*`는 별도 사용자 파일을 임의 삭제하지 말고 lint/types exclude와 기존 Turbopack dev cache 옵션을 유지한다. frappe-gantt CSS는 root layout에서 직접 import한다. native CLI의 APP_PORT/환경 우선순위·protected schema 설정은 기존 코드를 따른다. VS Code launch와 dev:debug는 개발 지원이며 운영 검증을 대신하지 않는다. 실측/의존성 상태를 바꾸려는 경우 해당 source와 exact 환경을 다시 확인한다.

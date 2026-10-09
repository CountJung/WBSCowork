# WBSCowork 하네스 맵

> 실제 `package.json`과 저장소 파일에 존재하는 실행·검증 경로만 기록한다.
> 구 `docs/PROJECT_MAP.md`(명령 하네스 문서)를 이 파일로 통합했다. 코드 탐색 지도는 [PROJECT_MAP.md](PROJECT_MAP.md)다.

## 1. 전제

- Node.js/npm 환경과 lockfile 기반 `npm install`.
- 환경 키 목록은 `env.example`로 확인하되 실제 `.env*` 값은 문서/AI 컨텍스트/로그에 노출하지 않는다.
- 앱 포트는 `scripts/run-next.ts`가 env를 로드해 `APP_PORT`를 Next CLI `-p`와 `PORT`에 전달한다.
- 외장 macOS 볼륨의 `._*` AppleDouble 파일은 lint/Turbopack에 영향을 줄 수 있다. 사용자 파일을 임의 삭제하지 말고 기존 이슈와 변경 유발 이슈를 분리한다.

## 2. package scripts

| 명령 | 구현 | 목적 | 성공 기준 |
| --- | --- | --- | --- |
| `npm run dev` | `node --import tsx scripts/run-next.ts dev` | 개발 서버 | APP_PORT 출력 후 route 응답 |
| `npm run dev:debug` | 위 명령 + `--inspect` | 서버 디버깅 | inspector와 dev server 기동 |
| `npm run build` | `vinext build` | Sites Worker build | exit 0, dist/server/index.js 생성 |
| `npm run build:next` | `node --import tsx scripts/run-next.ts build` | 기존 Node/Next 빌드 | exit 0, route 생성 |
| `npm run test:sites:auth` | `node scripts/test-sites-auth.mjs` | 빌드한 Worker의 NextAuth 계약 | 18건 통과; 실제 Google 로그인과 구분 |
| `npm run start` | `node --import tsx scripts/run-next.ts start` | native Node production server | 선행 build:next 후 APP_PORT listen |
| `npm run lint` | `eslint` | 정적 검사 | error/warning 0 |
| `npm run typecheck` | `tsc --noEmit` | 타입 검사 | 출력 없이 exit 0 |
| `npm run check:fsd` | `node --import tsx scripts/check-fsd-boundaries.ts` | FSD import 경계 | fixture self-test 5건 PASS + 저장소 위반 0 |
| `npm run db:check -- --validate-only` | `node --import tsx scripts/check-db.ts` | DB env 파싱만 | 연결 없이 validation passed |
| `npm run db:check` | 동일 | 실제 pool 연결 | DB name/server version 출력, exit 0 |
| `npm test` | `node --import tsx scripts/run-tests.ts` | 단위 + 가시성 e2e | 전체 통과. DB 없으면 DB suite 미실행 사유 출력 |
| `npm test -- --unit` | 위 + `--unit` | DB 없이 도는 suite만 | 정책·범위·로그 redaction 통과 |
| `npm test -- --require-db` | 위 + `--require-db` | DB 미기동을 실패로 처리 | CI에서 조용한 건너뛰기 방지 |
| `npm run test:db:up` | `node --import tsx scripts/test-database.ts up` | 테스트 전용 MariaDB 기동 | `127.0.0.1:3307/wbs_app_test` 준비 |
| `npm run test:db:down` | 동일 스크립트 `down` | 종료 및 데이터 폐기 | 컨테이너/프로세스와 datadir 제거 |
| `npm run test:db:status` | 동일 스크립트 `status` | 기동 여부 확인 | up이면 버전 출력, down이면 exit 1 |
| `npm run test:sites:quality` | `node scripts/test-sites-http.mjs --quality` | Worker 날짜·계층·첨부·역할 회귀 | 로컬 D1/R2 합성 fixture 375건, 삭제/purge 제외 |
| `npm run test:sites:decoder` | `node scripts/check-rsc-decoder.mjs` | 실제 빌드 RSC 패치 fingerprint | 활성 decoder 1개가 수정 계약과 일치 |
| `npm run db:migrate -- --status` | `node --import tsx scripts/migrate-database.ts --status` | native ledger 읽기 전용 | 상태/대기/검증 오류 구분, DDL 없음 |
| `npm run db:migrate -- --apply` | 같은 script의 명시 --apply | 승인된 native 스키마 적용 | 별도 schema identity, lock/checksum/postcondition/ledger |
| `npm run test:native:migrations` | `scripts/test-native-migrations.ts` | 비파괴 native migration 계약 | loopback:3307 새 *_test DB만 생성·보존 |

DB fixture의 삭제·TRUNCATE·purge가 포함된 기존 전체 suite는 실행 전에 승인 범위를 확인한다. 위 additive 전용 하네스는 이 경로를 호출하지 않는다.

### `check:fsd` 세부

기본 실행은 **fixture self-test → 저장소 검사** 순서다. 검사기가 조용히 망가진 채 통과하는 것을 막기 위한 구성이다.

| 플래그 | 동작 |
| --- | --- |
| (없음) | self-test 후 저장소 검사 |
| `-- --self-test` | `scripts/fixtures/fsd/*` 만 검사 |
| `-- --only-repo` | 저장소만 검사 |
| `-- --json` | 기계 판독용 출력 |

차단하는 위반: `layer-direction`, `cross-slice`, `deep-import`, `unknown-layer`, `client-server`. `legacy-import`(src 슬라이스가 `components/`·`lib/`·`models/` 참조)는 이동 중 남은 부채로 경고만 내지만, 8단계 M5 완료 후 현재 저장소에는 남기지 않는다.

## 3. 변경 유형별 최소 게이트

| 변경 범위 | 필수 | 조건부/수동 |
| --- | --- | --- |
| 문서만 | `git diff --check`; 링크/파일명 검토 | standalone HTML에서 외부 URL/CDN 없음 확인 |
| TS/TSX/UI | `npm run lint`, `npm run typecheck`, `npm run build` | `/`, `/tasks`, 관련 admin desktop/mobile smoke |
| role/auth | lint/typecheck/build | guest/member/admin/superuser matrix, 로그인/redirect/action 직접 호출 |
| visibility | lint/typecheck/build, `npm test` | public/private × actor, comment/attachment metadata/download, IDOR |
| repository SQL | lint/typecheck/build, validate-only | 테스트 DB에서 CRUD/transaction/EXPLAIN |
| schema | 위 + 실제 DB | fresh/existing upgrade, FK/cascade/index, rollback/backup |
| upload/download | lint/typecheck/build | size limit, MIME/disposition, traversal, missing file, unauthorized 404 |
| FSD 이동 | `npm run check:fsd`, lint/typecheck/build | 이동 전후 export/signature/SQL 동일성, public API 동작 |

## 4. DB 검증 층위

### A. 설정 형식

```bash
npm run db:check -- --validate-only
```

`src/shared/server/runtime-env`의 필수 DB 설정과 숫자 범위를 확인하며 네트워크 연결은 하지 않는다.

### B. 연결

```bash
npm run db:check
```

`src/shared/server/database` pool로 실제 MariaDB에 연결한다. DB 미구성/접근 불가 환경의 실패를 코드 실패로 위장하지 않는다.

### C. managed schema

Native는 `/admin/database` 또는 `db:migrate -- --status`에서 조회하고, 명시적인 SU action/CLI --apply만 별도 schema identity로 불변 migration을 적용한다. Sites D1은 기존 게시 migration을 사용하며 런타임 초기화 버튼이 없다. 상세 절차와 복구 제한은 [Native 운영](NATIVE_DATABASE_MIGRATIONS.md)을 따른다.

DB 변경 시 최소 확인 목록:

- 빈 native DB에서 9개 domain table과 schema_migrations ledger 생성
- 기존 DB에서 누락 컬럼 보정의 재실행 가능성
- `users.email` unique, role enum
- task self-FK와 project/assignee FK
- submission visibility default와 author/task FK
- attachment/comment cascade
- runtime/schema identity 코드 분리와 누락 시 fail-closed; 실제 제한 계정의 DML 허용·DDL/ledger 변경 거부는 별도 운영 검증

## 5. route smoke matrix

| 대상 | anonymous | guest | member | admin | superuser |
| --- | --- | --- | --- | --- | --- |
| `/` | readiness/로그인 안내 | read | read | read | read |
| `/tasks` | sign-in redirect | public read | write + public/own private | write + all | write + all |
| `/admin`, `/admin/projects`, `/admin/users` | sign-in | `/` redirect | `/` redirect | allow | allow |
| `/admin/database`, `/admin/logs`, `/admin/settings` | sign-in | deny | deny | deny | allow |
| attachment GET | 401 | public만, private 404 | public + 본인 private | allow | allow |

attachment handler는 부모 제출물의 가시성을 검사하고 unauthorized/missing을 모두 404로 응답한다. private IDOR는 기존 native visibility suite와 Worker quality fixture에서 검사한다. 실행 결과와 미실행 범위는 아래 날짜별 기록을 따른다.

## 6. 가시성 focused test (구현 완료, 2026-09-06)

fixture는 `tests/helpers/fixture.ts`, 검증은 `tests/visibility.e2e.test.ts`에 있다.

```bash
npm run test:db:up     # 테스트 전용 MariaDB 기동 (127.0.0.1:3307 / wbs_app_test)
npm test               # 단위 + DB suite
npm run test:db:down   # 종료 및 데이터 폐기
```

fixture:

- public submission A, member1 private B, member2 private C
- 각 제출물에 comment, legacy file, multi-attachment(2건) — 저장 파일도 실제로 생성한다
- guest/member1/member2/admin/superuser viewer
- project/task가 다른 교차 식별자(다른 프로젝트의 공개 제출물 D)
- 존재하지 않는 submission/attachment id — 열거 방지 응답 비교용

검증(각 항목이 `describe` 블록 하나에 대응):

1. 목록·댓글·첨부 metadata가 부모 가시성을 그대로 따름.
2. 두 download URL의 직접 ID 접근도 같은 결과.
3. 수정/삭제는 author 또는 명시된 관리자만 가능.
4. unauthorized/missing 응답이 자원 열거를 줄임.
5. DB query가 UI 사후 필터가 아니라 bounded viewer filter를 수행.

### 하네스 구조와 한계

- 러너는 Node 내장 `node:test`다. 새 테스트 의존성을 추가하지 않았다.
- `tests/helpers/bootstrap.ts`가 실제 `getAuthSession()` 경로를 그대로 두고 `next-auth`의 `getServerSession`만 대체해 세션을 주입한다. 즉 인가 로직 자체는 production 코드가 실행된다.
- Server Action은 성공·실패를 모두 `redirect()`로 끝내므로 `NEXT_REDIRECT` digest를 파싱해 결과를 판정한다(`tests/helpers/redirect.ts`).
- `revalidatePath`, `server-only`은 Next 런타임 전용이라 no-op으로 대체한다. 캐시 무효화 동작은 이 하네스가 검증하지 않는다.
- HTTP 계층(실제 next server + OAuth 로그인)은 검증 범위 밖이다. route handler의 `GET`을 직접 호출하므로 handler 로직·가시성 질의·응답 헤더까지는 확인하지만 미들웨어·라우팅은 확인하지 않는다.
- 스키마는 앱의 `initializeDatabaseSchema()`를 그대로 호출한다. 테스트가 별도 DDL을 들고 있으면 운영 스키마와 조용히 어긋나기 때문이다.
- fixture는 테스트마다 재시드해 실행 순서에 의존하지 않는다.

### 테스트 DB 백엔드

`scripts/test-database.ts`가 이 머신에서 실제로 쓸 수 있는 백엔드를 자동 선택한다.

| 백엔드 | 조건 | 정의 |
| --- | --- | --- |
| docker | 데몬 기동 + `mariadb` 이미지 보유 | `docker-compose.test.yml` |
| local | Homebrew MariaDB 설치됨 | 저장소 밖 임시 datadir에 매번 새로 기동 |

어느 쪽이든 접속 계약은 `127.0.0.1:3307 / root / test_password / wbs_app_test`로 같다. 개발·운영 DB(기본 3306)와 포트·DB 이름이 모두 다르고, `applyTestEnv()`가 `_test`로 끝나지 않는 DB 이름을 거부한다. 테스트는 `.env*`를 읽지 않고 `TEST_DB_*`만 본다.

DB가 없으면 `npm test`는 DB suite를 건너뛰고 사유를 출력한다. CI처럼 건너뛰기를 허용하지 않으려면 `npm test -- --require-db`를 쓴다.

## 7. 환경 변수 가정

키 목록만 기록한다. 실제 값은 `.env*`에만 두고 문서·AI 컨텍스트·로그에 남기지 않는다. 전체 목록은 `env.example`이 기준이다.

| 범위 | 키 |
| --- | --- |
| 앱 | `NEXT_PUBLIC_APP_NAME`, `APP_PORT` |
| 인증 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SUPERUSER_EMAIL` |
| DB | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT_MS` |
| 업로드 | `UPLOAD_DIR`, `UPLOAD_MAX_FILE_SIZE_MB` |
| 로그 | `LOG_DIR`, `LOG_RETENTION_DAYS`, `LOG_MAX_FILE_SIZE_MB` |
| digest/report (미구현) | `DIGEST_SCHEDULER_TOKEN`, `REPORT_DIR`, `REPORT_RETENTION_DAYS` — token 미설정 시 endpoint는 fail closed |

## 8. 환경 특이사항

- 설치된 `next-auth`는 v4.24.x로 해석된다. `NextAuthOptions`와 App Router 핸들러 패턴을 사용한다.
- macOS 외장 볼륨에서 AppleDouble(`._*`) 파일이 Turbopack 캐시에 쓰여 dev 서버가 실패한 적이 있다. `next.config.ts`의 `experimental.turbopackFileSystemCacheForDev = false`로 회피한다. lint 대상에서도 `**/._*`를 제외한다.
- `frappe-gantt` CSS는 Turbopack에서 `globals.css`로 불러올 수 없어 `app/layout.tsx`에서 직접 import한다.
- 저장소 bootstrap 시 대문자 폴더명은 npm 패키지 명명 규칙에 걸린다. 소문자 임시 폴더에서 생성 후 이동했다.

## 9. VS Code 디버깅

- `.vscode/launch.json` + `npm run dev:debug`.
- 풀 스택 런치는 `debugWithChrome`으로 Chrome을 실행한다. 서버가 이미 떠 있으면 client-side 구성만 붙인다.

## 10. 알려진 기준선 (2026-09-06)

| 명령 | 결과 |
| --- | --- |
| `npm run lint` | 통과 (0 errors, 0 warnings) |
| `npm run typecheck` | 통과 |
| `npm run check:fsd` | 통과 (self-test 5건, 저장소 위반 0건) |
| `npm run build` | 통과. Next.js 16.2.4 Turbopack production build 성공 |
| `npm test` | 통과 (단위 14건, 가시성 e2e 33건) |
| `npm run db:check` | 미실행 — 앱 개발용 DB(3306) 인스턴스는 여전히 없음. 테스트용 3307과 별개다 |

`tsx` 4.23.13 적용으로 `[DEP0205] module.register()` deprecation 경고는 더 이상 나오지 않는다. 남은 build 출력의 `⨯ turbopackFileSystemCacheForDev`는 실험 플래그 안내이며 실패가 아니다.

DB 연결이 필요한 명령을 실행하지 못했으면 코드 실패로 위장하지 말고 미실행 사유를 남긴다.

## 11. 완료 체크

```bash
git diff --check
git status --short
```

그리고 작업 보고에 다음을 남긴다.

- 실행 명령과 exit code/핵심 결과
- 미실행 명령과 이유(DB/secret/browser 등)
- 변경 전부터 존재한 warning/error
- 생성/수정 파일
- commit/push 여부

## 12. 다음 업데이트 트리거

- FSD 구조나 경계 규칙 변경 시
- digest D0 구현 시작 시
- Synology NAS 배포 준비 시작 시
- 새 검증 명령 추가 또는 블로커 발생/해소 시

## 13. 클라우드 실측 기준선 (2026-10-08)

체크아웃 SHA: `2f6b74d7b77106d38ad914eee14e1e073c61b039`.
Node 26.11.1 / npm 11.20.0 / MariaDB 11.4.13의 실제 실행과 용량은
[CLOUD_INSTALL_REPORT_2026-10-08.md](CLOUD_INSTALL_REPORT_2026-10-08.md)에 있다.

| 명령 | 실제 결과 |
| --- | --- |
| `npm ci --include=dev` | exit 0, 541개 설치. 최초 install hook 정책 경고는 별도 설정의 scoped rebuild로 보완 |
| `npm run lint` / `typecheck` / `check:fsd` | 모두 exit 0, FSD self-test 5건 |
| `npm run test:unit` | exit 0, 14건 PASS |
| DB 없는 `npm test` | exit 0, unit만 PASS, DB suite 미실행 |
| DB 없는 `npm test -- --require-db` | exit 1, DB 부재를 실패 처리 |
| tmpfs DB의 `npm test -- --require-db` | exit 0, unit 14 + DB 33 PASS |
| 디스크 DB의 `TEST_DB_PORT=3308 npm test -- --require-db` | exit 0, unit 14 + DB 33 PASS, 재기동 후 6개 테이블/역할 fixture 보존 확인 |
| 격리 DB의 `npm run db:check` / `-- --validate-only` | 모두 exit 0; 운영 DB 접근 없음 |
| 기본 `npm run build` | exit 1, Google Fonts Roboto 다운로드 실패 |
| 환경 전용 폰트 response fixture + 로컬 폰트 HTTP의 build | exit 0, Turbopack production build. 실제 공식 폰트 bytes SHA 일치 |
| 실제 production HTTP | `/privacy` 200; `/`, tasks/admin/auth/download 경로는 secret 미설정으로 `NO_SECRET` 500 |

미해결 환경 전제/경고는 OPS-022에 있다. Docker/Compose는 기존 기반 이미지 도구를 사용했고 MariaDB 이미지 하나를 추가했다. 브라우저는 설치·사용하지 않았다.
기존 compose의 공개 포트 매핑 대신 별도 overlay로 host network의 `127.0.0.1:3307`에만 DB를 바인딩했다. 원본 compose는 변경하지 않았다.
종료 시 DB 컨테이너는 정지 상태로 보존했고 디스크 datadir, 소스, 설치물, 다운로드 캐시를 삭제하지 않았다.

## 14. Sites 사전검증 게이트 (2026-10-08)

설치 실측 체크포인트는 `feat/sites-deployment`의 `26ed97397aafa43b5e0844a5b6fe44bf2ff229d0`에 push했고 원격 SHA를 확인했다. 원격 main은 `2f6b74d7b77106d38ad914eee14e1e073c61b039` 그대로다.

[SITES_PREFLIGHT_2026-10-08.md](SITES_PREFLIGHT_2026-10-08.md)에 배포 환경 준비, SQLite/Worker 한도와 Google OAuth 검증 항목을 기록했다. 실제 Worker 빌드·HTTP, Google 로그인, D1/R2 전환과 배포는 **미실행**이다. 기존 Node/Next 검사 통과로 대체하지 않는다. OPS-023에서 남은 작업을 추적한다.

`wbscowork` 등록 후 `.openai/hosting.json`에 프로젝트 ID를 보존했다. 예약 origin은 `https://wbscowork.cometgnome.chatgpt.site`이고 현재 비공개·미게시(버전 0)다. 등록은 실제 배포·OAuth 검증과 별개다.

## Sites Worker 추가 기준선 — 2026-10-08

[Sites Worker 인증 체크포인트](SITES_WORKER_AUTH_2026-10-08.md)를 참고한다. lint/typecheck/FSD, 단위 14건, Worker 빌드와 인증 HTTP 계약 18건 통과. DB suite는 이 환경에서 미실행이며 이전 컨테이너의 33건을 가져와 통과로 기록하지 않는다. Vinext scanner의 next-auth unsupported 경고는 Vite 8 CommonJS 호환 모드와 실제 Worker 테스트로 범위를 구분한다. 실제 OAuth와 운영 DB/R2는 아직 미검증이다. Node module-mocking 실험 경고, 환경의 npm http-proxy 설정 경고, Vinext route 분류/플러그인 성능 안내는 알려진 도구 출력이며 테스트 통과의 증거로 사용하지 않는다.

`npm run db:generate`는 `db/schema.ts`의 SQLite schema에서 Drizzle migration을 생성한다. `npm run test:sites:storage`는 실제 로컬 D1/R2 binding에서 합성 데이터만 사용하며 현재 D1 계약 21건 통과. 본문 이전 MariaDB 기준은 Node 실행 경로의 기준이다.


## Sites 최종 런타임 검증 — 2026-10-08

- `npm run test:sites:storage`: 실제 Miniflare D1/R2 + 합성 데이터/주입 세션, 57건 통과.
- `npm run test:sites:http`: 배포 Worker 산출물 + 실제 NextAuth/JWT/D1/R2 HTTP, 합성 서명 세션으로 92건 통과. 실제 Google 교환은 별도이다.
- `npm run test:sites:auth`: credential-free 실제 Worker 계약 18건 통과.
- `npm run test:sites:browser`: Python Playwright/Chromium가 필요하다. 이 클라우드에서는 Chromium IPC socket의 EPERM 때문에 시작하지 못했다. 기본 실행과 승인된 sandbox 외부 명령 재시도 모두 같은 제한. Chromium 자체 sandbox를 끄거나 보안 설정을 바꾸지 않았다. 시각/하이드레이션 QA를 통과로 기록하지 않는다 (OPS-023).
- [최종 검증 기록](SITES_VALIDATION_2026-10-08.md).

게시 후 지원되는 클라우드 브라우저에서 공개 홈의 1180px 및 500px 레이아웃과 실제 Google 로그인 진입을 확인했다. 사용자 브라우저의 로그인 성공 보고도 별도 기록했다. [게시 결과](SITES_PUBLICATION_2026-10-08.md).

## 관리자 runtime 표시 회귀 — 2026-10-08 13:24 UTC

새로 복원한 dot cloud checkout(Node 24.19.0)에서 OPS-025 표시 변경을 확인했다.
- 단위 17건(기존 14 + hosted/native 표시 3), lint/typecheck/FSD(5 self-test), Worker production build: 모두 exit 0.
- 실제 로컬 D1/R2 실패 복구 57건, 빌드 산출물의 Worker HTTP 역할·표시 112건, credential-free 인증 계약 18건: 모두 통과.
- `/admin`의 D1 대상과 effective superuser 표시, ordinary admin 안내, hosted DB binding 표시·DDL 버튼 부재, 보존 기간 기반 로그 안내를 추가 확인한다. Node 모드 안내는 순수 함수 단위 검사로 확인하며 MariaDB 실제 DB suite는 이번 표시 수정에서 실행하지 않았다.
- 기존 npm http-proxy/Node mock experimental 경고, Vinext proxy·plugin timing·정적 route 분류 안내, Drizzle 의존성의 @esbuild-kit deprecation을 관찰했다. 잠금파일/의존성 변경은 하지 않았으며 기존 runtime 계약으로 검증 범위를 한정한다.
- 독립 읽기 전용 리뷰에서 인가·저장소 동작 변경 없이 표시 정정만 이루어졌음을 확인했다.
- 실제 Google 로그인은 합성 테스트와 별도로, 같은 날 13:14 UTC 소유자가 직접 인증한 클라우드 브라우저의 /tasks 및 /admin에서 확인했다. 운영 계정/비밀값은 테스트 fixture나 문서에 복사하지 않았다.

OPS-026: `scripts/verify-sites-crud.mjs`를 실제 Worker HTTP suite에서 실행한다. 2026-10-08 13:31 UTC 총 149개 통과(112+CRUD 37), 변경된 테스트 JS ESLint 통과. 앱 소스 변경 없이 OPS-025 빌드 산출물을 재사용했다. 별도 live test 데이터는 소유자가 승인한 QA 프로젝트에 한하며 영구 파기는 별도 확인한다.

## 버그 제보·리뷰 게이트 — 2026-10-08 14:18 UTC

- lint/typecheck/FSD(5 checker fixtures), Worker production build: exit 0.
- `npm test`: unit 17 PASS; native MariaDB suite skipped with ECONNREFUSED 127.0.0.1:3307. Docker/MariaDB executable absent. OPS-028 tracks native bug schema/query runtime validation; source review is not execution evidence.
- `npm run test:sites:storage`: 57 PASS, additive migration 후 domain table 8개 확인.
- `npm run test:sites:bugs`: 26 actual D1 archive/transaction/input contracts PASS. Failure trigger rollback, same-token/different-version concurrency, stale-review conflict, account/project deletion retention 포함.
- `npm run test:sites:http`: final rebuilt Worker + synthetic signed sessions 185 checks PASS (기존 CRUD 및 신규 bug HTTP 36 포함). 두 guest·두 member·admin·superuser, counts/search/details/history authorization, forged owner/status, cross-user addendum, escaped XSS, size/URL limits, cross-origin action, alternate-route validation, role refresh 검증.
- `npm run test:sites:auth`: credential-free workerd 18 PASS.
- 독립 security/storage 리뷰: transaction 밖 token precheck만으로는 동시 요청에서 이력 없는 갱신이 가능하다는 문제를 발견했고 atomic UPDATE의 NOT EXISTS(operation_token)으로 수정했다. MariaDB upsert RHS target table qualification도 보완했다. 후속 source review에서 두 지적 해결 확인.
- 도구 경고는 기존 proxy/experimental mock/Vinext plugin timing·route static-analysis 안내다. Prettier 임시 실행의 기본 cache 경로 ENOENT는 `/tmp/wbscowork-npm-cache`를 사용해 해결했다. 중단된 build wait는 완료로 계산하지 않고 final build를 다시 실행해 exit 0을 확인했다.

## Native 호환성 수정 checkpoint — 2026-10-08 14:57 UTC

원래 측정 saved cloud의 exact f294edd 재검증(Node26.11.1/MariaDB11.4.13)에서 bug contract 15 PASS/2 FAIL이 보고됐다. ER_LOCK_DEADLOCK(1213/40001)이 동시 요청의 stale-version 또는 idempotent replay 기대 대신 노출됐으며 4×40회 검사에서 상태/이력 불일치는 없었다. 기존 required DB suite는 test graph linking의 ERR_INTERNAL_ASSERTION 때문에 기본 명령에서 실패했고, 환경 ordered preload로 unit17+DB33 skip0가 통과했다.

수정: native databaseBatch는 성공한 rollback·awaited release 후 1213만 전체 transaction을 최대3회/10·20ms 지연으로 재시도한다. 연결/commit 결과 불명·1205 timeout·SQL·권한 오류, rollback/release 실패는 재시도하지 않는다. D1 batch 경로는 바꾸지 않는다. tests/helpers/preload.mjs가 tsx 후 bootstrap을 await하고, test runner 및 D1 test scripts는 CLI mock flag와 함께 이 preload를 사용한다. NODE_OPTIONS에 실험 flag를 넣지 않는다.

이 dot cloud(Node24.19.0)에서는 unit30(기존17+transaction12+preload1), lint/typecheck/FSD, bug D1 26, D1/R2 57가 exit0이다. 아직 수정 SHA의 실제 Node26/MariaDB 계약 결과는 기다리는 중이며 OPS-028을 완료로 표시하지 않는다. Worker build/HTTP는 다음 별도 security patch와 함께 최종 게이트를 실행하기 전이므로 이 native checkpoint만으로 production 재게시를 주장하지 않는다.

## RSC 19.2.8 최소 보안 패치 게이트

React/react-dom/RSC 19.2.8 trio에서 lint/types/FSD/build, unit30, D1/R2 57, bugD1 26, rebuilt WorkerHTTP185 및 auth18 통과. `npm run test:sites:decoder`는 실제 production chunk의 선택 action 1개/순회 후 decode 구현을 확인한다. 정적 회귀이며 공격·DoS 테스트가 아니다. [범위와 출처](SECURITY_PATCH_2026-10-08.md). Native f31f9dc의 실제 MariaDB 재검증은 별도 결과 대기이며 이 게이트로 대신하지 않는다.

## Exact native retest 결과 및 repaired live QA

saved-cloud가 exact `f31f9dc18ca9848e648035ed602cba5b9731d9f1`을 외부 preload 없이 다시 검사해 unit30+real MariaDB33(skip0), native bug17, retry boundary23, 별도 concurrency160회의 기대 API/state/history 계약을 모두 통과했다고 보고했다. 내부 deadlock268건은 bounded retry로 처리됐고 DB 재시도 경계 mock tests와 실제 SQL 경쟁 검사는 구분한다. 이 SHA의 React는19.2.6이며 이후 security patch의 native 전체 실행을 증명하지 않는다.

`9a5367d` React19.2.8 build는 이 dot cloud에서 WorkerHTTP185/auth18/D1bug26/storage57/unit30/lint/types/FSD/build/static decoder PASS. 게시 version4 owner 세션에서 승인된 bug record1의 작성·추가 설명·검토·해결과 검색 필터가 실제로 성공했다. native와 D1, 합성 세션과 실제 owner session 근거를 혼합하지 않는다.


## 2026-10-09 QLT-010 프로젝트 action 단일화

`npm run lint`, `npm run typecheck`, `npm run check:fsd`, `npm test`, `npm run build`: lint 0/0, types, FSD 5 self-tests, unit 41 PASS 및 Worker build 성공. 새 canonical project guard 11건은 실제 action/redirect를 사용하고 DB mutation에 도달하지 않는 계약을 검사한다. MariaDB e2e는 localhost3307 연결 거부로 미실행이다.

환경 경고: npm의 주입된 http-proxy 옵션 경고, Node module-mocking ExperimentalWarning, Vinext proxy/route-classification 안내는 기존 환경/도구 한계다. 첫 깨끗한 Worker 빌드는 Google font plugin에서 1분 이상 소요되어 plugin timing 안내가 있었으며 오류는 없었다. 종전 미사용 import lint 경고 1건은 제거 후 0/0으로 재검증했다.

`npm run test:sites:auth` 18 PASS (실제 workerd·합성 설정, Google 로그인 아님), `npm run test:sites:decoder` 빌드된 React 19.2.8 decoder 지문 PASS.


## 2026-10-09 QLT-014 타입 파일 정리

`next-env.d.ts` include와 gitignore를 유지한다. Next의 생성 타입은 필요한 파일이며 AppleDouble(`**/._*`)만 TypeScript 검사 대상에서 제외한다. `types/next-auth.d.ts`의 obsolete `@/models/user` 참조는 현 entity API로 정정했다. typecheck/lint0·Worker build PASS. native Next build 미실행; 파일 삭제나 기존 첨부 데이터 변경 없음.


## 2026-10-09 QLT-011 경계 회귀

`npm run test:sites:quality`: **375 PASS**, 실제 production bundle/workerd + 로컬 D1/R2·합성 JWT. 공개/비공개 SSR·첨부·역할 갱신 기본 확인과 날짜/계층/업로드/역할 action 경계를 포함한다. 기존 `test:sites:http` 전체(삭제·bug purge 포함)와 별도 command다. 새 quality lane은 실제 서비스나 실제 사용자 계정을 쓰지 않고 delete/purge를 호출하지 않는다.

`npm test` unit67 PASS 및 MariaDB localhost3307 연결 거부로 DB suite skip; 이후 hostile upload filename/direct size 검사를 보강한 `npm run test:unit` **69 PASS**. lint0/0, types, FSD self5/경계, Worker build PASS. 실제 native DB 검증은 별도 체크포인트 결과를 따른다.

첫 HTTP 검사에서 streaming Content-Length가 없어 잘못 가정한 assertion이 실패했다. 실제 Worker는 길이 헤더를 제거할 수 있으므로 전송 bytes와 MIME를 검사하며, 직접 route 테스트로 metadata 대신 실제 파일 크기를 사용하는 것을 검증했다. 별도 네트워크 metadata 포함 실행은 결과 미확정으로 통과 계산에서 제외했다. 최종375는 공식 `cf:false`를 명시하여 Miniflare의 `workers.cloudflare.com/cf.json` GET 없이 내장 request.cf fixture를 사용한 실행이다. 두 정상 edit 대조군 및 음성 validation redirect도 검증한다.


## 2026-10-09 QLT-013 native schema identity 코드 경계

| 키 | 용도 | 미설정 시 |
| --- | --- | --- |
| DB_USER / DB_PASSWORD | runtime DML/readiness | 기존 필수값 검사 |
| DB_SCHEMA_USER / DB_SCHEMA_PASSWORD | 명시적 native DDL 전용, 같은 DB_HOST/PORT/NAME | schema 작업 거부, runtime fallback 없음 |
| TEST_DB_SCHEMA_USER / TEST_DB_SCHEMA_PASSWORD | 격리 fixture 전용 | 기본 테스트 identity 사용; 최소권한 증명 아님 |

schema 값은 일반 RuntimeEnv/status/설정 편집 UI에 넣지 않는다. `npm run test:unit`73 PASS, lint0/0, types, FSD5/경계 PASS. 실제 계정 생성/권한 변경/credential 입력·전송은 수행하지 않았으며 runtime DDL 거부는 미검증이다. [운영 계약](NATIVE_DATABASE_MIGRATIONS.md).

QLT-013 코드 지원 후 Worker build 및 네트워크 metadata 조회 없는 quality375 재검증 PASS. Sites의 계정/DB 권한은 변경하지 않았다.


## 2026-10-09 QLT-012 native versioned migration

`npm run db:migrate -- --status`: runtime identity로 ledger 상태 조회만 한다. `--apply`는 별도 schema identity로 명시적 적용이며 운영에서는 백업/점검 창/적용 대상 승인이 선행한다. `npm run test:native:migrations`는 새 loopback3307 `wbs_mig_*_test` DB를 보존하는 additive 전용 검증이다. 기존 destructive fixture suite와 섞지 않는다.

lint0/0·types·FSD5/경계·unit85·Worker build·quality375 PASS. 새 단위 검사는 checksum/version/name drift·lock 실패·DDL interruption·미설정 schema/오류정보 비노출을 포함한다. native 실 DB 결과는 exact-commit 검증 대기다. 인덱스 전체 길이/charset·case-sensitive role·autocommit0 durability·fresh 동시 runner는 그 하네스에서 확인한다. 타입 target ES2017에서 지원하지 않는 dotAll regex는 호환 패턴으로 고친 뒤 재검증했다.


### QLT-010~014 최종 검증 구분 (2026-10-09)

- 최종 코드 `cecce92e06c0b042441352445f4ce9856c6bc87e`에서 dot Worker build, auth18, quality375, 패치된 RSC decoder fingerprint PASS. 앞선 lint0/0·types·FSD5/경계·unit85도 통과했다. D1 `drizzle/`, DB binding, 공개 audience/Google 설정 변경은 없다.
- saved-cloud의 같은 코드/정확한 lockfile에서 lint/types/FSD, migration unit11 PASS. 실제 native migration 하네스는 loopback3307 ECONNREFUSED로 SQL 전에 exit1이다. 임의 tmpfs 재초기화/계정 구성을 하지 않았고 기존 보존 파일600개 hash는 유지했다. 영속 격리 DB 구성 승인 및 실제 native 검증이 남아 있다.
- 따라서 QLT-010/011/014는 완료이고, QLT-012 실제 MariaDB 계약 및 QLT-013 운영 identity/권한 적용은 보류다. 전체 native CRUD/purge suite를 다시 실행하거나 통과로 계산하지 않았다.
- Worker 계약은 합성 JWT/로컬 D1/R2를 사용한다. 실제 Google 재로그인이나 live 다중 계정 검증과 구분한다. 현재 Site에는 검증된 D1 실행 경로의 수정만 기존 공개 게시 절차로 반영한다.


### 기존 공개 Site 반영 (2026-10-09 10:05 UTC)

- GitHub와 Site source는 `6f415593f790bdfde18d0f06f2d0eed181213942` / tree `86f04dc9a0be72b181cca0a336fe3bca6eee228f`로 일치했다. 코드는 검증된 cecce92e와 같고 이후 변경은 문서다. 공식 workflow에서 이 source를 다시 빌드·패키징했다.
- version6 / deployment `appgdep_6ac8bc4ba93c8191886084aa2921a96b`는 10:05:22 UTC terminal succeeded. 기존 공개 URL은 https://wbscowork.cometgnome.chatgpt.site 이며 환경 revision11과 D1 migration은 유지됐다. 첫 배포 요청은 승인 범위 확인으로 거부됐고 기존 명시 게시 승인 원문을 확인한 동일 요청 1회 재시도에서 성공했다.
- 실제 URL의 anonymous session200/빈 객체, tasks·admin database307/로그인 이동, attachment401을 확인했다. dot 브라우저의 기존 로그인 세션에서 SU 표시, /tasks, /admin/projects, D1 관리9/9·정리 대기0·native 초기화 버튼 없음도 읽기 확인했다. 새 Google 로그인이나 live CRUD/역할 변경은 수행하지 않았다.
- main은 `2f6b74d7b77106d38ad914eee14e1e073c61b039` 그대로이며 취소된 docs commit262c4b8은 현재 이력에 포함하지 않았다.
- native 재실행은 아래의 별도 승인된 격리 영속 테스트 DB 결과를 따른다. 게시 성공과 native 검증을 구분한다.


### QLT-012 native 실제 DB 최종 결과 (2026-10-09)

사용자 승인 후 새 영속 격리 DB/테스트 계정으로 exact `cecce92e06c0b042441352445f4ce9856c6bc87e`의 `npm run test:native:migrations`를 실행해 **27 PASS**했다. MariaDB11.4.13, Node26.11.1, npm11.20, 정확한 lockfile/React19.2.8이다. fresh/legacy/pre-lifecycle, 데이터·권한 값·private·이력 보존, 동시 실행, 중단/재개, ledger 내구성, 잘못된 schema/checksum 거부를 실제 DB에서 검사했다.

합성 DB10개/테이블100개는 보존됐고 정지/재기동 schema+data snapshot이 일치했다. 기존 보존 DB 파일719개/artifact21개도 변경되지 않았다. 실행 중 loopback3307만 사용하고 마지막에 정상 정지했다. 이 검증에는 DELETE/DROP/TRUNCATE/purge나 운영 최소권한 변경이 없다. 앞선 ECONNREFUSED는 최초 환경 차단 기록이며, QLT-012 실제 DB 게이트는 이 재실행으로 충족했다. QLT-013 운영 권한 검증은 계속 보류다.


## PRD-033 프로젝트 전환 checkpoint (2026-10-09)

프로젝트 선택 UI를 모든 인증 사용자에게 제공하고 관리 버튼만 기존 admin/SU guard 안에 남겼다. 선택 링크는 이전 taskId를 제거하며 현재 프로젝트에 aria-current를 표시한다. 기존 조회 SQL·private 필터·관리 action 권한은 바꾸지 않았다.

lint0/0, typecheck, FSD5/경계, Worker build, `npm run test:sites:workflow` **187 PASS**. 실제 workerd의 두 프로젝트/guest·member2명·admin·SU, 반복 전환·관리 버튼 경계·다른 프로젝트 제출 누출 없음·정상 direct-link 선택과 위조 관계 거부를 검사했다. 독립 읽기 리뷰 후 direct-link 정상 대조군을 보강했다. 브라우저 클릭/Back/Forward·모바일은 아직 실행하지 않았고 PRD-044에서 함께 확인한다. Google 재로그인/운영 데이터 변경은 없다.

## PRD-034 업무 목표 checkpoint (2026-10-09)

프로젝트 목표·성공 기준, 카드 기대 산출물·완료 기준·선택 검토 여부를 기존 MUI 생성/수정/읽기 화면에 추가했다. 각 본문은 2,000자로 제한하고 plain text로 escape한다. 기존 빈 draft는 유지하고 update에서 새 필드를 생략하면 기존 값을 보존한다. 완료 전 필수 기준은 다음 상태 전이 단계에서 검사한다.

lint0/0, typecheck, FSD5/경계, unit88, Worker build 및 workflow206 PASS. 실제 workerd에서 생성/수정/생략 보존/guest 읽기/HTML escape/길이 초과 무변경을 확인했다. 독립 리뷰에서 찾은 missing-column readiness를 root·관리 개요·프로젝트 관리·workspace에 반영했다. D1은 추가 컬럼5개만 생성하는 0005이며 기존 migration은 수정하지 않았다. Native v1 명세는 불변이고 새 v2가 누락 컬럼만 추가한다. populated-v1 upgrade·v2 중단/재개·wrong-type drift 하네스를 추가했지만 실제 MariaDB v2 검증은 별도 exact-commit 실행 대기다. 아직 운영 migration·게시·실제 브라우저 입력은 실행하지 않았다.

### PRD-034 native v2 결과

exact `38602c8fd8c113f3b9a425c91991121cff11ca5f`에서 saved-cloud MariaDB11.4.13 / Node26.11.1 / npm11.20, lockfile 일치 상태로 전용 migration35·추가 원문/파일 보존9·migration unit12·lint/types/FSD PASS. populated v1→v2, 부분 적용 재개, 잘못된 새 타입 거부, 원래 role/private/파일을 확인했다. 기존 DB10개는 그대로이고 새 합성 DB14개를 보존했다. 정지/재기동 snapshot·파일이 일치하며 최종 listener는 없다. v3 업무 상태 검증과 구분한다.

## PRD-035/036 담당·실행 checkpoint (2026-10-09)

담당자/검토자 후보는 현재 쓰기 가능한 member/admin/SU이고 신규 guest 배정은 서버에서도 거부한다. 기존 역할과 public/private 조회 범위는 유지한다. task 내용 편집은 기존 member 권한을 유지하고 실행 상태는 현재 담당자/admin/SU가 변경한다. 검토 필요 여부는 최초 실행 이후 고정하며 planned로 돌아가도 해제할 수 없다. 차단·완료·재개 근거를 기록하고 no-review 완료에는 산출물/완료 기준/담당자 제출이 필요하다. 검토 대기/보완 요청은 일반 상태 action으로 위조할 수 없고 다음 PRD-038 검토 절차에 연결한다.

state/version과 append-only task_events를 같은 transaction에 쓰고 stable token+payload hash로 반복 요청을 구분한다. 생성과 최초 이력도 원자적이다. 기존 작업은 migration 당시 상태라는 baseline을 명시적으로 남기며 과거 생성/재배정 시각을 꾸미지 않는다. D1 0006/native v3는 새 컬럼·이력 테이블·baseline INSERT만 추가한다. native v1/v2는 불변이다. Gantt는 완료 leaf/전체 leaf, 남은 leaf와 상태별 leaf 수를 표시하고 날짜 경과/parentId를 완료율/선행조건으로 사용하지 않는다.

lint0/0, types, FSD5/경계, unit97, Worker build, workflow263, 기존 quality375 PASS. D1 보존 migration fixture도 원래 guest 배정·산출물·상태 baseline·reviewer SET NULL을 확인했다. 독립 리뷰에서 발견한 client token 재사용, planned 우회, 미래 버전 위조, actor/target role 경합을 수정하고 관련 회귀 검사를 추가했다. metadata form은 id+version으로 재마운트해 성공 후 토큰을 갱신한다. 실제 브라우저 연속 입력은 PRD-044에서 확인한다. native v3 동시 실행/반복 제출 하네스를 추가했으며 실제 MariaDB 결과는 정확한 commit에서 실행 대기다. 운영 계정/권한/자료/비밀값 변경 또는 영구 삭제는 없다.

### PRD-035/036 native v3 결과

exact `72a9b391b857aeedf97bf0366727110210017fab`에서 MariaDB11.4.13 / Node26.11.1 / npm11.20 / 동일 lockfile로 additive harness48·migration unit13·lint/types/FSD PASS. v1/v2 checksum, v3 중단/재개·baseline 중복 방지, 생성 replay, 다른 토큰 경합8쌍(승자1/정상 stale1), 같은 토큰8쌍(16성공/중복 이력0), 재배정 후 이전 담당 거부/현재 담당 완료를 확인했다. 내부 deadlock6건은 기존 bounded whole-transaction retry가 처리했고 호출자 SQL 오류는 없었다. 기존 DB24개 그대로, 새 DB15개 보존, 재시작 snapshot 동일, 최종 listener 없음.

## PRD-037 산출물 버전 checkpoint (2026-10-09)

immutable submission_revisions/events, 현재 버전 projection, 안전한 자료 링크, 변경 요약, 버전별 첨부/댓글/이력 화면을 구현했다. 기존 자료 snapshot은 원래 본문·private·작성자·생성 시각·파일 bytes를 보존하며, 당시 편집자를 꾸미지 않는다. D1 0007/native v4는 새 컬럼·두 테이블·보존 snapshot을 추가한다. D1 0008은 cleanup retry 시각과 upload staging 만료를 분리하는 nullable 컬럼 하나이다. 기존 migration/checksum은 불변이다.

lint/types/FSD, unit106, Worker build와 workflow316 PASS. private v1→public v2에서도 v1은 비공개, 현재 private 전환 시 이전 공개 버전도 숨김, 실제 파일 bytes, 반복 업로드/변경 payload 거부/동시 stale/새 버전 파일 제외/관리자 실제 편집자/이력 쓰기 실패 rollback/부적절 링크·길이 거부를 확인했다. 프로젝트 첨부 조회는 전달받은 ID가 오래되어도 매 SQL chunk가 현재+당시 visibility를 재검사한다. 기존 quality375는 staging 분리 전 source에서 PASS이며 최종 전체 gate에서 다시 확인한다. native v4 실제 DB 결과와 브라우저 전체 흐름은 대기다.

저장소 독립 검토가 찾아낸 cleanup backoff에 의한 만료 upload 재허용은 별도 staging_expires_at과 정리 전 irrevocable 회수로 수정했다. metadata transaction이 먼저 완료되면 live reference가 정리를 막고, 회수가 먼저 완료되면 새 metadata의 lease guard가 거부한다. 실제 action은 canonical revision batch만 사용하며 이전 standalone 첨부 mutation helper는 제거했다. 기존 순차 업로드/실패 rollback 검사는 통과했지만, 별도 두 cleanup runner를 의도적으로 정지/재개하는 경합 재현은 플랫폼 검토에 의해 차단되어 미실행이다. 다른 경로로 재시도하지 않았으며 이 검사를 통과한 것으로 계산하지 않는다. 이 경합의 동적 검증과 전체 저장소 독립 검토 완료를 주장하지 않는다. 배포 전 정적 불변식 검토/통합 gate에서 남은 위험을 다시 평가한다.

## PRD-038/039 검토·개인 업무 checkpoint (2026-10-09)

현재 제출 버전에 대한 request/changes/approve/reopen과 개인 업무 페이지를 연결했다. D1 0009/native v5는 nullable 선택 대상2컬럼만 추가한다. 본문/파일/검토 사유는 공개 task DTO로 보내지 않는다. 정확한 현재 대상·역할·담당자·검토자·자체 승인 배제·공개 범위·token/version은 DB transaction에서 재검사한다.

통합 Worker workflow **412 PASS**, unit **112 PASS**, 기존 quality **375 PASS**, credential-free auth **18 PASS**, patched built decoder·lint/types/FSD/build PASS. 가상 세션을 사용한 실제 workerd 검사이며 실제 Google 재로그인을 뜻하지 않는다. 일반 제출→검토→보완→v2→승인, 원문/판정 보존, 권한 강등, private 검토 거부, 일반 task에서 사유 비노출, 동시 정상 판정 한 승자, 이력 실패 rollback, 개인 목록/건수/페이지·기여 댓글 privacy·안전한 돌아가기 URL을 확인했다.

독립 정적 리뷰의 개인 검토 큐 전제 누락과 상태/첨부 action의 returnTo 누락을 수정하고 재확인했다. native v5 전용 추가/동시 검토 하네스는 기존 고립 DB에서 모든 합성 row/file을 남기며 exact-commit 실행 대기다. 별도 차단된 cleanup runner 경합 재현은 계속 미실행이다. 승인된 browser QA는 loopback-only 합성 fixture를 사용하며 테스트 persona 선택은 script에만 있고 production Worker에는 존재하지 않는다. 브라우저 결과는 아직 대기다.

### PRD-037 native v4 결과

exact `b0353724f3277479813352efdd5b47cd2939939d`에서 MariaDB11.4.13 / Node26.11.1 / 동일 lockfile로 additive harness62·migration unit14·lint/types/FSD PASS. 기존 DB39개를 보존하고 새 DB16개와 실제 합성 첨부를 유지했다. 14개 submission version/event가 일치하고 옛 첨부 metadata/bytes가 재시작 후 동일했다. 최종 DB 정지/listener 없음. 제외된 cleanup 경합 재현은 실행하지 않았다.

### PRD-044 로컬 브라우저 제약

합성 fixture는 명시된 loopback URL에서 대기했지만 managed cloud browser에서 두 서버 세션 모두 connection refused였다. 공식 network-escalated readiness 명령은 sandbox mount 오류로 실행되지 않았다. 오류 화면의 브라우저 내부 protocol 접근도 정책상 거부되어 재시도하지 않았다. 포트 공개/네트워크 설정 변경/다른 브라우저 제어로 우회하지 않았고 두 fixture 세션은 종료했다. 따라서 local interactive browser 검증은 아직 통과로 계산하지 않으며 게시 후 정상 HTTPS 페이지에서 지원되는 브라우저 검증으로 확인할 예정이다.

### 최종 P0 completion guard 보강

검토 없는 완료의 담당자 자격도 transaction 안에서 현재 DB role/SU 이메일로 다시 검사하도록 보강했다. 사전 검증과 실제 쓰기의 조건이 같아지며 기존 역할을 확대하지 않는다. native 검토 하네스에 mine/contributed/review SQL 실행·중복 없는 bounded 결과의 읽기 전용 검사를 추가했다. 배포에는 이 최종 source를 사용하며 이전 saved version7은 게시하지 않는다.

### PRD-038/039 최종 native 결과

exact `d18cef86d4b7ed9063d92d41f8b4563ec58e4602` / tree `a24b50a79d1d0e847f175f77d5b59fd1cc147496`에서 native harness77·migration unit15·lint/types/FSD PASS. 내 업무 SQL9조합과 추가 읽기 전용18조합/37 SELECT도 통과했다. 기존 DB72개에 새 합성 DB17개를 더해89개를 보존했고 재시작 전후 snapshot/첨부 bytes가 동일했다. 기존 검증 artifact196개와 별도 DB파일719개는 변하지 않았으며 최종3307 listener 없음.

정확한 한계: 별도 담당자 강등 interleaving은 native에서 재현하지 않았고, native queue는 최종 상태의 빈 검토 대기를 주로 확인하여 양성 pending-review 행을 확인한 것으로 계산하지 않는다. 실제 pending-review 행·1건 count·정확한 제출 버전 링크 및 이후 부적격 조건 제거는 D1 Worker412 시나리오에서 통과했다. 별도 차단된 cleanup runner 재현은 계속 제외했다. 이 결과는 운영 MariaDB 계정 최소권한 적용 또는 운영 데이터 검증을 뜻하지 않는다.

### PRD-044 공개 HTTPS 중간 검증 / 저장 대기 표시

version8은 source `d18cef86d4b7ed9063d92d41f8b4563ec58e4602`에서 2026-10-09 12:07:47 UTC terminal succeeded했다. 추가 migration0005–0009 적용 후 기존 user1/최소 purge receipt1이 같고, 검증 전 운영 프로젝트·업무·제출·첨부·댓글·버그·정리 대기는 모두0인 기준선을 보존했다. 환경 revision11과 공개 audience는 유지했다.

인증된 기존 사용자로 합성 project2, task3/4/5를 생성하고 내 담당 목록→카드→제출3 v1/v2→이전 버전 링크/첨부 원문 보존, 버전2 댓글을 실제 UI에서 확인했다. v1(44bytes)/v2(71bytes) 다운로드와 v2 이후 v1 다운로드의 SHA256이 각각 원본과 같다. 취소한 수정 초안은 저장되지 않았다. 전체 판정·모바일·완료 상태의 최종 결과는 아래 후속 기록에서 확정한다. 계정 역할 변경이나 영구 삭제는 하지 않았다.

일부 버튼의 첫 클릭 직후에는 화면 피드백이 없었으나 같은 요청의 재시도 후 task가1개만 저장됐다. 요청 미전달 원인을 확정하거나 데이터 손실로 단정하지 않는다. 이 UX를 개선해 task 생성/수정/상태, 제출 생성/새 버전, 댓글 생성/수정7곳에 부모 form의 pending 상태를 표시하고 재클릭을 막는 공통 버튼을 추가했다. action/token/권한/삭제 확인은 그대로이며 독립 정적 리뷰에서 변경 누락을 찾지 않았다. lint/types/FSD/build/decoder 검사 통과. UI 변경 후 Worker workflow 첫 실행은 기존 동시 검토 요청 한 건의 HTTP503으로 중단됐고, 같은 명령의 별도 재실행은412 PASS했다. 최초503의 원인을 확인한 것으로 주장하지 않으며 결과를 구분해 보존한다.

### PRD-044 최종 HTTPS 결과 / version9

source `82d7d516ef34ed8718dbfe09d6189b7f81cacfe8` / tree `4144cbda144bc79311f82d30f187c598ab70dbea`가 version9, deployment `appgdep_6ac8dcf66db88191af561d72d4b122b8`로 12:24:42 UTC terminal succeeded했다. archive SHA256 `5fc14d78294a6e05ff2767e30f2c91436df3894598fc11bec611522893f24fd3`, 322files/4,884,480bytes. 공개 URL과 env revision11은 유지했고 추가 migration은 없다.

실제 기존 로그인으로 492px의 내 업무→카드→완료 근거 저장을 수행하고 `상태 저장 중…`·aria-busy=true·disabled를 확인했다. 완료 후 task3 done/version3, 이력3개, leaf1/3(33%)·잔여2, 미완료 큐0건/완료 필터1건, 필터·선택 복귀가 일치했다. light/dark 모바일 메뉴와 업무·버전 이력의 가로 넘침 없음, 두 프로젝트 전환 시 이전 카드 제거/브라우저 Back 복귀를 확인했다. 테스트 후 System theme과 데스크톱 창 크기를 복구했다.

최종 read-only D1 확인: projects2개, tasks3개, task_events5개, submission1개/revisions2개/submission_events2개, 댓글1개, 첨부3행/실제 file2개, cleanup0. 사용자1명과 기존 purge receipt의 전체 row가 게시 전과 같다. 정확한 합성 ID와 파일 hash는 [P0 인수 결과](P0_ACCEPTANCE_2026-10-09.md)에 기록했다. 테스트 자료는 영구 삭제하지 않았다.

별도 정적 storage 리뷰는 현재+과거 visibility, 원본 보존, transaction lease guard, cleanup 회수→참조 검사, canonical production write를 확인했고 검사한 범위에서 actionable defect가 없었다. 보충 adapter/admin 검색 일부는 리뷰 실행기 transport 중단으로 끝내지 못했으므로 exhaustive review로 표시하지 않는다. 차단된 동적 cleanup 경합은 QLT-015, 첫 fixture503 원인은 QLT-016으로 남긴다. 실제 다중 Google 계정 검증·별도 native 강등 interleaving·영구 파기 검사는 미실행이다.

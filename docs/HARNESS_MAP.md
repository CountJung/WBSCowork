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
| `npm run dev` | `tsx scripts/run-next.ts dev` | 개발 서버 | APP_PORT 출력 후 route 응답 |
| `npm run dev:debug` | 위 명령 + `--inspect` | 서버 디버깅 | inspector와 dev server 기동 |
| `npm run build` | `tsx scripts/run-next.ts build` | production compile/build | exit 0, route 생성 성공 |
| `npm run start` | `tsx scripts/run-next.ts start` | production server | 선행 build 후 APP_PORT listen |
| `npm run lint` | `eslint` | 정적 검사 | error/warning 0 |
| `npm run typecheck` | `tsc --noEmit` | 타입 검사 | 출력 없이 exit 0 |
| `npm run check:fsd` | `tsx scripts/check-fsd-boundaries.ts` | FSD import 경계 | fixture self-test 5건 PASS + 저장소 위반 0 |
| `npm run db:check -- --validate-only` | `tsx scripts/check-db.ts` | DB env 파싱만 | 연결 없이 validation passed |
| `npm run db:check` | 동일 | 실제 pool 연결 | DB name/server version 출력, exit 0 |

현재 `test`, `db:migrate` script는 없다. 없는 명령을 문서에 기재하지 않는다.

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
| visibility | lint/typecheck/build | public/private × actor, comment/attachment metadata/download, IDOR |
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

슈퍼관리자로 `/admin/database`에서 상태를 확인하고 초기화를 실행한다. 현재 별도 CLI migration은 없고 `src/shared/server/database-admin`이 database/table 생성과 일부 column 보정을 수행한다.

DB 변경 시 최소 확인 목록:

- 빈 DB에서 6개 managed table 생성
- 기존 DB에서 누락 컬럼 보정의 재실행 가능성
- `users.email` unique, role enum
- task self-FK와 project/assignee FK
- submission visibility default와 author/task FK
- attachment/comment cascade
- runtime 계정에 불필요한 DDL 권한이 없는지(현재 credential 분리는 미구현)

## 5. route smoke matrix

| 대상 | anonymous | guest | member | admin | superuser |
| --- | --- | --- | --- | --- | --- |
| `/` | readiness/로그인 안내 | read | read | read | read |
| `/tasks` | sign-in redirect | public read | write + public/own private | write + all | write + all |
| `/admin`, `/admin/projects`, `/admin/users` | sign-in | `/` redirect | `/` redirect | allow | allow |
| `/admin/database`, `/admin/logs`, `/admin/settings` | sign-in | deny | deny | deny | allow |
| attachment GET | 401 | public만, private 404 | public + 본인 private | allow | allow |

attachment handler는 부모 제출물의 가시성을 검사하고 unauthorized/missing을 모두 404로 응답한다. 자동화된 private IDOR 회귀 테스트는 테스트 인프라 도입 시 추가한다.

## 6. 가시성 focused test 사양(추가 예정)

테스트 인프라를 도입할 때 최소 fixture:

- public submission A, member1 private B, member2 private C
- 각 제출물에 comment, legacy file, multi-attachment
- guest/member1/member2/admin/superuser viewer
- project/task가 다른 교차 식별자

검증:

1. 목록·댓글·첨부 metadata가 부모 가시성을 그대로 따름.
2. 두 download URL의 직접 ID 접근도 같은 결과.
3. 수정/삭제는 author 또는 명시된 관리자만 가능.
4. unauthorized/missing 응답이 자원 열거를 줄임.
5. DB query가 UI 사후 필터가 아니라 bounded viewer filter를 수행.

실제 script를 package.json에 추가하기 전에는 가상의 명령을 기재하지 않는다.

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

## 10. 알려진 기준선 (2026-08-12)

| 명령 | 결과 |
| --- | --- |
| `npm run lint` | 통과 (0 errors, 0 warnings) |
| `npm run typecheck` | 통과 |
| `npm run check:fsd` | 통과 (self-test 5건, 저장소 위반 0건) |
| `npm run build` | 통과. Next.js 16.2.4 Turbopack production build 성공 |
| `npm run db:check` | 미실행 — 이 환경에 MariaDB 인스턴스 없음 |

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

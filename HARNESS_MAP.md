# WBSCowork 하네스 맵

> 실제 `package.json`과 저장소 파일에 존재하는 실행·검증 경로만 기록한다.

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
| `npm run lint` | `eslint` | 정적 검사 | error/warning 정책 충족 |
| `npm run db:check -- --validate-only` | `tsx scripts/check-db.ts` | DB env 파싱만 | 연결 없이 validation passed |
| `npm run db:check` | 동일 | 실제 pool 연결 | DB name/server version 출력, exit 0 |

현재 `test`, `typecheck`, `check:fsd`, `db:migrate` script는 없다.

## 3. 변경 유형별 최소 게이트

| 변경 범위 | 필수 | 조건부/수동 |
| --- | --- | --- |
| 문서만 | `git diff --check`; 링크/파일명 검토 | standalone HTML에서 외부 URL/CDN 없음 확인 |
| TS/TSX/UI | `npm run lint`, `npm run build` | `/`, `/tasks`, 관련 admin desktop/mobile smoke |
| role/auth | lint/build | guest/member/admin/superuser matrix, 로그인/redirect/action 직접 호출 |
| visibility | lint/build | public/private × actor, comment/attachment metadata/download, IDOR |
| repository SQL | lint/build, validate-only | 테스트 DB에서 CRUD/transaction/EXPLAIN |
| schema | 위 + 실제 DB | fresh/existing upgrade, FK/cascade/index, rollback/backup |
| upload/download | lint/build | size limit, MIME/disposition, traversal, missing file, unauthorized 404 |
| FSD 이동 | lint/build | import boundary checker가 실제 추가된 뒤 `npm run check:fsd` |

## 4. DB 검증 층위

### A. 설정 형식

```bash
npm run db:check -- --validate-only
```

`lib/env.ts`의 필수 DB 설정과 숫자 범위를 확인하며 네트워크 연결은 하지 않는다.

### B. 연결

```bash
npm run db:check
```

`lib/db.ts` pool로 실제 MariaDB에 연결한다. DB 미구성/접근 불가 환경의 실패를 코드 실패로 위장하지 않는다.

### C. managed schema

슈퍼관리자로 `/admin/database`에서 상태를 확인하고 초기화를 실행한다. 현재 별도 CLI migration은 없고 `lib/database-admin.ts`가 database/table 생성과 일부 column 보정을 수행한다.

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
| attachment GET | 401 | 부모 visibility 적용 필요 | 부모 visibility 적용 필요 | allow | allow |

마지막 행은 목표 게이트다. 현재 handler는 로그인만 검사하므로 private IDOR 테스트를 추가하고 수정 전 통과로 표시하지 않는다.

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

## 7. 완료 체크

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

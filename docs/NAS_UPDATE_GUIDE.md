# Synology NAS 업데이트와 수동 인수

대상: 기존 NAS의 **Node/Next.js + MariaDB + 로컬 업로드/로그** 실행 환경. main에는 Sites에서 개발한 P0/P1·품질 개선을 같은 앱 기능으로 통합한다. Sites의 D1/R2 데이터나 환경 설정을 NAS로 복사하지 않는다. NAS에 직접 접속·배포하거나 운영 DB/계정/권한을 변경한 결과가 아니라, 운영자가 적용하고 수동 확인할 절차다.

## 실행 경로

| 용도 | 명령 | 결과/조건 |
| --- | --- | --- |
| main 기본 빌드 | `npm run build` | native Next `.next/` 생성 |
| 명시적 native 빌드 | `npm run build:native` | 기본 빌드와 같은 Next 경로 |
| 기존 native 별칭 | `npm run build:next` | 같은 Next 경로 유지 |
| native 기동 | `npm run start` | 기존 `APP_PORT`, MariaDB와 로컬 파일 사용 |
| native 개발 | `npm run dev` | 개발 서버; 운영 기동 대체 아님 |
| Worker 빌드 | `npm run build:sites` | `dist/` 생성; NAS 기동에 사용하지 않음 |
| migration 상태 | `npm run db:migrate -- --status` | 읽기 전용; 기본 무인자도 상태 조회 |
| migration 적용 | `npm run db:migrate -- --apply` | 아래 백업·점검 창·대상 확인 후 운영자가 명시 실행 |

feature 브랜치의 기본 build는 기존 Sites/Vinext를 유지한다. 양쪽에서 `build:native`와 `build:sites`로 대상을 명시할 수 있다. main을 추후 Sites에 반영하려면 검증된 Worker 빌드와 공식 Site 절차를 별도로 수행해야 하며 이번 통합이 공개 Site v10을 재게시하지 않는다.

## 업데이트 전 확인

- [ ] NAS의 실제 Node/npm/MariaDB 버전, CPU 아키텍처, DSM/컨테이너 이미지, 서비스 계정과 작업 디렉터리를 기록한다. 이번 소스 빌드 확인은 Linux Node24.19.0/npm11.9.0이다. 전체 lockfile의 build 도구는 Node22.12 이상이 필요하며 NAS의 실제 플랫폼을 대신 검증한 것은 아니다. 이전 native DB fixture는 MariaDB11.4.13이었다.
- [ ] 현재 commit과 서비스 실행 명령을 기록한다. `git status --short`에 로컬 변경이 있으면 먼저 보존하고 비교한다. 강제 reset/clean이나 운영 파일 삭제로 맞추지 않는다.
- [ ] 앱 쓰기를 멈출 점검 창과 복구 책임자를 정한다. 서비스 중지/재시작은 기존 NAS 운영 방식으로 수행하며 이 문서는 컨테이너·네트워크·권한 설정을 새로 만들지 않는다.
- [ ] 같은 시점의 MariaDB 백업과 실제 `UPLOAD_DIR`를 함께 백업하고 복원 가능 여부를 확인한다. 기존 환경 파일/서비스 설정과 필요한 `LOG_DIR`도 별도 안전한 장소에 보존한다. 백업·자격증명을 Git이나 채팅에 넣지 않는다.
- [ ] `DB_NAME/HOST/PORT`, HTTPS origin/Google callback, 기존 `SUPERUSER_EMAIL`, `UPLOAD_DIR/LOG_DIR`, 서비스 작업 디렉터리를 확인한다. 상대 경로는 release 디렉터리가 바뀌면 다른 곳을 가리킬 수 있다. 기존 파일의 위치·소유권·서비스 접근 권한을 유지한다.
- [ ] 새 schema 계정이 없거나 필요한 권한이 불명확하면 운영자가 별도로 결정한다. 앱이 계정/비밀번호를 생성하거나 GRANT/REVOKE하지 않는다. 실제 QLT-013 최소권한 구성은 아직 완료로 표시하지 않는다.

## 코드와 의존성 준비

아래 명령은 기존 checkout을 제자리 갱신한다. 먼저 기존 NAS 운영 방식으로 앱 서비스를 중지하고 쓰기가 멈췄는지 확인한 뒤, 같은 시점의 DB·UPLOAD_DIR 백업과 환경/서비스 설정 보존을 마친다. 실행 중인 서비스 아래에서 `npm ci`나 `.next` 빌드를 수행하지 않는다. 이후 작업 폴더가 깨끗하고 main에 별도 로컬 commit이 없는지 확인한 후 사용한다. 충돌/분기가 보이면 강제로 덮지 말고 중단해 비교한다.

```bash
git fetch origin main
git switch main
git pull --ff-only origin main
npm ci --include=dev
npm run lint
npm run typecheck
npm run check:fsd
npm run build:native
```

- `npm ci`는 lockfile을 사용한다. build에는 개발 의존성이 필요하다. `tsx`와 `@next/env`는 production 의존성이므로 빌드 후 production-only 설치에서도 native start/migration CLI가 필요한 loader를 잃지 않는다. `.next`만 복사해 시작하거나 migration에 필요한 `scripts/`, `src/`, `tsconfig.json`을 빠뜨리지 않는다.
- 기본 Next16 compiler는 Turbopack이다. 실제 NAS에서 기본 빌드를 확인한다. Webpack을 명시하려면 `npm run build:native -- --webpack` 또는 `npm run build -- --webpack`을 사용한다.
- `next/font/google`는 빌드 시 Roboto CSS/폰트 다운로드가 필요하다. 네트워크 제한으로 실패하면 성공으로 간주하지 않는다. 이번 dot 빌드는 캐시된 실제 Roboto 파일을 쓴 환경 전용 오프라인 fixture + Webpack 결과이며, 그 fixture 설정을 NAS에 복사하지 않는다. 같은 fixture의 Turbopack 빌드는 font import-map 오류로 실패했고 동적 로그 경로 NFT 추적 경고도 관찰했다. 실제 NAS 기본 빌드 결과와 구분하며 [하네스 기록](HARNESS_MAP.md#2026-10-10-native-통합-준비)에 남겼다.
- 기존 `.env`, `.env.local`, production 환경 파일과 서비스에서 주입한 값의 우선순위를 유지한다. 예제 값으로 덮어쓰거나 새 NextAuth secret을 만들지 않는다. 인증 URL은 기존 NAS HTTPS origin이며 Sites 주소로 바꾸지 않는다.

## MariaDB v1–v8 적용

실제 운영 DB에 쓰기 전에 [native migration 계약](NATIVE_DATABASE_MIGRATIONS.md)을 읽는다. D1용 `drizzle/*.sql`이나 `db:generate`를 MariaDB에 적용하지 않는다.

1. 아직 서비스를 시작하지 않은 점검 창에서 기존 runtime 설정으로 `npm run db:migrate -- --status`를 실행한다. DB 이름과 존재 여부, 적용/대기 버전, 오류를 확인한다. exit0만으로 준비 완료라고 판단하지 않는다. 이 명령은 ledger/필수 표·컬럼 존재를 읽으며 전체 drift 검증을 수행하지 않는다.
2. DB 대상이 예상과 다르거나 schema/checksum 오류가 있으면 중단한다. `DB_SCHEMA_USER/DB_SCHEMA_PASSWORD`는 같은 DB 서버/이름에 대한 별도 schema identity다. 미설정 시 runtime 계정으로 자동 대체하지 않는다. 기존의 승인된 보안 설정 경로로 운영자가 구성하며 웹 설정 폼에는 노출·편집하지 않는다.
3. 쓰기 중지와 백업을 확인한 운영자만 `npm run db:migrate -- --apply`를 실행한다. v1–v8은 새 구조/ledger와 필요한 baseline 기록을 추가한다. 기존 사용자 role·private 원문·ID·파일 bytes를 다른 환경에서 덮어쓰지 않는다. 데이터량에 따라 시간·공간·잠금 비용이 있으므로 NAS에서 따로 확인한다.
4. `npm run db:migrate -- --status`를 다시 실행해 적용 버전 1–8, pendingVersions 빈 배열, 오류 없음과 15개 관리 표 준비를 확인한다. 관리 표 15개 외에 `schema_migrations` ledger가 별도로 있다. `--apply`는 schema postcondition도 검사한다.
5. 기존 프로젝트/업무/제출/댓글/첨부·사용자 수와 대표 ID/role/private 내용을 백업 전 기준과 대조한다. v3의 task baseline, v4의 submission revision/event baseline은 새 기록이므로 총 이력 수가 증가할 수 있다. 옛 편집 시각이나 담당 변경을 추측해 생성한 기록은 아니다.
6. 기존 NAS 서비스 명령으로 `npm run start`를 실행하고 아래 수동 인수를 수행한다. `APP_PORT`를 기존 reverse proxy upstream과 맞추며 인증/네트워크 설정을 자동 변경하지 않는다.

## 수동 인수 체크리스트

실제 자료를 수정하는 대신 구분 가능한 합성 프로젝트/업무·작은 파일을 사용하고 ID를 기록한다. 역할 검사는 이미 준비된 별도 사용자 계정으로 한다. 테스트 때문에 실제 계정의 권한을 임의로 바꾸지 않는다.

### 기존 자료와 인증

- [ ] 기존 Google 로그인, HTTPS callback(`/api/auth/callback/google`), 재접속/로그아웃, 기존 역할과 슈퍼관리자 표시가 기대와 같다.
- [ ] 기존 프로젝트·담당자·공개/비공개 제출물과 첨부를 읽을 수 있다. 예전 파일의 다운로드 내용이 원본과 같다.
- [ ] guest/member/admin/SU의 기존 조회·수정 경계를 확인한다. guest/member는 타인의 비공개 직접 링크/첨부가 거부되고, admin/SU는 기존 관리 권한으로 조회할 수 있다. 담당자·검토자 지정만으로 private 접근이 늘지 않는다.
- [ ] admin 일반 화면과 SU DB/설정/로그 화면의 구분이 유지된다. native 관리자 개요는 MariaDB/로컬 파일을 안내하고 schema credential 값은 설정 목록에 나오지 않는다. 이번 검사에서 실제 비밀값을 바꾸지 않는다.

### P0: 주제에서 제출·완료까지

- [ ] 프로젝트 목표/성공 기준과 업무별 산출물/완료 기준을 작성하고 다시 연다. 일반 구성원도 조회 권한 내 프로젝트를 전환한다.
- [ ] 상하위 업무, 수행 가능한 담당자, 검토 필요/불필요를 설정한다. 내 업무의 상태·기한·담당/검토 대기가 해당 계정과 일치한다.
- [ ] 검토 없는 업무는 현재 담당자가 완료한다. 검토 업무는 제출→선택한 정확한 버전 검토 요청→보완 요청→새 버전 제출→다른 적격 검토자 승인으로 완료한다. 자기 승인은 거부된다.
- [ ] 텍스트·자료 링크·작은 한글 파일로 두 버전을 만들고 이전 본문/파일/댓글 연결을 확인한다. 과거 파일 제외는 새 버전 변경이며 옛 버전 bytes가 없어지지 않는다.
- [ ] 연속 클릭, 저장 중 취소/뒤로가기와 재조회에서 중복 업무/제출/이력이 생기지 않는다. 간트 완료율은 날짜 경과가 아닌 완료 leaf 기준이다.

### P1: 선후행·템플릿·검색·알림

- [ ] 같은 프로젝트의 선행 업무를 연결하고 순환/다른 프로젝트 연결 거부를 확인한다. 선행 미완료 시 시작·완료·검토 전이가 막히고, 완료 후 진행된다. 완료 선행을 다시 열면 관련 경고를 확인한다.
- [ ] 수동 템플릿을 미리 보고 제목·완료 기준·기준일·담당·포함 여부를 조정한다. 취소는 저장하지 않고 적용/재클릭은 한 번만 생성한다. 기본 담당자는 미배정이다.
- [ ] 검색의 프로젝트/담당/상태/날짜/기한 경과와 최신·승인·전체 버전 필터를 확인한다. 비공개 본문/파일명은 검색 결과·건수에도 권한 없이 나오지 않는다.
- [ ] 다른 구성원의 배정/검토 요청/보완/댓글로 해당 수신자의 앱 내 알림을 확인한다. 읽음·미읽음/링크와 현재 권한을 확인하며 외부 이메일/메신저 발송은 없다.

### 운영과 버그 기록

- [ ] 데스크톱/모바일과 밝은/어두운 테마에서 핵심 페이지를 확인한다. NAS 재시작 후 DB·첨부·내 업무·알림 상태와 같은 경로가 유지된다.
- [ ] native 감사 로그가 기존 `LOG_DIR`에 쌓이고 SU가 조회할 수 있다. 로그 보존 정책/볼륨 공간을 확인한다.
- [ ] 합성 버그 한 건으로 제보→추가 설명→검토/해결→검증 완료→휴지통→복원을 확인한다. 원문과 이력은 유지된다.
- [ ] 검증 결과/버그 ID를 기록한다. 프로젝트 파기와 버그 영구 삭제는 기본 인수에서 제외한다. 현재 프로젝트 파기는 DB cascade 후 파일 정리를 수행하는 복구 불가능한 기능이며 파일 정리 실패가 남을 수 있다. 필요하면 정확한 대상을 따로 판단한다.

## 실패 시 중단과 복구

- 적용 전에 빌드/설정/대상 확인이 실패하면 운영 DB를 변경하지 말고 기존 서비스를 유지하거나 점검 상태로 둔다.
- MariaDB DDL은 implicit commit이므로 전체 migration이 하나의 rollback으로 취소되지 않는다. 중단 시 상태를 먼저 읽고 같은 명세의 재개/forward fix를 검토한다. checksum/ledger를 고치거나 표/컬럼을 지우는 자동 down은 없다.
- v3/v4 이후 옛 코드로 돌아가서 새 쓰기를 허용하면 업무 상태·제출 버전·파일 참조 규칙이 맞지 않을 수 있다. 코드만 되돌리면 안전하다고 가정하지 않는다. 쓰기를 중지한 상태에서 호환성을 검토하고, 필요 시 같은 시점 DB+파일 백업 복원을 운영자가 결정한다. 백업 이후 쓰기를 잃을 수 있다.
- 이 문서는 실제 NAS 배포/DB 변경/다중 실계정 인수를 완료했다는 증거가 아니다. QLT-013 실제 운영 최소권한, QLT-015 차단된 cleanup 경합, QLT-016 fixture503 원인, OPS-031 native 파기 전체 검증은 기존 열린 항목으로 남는다.

## 소스 확인 범위

공통 checkpoint `b43704e89dd48ebe6304510fe420ccda3d218c5b`에서 합성 CLI/설정 파일 보존 8조건, lint/typecheck/FSD와 위 Webpack fixture 빌드를 확인했다. main 후속 변경은 native 기본 build와 이 문서 인계이며 앱/SQL 로직은 동일하다. 기존 P0/P1의 D1 및 MariaDB 검증 기록은 [P0](P0_ACCEPTANCE_2026-10-09.md), [P1](P1_ACCEPTANCE_2026-10-09.md)에 있고 이번 NAS 실행 결과를 의미하지 않는다.

# Native MariaDB 스키마 운영

## 계정 경계 (QLT-013)

- 일반 질의·로그인·readiness는 기존 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`만 사용한다.
- 명시적인 native 스키마 변경은 같은 서버/DB 대상의 `DB_SCHEMA_USER/DB_SCHEMA_PASSWORD`를 별도 읽는다. 없거나 일부만 설정하면 runtime 계정으로 대체하지 않고 중단한다. 슈퍼관리자 action 검사도 그대로 유지한다.
- schema 계정/비밀번호는 일반 RuntimeEnv·admin status·로그·설정 편집 폼에 포함하지 않는다. 화면에는 설정 존재 여부만 표시한다.
- 운영자는 별도 identity를 안전한 설정 경로로 구성하고 runtime 계정의 DDL 권한을 제거해야 한다. 앱 코드가 DB 계정 생성, GRANT/REVOKE, 비밀번호 전달을 수행하지 않는다. 이 운영 단계는 아직 승인·검증되지 않았다.
- 권장 runtime 범위는 도메인 테이블의 필요한 SELECT/INSERT/UPDATE/DELETE와 migration ledger SELECT다. DB 전체 쓰기를 허용하면 ledger 변조도 가능하므로 per-table 범위를 검토한다. 실제 권한은 운영자가 현재 구성과 백업/복구 계획을 확인하고 결정한다.
- 별도 키를 입력했다고 서로 다른 identity나 DDL 거부가 증명되지는 않는다. 적용 후 runtime의 정상 DML/readiness와 CREATE/ALTER/TRUNCATE 및 ledger 변경 거부를 격리 환경에서 검증해야 한다.
- Sites D1은 Worker binding과 게시 시 migration을 사용한다. 위 native 자격증명을 Sites에 넣거나 runtime DDL을 활성화하지 않는다.

테스트는 `TEST_DB_SCHEMA_*`만 사용한다. 일반 fixture의 기본값은 기존 테스트 DB identity이며 실제 최소권한 분리를 증명하지 않는다. 이전 destructive fixture/TRUNCATE나 영구 삭제 테스트는 별도 승인 없이 재개하지 않는다.

## 검증 기록

2026-10-09 코드 checkpoint: lint0/0, typecheck, FSD5/경계, unit73 PASS. 4개 새 계약은 누락/부분 설정의 fail-closed, runtime-only readiness, schema 값의 비직렬화, 미설정 초기화가 연결 전에 중단되는 것을 검사한다. 실제 운영 credential 구성/GRANT/REVOKE 및 DDL 거부 시험은 미실행이다.


## 버전·적용 절차 (QLT-012)

D1은 기존 `drizzle/` 게시 migration을 유지한다. Native MariaDB는 `native-migration-v1.ts`의 불변 baseline+기존 schema additive upgrade를 `schema_migrations(version,name,checksum,applied_at)`로 추적한다. 이미 적용된 명세는 편집하지 않고 새 버전/handler를 추가한다. v1 checksum은 `8dea300dc59fc6a4d7c0fcb0a54b4a4fdec2db9d2681b303be9c1208d7007092`다.

1. 운영자가 앱 쓰기 중지/점검 창과 검증된 백업을 준비한다. 이 문서는 실제 운영 적용 승인을 대신하지 않는다.
2. `npm run db:migrate -- --status`는 runtime identity로 읽기만 수행한다. ledger 없음/대기/검증 오류를 구분하며 조회가 ledger를 생성하지 않는다.
3. 명시적으로 승인된 대상에서만 `npm run db:migrate -- --apply` 또는 기존 SU 관리 화면의 Native migration 적용을 실행한다. 별도 schema identity가 필요하다.
4. 하나의 전용 연결이 DB별 `GET_LOCK(...,10)`을 획득하고 생성/검증/ledger 기록/명시 COMMIT/lock release를 수행한다. schema 연결은 항상 닫으며 일반 deadlock 재시도를 사용하지 않는다.
5. 알려지지 않은 버전·중복/빈 순서·name/checksum 불일치는 domain DDL 전에 거부한다. 각 버전은 postcondition 검증 후에만 성공을 기록한다. 기존 필드의 타입/nullable/default/identity, 전체 길이 index/unique, FK target/delete rule, CHECK, InnoDB/utf8mb4_unicode_ci를 확인한다.
6. 문서화된 누락 컬럼/FK만 추가한다. legacy role은 정확한 `admin/member/guest` 값일 때만 ENUM/default를 확장한다. `ADMIN`, 공백/알 수 없는 role 등을 권한 값으로 자동 변환하지 않는다. 원문/이력/private/ID를 재작성하지 않는다.
7. 이미 적용된 상태에서도 schema drift를 확인한다. schema 접속/driver 오류는 계정명·비밀번호·SQL을 UI/감사 로그에 그대로 전파하지 않고 안전한 코드/운영 안내만 전달한다.

## 실패·복구·rollback

MariaDB의 CREATE/ALTER는 [암묵적으로 commit](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit)한다. 일반 transaction rollback으로 DDL을 되돌린다고 주장하지 않는다. [GET_LOCK](https://mariadb.com/docs/server/reference/sql-functions/secondary-functions/miscellaneous-functions/get_lock)은 연결 단위이며 commit을 지나도 유지된다.

- DDL 중단 후 성공 ledger가 없으면 원인을 해결하고 현재 schema를 확인한 뒤 같은 명세를 재실행한다. 존재하는 구조는 검사하고 누락된 부분만 이어 간다.
- ledger INSERT/COMMIT/접속 결과가 불확실하면 자동 재시도하지 않는다. 새 연결에서 상태를 먼저 확인한다. commit된 ledger를 지우거나 checksum을 강제 재작성하는 복구 스위치는 없다.
- 기본 복구는 forward fix다. 코드 rollback은 추가된 schema를 허용하는 이전 코드인지 확인해야 하며 추가 컬럼·ledger를 자동 삭제하지 않는다.
- DB 백업 복원은 이후 쓰기를 잃을 수 있으므로 대상/범위가 확인된 별도 운영 결정이다. 자동 down/DROP이나 기록 삭제 명령은 제공하지 않는다.

## 비파괴 native 검증

`npm run test:native:migrations`는 `.env`를 읽지 않고 `TEST_DB_*`/`TEST_DB_SCHEMA_*`만 사용하며 loopback:3307을 강제한다. 무작위 새 `wbs_mig_*_test` DB만 생성하고 모든 DB/행을 보존한다. 빈 설치, 기존 core/pre-lifecycle upgrade, 재실행·원문/role/private 보존, 겹치는 fresh runner, DDL 후 ledger 전 중단/재개, autocommit0 durable ledger, 대문자/공백 role·prefix unique index·latin1 drift·checksum 오류 거부를 검사한다. 실제 계정/권한 변경, DELETE/DROP/TRUNCATE/purge가 없다.

로컬 dot 검증: lint/types/FSD, unit85, Worker build/quality375/auth18 및 RSC decoder fingerprint PASS. schema identity 단위 계약은 이후 driver 오류정보 비노출 검사를 포함해 5건이다. 운영 최소권한 적용이나 운영 migration 완료를 뜻하지 않는다.

2026-10-09 saved-cloud exact `cecce92e06c0b042441352445f4ce9856c6bc87e` / tree `0128b071bf33f2ebe77d4340a78831d52c1c4c62`: Node26.11.1, lockfile의 React19.2.8을 포함한 685 packages에 맞췄다. lint/types/FSD와 native migration 단위11건은 통과했다. 실제 `npm run test:native:migrations`는 **127.0.0.1:3307 ECONNREFUSED, exit1**로 SQL/DB 생성 전에 중단됐다. 기존 tmpfs DB 재기동은 초기화/테스트 계정 구성과 정지 시 데이터 소멸을 수반하므로 실행하지 않았다. 기존 보존 DB 파일600개의 hash는 그대로다. 이 최초 실행을 통과로 계산하지 않았으며, 이후 승인된 재실행 결과는 아래와 같다.

이후 사용자가 격리 영속 테스트 DB/계정 구성과 전용 하네스 실행을 승인했다. 이 승인은 운영 QLT-013 권한 변경이나 기존 native purge 테스트를 포함하지 않는다.


### 승인된 영속 fixture 재검증 결과

같은 `cecce92e`에서 MariaDB11.4.13 / Node26.11.1 / npm11.20과 정확한 lockfile로 **27 PASS**. 빈 설치·기존 core/pre-lifecycle upgrade, 재실행·내용/private/역할/이력 보존, 겹치는 fresh runner, 중단/재개, autocommit0 durable ledger, 잘못된 schema/role/checksum 거부를 확인했다. 합성 DB10개/테이블100개를 보존했고 DB 정지·재기동 후 schema/data snapshot이 모두 일치했다. 기존 보존 DB 파일719개와 artifact21개는 변경되지 않았다. 마지막에는 DB를 정상 정지했고 listener도 없다.

테스트 listener는 실행 중 127.0.0.1:3307로 한정됐다. 실제 운영 계정의 DDL/ledger 거부, 운영 credential 구성, 실제 운영 migration 및 과거 native purge fixture는 수행하지 않았다. QLT-012의 migration 구현/검증은 완료이며 QLT-013의 실제 최소권한 운영 단계는 별도다.

## 업무 목표 v2 (PRD-034)

새 명세 `native-migration-v2.ts`의 checksum은 `c010a7e166ece374ab7b8046086fa67011225cebca5f5435928f5289e8ca8549`다. v1 명세·checksum은 그대로다. projects의 goal/success_criteria와 tasks의 deliverable/definition_of_done/review_required를 additive ALTER로 추가한다. 기존 행은 빈 문구/검토 안 함으로 보존되고 원래 값과 ID를 재작성하지 않는다. v2 도중 중단되면 누락 필드만 재개하며 잘못된 기존 타입은 거부한다.

전용 native 하네스는 populated-v1 ledger/행 보존, 부분 v2 재개, 잘못된 v2 필드 거부를 추가했다. 실제 MariaDB v2 검증은 exact-commit 실행 대기다. D1은 별도 `drizzle/0005_work_goals.sql`을 사용한다. 새 코드 배포 전 schema 적용이 필요하며 readiness는 필수 새 컬럼이 없을 때 안내한다.

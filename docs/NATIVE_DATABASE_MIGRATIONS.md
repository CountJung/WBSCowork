# Native MariaDB 스키마 운영

## 계정 경계 (QLT-013)

- 일반 질의·로그인·readiness는 기존 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`만 사용한다.
- 명시적인 native 스키마 변경은 같은 서버/DB 대상의 `DB_SCHEMA_USER/DB_SCHEMA_PASSWORD`를 별도 읽는다. 없거나 일부만 설정하면 runtime 계정으로 대체하지 않고 중단한다. 슈퍼관리자 action 검사도 그대로 유지한다.
- schema 계정/비밀번호는 일반 RuntimeEnv·admin status·로그·설정 편집 폼에 포함하지 않는다. 화면에는 설정 존재 여부만 표시한다. `.env`/`.env.local`의 해당 키는 추가 설정 목록에서도 제외하며 일반 설정 저장 시 기존 server-side entry를 보존한다. 웹 폼으로 새 schema 값을 입력하거나 바꾸지 않는다.
- 운영자는 별도 identity를 안전한 설정 경로로 구성하고 runtime 계정의 DDL 권한을 제거해야 한다. 앱 코드가 DB 계정 생성, GRANT/REVOKE, 비밀번호 전달을 수행하지 않는다. 이 운영 단계는 아직 승인·검증되지 않았다.
- 권장 runtime 범위는 도메인 테이블의 필요한 SELECT/INSERT/UPDATE/DELETE와 migration ledger SELECT다. DB 전체 쓰기를 허용하면 ledger 변조도 가능하므로 per-table 범위를 검토한다. 실제 권한은 운영자가 현재 구성과 백업/복구 계획을 확인하고 결정한다.
- 별도 키를 입력했다고 서로 다른 identity나 DDL 거부가 증명되지는 않는다. 적용 후 runtime의 정상 DML/readiness와 CREATE/ALTER/TRUNCATE 및 ledger 변경 거부를 격리 환경에서 검증해야 한다.
- Sites D1은 Worker binding과 게시 시 migration을 사용한다. 위 native 자격증명을 Sites에 넣거나 runtime DDL을 활성화하지 않는다.

테스트는 `TEST_DB_SCHEMA_*`만 사용한다. 일반 fixture의 기본값은 기존 테스트 DB identity이며 실제 최소권한 분리를 증명하지 않는다. 이전 destructive fixture/TRUNCATE나 영구 삭제 테스트는 별도 승인 없이 재개하지 않는다.

## 검증 기록

2026-10-09 코드 checkpoint: lint0/0, typecheck, FSD5/경계, unit73 PASS. 4개 새 계약은 누락/부분 설정의 fail-closed, runtime-only readiness, schema 값의 비직렬화, 미설정 초기화가 연결 전에 중단되는 것을 검사한다. 실제 운영 credential 구성/GRANT/REVOKE 및 DDL 거부 시험은 미실행이다.


## 버전·적용 절차 (QLT-012)

D1은 기존 `drizzle/` 게시 migration을 유지한다. Native MariaDB는 `native-migration-v1.ts`–`native-migration-v14.ts`의 불변 명세와 기존 schema additive upgrade를 `schema_migrations(version,name,checksum,applied_at)`로 추적한다. 이미 적용된 명세는 편집하지 않고 새 버전/handler를 추가한다. v1 checksum은 `8dea300dc59fc6a4d7c0fcb0a54b4a4fdec2db9d2681b303be9c1208d7007092`다.

1. 운영자가 앱 쓰기 중지/점검 창과 검증된 백업을 준비한다. 이 문서는 실제 운영 적용 승인을 대신하지 않는다.
2. `npm run db:migrate -- --status`는 runtime identity로 읽기만 수행한다. ledger 없음/대기/검증 오류를 구분하며 조회가 ledger를 생성하지 않는다.
3. 명시적으로 승인된 대상에서만 `npm run db:migrate -- --apply` 또는 기존 SU 관리 화면의 Native migration 적용을 실행한다. 별도 schema identity가 필요하다.
4. 하나의 전용 연결이 DB별 `GET_LOCK(...,10)`을 획득하고 생성/검증/ledger 기록/명시 COMMIT/lock release를 수행한다. schema 연결은 항상 닫으며 일반 deadlock 재시도를 사용하지 않는다.
5. 알려지지 않은 버전·중복/빈 순서·name/checksum 불일치는 domain DDL 전에 거부한다. 각 버전은 postcondition 검증 후에만 성공을 기록한다. 기존 필드의 타입/nullable/default/identity, 전체 길이 index/unique, FK target/delete rule, CHECK, InnoDB/utf8mb4_unicode_ci를 확인한다.
6. 문서화된 누락 컬럼/FK만 추가한다. legacy role은 정확한 `admin/member/guest` 값일 때만 ENUM/default를 확장한다. `ADMIN`, 공백/알 수 없는 role 등을 권한 값으로 자동 변환하지 않는다. 원문/이력/private/ID를 재작성하지 않는다.
7. `--apply`는 이미 적용된 상태에서도 schema drift를 확인한다. `--status`는 ledger와 readiness를 읽으며 같은 전체 postcondition 검증을 대신하지 않는다. schema 접속/driver 오류는 계정명·비밀번호·SQL을 UI/감사 로그에 그대로 전파하지 않고 안전한 코드/운영 안내만 전달한다.

## 실패·복구·rollback

MariaDB의 CREATE/ALTER는 [암묵적으로 commit](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit)한다. 일반 transaction rollback으로 DDL을 되돌린다고 주장하지 않는다. [GET_LOCK](https://mariadb.com/docs/server/reference/sql-functions/secondary-functions/miscellaneous-functions/get_lock)은 연결 단위이며 commit을 지나도 유지된다.

- DDL 중단 후 성공 ledger가 없으면 원인을 해결하고 현재 schema를 확인한 뒤 같은 명세를 재실행한다. 존재하는 구조는 검사하고 누락된 부분만 이어 간다.
- ledger INSERT/COMMIT/접속 결과가 불확실하면 자동 재시도하지 않는다. 새 연결에서 상태를 먼저 확인한다. commit된 ledger를 지우거나 checksum을 강제 재작성하는 복구 스위치는 없다.
- 기본 복구는 forward fix다. 코드 rollback은 추가된 schema를 허용하는 이전 코드인지 확인해야 하며 추가 컬럼·ledger를 자동 삭제하지 않는다.
- DB 백업 복원은 이후 쓰기를 잃을 수 있으므로 대상/범위가 확인된 별도 운영 결정이다. 자동 down/DROP이나 기록 삭제 명령은 제공하지 않는다.

## 비파괴 native 검증

`npm run test:native:migrations`는 `.env`를 읽지 않고 `TEST_DB_*`/`TEST_DB_SCHEMA_*`만 사용하며 loopback:3307을 강제한다. 무작위 새 `wbs_mig_*_test` DB만 생성하고 DB·도메인 자료·이력을 보존한다. 빈 설치, 기존 core/pre-lifecycle upgrade, 재실행·원문/role/private 보존, 겹치는 fresh runner, DDL 후 ledger 전 중단/재개, autocommit0 durable ledger, 대문자/공백 role·prefix unique index·latin1 drift·checksum 오류 거부를 검사한다. DB/프로젝트/업무/파일/이력의 purge, DROP/TRUNCATE나 실제 계정/권한 변경은 하지 않는다. P1 확장 이후에는 새 합성 `task_dependencies` 관계 집합을 같은 transaction에서 교체하는 DELETE가 포함된다. 원래 관계는 event에 보존되고 rollback/이전 집합 복원을 검사하며, 이 신규 테스트 DB의 해당 표에 한해서만 승인된 DELETE 권한을 사용했다. 기존 보존 DB 정리나 프로젝트 파기가 아니다.

로컬 dot 검증: lint/types/FSD, unit85, Worker build/quality375/auth18 및 RSC decoder fingerprint PASS. schema identity 단위 계약은 이후 driver 오류정보 비노출 검사를 포함해 5건이다. 운영 최소권한 적용이나 운영 migration 완료를 뜻하지 않는다.

2026-10-09 saved-cloud exact `cecce92e06c0b042441352445f4ce9856c6bc87e` / tree `0128b071bf33f2ebe77d4340a78831d52c1c4c62`: Node26.11.1, lockfile의 React19.2.8을 포함한 685 packages에 맞췄다. lint/types/FSD와 native migration 단위11건은 통과했다. 실제 `npm run test:native:migrations`는 **127.0.0.1:3307 ECONNREFUSED, exit1**로 SQL/DB 생성 전에 중단됐다. 기존 tmpfs DB 재기동은 초기화/테스트 계정 구성과 정지 시 데이터 소멸을 수반하므로 실행하지 않았다. 기존 보존 DB 파일600개의 hash는 그대로다. 이 최초 실행을 통과로 계산하지 않았으며, 이후 승인된 재실행 결과는 아래와 같다.

이후 사용자가 격리 영속 테스트 DB/계정 구성과 전용 하네스 실행을 승인했다. 이 승인은 운영 QLT-013 권한 변경이나 기존 native purge 테스트를 포함하지 않는다.


### 승인된 영속 fixture 재검증 결과

같은 `cecce92e`에서 MariaDB11.4.13 / Node26.11.1 / npm11.20과 정확한 lockfile로 **27 PASS**. 빈 설치·기존 core/pre-lifecycle upgrade, 재실행·내용/private/역할/이력 보존, 겹치는 fresh runner, 중단/재개, autocommit0 durable ledger, 잘못된 schema/role/checksum 거부를 확인했다. 합성 DB10개/테이블100개를 보존했고 DB 정지·재기동 후 schema/data snapshot이 모두 일치했다. 기존 보존 DB 파일719개와 artifact21개는 변경되지 않았다. 마지막에는 DB를 정상 정지했고 listener도 없다.

테스트 listener는 실행 중 127.0.0.1:3307로 한정됐다. 실제 운영 계정의 DDL/ledger 거부, 운영 credential 구성, 실제 운영 migration 및 과거 native purge fixture는 수행하지 않았다. QLT-012의 migration 구현/검증은 완료이며 QLT-013의 실제 최소권한 운영 단계는 별도다.

## 업무 목표 v2 (PRD-034)

새 명세 `native-migration-v2.ts`의 checksum은 `c010a7e166ece374ab7b8046086fa67011225cebca5f5435928f5289e8ca8549`다. v1 명세·checksum은 그대로다. projects의 goal/success_criteria와 tasks의 deliverable/definition_of_done/review_required를 additive ALTER로 추가한다. 기존 행은 빈 문구/검토 안 함으로 보존되고 원래 값과 ID를 재작성하지 않는다. v2 도중 중단되면 누락 필드만 재개하며 잘못된 기존 타입은 거부한다.

전용 native 하네스는 populated-v1 ledger/행 보존, 부분 v2 재개, 잘못된 v2 필드 거부를 추가했다. 아래에 후속 exact-commit MariaDB 결과를 기록한다. D1은 별도 `drizzle/0005_work_goals.sql`을 사용한다. 새 코드 배포 전 schema 적용이 필요하며 readiness는 필수 새 컬럼이 없을 때 안내한다.

v2 실제 검증: exact38602c8에서 migration35, 추가 보존9, migration unit12, lint/types/FSD PASS. MariaDB11.4.13/Node26.11.1의 승인된 영속 fixture에서 새 DB14개를 보존하고 기존 DB와 정지/재시작 데이터·파일을 확인했다.

## 업무 실행 v3 (PRD-035/036)

`native-migration-v3.ts` checksum `c175311bceb4f66d8f0808e7eff68e85f15344acd27c250197af01a6ad81c080`. tasks에 요청·상태·버전·검토자 metadata를 추가하고 task_events에 생성/재배정/상태 이력을 남긴다. 기존 작업은 현재 상태를 `baseline`으로 기록하며 이전 시각을 추측하지 않는다. 기존 행·role·private scope를 수정하지 않는다. v1/v2 불변, 중단 후 누락 구조만 재개한다. 하네스는 새 합성 DB에 concurrent creation/status·same-token replay·former-owner 거부·no-review 완료를 추가했다. 모든 합성 DB/행은 보존한다.


v3 실제 검증: exact `72a9b39`에서 native48, migration unit13, lint/types/FSD PASS. 서로 다른 token/같은 version의 정상 stale, 같은 token replay, 재배정 후 이전 담당 거부·현재 담당 완료와 이력 일치를 검사했다. 새 합성 DB15개와 이전 DB·파일의 재시작 보존을 확인했다. SQL deadlock은 기존 bounded whole-transaction retry로 처리됐으며 원래 요청을 외부에서 재시도해 통과시킨 결과가 아니다.

## schema v1–v8 기준선

| 버전 | 추가 구조와 기존 자료 처리 |
| --- | --- |
| v1 | 기존 core6표와 독립 버그 원문/이력/최소 purge receipt3표, 기존 명시 컬럼·역할 계약을 검사/보완 |
| v2 | 프로젝트 목표/성공 기준, 업무 산출물/완료 기준/검토 필요 여부 |
| v3 | 업무 상태·담당/검토 metadata·중복 방지·버전, `task_events`와 기존 업무 baseline |
| v4 | 제출 현재 버전/자료 링크, 불변 `submission_revisions`·`submission_events`, 기존 첨부의 revision1·댓글의 nullable revision 연결; 기존 제출의 원문/private/file 참조를 baseline으로 보존 |
| v5 | 업무 검토가 선택한 정확한 submission/revision을 가리키는 nullable 필드 |
| v6 | WBS와 독립적인 `task_dependencies`, 프로젝트 관계 갱신 버전/token |
| v7 | 템플릿 적용의 payload/token 중복 방지 `task_template_runs` |
| v8 | 수신자별 알림 읽음 상태 `notification_reads` |

해당 v1–v8 기준선의 도메인 관리 표는 총15개이며 `schema_migrations` ledger는 별도다. 기존 migration/checksum을 수정하거나 D1 SQL을 MariaDB에 적용하지 않는다. 새 기능 사용 전 모든 version1–8 적용, pendingVersions 빈 배열, 필수15표/새 컬럼 준비를 확인한다. v3/v4의 baseline은 도입 시점의 자료이며 과거 변경 사건을 재구성하지 않는다. 기존 Google 계정·role·private 원문·파일 bytes를 자동 이전하거나 대체하지 않는다.

최종 P0 native `d18cef8`의 additive77과 P1 `3b4af81`의 전체 harness99 + 관계 교체/rollback/복원4 PASS는 [P0 인수 기록](COMPLETED_LOG.md#p0p1-인수와-승인된-정리)과 [P1 인수 기록](COMPLETED_LOG.md#p0p1-인수와-승인된-정리)에 있다. P1의 초기 DELETE 권한1142 중단과 이후 새 합성 DB 한 곳/한 표에 한정한 승인 재검증도 구분해 보존한다. 승인된 loopback MariaDB11.4.13 fixture 결과이며, NAS 운영 DB나 main native CLI 수정 후의 실제 DB 실행 결과는 아니다. 남은 native purge/별도 강등 interleaving/차단된 cleanup race는 이 통과에 포함되지 않는다.

기존 NAS 업데이트의 백업·쓰기 중지·명시적 적용·수동 인수·rollback 한계는 [NAS 업데이트 안내](NAS_UPDATE_GUIDE.md)를 따른다. 이번 main 통합에서는 실제 DB 명령을 실행하지 않는다.

## 버그 스크린샷 v9 (2026-10-20)

`native-migration-v9.ts`는 별도 screenshot metadata 표와 bug_reports.creation_fingerprint만 추가한다. 기존 v1~v8 명세/ledger checksum은 보존한다. loopback3307의 보존형 additive 하네스99 PASS. 운영/NAS migration은 미적용이다. 첨부 있는 native 제보의 최종 삭제는 durable 파일 정리 도입까지 fail-closed로 보존한다(QLT-020). Sites는 별도 Drizzle0013/R2 cleanup queue를 사용한다.

## 봉사활동 저장 기반 v10

`native-migration-v10.ts`와 별도 `drizzle/0014_volunteer_workspace.sql`은 기존 migration/checksum을 보존하고 프로젝트 유형/workspace CAS, 프로젝트 참여자·활동팀·팀 소속·명단 event, 업무의 팀 연결/완료 모드를 추가한다. 기존 프로젝트는 업무 협업, 신규/기존 업무는 제출 필수·팀 미지정 기본값을 유지하며 계정 역할·원문/private·제출/검토 이력을 재작성하지 않는다. 같은 프로젝트의 팀 소속은 복합 FK로 제한하고 Native postcondition은 독립 단일 FK를 동일한 복합 FK로 오인하지 않는다.

v10 도입 시점은 관리자 전용 저장 기반이었다. 후속 v11의 단일 팀장·완료 실행과 해당 기능 인수는 [TODO](TODO.md#봉사활동-확장-작업)에 남는다. 새 코드 사용 전 운영자가 백업/쓰기 중지·명시 승인과 기존 schema identity 절차로 적용해야 하며 이번 로컬 작업에서는 운영/NAS/Sites migration을 실행하지 않는다.

새 격리 자료의 fresh/existing additive·재실행·보존·관계 무결성 검증 방법과 실제 결과는 [HARNESS_MAP](HARNESS_MAP.md#봉사활동-저장-기반과-auth-import-검증)이 소유한다. 자동 down이나 과거 명세 변경으로 되돌리지 않는다.

## 단일 팀장과 완료 기록 v11

`native-migration-v11.ts`와 별도 `drizzle/0015_volunteer_team_completion.sql`은 팀당 한 canonical 팀장 pointer를 갖는 `activity_team_leaders`와 nullable `tasks.completed_by`/`completed_at`을 추가한다. 같은 프로젝트·실제 팀 소속을 FK로 검사하고 이전 명세/checksum과 모든 자료를 보존한다. 기존 활성 팀장이 한 명이면 pointer baseline으로 유지하되 여러 명이면 임의로 고르거나 강등하지 않고 적용을 중단한다. 운영자가 대상 자료와 선택을 명시적으로 확인해야 하며 자동 정리 명령은 제공하지 않는다.

과거 완료 업무의 완료자/시각을 추측해 채우지 않는다. 기존 업무는 제출 필수로 유지하고 새 봉사 업무의 직접 완료 기본값은 애플리케이션 생성 정책으로 적용한다. 완료 mode/팀 변경은 시작 이력 없는 초안에서만 허용하며 제출·검토·이전 완료 event를 지우지 않는다. 현재 관리표·검증 수치·미확인 범위는 [하네스](HARNESS_MAP.md#봉사활동-팀장과-직접-완료-검증)가 소유한다. 운영/NAS/Sites 적용·실제 계정 권한 변경·재게시 승인을 이 구현/로컬 검증으로 대신하지 않는다.

## 프로젝트 접근 모드 v12

`native-migration-v12.ts`와 별도 `drizzle/0016_project_access_mode.sql`은 `projects.access_mode`와 허용 mode CHECK만 추가한다. 기본 `legacy_authenticated`는 기존 인증 읽기를 보존하며 자동 소속/계정 역할 부여나 자료 재작성은 없다. 실제 `members_only` 전환은 SU의 최신 영향 미리보기·확인과 workspace CAS를 거친 별도 작업이다. admin 관리 범위 축소는 애플리케이션 인가 정책으로 적용하며 기존 읽기 보존과 구분한다. 이전 명세/checksum과 원문/버전·파일·완료 이력은 보존한다.

적용·검증 상태는 [TODO](TODO.md#ux-재설계와-프로젝트-바인딩)와 [하네스](HARNESS_MAP.md#ux-바인딩-구현과-회귀-검증)가 소유한다. 이 소스 설명은 운영/NAS migration 실행이나 실제 구성원 소속 변경을 뜻하지 않는다. 운영 적용과 복구는 기존 백업·schema identity·명시 적용 절차를 따르며 소속 제한을 활성화한 뒤 구형 전역 관리자 앱으로 writable rollback하면 새 접근 정책을 우회할 수 있으므로 forward fix를 우선한다.


## Native 첨부 격리 v13·보고서 ledger v14 준비

v13은 screenshot staging lease와 참조/만료 검사용 trigger·durable cleanup job을 추가하고, native 파일을 영구 삭제하는 대신 검증된 quarantine/retry/restore 경로를 둔다. 새 버전은 기존 명세/checksum·원문/파일·역할을 보존한다. 이 기반 도입만으로 Native 첨부 bug purge의 fail-closed나 기존 거부된 runner 시험을 해제하지 않는다.

v14는 보고서 schedule/run/artifact ledger3표를 additive로 준비한다. 기존 runner의 별도 schema identity·version/checksum·lock/postcondition을 재사용하며 새 credential 생성/GRANT나 runtime DDL 허용은 하지 않는다. 실제 NAS 적용·운영 예약 활성화는 미실행이며 runtime DDL 거부도 아직 실증하지 않았다. 진행 중 로컬 검증과 최종 인수는 [하네스](HARNESS_MAP.md#남은-품질과-digest-구현-진행)가 소유한다. 운영 적용·자동 down·기존 사용자 자료 정리를 승인하는 문서가 아니다.

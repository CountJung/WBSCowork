# 비공개 버그 제보와 관리자 리뷰

## 사용 흐름

- `/bugs`: 내 제보 목록(20건/페이지), 제목 검색·상태 필터, 제보 작성. guest도 제보할 수 있지만 작업/프로젝트 쓰기 권한은 바뀌지 않는다.
- `/bugs/[id]`: 불변 원문, 현재 처리 상태·해결 내용·수정 SHA, 추가 설명/정정, 최근 순 처리 이력(30건/페이지).
- `/admin/bugs`: admin/superuser 전체 검토 목록. 상세 화면에서 검토 메모·상태·우선순위·해결 사유·선택 commit SHA 저장.
- 모든 본문/이력은 작성자와 관리자만 보며 관리자 메모도 작성자에게 표시한다. 일반 사용자의 다른 제보는 존재하지 않는 ID와 같은 404다.
- 제보는 실행 지시가 아니다. 코드를 자동 수정하거나 링크를 자동 조회하지 않는다. 수정 검토는 사용자의 작업 범위 안에서 별도로 진행한다.

## 보존 및 입력 계약

프로젝트와 독립된 bug_reports / bug_report_events 테이블이며 원문 수정 endpoint는 없다. 삭제는 아래의 검증·휴지통·슈퍼관리자 최종 확인 절차로 제한한다. 정정은 추가 설명, 처리 변경은 append-only event다. 보고서/이력은 운영 audit_logs의 5일 정리에 포함되지 않는다. 계정 삭제는 nullable FK 연결을 해제하고, 이후 다른 계정에는 작성자 권한을 부여하지 않는다. 본문 개인정보의 별도 삭제 요청은 운영자가 검토해야 한다.

- 제목 160자, 재현 8,000자, 예상/실제 결과 각 4,000자, 추가 설명/검토/해결 각 4,000자.
- 내부 경로 500자. query/fragment 제거, 외부 URL·protocol-relative/backslash/공백 경로 거부. 경로는 링크로 자동 실행하지 않는다.
- 수정 참조는 선택적 7~40자리 Git SHA 텍스트. HTML/Markdown 실행 없음; React escaped plain text만 출력.
- bug 페이지 경로에서 Worker body cap 64KiB; 모든 bug Server Action은 파싱 후 48KiB envelope 제한 및 file input 거부를 다시 검사한다. 다른 route로 보낸 action도 검증을 거친다. 전체 Worker의 기존 hard cap은 22MiB다.
- Form UUID + actor/kind/report로 idempotency key를 구성한다. 서버는 reporter/role/status 생성 필드를 신뢰하지 않는다.
- 수정은 expected version과 이미 적용된 operation token 부재를 **동일 atomic UPDATE**에서 검사한다. 상태와 이력은 batch/transaction으로 함께 저장한다. 재전송은 중복 event를 만들지 않고 충돌은 최신 화면 확인을 안내한다.

## 스키마와 실행 모드

`drizzle/0003_free_zarek.sql`은 기존 테이블/데이터 변경 없이 두 테이블을 추가한다. Sites 게시가 적용한다. 최초 Node/MariaDB 구현은 슈퍼관리자 schema initialization에 additive `CREATE TABLE IF NOT EXISTS`를 통합했다. 이후 native schema는 [불변 version/checksum migration](NATIVE_DATABASE_MIGRATIONS.md)으로 전환했고, 초기 버그 계약의 실제 DB 검증은 [OPS-028 완료 기록](COMPLETED_LOG.md#ops-028--nodemariadb-동시-검토-및-테스트-로더-호환성-2026-10-08)에 있다. 기존 마이그레이션 0000~0002는 수정하지 않았다.

## 검증

- `npm run test:sites:bugs`: 실제 로컬 D1에서 원문·조회 범위·중복 요청·동시 검토·이력 실패 rollback·프로젝트/계정 삭제 독립성 검사.
- `npm run test:sites:http`: 실제 build Worker + 합성 JWT로 두 guest/두 member/admin/superuser 접근, SSR 정보 누출, 입력 위조·XSS·CSRF·길이/경로 제한·same-cookie role downgrade 검사.
- 공개 production의 실제 제보 쓰기 테스트는 사용자 승인 범위와 별도로 기록한다. 합성 local 검사를 실사용자 다중 계정 검사로 표현하지 않는다.

2026-10-08 게시 전 검증: lint/types/FSD/build 통과, unit 17, D1/R2 57, bug D1 26, actual Worker HTTP 185, credential-free auth 18 통과. 독립 리뷰 지적의 replay-race와 native upsert ambiguity를 수정 후 재검증했다. 당시 dot 환경에는 Native MariaDB daemon이 없어 실행 미검증이었으며, 후속 exact-commit 결과는 아래와 OPS-028에서 구분한다.

최초 public Site version3 게시 때 위 화면과 빈 데이터 상태를 실제 소유자 세션으로 확인했다. 원본 QA 프로젝트의 승인된 파기는 완료됐고 사용자/감사 기록은 보존했다. 이후 실제 제보 저장·검토는 별도 승인 후 OPS-029에서 확인했다. 현재 게시본은 [P1 인수 결과](P1_ACCEPTANCE_2026-10-09.md#게시-및-데이터-보존)의 version10이다.

후속 확인: OPS-028 exact f31f9dc native 검증 통과(React19.2.6 기준), OPS-030 version4 React19.2.8 Worker 게시, OPS-029 승인된 실제 report1 작성·추가 설명·검토·해결 및 filter 확인 완료. OPS-029 당시 report1은 version4/events1–4까지 보존됐고, 이후 OPS-031에서 version8/events1–8의 정확한 대상 승인을 받아 정리했다([후속 기록](SITES_BUG_QA_2026-10-08.md#후속-수명주기-및-정리-결과)).

## 검증 완료·휴지통·영구 삭제 (OPS-031)

- admin/superuser는 해결 또는 종료 상태의 제보에 검증 방법·결과(최대 4,000자)를 남겨 검증 완료로 표시한다. 새 추가 설명 또는 검토 변경은 검증 완료를 원자적으로 해제한다.
- 검증된 해결/종료 제보만 휴지통으로 옮긴다. `/admin/bugs/trash`, `/admin/bugs/trash/[id]`에서 admin/superuser가 원문·이력을 확인하고 복원한다. 이동/복원도 이력이며 원문을 덮어쓰지 않는다. 일반 목록/검색/건수/상세/이력에서는 관리자에게도 휴지통 기록이 제외되고 일반 사용자는 휴지통 자체에 접근할 수 없다.
- 영구 삭제는 현재 설정으로 확인된 superuser만 가능하다. 검증된 해결/종료 기록이 휴지통에 있어야 하며 제목을 정확히 다시 입력하고 현재 버전·전체 이력 수·마지막 event ID·내용 지문을 일치시켜야 한다. 1,000건을 넘는 이력은 이 화면에서 영구 삭제하지 않는다.
- 지문은 원문·상태·검증·전체 순서화된 이력에 대한 SHA-256이다. 계정 파기로 독립적으로 NULL이 될 수 있는 계정 연결 ID는 지문에서 제외한다. 이를 계정 신원에 대한 암호학적 증명으로 사용하지 않는다. UI의 30건 페이지가 아니라 전체 이력을 50건씩 읽는다.
- 하나의 DB transaction/batch에서 최소 삭제 증빙을 생성하고 해당 이력과 원문을 삭제한다. 실패하면 전체 rollback된다. native MariaDB는 먼저 parent row FOR UPDATE를 잠가 READ COMMITTED에서도 복원과 삭제가 교차하지 않게 한다. Sites D1 batch도 원자적이다. 재시도는 같은 수행자·대상·operation token·지문으로 이미 완료된 삭제만 확인한다.
- `bug_report_purge_receipts`에는 대상 번호, 수행자 계정 연결, 시각, 버전, 이력 수/마지막 ID, 내용 지문, 재시도 식별자만 남고 제목·본문·검토 내용 사본은 남기지 않는다. 이 증빙은 운영 audit의 5일 정리와 별도다. 앱에서 최종 삭제를 복구할 수 없으며 호스팅 백업/진단 기록의 삭제를 보장하지 않는다.
- `0004_fresh_killer_shrike.sql`은 기존 테이블의 nullable/default column 추가와 새 증빙 테이블만 포함한다. 이전 적용 migration 수정·운영 데이터 DML·table rebuild는 없다. 최초 native schema initialization에도 additive column/FK upgrade를 제공했으며, 현재 운영 절차는 [native versioned migration](NATIVE_DATABASE_MIGRATIONS.md)을 따른다.

실환경 합성 report #1은 검증·휴지통·복원을 확인한 뒤, version8/events1–8의 정확한 대상에 대한 별도 승인으로 영구 삭제를 완료했다. 본문·이력 제거와 최소 증빙 1건 보존을 확인했다. 이 완료는 향후 다른 대상의 삭제 승인이나 native 파기 테스트 승인으로 확대하지 않는다. 남은 native 전체·파기 검증은 [TODO OPS-031](TODO.md#10단계--배포), 완료된 게시/실환경 범위는 [완료 기록](COMPLETED_LOG.md#ops-031--버그-수명주기-게시와-승인된-실환경-정리-완료분)을 따른다.

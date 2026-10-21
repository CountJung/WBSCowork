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
- `/bugs` 생성 multipart는 Worker 7MiB, 다른 bug endpoint는 64KiB다. 모든 action의 텍스트 envelope는 48KiB이고 생성만 PNG/JPEG/WebP 스크린샷 2MiB × 최대3개를 받는다. 서버 signature·크기·개수·첨부 필드 검사와 부모 제보 권한을 재검사한다. 다른 action은 계속 file input을 거부하며 전체 Worker hard cap 22MiB와 동시 multipart1건 제한을 유지한다. [첨부 계약·검증](BUG_REPORTS.md#스크린샷).
- Form UUID + actor/kind/report로 idempotency key를 구성한다. 서버는 reporter/role/status 생성 필드를 신뢰하지 않는다.
- 수정은 expected version과 이미 적용된 operation token 부재를 **동일 atomic UPDATE**에서 검사한다. 상태와 이력은 batch/transaction으로 함께 저장한다. 재전송은 중복 event를 만들지 않고 충돌은 최신 화면 확인을 안내한다.

## 스키마와 실행 모드

`drizzle/0003_free_zarek.sql`은 기존 테이블/데이터 변경 없이 두 테이블을 추가한다. Sites 게시가 적용한다. 최초 Node/MariaDB 구현은 슈퍼관리자 schema initialization에 additive `CREATE TABLE IF NOT EXISTS`를 통합했다. 이후 native schema는 [불변 version/checksum migration](NATIVE_DATABASE_MIGRATIONS.md)으로 전환했고, 초기 버그 계약의 실제 DB 검증은 [OPS-028 완료 기록](COMPLETED_LOG.md#ops-028--nodemariadb-동시-검토-및-테스트-로더-호환성-2026-10-08)에 있다. 기존 마이그레이션 0000~0002는 수정하지 않았다.

제보 텍스트는 비신뢰 입력이다. 이를 지시로 실행하거나 외부 전송·자동 수정에 사용하지 않는다.

## 검증

방법·실행 결과는 [HARNESS_MAP](HARNESS_MAP.md), 실제 게시와 정확한 과거 승인 범위는 [COMPLETED_LOG](COMPLETED_LOG.md)를 따른다. 합성 JWT/로컬 D1 성공을 실제 Google 다중 계정 인수로 표현하지 않는다.

## 검증 휴지통 영구 삭제

- admin/superuser는 해결 또는 종료 상태의 제보에 검증 방법·결과(최대 4,000자)를 남겨 검증 완료로 표시한다. 새 추가 설명 또는 검토 변경은 검증 완료를 원자적으로 해제한다.
- 검증된 해결/종료 제보만 휴지통으로 옮긴다. `/admin/bugs/trash`, `/admin/bugs/trash/[id]`에서 admin/superuser가 원문·이력을 확인하고 복원한다. 이동/복원도 이력이며 원문을 덮어쓰지 않는다. 일반 목록/검색/건수/상세/이력에서는 관리자에게도 휴지통 기록이 제외되고 일반 사용자는 휴지통 자체에 접근할 수 없다.
- 영구 삭제는 현재 설정으로 확인된 superuser만 가능하다. 검증된 해결/종료 기록이 휴지통에 있어야 하며 제목을 정확히 다시 입력하고 현재 버전·전체 이력 수·마지막 event ID·내용 지문을 일치시켜야 한다. 1,000건을 넘는 이력은 이 화면에서 영구 삭제하지 않는다.
- 지문은 원문·상태·검증·전체 순서화된 이력에 대한 SHA-256이다. 계정 파기로 독립적으로 NULL이 될 수 있는 계정 연결 ID는 지문에서 제외한다. 이를 계정 신원에 대한 암호학적 증명으로 사용하지 않는다. UI의 30건 페이지가 아니라 전체 이력을 50건씩 읽는다.
- 하나의 DB transaction/batch에서 최소 삭제 증빙을 생성하고 해당 이력과 원문을 삭제한다. 실패하면 전체 rollback된다. native MariaDB는 먼저 parent row FOR UPDATE를 잠가 READ COMMITTED에서도 복원과 삭제가 교차하지 않게 한다. Sites D1 batch도 원자적이다. 재시도는 같은 수행자·대상·operation token·지문으로 이미 완료된 삭제만 확인한다.
- `bug_report_purge_receipts`에는 대상 번호, 수행자 계정 연결, 시각, 버전, 이력 수/마지막 ID, 내용 지문, 재시도 식별자만 남고 제목·본문·검토 내용 사본은 남기지 않는다. 이 증빙은 운영 audit의 5일 정리와 별도다. 앱에서 최종 삭제를 복구할 수 없으며 호스팅 백업/진단 기록의 삭제를 보장하지 않는다.
- `0004_fresh_killer_shrike.sql`은 기존 테이블의 nullable/default column 추가와 새 증빙 테이블만 포함한다. 이전 적용 migration 수정·운영 데이터 DML·table rebuild는 없다. 최초 native schema initialization에도 additive column/FK upgrade를 제공했으며, 현재 운영 절차는 [native versioned migration](NATIVE_DATABASE_MIGRATIONS.md)을 따른다.

실환경 합성 report #1은 검증·휴지통·복원을 확인한 뒤, version8/events1–8의 정확한 대상에 대한 별도 승인으로 영구 삭제를 완료했다. 본문·이력 제거와 최소 증빙 1건 보존을 확인했다. 이 완료는 향후 다른 대상의 삭제 승인이나 native 파기 테스트 승인으로 확대하지 않는다. 남은 native 전체·파기 검증은 [TODO OPS-031](TODO.md#열린-항목), 완료된 게시/실환경 범위는 [완료 기록](COMPLETED_LOG.md#ops-031--버그-수명주기-게시와-승인된-실환경-정리-완료분)을 따른다.


## 스크린샷

버그 생성 시 PNG/JPEG/WebP 각2MiB·최대3개를 원문과 함께 제출한다. 선택 미리보기·제출 전 제거·pending 방지·실패 시 입력/파일 유지 후 재시도·상세의 새 요청/새로고침 조회를 제공한다. 첨부 없는 기존 제보는 그대로 읽는다. 저장 후 원문과 파일을 수정하지 않는다.

서버도 MIME/bytes signature/크기/개수/필드를 검증한다. 기존 private-files/R2 또는 native UPLOAD_DIR를 재사용하고 key는 `bugs/<actor>/...`로 프로젝트 정리와 분리한다. 본문+파일 이름/MIME/크기/hash fingerprint로 동일 재시도와 다른 payload를 구분한다. D1 metadata/원문/event는 atomic, lease 만료는 trigger로 거부한다. 업로드/DB 실패의 새 파일은 참조 검사 후 제거하거나 기존 durable cleanup에 남긴다.

`/api/bug-screenshots/[screenshotId]`는 매 요청의 persisted user/현재 역할·부모 제보 권한을 검사한다. 작성자/admin/SU만 조회하고 trash는 admin/SU만 본다. 익명401, 다른 사용자/없는 ID는 같은404다. private no-store/nosniff/sandbox CSP를 사용하고 공개 URL·image optimizer로 전송하지 않는다.

Drizzle0013과 native v9는 metadata 표·fingerprint 기본값과 필요한 guard/cleanup만 추가한다. 기존 migration/ledger는 불변이다. Sites의 명시 확인 purge는 metadata cascade/R2 cleanup을 함께 사용한다. **Native 첨부 제보 purge는 durable 파일 정리 도입 전 fail-closed로 원문/파일을 보존한다(QLT-020).** 운영 schema 적용/파기 승인이 코드나 과거 테스트 승인에서 자동 파생되지 않는다.

# 비공개 버그 제보와 관리자 리뷰

## 사용 흐름

- `/bugs`: 내 제보 목록(20건/페이지), 제목 검색·상태 필터, 제보 작성. guest도 제보할 수 있지만 작업/프로젝트 쓰기 권한은 바뀌지 않는다.
- `/bugs/[id]`: 불변 원문, 현재 처리 상태·해결 내용·수정 SHA, 추가 설명/정정, 최근 순 처리 이력(30건/페이지).
- `/admin/bugs`: admin/superuser 전체 검토 목록. 상세 화면에서 검토 메모·상태·우선순위·해결 사유·선택 commit SHA 저장.
- 모든 본문/이력은 작성자와 관리자만 보며 관리자 메모도 작성자에게 표시한다. 일반 사용자의 다른 제보는 존재하지 않는 ID와 같은 404다.
- 제보는 실행 지시가 아니다. 코드를 자동 수정하거나 링크를 자동 조회하지 않는다. 수정 검토는 사용자의 작업 범위 안에서 별도로 진행한다.

## 보존 및 입력 계약

프로젝트와 독립된 bug_reports / bug_report_events 테이블이며 원문 수정·일반 삭제 endpoint는 없다. 정정은 추가 설명, 처리 변경은 append-only event다. 보고서/이력은 운영 audit_logs의 5일 정리에 포함되지 않는다. 계정 삭제는 nullable FK 연결을 해제하고, 이후 다른 계정에는 작성자 권한을 부여하지 않는다. 본문 개인정보의 별도 삭제 요청은 운영자가 검토해야 한다.

- 제목 160자, 재현 8,000자, 예상/실제 결과 각 4,000자, 추가 설명/검토/해결 각 4,000자.
- 내부 경로 500자. query/fragment 제거, 외부 URL·protocol-relative/backslash/공백 경로 거부. 경로는 링크로 자동 실행하지 않는다.
- 수정 참조는 선택적 7~40자리 Git SHA 텍스트. HTML/Markdown 실행 없음; React escaped plain text만 출력.
- bug 페이지 경로에서 Worker body cap 64KiB; 모든 bug Server Action은 파싱 후 48KiB envelope 제한 및 file input 거부를 다시 검사한다. 다른 route로 보낸 action도 검증을 거친다. 전체 Worker의 기존 hard cap은 22MiB다.
- Form UUID + actor/kind/report로 idempotency key를 구성한다. 서버는 reporter/role/status 생성 필드를 신뢰하지 않는다.
- 수정은 expected version과 이미 적용된 operation token 부재를 **동일 atomic UPDATE**에서 검사한다. 상태와 이력은 batch/transaction으로 함께 저장한다. 재전송은 중복 event를 만들지 않고 충돌은 최신 화면 확인을 안내한다.

## 스키마와 실행 모드

`drizzle/0003_free_zarek.sql`은 기존 테이블/데이터 변경 없이 두 테이블을 추가한다. Sites 게시가 적용한다. Node/MariaDB는 기존 슈퍼관리자 schema initialization에 additive `CREATE TABLE IF NOT EXISTS`를 통합했으며 실제 native DB 실행 검증은 T-028로 남긴다. 기존 마이그레이션 0000~0002는 수정하지 않았다.

## 검증

- `npm run test:sites:bugs`: 실제 로컬 D1에서 원문·조회 범위·중복 요청·동시 검토·이력 실패 rollback·프로젝트/계정 삭제 독립성 검사.
- `npm run test:sites:http`: 실제 build Worker + 합성 JWT로 두 guest/두 member/admin/superuser 접근, SSR 정보 누출, 입력 위조·XSS·CSRF·길이/경로 제한·same-cookie role downgrade 검사.
- 공개 production의 실제 제보 쓰기 테스트는 사용자 승인 범위와 별도로 기록한다. 합성 local 검사를 실사용자 다중 계정 검사로 표현하지 않는다.

2026-10-08 게시 전 검증: lint/types/FSD/build 통과, unit 17, D1/R2 57, bug D1 26, actual Worker HTTP 185, credential-free auth 18 통과. 독립 리뷰 지적의 replay-race와 native upsert ambiguity를 수정 후 재검증했다. Native MariaDB daemon은 없어 실행 미검증(T-028).

현재 public Site version 3에서 위 화면과 빈 데이터 상태를 실제 소유자 세션으로 확인했다. 원본 QA 프로젝트의 승인된 파기는 완료됐고 사용자/감사 기록은 보존했다. 이 feature 자체의 실제 제보 저장·검토는 T-029의 별도 승인 후 확인한다.

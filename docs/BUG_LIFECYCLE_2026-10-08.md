# 버그 기록 검증·삭제 수명주기 (OPS-031)

## 구현 범위

사용자 요청에 따라 일회성 합성 레코드 정리 도구 대신 정상 앱 기능을 구현했다. admin은 해결/종료 제보에 검증 방법·결과를 남기고 검증된 기록을 휴지통으로 이동하거나 복원한다. superuser만 휴지통의 검증된 제보를 정확한 제목 재입력과 최신 버전/전체 이력 수/마지막 ID/내용 지문으로 최종 확인하여 영구 삭제한다. 원문과 이력은 최종 삭제 전까지 유지한다.

`/admin/bugs/trash`와 상세 경로는 admin/SU 전용이다. 일반 목록·검색·건수·상세·이력 쿼리는 휴지통을 제외하며 사용자는 자신의 휴지통 기록도 볼 수 없다. 추가 설명과 검토 변경은 이전 검증 완료를 원자적으로 해제한다. 제보 원문/검증 메모/처리 이력 사본을 삭제 증빙에 남기지 않는다. 최소 증빙의 필드·보존 및 호스팅 백업 한계는 개인정보 안내와 BUG_REPORTS.md에 명시했다.

<a id="검증-결과"></a>

## 구현 체크포인트의 검증 결과

- lint / TypeScript / FSD 통과.
- Node unit 30 통과. 이 dot 환경에 MariaDB daemon이 없어 기본 `npm test`의 DB suite는 명시적으로 미실행이다. 이전 f31f9dc의 native 결과를 이번 코드의 검증으로 재사용하지 않는다.
- 생산 Worker 빌드 통과, React19.2.8 활성 decoder 정적 지문 검사 통과.
- 실제 로컬 D1 bug 계약 58 통과. 신규 검증/휴지통/복원, 상태 선행 조건, SQL-level privacy, 원문 보존, same-token 동시 재시도, stale version, 전체 이력 43건 지문, receipt/report 삭제 실패 rollback, restore/purge 경합, 계정 unlink 시 FK 및 지문 안정성을 포함한다.
- 실제 Worker HTTP 217 통과. 합성 JWT의 guest/member/admin/SU/익명, 위조 privilege/direct action, 역할 강등, CSRF, 잘못된 제목/지문, 복원 뒤 오래된 삭제 확인, 최소 receipt 및 다른 작성자의 제보 보존을 포함한다. 실제 다중 Google 계정으로 테스트한 결과는 아니다.
- 기존 D1/R2 저장소 57, credential-free auth 18 통과. 업로드/다운로드/실패 정리와 기존 업무 권한 회귀를 포함한다.
- 독립 read-only 리뷰에서 native READ COMMITTED의 parent-lock 가정을 지적받아, 동일 transaction의 첫 statement로 `SELECT ... FOR UPDATE`를 추가했다. D1은 해당 SQL 없이 atomic batch를 사용한다. 실 MariaDB 두 isolation level 재검증은 정확한 체크포인트로 별도 수행한다.

## 적용과 남은 확인

- migration 0004는 컬럼과 receipt 테이블의 additive schema 변경만 수행한다. 이미 적용된 0000~0003, 기존 데이터, 역할/환경 값은 변경하지 않았다.
- 최초 native initialization은 기존 bug 테이블에도 컬럼/FK를 추가하고 당시 readiness에 9개 관리 테이블을 반영했다. 현재 native schema 운영은 [불변 versioned migration](NATIVE_DATABASE_MIGRATIONS.md)을 따른다.
- source `d631e51db980405f2dbf437116fa5d3f91b4b05a`를 version5로 게시했고, 실제 소유자 세션에서 검증 완료·휴지통·복원·재이동을 확인했다. 합성 report1 「닷프로 검증용 버그」는 version8/events1–8이 됐다.
- 이후 정확한 해당 대상의 별도 영구 삭제 승인 후 정상 SU 제목·지문 확인 절차로 처리했다. 원문과 이력 제거, 최소 증빙 1건과 기존 사용자·역할·감사 기록 보존을 확인했다([실환경 결과](SITES_BUG_QA_2026-10-08.md#후속-수명주기-및-정리-결과)).
- native exact `d631e51`에서는 생성·검증·휴지통·복원의 비파괴 16조건을 확인했다. 설치된 React19.2.6을 사용한 좁은 MariaDB 동작 검증이며 lockfile19.2.8 빌드 검증은 아니다. 파기 포함 전체 수명주기 및 두 isolation level의 파기 경합 검증은 승인 대기/미실행이다.
- 따라서 기능 게시/실환경 완료분은 [COMPLETED_LOG](COMPLETED_LOG.md#ops-031--버그-수명주기-게시와-승인된-실환경-정리-완료분)에, 남은 native 검증은 [TODO OPS-031](TODO.md#10단계--배포)에 구분한다. QLT-015의 차단된 cleanup 경합과 QLT-016의 fixture503 원인 확인도 해결된 것으로 표시하지 않는다.

2026-10-10 문서 동기화: 위 후속 결과를 기존 기록과 대조해 반영했다. 구현 체크포인트의 테스트 수는 당시 결과를 보존한 것이며 이번에 테스트·삭제·게시를 재실행하지 않았다.

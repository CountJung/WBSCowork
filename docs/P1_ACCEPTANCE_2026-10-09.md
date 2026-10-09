# P1 팀 운영 기능 인수 — 2026-10-09

대상: PRD-040~043, `feat/sites-deployment`. 기존 Google 로그인과 author/admin/superuser의 private 자료 경계를 유지한다. 외부 알림·AI 전송·운영 계정 권한 변경은 없다.

## 구현 및 확인

| 항목 | 사용자 동작 | 확인 범위 |
| --- | --- | --- |
| PRD-040 | 작업 화면의 미배정/지연/차단/검토 대기 숫자에서 해당 카드로 이동. WBS와 별개로 같은 프로젝트 선행 업무를 지정 | 순환/다른 프로젝트 거부, project graph CAS와 task version, 중복 요청, atomic history, 미완료 선행 업무의 시작/검토 요청/승인/보완 거부, 취소/재오픈 허용 |
| PRD-041 | 조사/산출물 템플릿을 선택해 생성 전에 제목·설명·산출물·기준·담당·날짜·포함 카드를 편집 | 기본 미배정, 상위 제외 시 하위 제외, 계층·상대 날짜, stable token/fingerprint, 동일 요청 한 번만 생성, 늦은 실패 시 전체 rollback, pending 중 편집/취소 차단 |
| PRD-042 | 검색에서 업무·제출 본문·작성자·파일명과 project/담당/status/date/overdue 필터 사용 | 최신/현재 승인/이전 버전 규칙, 현재 역할과 현재+과거 visibility를 SQL count/list/snippet/pagination 전에 적용, 문자 wildcard literal, 파일명 일치 표시 |
| PRD-043 | 내 알림에서 배정·검토·보완·승인·내 제출물 댓글을 열고 읽음 처리 | 수신자만 조회, A→B→A 과거 알림 억제, 현행 검토 token/선택 version/상태/역할, 중복 읽음 한 행, 위조·교차 출처 거부, 전체/미확인·페이지 유지 |

원래 작성자는 기존 소유 조회권으로 자신의 private 제출물과 댓글을 계속 볼 수 있다. 담당자가 바뀌어도 이 권한은 사라지는 정책이 아니므로 자신의 댓글 알림은 유지된다. 업무 공유 범위 자체를 이번에 변경하지 않았다.

## 체크포인트

- `fe6cb40507bd2f45501e3139243e164e35f2b16b`: 현황/선행 관계
- `ed9a9d349194ca0c1a7c5b0dbe76de75b7891a44`: 수동 템플릿
- `299def9962de87ffef727fa79402067ba0711bb1`: 업무/산출물 검색
- `3b4af81e175ca0cd889fdc2cb2f13bead9bec7b0`: 수신자 알림 및 최종 선행 판정 SQL 보완, tree `c57d98fe65a5159c404338121e1d43f6de31b79b`

GitHub remote ref와 fetch tree를 매 단계 확인했다. main은 `2f6b74d7b77106d38ad914eee14e1e073c61b039` 그대로이다. 취소된 예전 docs commit은 포함하지 않았다.

## 최종 로컬/Worker 검사

- 단위119, D1 P1계약65, 실제 Worker workflow472, 기존 업로드/날짜/역할 품질375, credential-free auth18 PASS
- lint/typecheck/FSD self-test5 및 경계, Worker build, React19.2.8 실제 decoder fingerprint PASS
- 독립 P1 정적 검토와 별도 pure unit7 PASS. 검토에서 발견한 transaction-time 보완 요청의 선행 조건을 수정했다.
- 이 dot cloud에는 native MariaDB3307이 없으므로 npm test의 DB suite는 미실행이다. 실제 MariaDB 결과는 아래 별도 exact-SHA 기록을 따른다.
- 검색 단계의 최초 workflow 실행은 동시 승인 POST503으로 실패했고 별도 재실행455 PASS. 원인을 확정한 것으로 표시하지 않는다(QLT-016).
- 알림 HTTP 테스트 작성 중 FormData 전송/절대 Location 비교 오류2개를 수정했다. 올바른 수동 multipart의 교차 출처 요청은403/무변경, 최종472 PASS. 앱 인증 정책은 바꾸지 않았다.

## Native MariaDB

정확한 `3b4af81`의 최종 전체 native harness99 PASS와 별도 관계 교체/실패 rollback/복원4 PASS를 확인했다. graph CAS, 선행 관계, template, search, notification을 포함한다. 이전 부분 결과에서는 v1–v8 migration 재개8시나리오, 별도 템플릿/검색/알림15조건, migration unit22와 lint/types/FSD가 통과했으나 전체 harness는 task_dependencies의 실제 DELETE 권한1142로 중단됐다. 이 초기 중단을 통과로 세지 않았다.

사용자의 해당 권한 승인 후 **새 실행DB 하나의 task_dependencies 표에만** DELETE를 추가하여 정상 관계 교체를 검증했다. 프로젝트/업무/파일/검토 이력 영구 삭제나 다른 계정·표의 권한 확대는 없었다. 기존119DB가 unchanged이고 신규18개를 포함한137DB/파일/좁은 권한의 재시작 전후 snapshot이 같았다. 최종DB를 정지하여3307 listener가 없다. SQL 관측 집계 일부가 유실된 한계가 있으므로 모든 실행 SQL의 완전한 trace를 확보했다고 표현하지 않는다. 이전 차단된 purge/cleanup 경합은 실행하지 않았다.

선행 관계 SQL DELETE는 새 합성 task_dependencies 관계를 같은 트랜잭션에서 재삽입하는 복구 가능한 수정이다. 프로젝트/업무/파일/이력 영구 삭제와 구분한다. 일반 사용자는 변경한 선행 관계를 재선택할 수 있고 버전별 변경 event가 남는다.

## 게시 및 데이터 보존

기존 public Site에 source `3b4af81`의 version10을 게시했다. deployment `appgdep_6ac92c90e644819192a066f2b25c9d6c`는 2026-10-09 18:04:25 UTC에 terminal succeeded. 공개 주소는 https://wbscowork.cometgnome.chatgpt.site 이며 환경 설정 revision11을 유지했다. 저장 archive는342files/5,171,200bytes, SHA256 `06997bc7a76194663eb25874f91ec23bffca2d7b92773d816e8042420c228fd0`이다. 배포 전 기준값: 프로젝트/업무/제출/버전/댓글/첨부/정리대기0, 사용자1명, 기존 bug purge receipt1개. D1 0010–0012는 관계/실행 receipt/읽음 receipt와 project CAS2열만 추가한다. 기존 row 변환이나 삭제는 없다.

게시 후 기존13개 표의 모든 row가 기준값과 같았고 새 task_dependencies/task_template_runs/notification_reads는 각각0건이었다. 감사 표는 이번 기능에서 변경하지 않았으며 별도 전체 감사 row 비교로 주장하지 않는다. 실제 R2 bucket inventory는 조회하지 않았고 파일/정리 참조0건만 확인했다. 새 표를 영구 삭제하는 down migration은 제공하지 않는다. 이전 앱으로 코드를 되돌리면 새 의존성 규칙을 인식하지 못하므로 새 기능 사용 후 rollback은 별도 영향 확인이 필요하다.

## 브라우저/검증 한계

관리 cloud browser에서 기존 로그인으로 슈퍼관리자 표시와 프로젝트0건을 확인했다. 로컬 fixture는 실제 Worker472개 이후 서버가 준비됐으나 별도 browser의 localhost 접근이 ERR_CONNECTION_REFUSED였다. 오류 탭 후속 관찰은 URL 정책에 막혀 중단하고 소유 fixture 서버를 종료했다. 지원되는 forwarding 경로가 없어 로컬 템플릿 preview의 실제 브라우저 클릭 인수는 미실행이다.

게시 후 기존 계정의 슈퍼관리자 세션으로 검색어 GET 제출/0건 결과, 이전 버전 필터 URL/선택 유지, 알림 unread/all 전환과0건 안내를 확인했다. 알림500px/검색485px 폭에서 scrollWidth=clientWidth였고 모바일 메뉴와 밝은/어두운 표시를 확인했다. System 테마와 원래 데스크톱 창 크기를 복원했다. 이번에 새 운영 QA project/report/file은 생성하지 않았다. 실제 여러 Google 계정 간 검토·알림 흐름은 브라우저에서 재현하지 않았으며 합성 세션 D1/Worker 검사와 구분한다. QLT-015 차단된 cleanup race, native 영구 purge, 별도 강등 interleaving은 실행하지 않았다.


## 게시 직후 관찰

18:04:25의 배포 성공 뒤 초기 요청은 옛 메뉴와 새 route404를 반환했다. 18:06 무렵에는 새 route/메뉴가 보였지만 AppShell 새 청크의 dynamic import가 한 번 실패했다. 추가 재배포나 코드 변경 없이 reload1회 후 정상화됐고 이후 검색·알림/모바일 QA를 통과했다. Worker version 전환과 asset 제공 시점의 불일치 가능성이 있지만 원인을 확정한 것으로 표현하지 않는다.

익명 session은200/빈 객체이고 새 검색·알림 요청은 전환 후307 로그인 redirect를 확인했다. 그 뒤 별도 반복 HTTP 관찰 프로세스는 네트워크 승인 취소로 결과 수집이 중단되어 재시도하지 않았다. 이 미확인 결과를 통과 수에 넣지 않는다. 실제 브라우저에서 수행한 로그인된 화면 확인과 합성 auth18 검사는 별도 증거다.

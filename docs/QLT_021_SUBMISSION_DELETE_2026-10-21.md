# QLT-021 — 제출물 삭제 완료 후 실패 표시

검증일: 2026-10-21(KST). 시작 기준 `main=a28188e`, `sites=56e397c`. 운영 DB·R2·NAS에는 접속하거나 자료를 삭제하지 않았다. GitHub 공통 수정이며 사이트 재게시와 NAS 배포는 포함하지 않는다.

## 확인된 원인

`deleteSubmission()`은 atomic `databaseBatch()`가 **커밋된 다음** 마지막 결과의 `affectedRows ?? meta.changes`가 정확히1인지 검사했다. 두 값은 같은 의미가 아니다. 실제 D1 API와 MariaDB Connector/Node.js의 반환값을 다음처럼 분리 측정했다. 매 경우 대상 부모는1행이며, 연쇄 삭제가 있는 경우 자식2행, 트리거가 있는 경우 별도 로그1행을 만든다.

| 격리 SQL 경우 | D1 `meta.changes` | MariaDB `affectedRows` | D1 `changes()` / MariaDB `ROW_COUNT()` | 커밋 후 부모/자식 |
| --- | ---: | ---: | ---: | --- |
| 부모만 | 1 | 1 | 1 / 1 | 없음 |
| 부모 + FK 연쇄 삭제 | 3 | 1 | 1 / 1 | 없음 |
| 부모 + DELETE 트리거 | 2 | 1 | 1 / 1 | 없음 |
| 부모 + FK + 트리거 | 4 | 1 | 1 / 1 | 없음 |

실제 migrations와 repository를 사용하는 제출물 fixture(버전2·첨부2·이벤트·댓글·선택된 검토)에서도 수정 전 D1은 `삭제할 제출물이 없거나 권한이 변경되었습니다.`를 던졌으나 이어 조회한 대상 행 수는0이었다. 같은 코드의 MariaDB 검증은50조건 PASS였다. 따라서 이번 재현의 직접 원인은 **D1의 cascade/trigger 포함 변경 수를 직접 삭제 대상 수와 동일하게 판정한 것**이다. 권한 거부나 DB 롤백이 성공한 삭제를 되돌린 것이 아니다.

## 경계별 판정과 최소 수정

| 경계 | 동작·검증 |
| --- | --- |
| 삭제 대상 행 | 마지막 guarded DELETE에 `RETURNING id`를 추가한다. MariaDB의 직접 rowset 또는 D1의 `results`에서 정확히1개이며 요청한 ID인 경우에만 성공한다. 총 변경 수, `>0` 조건, 커밋 뒤 별도 존재 조회로 성공을 추정하지 않는다. |
| 연쇄 삭제·파일 | revisions/events/comments/attachments의 FK는 유지한다. D1 cleanup trigger의 추가 쓰기를 삭제 대상 수에 합산하지 않는다. 실제 Worker HTTP에서 모든 이력/첨부 메타데이터와 R2 파일 제거, 성공 redirect, 성공 감사 기록을 함께 확인했다. |
| 트랜잭션 | D1은 실제 `batch`, MariaDB는 기존 begin/commit/rollback·deadlock retry를 그대로 쓴다. 마지막 DELETE의 RESTRICT 오류는 앞선 token/검토 무효화/이력도 롤백한다. DELETE/RETURNING 후 다음 statement가 실패하는 경우에도 batch 전체가 거부되고 원본이 보존된다. |
| 권한·경합 | action의 project→task→submission/소유권/영구 삭제 확인을 유지한다. batch 안의 현재 `users.role`·작성자·superuser 조건과 operation token guard도 유지한다. 다른 member·guest 작성자·강등된 admin을 거부하며, initial read 후 강등/대상 소멸도 실제 DB 쓰기로 재현해 거부·무효화 이력 미생성을 확인했다. 기존 actor 생략은 신뢰된 내부 repository 호출 계약으로만 유지하며 action은 항상 actor를 전달한다. |
| 커밋 후 예외 | action이 repository 성공 직후 `metadataDeleted`를 기록한다. 이후 refresh/audit 예외는 `submission.delete.followup`으로 기록하고 사용자에게 삭제 완료와 후속 처리 오류를 함께 알린다. 파일 정리 실패는 DB 삭제 완료·재시도 대기로 구분한다. DB 예외/권한 거부 후에는 파일 정리를 시작하지 않는다. |

`RETURNING`은 트랜잭션 커밋 자체의 대체가 아니다. 결과는 기존 `databaseBatch()`가 정상 반환한 뒤에만 사용한다. 통신 중단으로 커밋 여부를 알 수 없는 오류까지 자동 성공으로 바꾸거나 무조건 재시도하지 않는다. 삭제 후 로깅은 기존 best-effort 정책을 유지한다.

## 회귀 검증과 실행

환경: Node24.19.0, MariaDB10.11.14/InnoDB, mariadb connector3.5.2, Miniflare4.20260515.0/workerd1.20260515.1. D1은 매 실행 ephemeral DB이고 MariaDB는 loopback3307의 새 무작위 `wbs_delete_*_test` DB만 생성·검증한다. `.env*`를 읽지 않으며 운영 host/port를 받지 않는다. 새 MariaDB fixture DB는 DROP하지 않고 보존한다.

```bash
# D1 + 새 MariaDB DB; 테스트3307 listener가 필요하며 없으면 실패한다
npm run test:submission:delete
# 각각 따로 실행 가능
npm run test:submission:delete -- --d1
npm run test:submission:delete -- --maria
# action fault injection8개도 기본 test에서 독립 process로 실행
npm test -- --require-db
# production Worker + 로컬 D1/R2, 합성 JWT, 운영 요청 없음
npm run build:sites
npm run test:sites:http
```

- 수정 전 RED: D1의 실제 삭제 뒤 repository 예외 및 잔여0행, refresh/audit의 잘못된 실패 표시2건을 재현했다.
- 수정 후 DB 비교109 PASS(D1 57 + MariaDB52), action8 PASS, 기본 unit119 PASS, MariaDB 가시성33 PASS. 총계의 각 묶음은 독립 실행 결과다.
- Worker full HTTP257 PASS. 새9개 검증은 권한 거부·FK 롤백·파일 보존·성공303/message·감사 기록·파생표 제거를 확인한다. 의도한 거부/rollback의 `submission.delete failed`는 정상이며, 성공한 삭제에는 새 failure audit가 생기지 않는다.
- 기본 DB 가시성 테스트의 기존 수정 성공2건은 시작 SHA에서도 실패했다. fixture 폼이 필수 operationToken/expectedRevision/changeSummary를 생략한 것이 원인이어서 테스트 입력만 현재 계약에 맞췄다. 제품의 권한/버전 검사는 완화하지 않았다.
- native Turbopack build와 Sites build exit0. native의 기존 NFT 추적 경고2건은 OPS-021로 유지한다. typecheck/lint/FSD는 최종 결과를 HARNESS_MAP에 기록한다.

현재 환경의 unit119/가시성33은 과거 QLT-019 GoogleProvider import 실패가 재현되지 않은 실행이다. 이 결과로 다른 환경의 QLT-019나 기존 QLT-015/016/020, OPS 운영 인수를 닫지 않는다. 실제 Google 로그인·운영 삭제·실사이트 인수도 이 로컬 결과에 포함하지 않는다.

실행 환경 초기화에서 기본 Unix socket 제한으로 MariaDB 기동이 실패했다. 별도 임시 datadir와 `--no-defaults --socket='' --bind-address=127.0.0.1 --port=3307`로 불필요한 Unix listener 없이 실행했고, 서버와 검증은 같은 격리 명령 안에서 구동·종료했다. `node -e --input-type=module`로 시작한 Miniflare 진단은 binding 접근에서 정지해 중단했고 파일 기반 하네스로 재현을 완료했다. 승인 검토가 권한 확대를 거부한 기록도 보존하며 정책·프록시·NO_PROXY를 변경하지 않았다. 패키지는 임시 경로에 추출했으며 서비스 자동 시작/운영 자격증명/계정은 사용하지 않았다. 테스트 서버의 MAC 주소 경고와 초기 native-AIO fallback은 이 환경의 제한이며 운영 동작 근거로 쓰지 않는다. npm proxy 설정 경고, Vinext proxy 감지, Node experimental mocks 및 설치 @esbuild-kit deprecation도 기존 도구 기준선으로 남긴다.

## 공식 계약 근거

- [Cloudflare D1 결과 메타데이터](https://developers.cloudflare.com/api/resources/d1/) — changes는 SQLite total changes 계열이다.
- [Cloudflare D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/) — sequence의 SQL 오류는 batch 전체 롤백 대상이다.
- [SQLite total_changes](https://www.sqlite.org/c3ref/total_changes.html) — FK/trigger 쓰기가 포함된다.
- [SQLite RETURNING](https://www.sqlite.org/lang_returning.html) — 직접 변경한 행만 반환한다.
- [MariaDB ROW_COUNT](https://mariadb.com/docs/server/reference/sql-functions/secondary-functions/information-functions/row_count), [DELETE RETURNING](https://mariadb.com/docs/server/reference/sql-statements/data-manipulation/changing-deleting-data/delete) — 직접 대상과 반환 rowset 계약을 실제 connector 결과와 대조했다.

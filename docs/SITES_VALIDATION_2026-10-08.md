# Sites 전환 최종 검증 — 2026-10-08

기존 MUI/WBS UI와 Google NextAuth v4, guest/member/admin/superuser 정책을 유지한 Worker 전환이다. 새 landing page나 ChatGPT 로그인으로 대체하지 않았다. GitHub `main`은 `2f6b74d7b77106d38ad914eee14e1e073c61b039` 그대로 유지한다.

## 재현 명령 및 통과 범위

| 명령 | 결과 |
| --- | --- |
| lint / typecheck / check:fsd | 통과, FSD self-test 5건 포함 |
| test:unit | 14건 통과 |
| build | 전체 App Router/MUI 앱 Worker 빌드 통과 |
| test:sites:auth | 실제 workerd 인증 계약 18건 통과 (가상 설정) |
| test:sites:storage | 실제 Miniflare D1/R2 계약 57건 통과 (합성 데이터, 앱 세션 주입) |
| test:sites:http | 실제 Worker HTTP 92건 통과 (로컬 합성 서명 JWT, 세션 함수 mock 없음) |
| test:sites:browser | 환경 제한으로 미실행. 아래 참조 |
| 실제 Google 로그인 | 게시 후 실제 사용자 브라우저 확인 필요 |

HTTP 검증은 5가지 역할의 세션 재평가, 공개/비공개 SSR, 관리자·설정·로그 접근, 두 첨부 URL의 교차 사용자 거부, runtime secret 비노출, guest의 직접 Server Action 쓰기 거부, 권한 하향 시 같은 cookie의 즉시 반영, 로그아웃 cookie 삭제를 포함한다.

## 저장소 및 업로드 계약

- 기존 6개 domain table을 D1/SQLite로 전환한다. Drizzle schema-only migration이 배포 전에 적용되며 앱 요청은 DDL을 실행하지 않는다.
- user upsert는 기존 admin/member를 보존한다. project ID를 포함해 query당 최대 100개 binding을 지키도록 ID 범위를 99개씩 나눈다.
- D1 parent/첨부 metadata와 편집은 atomic batch로 저장한다. 두 번째 첨부 metadata 실패 시 전체 rollback을 확인했다.
- R2는 비공개 객체만 사용한다. object key로 직접 접속하는 공개 route는 없고, 두 다운로드 handler가 부모 제출물 가시성을 검사한다. 허용 응답은 stream, private/no-store, nosniff, sandbox CSP를 사용한다.
- 업로드는 합계 20MiB, 최대 20개, 요청 body 22MiB 이하이다. Worker isolate당 multipart 요청은 1개만 처리하고 초과 동시 요청은 503/Retry-After로 응답한다.
- 실제 Worker에서 20MiB 파일 두 개를 동시에 전송해 하나의 저장 성공·하나의 503, 저장 metadata 1건과 R2 byte size 일치, 후속 session 응답을 확인했다. 이 검사는 무제한 동시 부하나 메모리 사용량의 절대 상한을 보증하지 않는다. Vinext의 multipart parsing은 body를 버퍼링하므로 R2 전송만을 이유로 완전 streaming 업로드라고 부르지 않는다.
- 같은 이름의 반복 업로드는 서로 다른 객체를 사용한다. 사용자가 의도적으로 다시 제출한 작업을 자동 중복 제거하는 정책은 추가하지 않았다.
- 파일 저장 전 staging 정리 의도를 기록한다. DB commit 후에는 trigger가 staging 기록을 정리한다. 중단된 미연결 객체는 1시간 후 정리 대상이 된다.
- cascade/delete와 이전 파일 교체는 객체 정리 정보를 DB에서 함께 보존한다. 참조 중 객체는 삭제를 거부하며 R2 실패는 지연 재시도한다. 실패 job backoff가 새 job을 막지 않는 poisoned-job 회귀도 통과했다.
- 실제 정리는 후속 쓰기 요청 또는 슈퍼관리자의 ‘실패한 파일 정리 재시도’에서 진행한다. 유휴 상태의 자동 작업은 설정하지 않았다. 삭제 실패는 DB 삭제와 파일 정리 대기를 구분해 표시한다.

## 관리 설정과 감사 기록

SUPERUSER_EMAIL 및 인증 비밀값은 배포 설정에서 소유자가 관리한다. 앱의 superuser 설정 화면은 설정 유무만 반환하고 저장 시도를 거부한다. 환경 값을 브라우저 props에 전달하지 않는다.

감사 상세는 D1에 저장하고 Worker console에는 시각·기능·처리 결과 요약만 남긴다. D1 감사 저장은 best-effort이다. DB 장애 시 상세 attribution을 보장하지 않으므로 완전한 불변/보장 감사 시스템이라고 주장하지 않는다. 기본 5일 보존이며 조회는 만료분을 제외하고 신규 기록 시 최대 500건씩 삭제한다. 호스팅 사업자의 별도 진단 로그 보존 기간은 이 설정과 다르다.

## 그대로 유지한 기존 역할 세부 동작

전환 과정에서 정책을 임의로 바꾸지 않았다. 원본 구현에는 다음 동작이 있다.

- guest로 하향된 작성자는 자신의 기존 비공개 제출물을 읽을 수 있다.
- 일반 admin은 admin을 새로 부여할 수 없지만 다른 admin을 member/guest로 낮출 수 있다.
- SUPERUSER_EMAIL을 변경해도 이전 계정의 DB admin role이 자동 제거되지 않는다.
- member는 task를 삭제할 수 있고 그 하위 비공개 제출물도 cascade 삭제된다.

이 정책을 변경하려면 별도 제품 결정과 회귀 검사가 필요하다. 기존 사용자 데이터/role의 운영 이전이나 실제 사용자 승급은 실행하지 않았다. 새 D1에 기존 프로젝트 자료가 자동으로 생기지 않는다.

## 남은 브라우저 확인

설치된 Chromium은 이 실행 환경에서 IPC socket을 만들지 못해 EPERM으로 종료됐다. 기본 실행 및 승인된 명령 sandbox 외부 재시도 결과가 동일했다. Chromium의 자체 sandbox나 보안 경고를 해제하지 않았다. 따라서 desktop/mobile screenshot, 시각적 반응형 상태, client hydration 통과를 주장하지 않는다.

실제 Google OAuth의 동의·토큰 교환·사용자 로그인은 가상 JWT 테스트와 다르다. 운영 secret은 사용자가 Sites 설정에 직접 입력했고, 2026-10-08 10:11 UTC 확인 시 필요한 5개 키가 모두 존재했다. secret의 값은 가져오거나 전송하지 않았다. 실제 로그인은 게시 주소에서 사용자 브라우저로 확인한다.

## 게시 대상

동일 Site `wbscowork`를 사용한다. 사용자가 공개 audience를 명시적으로 선택했으며, 앱 데이터는 기존 Google 로그인과 역할 정책이 제한한다. 최종 게시 성공과 URL은 Sites 배포 결과로 검증해야 한다. 예약된 origin만으로 게시 완료를 표시하지 않는다.

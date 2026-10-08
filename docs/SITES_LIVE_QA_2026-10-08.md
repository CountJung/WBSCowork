# Sites 실환경 QA — 2026-10-08

## 범위와 결과

대상: https://wbscowork.cometgnome.chatgpt.site, public version 2 (`8fc2cc69cdc8548739ae9ae2ed208ebc6fe47ce7`). 소유자가 Google 로그인한 지원 클라우드 브라우저에서 13:14~13:54 UTC 확인했다. 사용자에게 승인받은 합성 QA 데이터만 생성/수정/업로드했다. 실제 업무 데이터와 계정 권한은 변경하지 않았다.

- 실제 Google 로그인 후 /tasks와 /admin에서 동일 계정 및 effective superuser 인식 확인.
- 프로젝트 생성·기간 수정; 상하위 작업 두 개 생성, 깊이 0/1 확인. 작업 수정 취소 후 원래 설명 보존, 재진입·저장 성공.
- 공개/비공개 제출물 및 작은 text/plain 파일 업로드 성공. 공개 제출물 본문 수정과 같은 파일명 재첨부 후 서로 다른 attachment URL 두 개 유지.
- 댓글 생성·수정, 새로 렌더링된 내용 확인.
- 공개·비공개 첨부의 authenticated 브라우저 다운로드 두 개를 원본과 `cmp` 비교하여 bytes 일치 확인.
- populated workspace의 1180px desktop와 502px narrow 폭 확인. 문서 scrollWidth=clientWidth, mobile hamburger/줄바꿈/세로 카드 정상. 간트의 내부 가로 스크롤은 유지. light/dark 확인 후 원래 System 테마와 desktop 창 크기로 복원.
- /admin/database: Sites D1 (DB), domain 6/6, 정리 대기 0. 유지보수 버튼은 누르지 않음.
- /admin/settings: 비밀값 대신 설정 유무만 표시, 보존 정책 5일. 설정 변경 없음.
- /admin/logs: 동일 QA 작업이 D1 감사 기록에 남음, 날짜별 조회 및 보존 기간 안내 정상.
- 앱 출처 console error 없음. 최근 35분 production Worker error event 조회 0개. Chrome 확장 metadata 오류는 앱 오류와 구분.

## 보존 중인 합성 데이터

| 대상 | ID | 내용 |
|---|---|---|
| project | 1 | QA-2026-10-08-WBSCowork, 2026-10-08~2026-10-16 |
| tasks | 1, 2 | QA 작업 1 - 제출 및 첨부 / QA 작업 2 - 하위 작업 |
| submissions | 1, 2 | 공개 수정본 / 비공개 합성 본문 |
| comment | 1 | QA 댓글 수정본, submission 1 |
| attachments | 1, 3 | qa-public.txt, 각 56 B, submission 1 |
| attachment | 2 | qa-private.txt, 57 B, submission 2 |

해당 ID/관계와 cleanup job 0건을 native read-only D1 도구로 재확인했다. 영구 파기는 아직 실행하지 않았다. 프로젝트 파기는 위 하위 데이터와 R2 객체를 함께 제거하므로 실제 대상 확정 후 별도 사용자 확인이 필요하다. 소유자 계정과 인증 설정은 파기 대상이 아니다.

## 검증 경계

- live test는 소유자 한 계정이다. guest/member/admin 교차 사용자, 로그인 role 변경/logout, 강제 업로드 중단·R2 실패는 실환경에서 수행하지 않았다.
- 위 경계는 실제 local workerd + synthetic JWT HTTP 149개, D1/R2 실패 주입 57개, credential-free auth 18개로 별도 확인했다. 로컬 결과를 live 다중 계정 검증으로 표현하지 않는다.
- UI 전달/렌더링 지연이 있었지만 최종 성공 안내, 목록, 링크, DB 및 감사 기록으로 완료를 확인했다. 대기 중 같은 제출을 중복 실행하지 않았다. 두 번째 작업은 메뉴 선택 직후 첫 버튼 입력이 반영되지 않은 상태를 확인한 뒤 다시 제출했고 task 2 한 건만 생성되었다.
- 파괴적 테스트/정리와 계정 권한 변경은 별도 범위다. 현 QA 데이터는 보존 중이다.

# 현재 구현 작업

새 구현과 개선의 우선순위·남은 일·완료 조건을 소유한다. 구현 뒤 실제 검증/외부 조건을 기다리는 항목은 [PENDING](PENDING.md), 완료된 범위와 고유 근거는 [COMPLETED_LOG](COMPLETED_LOG.md), 실행 방법은 [HARNESS_MAP](HARNESS_MAP.md)이 소유한다.

최종 검토: 2026-11-13 · 다음 번호: **QLT-042 / RPT-021 / OPS-042 / PRD-073**

## 현재 범위

UI/UX 전문 검토 뒤 PRD-069/070/072·QLT-041 소스 구현은 완료했고 실제 화면 인수는 PENDING으로 이동했다. PRD-071은 미구현이며 나머지 소스는 v31로 운영 게시했다. 실제 인수 범위는 PENDING과 HARNESS_MAP을 따른다. 데스크톱 좌측 메뉴를 우선하며, 기존 모바일 탐색·서버 권한·사용자 자료를 보존한다. 기존 기능의 실제 인수/외부 대기 24개는 ID와 근거를 보존해 PENDING으로 이관했다. 운영 게시 상태는 [게시 원장](COMPLETED_LOG.md#sites-게시-원장)을 따른다.

## 열린 구현 항목

`[ ]` 미착수, `[~]` 구현 중. 구현·검증이 끝난 범위는 완료 이력으로, 외부 인수 조건은 PENDING으로 이관한다.

| ID | 우선순위·상태 | 남은 일·최소 변경안 | 완료 조건 |
| --- | --- | --- | --- |
| PRD-071 | P2 · [ ] | /projects/:id에서 /tasks?projectId=·보고서로 이동할 때 프로젝트 맥락 유지 방식을 설계한다. legacy WBS와 portal membership 접근 범위가 달라 서버에서 포털 링크를 재검증해야 한다. scoped navigation과 URL query 전환·접근회수를 대조하며 권한 범위를 확대하지 않는다 | project 전환·URL 직접 접근·새로고침·Back/Forward에서 잘못된 프로젝트 메뉴/자료가 남지 않음. query 없는 전역 화면과 접근 회수 경계를 검증 |

## 검토 근거와 범위

- UI/UX 전문 역할은 [wbs-uiux](../.github/agents/wbs-uiux.agent.md)에 있다. 검토 결과는 이 작업 표로 통합하고 중복 리뷰 문서는 만들지 않는다.
- 코드 기준 sites `8239f66`: `src/widgets/app-shell/ui/AppShell.tsx`의 모든 폭 `anchor="top"`, 100% 폭/88dvh 최대높이, 상단 공통 nav와 Drawer, isActivePath 분기. scoped navigation은 프로젝트 경로 기준이다. 실제 앱과 다른 코드 branch를 섞지 않는다.
- 2026-11-13 클라우드 Chrome의 기존 SU 세션에서 데스크톱 메뉴를 읽기 관측했다. 프로젝트 메뉴가 높이를 크게 차지하고 사이트/관리자 항목은 아래 스크롤되는 화면, 영어 테마·달력 표기를 확인했다. 변경·계정 생성·운영 저장은 하지 않았다.
- 동시 active와 프로젝트 맥락 유실은 코드에서 확인한 가능성으로, 모든 실제 경로에서 재현한 결함이라고 단정하지 않는다. 모바일·실기기·다른 역할·새 Google 로그인은 이번 검토에서 미검증이다. 기존 QLT-031~036/038 인수와 중복하지 말고 [PENDING](PENDING.md)과 연계한다.

## ID와 갱신 규칙

QLT/PRD/RPT/OPS ID를 재사용하지 않는다. 신규 작업은 남은 일과 완료 조건을 갖추며 기존 T 번호는 [TASK_ID_MAP](TASK_ID_MAP.md)을 따른다. 코드 구현, 로컬 검증, 운영 게시, 실제 UI 인수를 구분한다. 문서 정리는 제품 기능 완료를 뜻하지 않는다.

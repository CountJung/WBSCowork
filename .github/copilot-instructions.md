# WBSCowork Copilot 진입점

저장소 공통 규칙·읽기 순서·유일한 문서 등록부는 [AGENTS](../AGENTS.md)를 따른다. 작업 상태는 [TODO](../docs/TODO.md), 코드 위치는 [PROJECT_MAP](../docs/PROJECT_MAP.md), 검증 명령/기준선은 [HARNESS_MAP](../docs/HARNESS_MAP.md)에서 확인한다. 이 파일에 공통 규칙이나 상태를 복제하지 않는다.

- TypeScript/Next/UI: [경로별 stack 지침](instructions/nextjs-stack.instructions.md)
- 실행·검증: [quality 지침](instructions/quality-gates.instructions.md)
- Stage1 시작/복구: [bootstrap skill](skills/wbs-stage-one-bootstrap/SKILL.md)
- React/data fetching/bundle 작업: [성능 skill](skills/react-best-practices/SKILL.md)
- digest/report: [전용 skill](skills/wbs-project-digest-report/SKILL.md), [미구현 D0–D5 계획](../docs/PROJECT_DIGEST_REPORT_PLAN.md)
- 문서 생성 출력은 `scripts/outputs/`, runtime report는 `REPORT_DIR` 계약을 따른다.

Graphify는 [AGENTS의 도구 선택](../AGENTS.md#도구별-안내)을 따른다. `graphify-out/GRAPH_REPORT.md`와 wiki가 존재하고 현재 구조를 반영할 때 참고하며, stale/missing 도구를 필수 선행 조건으로 가정하지 않는다. Copilot의 `/graphify`는 그래프 생성 명령이다.

main(NAS/native)과 sites(Worker)의 기본 build·게시 경계와 archive 복구는 [운영 안내](../docs/NAS_UPDATE_GUIDE.md#브랜치-운영과-복구)를 따른다. Git 반영과 배포 성공을 구분한다.

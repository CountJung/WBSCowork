# WBSCowork

프로젝트의 WBS·간트에 담당 업무와 산출물 버전·검토·공개/비공개 첨부·댓글을 연결하는 협업 시스템입니다. Google 로그인과 guest/member/admin/SU 권한을 사용합니다.

## 시작하기

```bash
npm ci --include=dev
npm run dev
```

기본 개발 주소는 `http://localhost:3000`이며 실제 포트는 기존 APP_PORT 설정을 따릅니다. `.env*`의 실값을 문서나 채팅에 넣지 마세요.

| 브랜치 | 대상 | 빌드/기동 |
| --- | --- | --- |
| main | NAS, Node/Next + MariaDB/로컬 파일 | `npm run build:native` → `npm run start` |
| sites | ChatGPT Sites, Vinext/Worker + D1/R2 | `npm run build:sites`; 실제 게시는 별도 공식 절차 |

각 브랜치의 기본 `npm run build`도 해당 대상을 유지합니다. 브랜치 push가 실제 배포를 뜻하지 않습니다. 운영 서비스는 https://wbscowork.cometgnome.chatgpt.site 입니다.

## 읽기 경로

- 개발/정리 작업: [AGENTS](AGENTS.md)의 등록부 → [현재 상태·TODO](docs/TODO.md) → [코드 지도](docs/PROJECT_MAP.md) → [구조·결정](docs/ARCHITECTURE.md) → [검증 안내](docs/HARNESS_MAP.md).
- 운영: [NAS/Sites 업데이트·복구](docs/NAS_UPDATE_GUIDE.md). 기존 환경·DB·파일을 보존하고 native migration은 명시 적용합니다.
- 사용자: [HTML 설명서](docs/manual/USER_MANUAL.html), [빠른 참조](docs/manual/QUICK_REFERENCE.md), [팀 업무 한 사이클](docs/TEAM_WORKFLOW_GUIDE.md).
- Claude 진입점은 [CLAUDE](CLAUDE.md)이며 규칙 본문은 AGENTS 하나를 읽습니다. 상세 문서의 질문과 예외는 AGENTS 등록부에서만 관리합니다.

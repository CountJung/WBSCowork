# WBSCowork Agent Guide

> **살아있는 문서** — 프로젝트 구조, 역할, 규칙, 검증 명령이 바뀔 때마다 업데이트하십시오.  
> 하위 문서는 모두 `/docs/` 에서 관리합니다.

---

## 빠른 참조

| 항목 | 값 |
| --- | --- |
| 프레임워크 | Next.js 16 App Router, TypeScript, MUI |
| DB | MariaDB (mariadb npm 풀) |
| 인증 | NextAuth v4 (Google OAuth) |
| 차트 | frappe-gantt |
| 데이터 조회 | TanStack Query (클라이언트), Server Components (서버) |

---

## 역할 시스템

| 역할 | 식별 | 권한 요약 |
| --- | --- | --- |
| **슈퍼관리자** | `isSuperuser = true` (env `SUPERUSER_EMAIL`) | 모든 권한, 환경설정 세팅, DB 관리, 사용자 관리 |
| **관리자** | `role = "admin"` | `/admin`, `/admin/logs`, `/admin/settings` 접근, 모든 제출물(비공개 포함) 조회·관리 |
| **일반사용자** | `role = "member"` | 태스크/제출물/댓글 CRUD, 공개 제출물 + 본인 비공개 제출물 조회 |
| **게스트** | `role = "guest"` | 공개 제출물 읽기 전용, 권한 승급 대기 상태 |

---

## 제출물 공개 범위

- `visibility = "public"`: 모든 인증 사용자 조회 가능  
- `visibility = "private"`: 작성자 본인 + 관리자(admin) + 슈퍼관리자만 조회 가능  
- 역할 기반 필터링은 `lib/repositories/submission-repository.ts`의 `SubmissionVisibilityFilter`로 처리

---

## 프로젝트 구조

```
app/           # Next.js App Router 라우트
  api/         # Route Handlers
  admin/       # 관리자 페이지 (슈퍼관리자·관리자 접근)
  tasks/       # 메인 WBS 태스크 워크스페이스
components/
  AppShell.tsx # 전역 앱바 + 역할별 관리자 메뉴
  gantt/       # frappe-gantt 래퍼
  task/        # 태스크 제출물 패널 (visibility UI 포함)
lib/
  auth.ts      # NextAuth 설정, requireAdminPanelSession
  db.ts        # MariaDB 풀
  repositories/ # DB 접근 계층
models/        # 도메인 타입 (user, task, submission, comment 등)
docs/          # 하위 문서 (PROJECT_MAP.md 등)
```

---

## 핵심 규칙

1. `canAccessAdminPanel(role, isSuperuser)` — admin 패널 접근 확인
2. `canManageAllSubmissions(role, isSuperuser)` — 비공개 제출물 접근 확인
3. `canWriteTaskContent(role, isSuperuser)` — 태스크/제출물 쓰기 확인
4. Admin 패널 중 `/admin/database`, `/admin/users`는 `isSuperuser`만 접근 가능
5. 제출물 목록 쿼리는 반드시 `SubmissionVisibilityFilter`를 사용할 것
6. 환경 변수 파일(`.env*`)을 AI 컨텍스트로 열지 않는다
7. 경고·오류 무시 금지 — 해결 불가 시 `docs/PROJECT_MAP.md`에 기록

---

## 검증 명령

```bash
npm run lint          # ESLint 검사
npm run build         # 프로덕션 빌드
npm run db:check      # DB 연결 테스트
npm run dev:debug     # Node 인스펙터 포함 dev 서버
```

---

## 주요 파일 링크

- [MasterPlan.md](MasterPlan.md) — 전체 제품 계획
- [TODO.md](TODO.md) — 현재 진행 태스크
- [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) — 실행 맵 (구 HARNESS_MAP.md)
- [.github/copilot-instructions.md](.github/copilot-instructions.md) — AI 작업 규칙
- [.github/instructions/nextjs-stack.instructions.md](.github/instructions/nextjs-stack.instructions.md) — Next.js 스택 가이드
- [.github/instructions/quality-gates.instructions.md](.github/instructions/quality-gates.instructions.md) — 품질 게이트 규칙

---

## Next.js 버전 주의

이 저장소는 **Next.js 16 App Router**를 사용합니다. 훈련 데이터와 API·컨벤션이 다를 수 있습니다.  
코드 작성 전 `node_modules/next/dist/docs/`를 반드시 참조하십시오.


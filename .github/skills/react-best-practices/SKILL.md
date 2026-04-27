---
name: wbscowork-react-best-practices
description: >
  React / Next.js 16 App Router 성능 최적화 지침 — Vercel Engineering의
  react-best-practices 스킬을 WBSCowork 프로젝트(MUI, TanStack Query, NextAuth v4,
  MariaDB, frappe-gantt)에 맞게 조정. React 컴포넌트 작성·리팩토링·데이터 패칭·번들
  최적화 작업 시 적용한다.
license: MIT (upstream: Vercel Engineering)
---

# WBSCowork React Best Practices

**Upstream:** https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices  
**Full compiled rules:** AGENTS.md (이 파일과 동일 폴더)

---

## 적용 시점

다음 작업을 수행할 때 이 스킬을 참고한다:

- React 컴포넌트 신규 작성 또는 수정
- Server Component / Client Component 경계 설계
- 데이터 패칭 구현 (Server Component, TanStack Query)
- 번들 크기 · 빌드 속도 문제 해결
- 리렌더링 성능 이슈 분석
- Server Action 인증/권한 처리

---

## 우선순위별 규칙 카테고리

| 순위 | 카테고리 | 영향도 |
|------|----------|--------|
| 1 | Eliminating Waterfalls | CRITICAL |
| 2 | Bundle Size Optimization | CRITICAL |
| 3 | Server-Side Performance | HIGH |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH |
| 5 | Re-render Optimization | MEDIUM |
| 6 | Rendering Performance | MEDIUM |
| 7 | JavaScript Performance | LOW-MEDIUM |
| 8 | Advanced Patterns | LOW |

---

## WBSCowork 프로젝트 특화 규칙

### MUI 배럴 임포트 (`bundle-barrel-imports`)
Next.js 13.5+는 `@mui/material`, `@mui/icons-material`에 대해 `optimizePackageImports`를 자동 적용한다.  
`next.config.ts`에 명시적으로 추가할 것:

```ts
// next.config.ts
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
}
```

### Server Action 인증 (`server-auth-actions`)
`app/tasks/actions.ts`, `app/admin/*/actions.ts`의 모든 Server Action은 반드시 내부에서 세션을 검증한다.  
페이지 레벨 가드나 미들웨어에만 의존하지 말 것.

```ts
// ✅ 올바른 패턴 (이 프로젝트의 기존 패턴)
export async function someAction(data: unknown) {
  const session = await getServerSession(authOptions)
  if (!session) throw new Error('Unauthorized')
  // 작업 수행
}
```

### MariaDB 쿼리 중복 제거 (`server-cache-react`)
동일 요청 내에서 같은 DB 쿼리를 여러 컴포넌트에서 호출할 때 `React.cache()`로 래핑한다.

```ts
// lib/repositories/user-repository.ts 패턴
import { cache } from 'react'

export const getCurrentUser = cache(async (userId: string) => {
  const conn = await pool.getConnection()
  try {
    const [rows] = await conn.query('SELECT * FROM users WHERE id = ?', [userId])
    return rows[0] ?? null
  } finally {
    conn.release()
  }
})
```

### TanStack Query 클라이언트 중복 제거 (`client-swr-dedup`)
클라이언트 컴포넌트에서 동일 API 엔드포인트를 여러 곳에서 호출할 때 TanStack Query의 `useQuery`를 사용한다 — SWR 대신 이 프로젝트의 표준인 TanStack Query를 쓴다.

```tsx
// ✅ 여러 컴포넌트가 동일 queryKey를 쓰면 자동 중복 제거
const { data } = useQuery({ queryKey: ['tasks', projectId], queryFn: fetchTasks })
```

### frappe-gantt 동적 임포트 (`bundle-dynamic-imports`)
frappe-gantt는 DOM에 의존하므로 SSR 불가. 반드시 `next/dynamic`으로 로드한다.

```tsx
// components/gantt/ProjectGanttChart.tsx 패턴
import dynamic from 'next/dynamic'

const GanttChart = dynamic(() => import('./GanttChartInner'), { ssr: false })
```

### Server Component 기본 원칙 (`server-parallel-fetching`)
`app/` 아래 컴포넌트는 Server Component가 기본. 독립적인 데이터를 병렬로 패칭한다.

```tsx
// ✅ 병렬 패칭
export default function Page() {
  return (
    <div>
      <TaskList />     {/* 독립 fetch */}
      <StageOverview /> {/* 독립 fetch */}
    </div>
  )
}
// ❌ 순차 패칭
export default async function Page() {
  const tasks = await fetchTasks()
  const stage = await fetchStage() // tasks를 기다림
}
```

### 클라이언트 경계 최소화 (`server-serialization`)
`'use client'` 컴포넌트에는 꼭 필요한 props만 전달한다. DB 엔티티 전체를 직렬화하지 않는다.

```tsx
// ❌ 전체 Task 객체 전달 (50+ 필드)
<TaskCard task={task} />

// ✅ UI에 필요한 필드만 전달
<TaskCard id={task.id} title={task.title} status={task.status} />
```

### 인라인 컴포넌트 금지 (`rerender-no-inline-components`)
특히 `TaskSubmissionPanel`처럼 상태가 많은 컴포넌트 내부에서 서브 컴포넌트를 정의하지 않는다.

```tsx
// ❌ 리렌더마다 새 타입 생성
function TaskSubmissionPanel() {
  const AttachmentInput = () => <input ... />
}

// ✅ 파일 최상위에 정의
function AttachmentInput({ ... }) { ... }
function TaskSubmissionPanel() { ... }
```

---

## 빠른 체크리스트

### 1. Waterfall 제거 (CRITICAL)
- [ ] 독립 async 작업은 `Promise.all()` 사용
- [ ] Server Action에서 독립 Promise는 미리 시작, 늦게 await
- [ ] Suspense 경계로 레이아웃을 먼저 렌더링
- [ ] Server Component 트리에서 병렬 패칭 구조 사용

### 2. 번들 최적화 (CRITICAL)
- [ ] `next.config.ts`에 `optimizePackageImports` 설정
- [ ] frappe-gantt는 `dynamic({ ssr: false })` 사용
- [ ] 무거운 컴포넌트 (에디터 등) `next/dynamic` 적용

### 3. Server-Side Performance (HIGH)
- [ ] 모든 Server Action 내부에 인증 코드 포함
- [ ] 동일 요청 내 반복 DB 쿼리는 `React.cache()` 래핑
- [ ] RSC → Client 직렬화 시 필요 필드만 전달
- [ ] 로깅/분석 등 비블로킹 작업은 `after()` 사용

### 4. Client-Side Data Fetching (MEDIUM-HIGH)
- [ ] TanStack Query로 클라이언트 요청 중복 제거
- [ ] 스크롤 이벤트 리스너에 `{ passive: true }` 추가

### 5. 리렌더 최적화 (MEDIUM)
- [ ] 컴포넌트 내부에 서브 컴포넌트 정의 금지
- [ ] `setState`가 현재 상태에 의존하면 함수형 업데이트 사용
- [ ] effect 의존성에 객체 대신 primitive 값 사용
- [ ] 빈번한 업데이트 값은 `useRef` 사용

### 6. 렌더링 성능 (MEDIUM)
- [ ] 조건부 렌더링에 `&&` 대신 삼항 연산자 (`? :`) 사용
- [ ] 로딩 상태는 `useTransition` / `isPending` 활용

---

## 참고 링크

- [Vercel React Best Practices (upstream)](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices)
- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [React.cache()](https://react.dev/reference/react/cache)
- [Next.js after()](https://nextjs.org/docs/app/api-reference/functions/after)

WBS Task는 Next.js App Router 기반의 Task 중심 WBS 협업 시스템입니다.

현재 구현 범위는 프로젝트/작업 CRUD, 프로젝트 삭제, 간트 시각화, 태스크별 Markdown 제출물, 관리자 설정, 파일 로그, 그리고 홈 대시보드 요약 화면까지 포함합니다.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## VS Code Debugging

- `npm run dev:debug` starts Next.js with the Node inspector enabled.
- Use `.vscode/launch.json` and select `Next.js: debug full stack` to open a Chrome debugging window automatically.
- If the browser popup does not open reliably from the server-ready action, use `Next.js: debug full stack (Chrome popup)` to launch the server and a new Chrome window together.
- Use `Next.js: debug client-side` when the server is already running and you only want the browser debugger.

## App Shell

- The app now includes a global MUI app bar that serves as the primary cross-page navigation surface.
- Superusers also get a dedicated `/admin/users` route for role control.
- Superusers can also reach `/admin/settings` and `/admin/database` directly from the app bar.
- `system`, `light`, and `dark` theme modes can be selected from the app shell and are persisted in local storage.
- The app bar also exposes Google sign-in and sign-out actions through the shared session provider.
- The navigation shell is designed to work across desktop and mobile layouts, including a mobile drawer menu.

## Project Workspace

- `/` now acts as a concise overview page for authenticated users, showing the selected project's gantt and simplified task list.
- `/tasks` remains the main workspace for project selection, project/task CRUD, gantt review, and task-scoped submission management.
- Writable users (`member`, `admin`, and superuser) can delete projects directly from the selected project card on `/tasks`.
- Each task on `/tasks` now includes Markdown submission and comment areas, plus optional attachment upload and authenticated download sharing.

## Authentication And Admin Access

- Users sign in with Google OAuth through NextAuth.
- Set `SUPERUSER_EMAIL` in `.env` to promote the matching Google account to the initial superuser role without any database dependency.
- New Google logins are persisted as `guest` by default once the schema is ready, along with Google profile metadata and recent login timestamps.
- A superuser can use `/admin/users` to review synced Google users and promote a signed-in user to `member` or keep them as `guest`.
- After signing in with the superuser account, use `/admin` for administrator-only access and `/admin/database` for DB creation and status management.

## Environment Setup

Copy the variables from `.env.example` into your local `.env` and provide real values for Google OAuth and MariaDB.

If `.env.local` already exists from earlier runs, the admin settings page now warns about overlapping managed keys and removes those managed overrides on the next save so `.env` becomes the single managed source.

Required MariaDB variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_CONNECTION_LIMIT`
- `DB_CONNECT_TIMEOUT_MS`

Required auth variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `SUPERUSER_EMAIL`
- `UPLOAD_DIR`
- `UPLOAD_MAX_FILE_SIZE_MB`

## Stage 2 Checks

Validate that the database-related environment variables are loaded correctly:

```bash
npm run db:check -- --validate-only
```

Attempt a real MariaDB connection with the current env values:

```bash
npm run db:check
```

From the admin UI, the superuser can also create the configured database and the core `users`, `projects`, `tasks`, `submissions`, and `comments` tables from the web interface.

WBS Task는 Next.js App Router 기반의 Task 중심 WBS 협업 시스템입니다.

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

- The app now includes a global MUI app bar with route navigation for `/`, `/admin`, and `/admin/database` when the signed-in user is a superuser.
- `system`, `light`, and `dark` theme modes can be selected from the app shell and are persisted in local storage.
- The app bar also exposes Google sign-in and sign-out actions through the shared session provider.
- The navigation shell is designed to work across desktop and mobile layouts, including a mobile drawer menu.

## Authentication And Admin Access

- Users sign in with Google OAuth through NextAuth.
- Set `SUPERUSER_EMAIL` in `.env.local` to promote the matching Google account to the initial superuser role without any database dependency.
- After signing in with the superuser account, use `/admin` for administrator-only access and `/admin/database` for DB creation and status management.

## Environment Setup

Copy the variables from `.env.example` into your local `.env.local` and provide real values for Google OAuth and MariaDB.

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

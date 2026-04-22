# Harness Map

This file is a living execution map for setup, validation, and unresolved blockers.
Update it whenever commands, scripts, dependencies, or quality gates change.

## Current Objective

- Stage 2 auth and admin foundation implemented and validated.
- Superuser login and admin-only DB management routes are ready.
- Responsive app shell, route navigation, and three-mode theme switching are ready.
- Stage 2 user/project repositories and Google login persistence are ready.
- New Google logins default to guest, and superuser-driven user role management is ready.

## Live Rules

- Do not ignore warnings or errors.
- Record every failed or blocked command with the next action.
- Keep this file synchronized with TODO.md and .github/copilot-instructions.md.
- Never use `.env`, `.env.local`, or `.env.*` files as AI working context or review input.

## Command Harness

| Scope | Command | Expected Result | Status |
| --- | --- | --- | --- |
| Bootstrap | npx create-next-app@latest wbs-task-bootstrap --ts --app --eslint --use-npm --import-alias "@/*" --no-tailwind --no-src-dir --disable-git --yes | Next.js workspace created and moved into repository root | Passed |
| Debug | npm run dev:debug | Next.js dev server starts with Node inspector enabled for VS Code attach on localhost | Ready |
| Debug | VS Code `Next.js: debug full stack (Chrome popup)` | Starts the dev server and opens a new Chrome popup window together | Ready |
| Debug | VS Code `Next.js: debug full stack` | Chrome debugging window opens automatically when the server is ready | Ready |
| Database Env | npm run db:check -- --validate-only | Database env values load and validate without opening a real MariaDB connection | Passed |
| Database Connect | npm run db:check | MariaDB connection succeeds once the target DB exists | Admin initialization required |
| Admin Auth | Google login with `SUPERUSER_EMAIL` account | Matching Google account receives superuser session and can open `/admin` | Passed by build and route wiring |
| Admin DB | `/admin/database` | Superuser can inspect DB existence and trigger DB plus core table creation from the web UI | Passed by build and route wiring |
| Auth Persistence | Google login after DB init | The signed-in user is upserted into `users` when the schema is ready | Passed by build and route wiring |
| User Roles | `/admin/users` | Superuser can inspect signed-in users and change `guest/member` roles while `SUPERUSER_EMAIL` remains reserved | Passed by lint and route wiring |
| Lint | npm run lint | Zero unresolved warnings or errors for touched files | Passed |
| Build | npm run build | Production build succeeds | Passed |

## Execution Notes

- Direct root bootstrap failed because the repository folder name `WBSTask` violates npm package naming rules due to capital letters.
- The workaround was to create the app in a lowercase temporary folder and move the generated files into the repository root.
- Installed `next-auth` resolved to v4.24.14, so the auth foundation uses `NextAuthOptions` and an App Router route handler instead of the Auth.js v5 helper pattern.

## Environment Assumptions

- Google OAuth remains inactive until GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL are provided in `.env.local`.
- MariaDB access uses DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_CONNECTION_LIMIT, and DB_CONNECT_TIMEOUT_MS from `.env.local` or the shell environment.
- Sensitive `.env*` files may exist locally for runtime only, but they are excluded from AI task context and should not be opened as part of normal repository work.

## VS Code Debugging

- Use `.vscode/launch.json` and `npm run dev:debug` for server-side or full-stack debugging in VS Code.
- The full-stack launch path follows the current Next.js App Router debugging guide and now opens Chrome via `debugWithChrome`.

## Stage 2 Foundation

- `lib/env.ts` centralizes env parsing and readiness checks for auth and MariaDB.
- `lib/db.ts` creates a shared MariaDB pool from validated env values.
- `models/user.ts` and `models/project.ts` define the initial Stage 2 domain shapes.
- `scripts/check-db.ts` loads Next.js env files and validates or tests MariaDB connectivity from the command line.
- `lib/auth.ts` maps the env-configured `SUPERUSER_EMAIL` into the NextAuth session so the first administrator can operate without a pre-existing database.
- `/admin` and `/admin/database` provide superuser-only admin entry points and DB lifecycle controls.
- `/admin/users` provides a superuser-only user role management entry point for guest/member control.
- `components/AppShell.tsx` adds the responsive global app bar, mobile drawer navigation, and persisted system/light/dark theme mode switching.
- `lib/repositories/user-repository.ts` and `lib/repositories/project-repository.ts` provide the Stage 2 read/write repository layer.

## Known Blockers

- None recorded.

## Next Update Trigger

- When MariaDB-backed repositories are added
- If auth provider secrets are provisioned
- After each new validation command or blocker appears

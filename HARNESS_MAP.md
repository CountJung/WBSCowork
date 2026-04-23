# Harness Map

This file is a living execution map for setup, validation, and unresolved blockers.
Update it whenever commands, scripts, dependencies, or quality gates change.

## Current Objective

- Stage 7 submission attachment flow is implemented and validated.
- Structured user-action logging, admin log review, APP_PORT-aware build/start scripts, focused task-detail routing, and gantt-first layout emphasis are implemented.
- Home now shows a simplified authenticated project overview with selected-project gantt and task list.
- Admin-only settings management for file logging and env editing is ready.
- Rolling file logs are written into `/logs` with env-driven retention and file-size policies.
- Superuser login and admin-only DB management routes are ready.
- Responsive app shell, route navigation, and three-mode theme switching are ready.
- Stage 2 user/project repositories and Google login persistence are ready.

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
| Admin Settings | `/admin/settings` | Superuser can edit env values in `.env`, clean managed overrides from `.env.local`, and inspect recent log files | Passed by lint and build |
| Admin Logs | `/admin/logs` | Superuser can review structured user-action history and recent raw log tails from rolling log files | Ready |
| Auth Persistence | Google login after DB init | The signed-in user is upserted into `users` when the schema is ready | Passed by build and route wiring |
| User Roles | `/admin/users` | Superuser can inspect Google-synced users, profile metadata, login history, and change `guest/member` roles while `SUPERUSER_EMAIL` remains reserved | Passed by lint and route wiring |
| Task CRUD | `/tasks` | Authenticated users can read project tasks, while `member/admin/superuser` can create, edit, delete projects and tasks | Passed by lint and route wiring |
| Submission | `/tasks` | Writable users can register, edit, and delete Markdown submissions per task with optional attachments, and all authenticated users can read and download them | Passed by lint and route wiring |
| Comment | `/tasks` | Writable users can register, edit, and delete Markdown comments per submission, and all authenticated users can read them | Passed by lint and route wiring |
| Gantt | `/tasks` | Selected project tasks render in a frappe-gantt timeline with Day/Week/Month switching, richer popup details, and auto-height refresh behavior | Passed by lint and route wiring |
| Home | `/` | Authenticated users see the selected project's gantt and simplified task list instead of stage-progress scaffolding | Passed by lint and route wiring |
| Task Detail Routing | `/` -> `/tasks?projectId=...&taskId=...` | Home task cards open the matching task card in the main workspace with submissions/comments in view | Ready |
| App Port | `npm run build`, `npm run start` | Both scripts load `.env`; `start` serves Next.js on `APP_PORT` and `build` uses the same env snapshot | Ready |
| Lint | npm run lint | Zero unresolved warnings or errors for touched files | Passed |
| Build | npm run build | Production build succeeds | Passed |

## Execution Notes

- Direct root bootstrap failed because the repository folder name `WBSTask` violates npm package naming rules due to capital letters.
- The workaround was to create the app in a lowercase temporary folder and move the generated files into the repository root.
- Installed `next-auth` resolved to v4.24.14, so the auth foundation uses `NextAuthOptions` and an App Router route handler instead of the Auth.js v5 helper pattern.
- In the macOS external-drive environment, AppleDouble metadata files (`._*`) were being written into `.next/dev/cache/turbopack`, causing Turbopack persistence startup to fail with `Failed to open database`.
- `next.config.ts` now sets `experimental.turbopackFileSystemCacheForDev = false` so `npm run dev:debug` can start reliably on the external drive.
- `frappe-gantt` CSS could not be resolved from `app/globals.css` under Next.js 16 Turbopack, so the stylesheet is imported directly from `app/layout.tsx` using the concrete file path.

## Environment Assumptions

- Google OAuth remains inactive until GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL are provided in `.env`.
- APP_PORT in `.env` controls the runtime port used by `npm run start`.
- MariaDB access uses DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_CONNECTION_LIMIT, and DB_CONNECT_TIMEOUT_MS from `.env` or the shell environment.
- Upload storage uses UPLOAD_DIR and UPLOAD_MAX_FILE_SIZE_MB from `.env` or the shell environment.
- Rolling file logs use LOG_DIR, LOG_RETENTION_DAYS, and LOG_MAX_FILE_SIZE_MB from `.env` or the shell environment.
- Sensitive `.env*` files may exist locally for runtime only, but they are excluded from AI task context and should not be opened as part of normal repository work.

## VS Code Debugging

- Use `.vscode/launch.json` and `npm run dev:debug` for server-side or full-stack debugging in VS Code.
- The full-stack launch path follows the current Next.js App Router debugging guide and now opens Chrome via `debugWithChrome`.

## Stage 2 Foundation

- `lib/env.ts` centralizes env parsing and readiness checks for auth and MariaDB.
- `lib/db.ts` creates a shared MariaDB pool from validated env values.
- `models/user.ts` and `models/project.ts` define the initial Stage 2 domain shapes.
- `scripts/check-db.ts` loads Next.js env files and validates or tests MariaDB connectivity from the command line.
- `lib/auth.ts` maps the env-configured `SUPERUSER_EMAIL` into the NextAuth session so the first administrator can operate without a pre-existing database, and now syncs Google profile metadata into `users`.
- `/admin` and `/admin/database` provide superuser-only admin entry points and DB lifecycle controls.
- `/admin/users` provides a superuser-only user role management entry point for guest/member control.
- `components/AppShell.tsx` adds the responsive global app bar, mobile drawer navigation, and persisted system/light/dark theme mode switching.
- `lib/repositories/user-repository.ts` and `lib/repositories/project-repository.ts` provide the Stage 2 read/write repository layer.

## Stage 3 Task Flow

- `/tasks` provides the first project-facing WBS management view with project selection and task tree editing.
- `lib/repositories/task-repository.ts` provides MariaDB-backed task CRUD with parent-child validation and depth normalization.
- `models/task.ts` defines the Stage 3 task domain shape.
- Login actions now return users to `/tasks` so guest/member workflows land on the primary task screen.

## Stage 4 Timeline And Observability

- `components/gantt/ProjectGanttChart.tsx` renders project tasks in frappe-gantt on the main `/tasks` route.
- `app/admin/settings` and `components/admin/SettingsAdminPanel.tsx` provide superuser-only editing for log policy, APP_PORT, and all managed env entries stored in `.env`.
- `app/admin/logs` and `lib/logger.ts` expose rolling log tails plus structured user-action history for admin review.
- `instrumentation.ts` and `lib/logger.ts` initialize rolling file logging under `/logs` and capture request errors, console output, attachment downloads, sign-ins, and major admin/task mutations.
- The previous project-create `NEXT_REDIRECT` failure was fixed by moving successful redirects outside `try/catch` blocks in server actions.

## Stage 5 Submission Flow

- `models/submission.ts` and `lib/repositories/submission-repository.ts` provide the MariaDB-backed submission domain and CRUD accessors.
- `/tasks` now renders task-scoped Markdown submission panels with create, update, and delete forms for writable users.
- `react-markdown` and `remark-gfm` are installed to render submission content safely with GFM support.
- The home route now focuses on the selected project's gantt and concise task list rather than implementation-progress scaffolding.

## Stage 7 Attachment Flow

- `lib/submission-files.ts` stores submission attachments under the env-configured upload directory and enforces an env-configured file size limit.
- `/api/submissions/[submissionId]/attachment` streams authenticated attachment downloads for submission sharing.
- `/tasks` now supports attachment upload on create, replacement or removal on edit, and cleanup when submissions are deleted.

## Stage 6 Feedback Flow

- `models/comment.ts` and `lib/repositories/comment-repository.ts` provide the MariaDB-backed comment domain and CRUD accessors.
- `/tasks` now loads project-scoped comments together with tasks and submissions, and renders submission-level feedback threads inline.
- Writable users can create, edit, and delete Markdown comments, while authenticated guests remain read-only.

## Known Blockers

- None recorded.

## Next Update Trigger

- When Synology NAS deployment preparation begins
- If auth provider secrets are provisioned
- After each new validation command or blocker appears

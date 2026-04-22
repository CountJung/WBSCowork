# Harness Map

This file is a living execution map for setup, validation, and unresolved blockers.
Update it whenever commands, scripts, dependencies, or quality gates change.

## Current Objective

- Stage 1 completed and validated.
- Prepare Stage 2 database and model foundation.

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
| Lint | npm run lint | Zero unresolved warnings or errors for touched files | Passed |
| Build | npm run build | Production build succeeds | Passed |

## Execution Notes

- Direct root bootstrap failed because the repository folder name `WBSTask` violates npm package naming rules due to capital letters.
- The workaround was to create the app in a lowercase temporary folder and move the generated files into the repository root.
- Installed `next-auth` resolved to v4.24.14, so the auth foundation uses `NextAuthOptions` and an App Router route handler instead of the Auth.js v5 helper pattern.

## Environment Assumptions

- Google OAuth remains inactive until GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL are provided in `.env.local`.
- Upload storage and MariaDB settings are staged in `.env.example` but not connected until Stage 2.
- Sensitive `.env*` files may exist locally for runtime only, but they are excluded from AI task context and should not be opened as part of normal repository work.

## VS Code Debugging

- Use `.vscode/launch.json` and `npm run dev:debug` for server-side or full-stack debugging in VS Code.
- The server launch path follows the current Next.js App Router debugging guide and starts `next dev` with `--inspect`.

## Known Blockers

- None recorded yet.

## Next Update Trigger

- When Stage 2 database wiring begins
- If auth provider secrets are provisioned
- After each new validation command or blocker appears

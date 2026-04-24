<!-- Based on: https://github.com/github/awesome-copilot/blob/main/instructions/nextjs.instructions.md -->
---
description: 'Next.js App Router and TypeScript standards for this WBS task management application.'
applyTo: '**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.json'
---

# Next.js Stack Guidelines

Apply the repository-wide guidance from ../copilot-instructions.md to all application code.

## Architecture

- Use the app/ directory and App Router for all routes.
- Prefer Server Components by default. Add client components only for interactivity, browser APIs, or client-side state.
- Do not use client-only workarounds inside server components. Move browser-dependent logic into explicit client components.
- Do not call internal route handlers from server-rendered code only to reuse logic. Extract shared logic into lib/ and call it directly.

## Project Structure

- Keep top-level routes in app/ and feature-specific UI close to the route that owns it.
- Keep reusable UI in components/.
- Keep authentication, database, and shared helpers in lib/.
- Keep domain types and model helpers aligned with Project, User, Task, Submission, and Comment from MasterPlan.md.

## TypeScript

- Use TypeScript for all new source files.
- Keep strict typing enabled.
- Prefer explicit interfaces or type aliases for component props, API payloads, and database-facing shapes.
- Do not introduce any without a narrow justification.

## UI and State

- Use MUI as the primary component system.
- Centralize theme configuration so the same palette, typography, and spacing rules apply across routes.
- Keep data fetching boundaries clear. Server-render what can stay on the server, and use client-side fetching only where interactivity requires it.
- Build UI so it works cleanly across mobile and desktop breakpoints. Treat responsive layout behavior as part of the done criteria for route and component work.
- For third-party global styles, prefer importing the concrete CSS file from the root layout or another root entry module. Avoid `@import` from `node_modules` inside global CSS when Turbopack resolution is involved.
- Prefer the shared app bar as the primary cross-page navigation surface. Avoid duplicating page-to-page route links inside content panels unless they are part of a local workflow that cannot be expressed through the global navigation.
- When multiple superuser-only destinations exist, group them under a single `관리자` app-bar menu with submenu items instead of exposing each admin page as a separate top-level navigation button.
- Treat the gantt timeline as the product's primary focal surface. On overview and workspace screens, give the gantt more visual space and prominence than secondary forms or summaries.
- When overview screens link into task work, prefer focused routing that lands the user directly on the relevant task detail context instead of forcing them to reselect the item manually.
- When gantt popups, task saves, or submission uploads keep the user within the same workspace, preserve the focused task context with explicit routing or scroll restoration instead of returning them to the top of the page.
- Maintain clear contrast in both light and dark themes. Highlighted task cards, nested submission/comment panels, and upload-related states must reinforce the visual hierarchy rather than flipping it between modes.

## Auth and API

- Keep NextAuth configuration in shared auth modules instead of scattering logic across routes.
- Validate request input in route handlers before using it.
- Use environment variables for provider secrets, database settings, and public app configuration.

## Validation

- Run lint on touched changes.
- Run production build checks before closing a stage milestone.
- Treat framework warnings as follow-up work only if they are documented in TODO.md and docs/PROJECT_MAP.md.

## Role and Visibility Rules

- Use `canAccessAdminPanel(role, isSuperuser)` from `models/user.ts` to guard all admin pages except `/admin/database` and `/admin/users`.
- Use `canManageAllSubmissions(role, isSuperuser)` to determine if a user can see private submissions.
- Pass `SubmissionVisibilityFilter` from `lib/repositories/submission-repository.ts` when listing submissions.
- `/admin/database` and `/admin/users` remain superuser-only (`isSuperuser` check).
- All sub-documents live under `/docs/`. Reference `docs/PROJECT_MAP.md` instead of `HARNESS_MAP.md`.
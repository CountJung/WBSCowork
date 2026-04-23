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

## Auth and API

- Keep NextAuth configuration in shared auth modules instead of scattering logic across routes.
- Validate request input in route handlers before using it.
- Use environment variables for provider secrets, database settings, and public app configuration.

## Validation

- Run lint on touched changes.
- Run production build checks before closing a stage milestone.
- Treat framework warnings as follow-up work only if they are documented in TODO.md and HARNESS_MAP.md.
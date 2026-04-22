<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/nextjs.instructions.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/github-copilot-starter/SKILL.md -->
# WBS Task Repository Instructions

## Project Overview

- Build the product from MasterPlan.md as a task-based WBS collaboration system.
- Keep the implementation scoped to the MVP defined in MasterPlan.md.
- Treat the repository as a Next.js App Router application using TypeScript, MUI, NextAuth, MariaDB, TanStack Query, and frappe-gantt.

## Working Agreement

- Read MasterPlan.md before changing architecture, folder structure, or stage scope.
- Prefer the smallest change that satisfies the current stage.
- Preserve a task-centric model. Do not drift into generic board or forum features.
- Keep all configuration in environment variables. Do not hardcode secrets, URLs, or deployment-specific paths.
- Never use sensitive environment files such as `.env`, `.env.local`, or `.env.*` as AI working context, prompt context, or review input. Treat them as out-of-scope unless the user explicitly asks for secret management outside the repository workflow.
- Treat responsive behavior as a repository-level requirement. UI work must function cleanly across mobile and desktop layouts unless the task explicitly scopes otherwise.

## Quality Gates

- Do not ignore warnings or errors from TypeScript, ESLint, build output, runtime logs, or test runs.
- If a warning or error cannot be fixed in the current task, record it explicitly in TODO.md and HARNESS_MAP.md with impact and next action.
- Do not silence checks with blanket disables. Any narrow suppression must include a reason in code and a matching task entry.
- Validate the touched slice with the narrowest executable command before widening scope.

## Living Artifacts

- Keep TODO.md, HARNESS_MAP.md, .github/copilot-instructions.md, and .github/skills/ alive at all times.
- Update these files whenever project structure, workflow, validation commands, or stage status changes.
- Treat these files as operational documents, not one-time setup output.

## Repository Shape

- Use app/ with the App Router.
- Keep shared logic in lib/ and reusable UI in components/.
- Keep route handlers under app/api/.
- Prefer Server Components by default and isolate client-only behavior into explicit Client Components.

## Detailed Guidance

- Apply TypeScript and Next.js guidance from .github/instructions/nextjs-stack.instructions.md.
- Apply workflow and validation guidance from .github/instructions/quality-gates.instructions.md.
- Use the stage bootstrap workflow from .github/skills/wbs-stage-one-bootstrap/SKILL.md when starting or repairing Stage 1.
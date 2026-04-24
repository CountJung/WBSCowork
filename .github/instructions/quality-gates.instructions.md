<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/instructions/instructions.instructions.md -->
---
description: 'Execution, validation, and living-document rules for this repository. Warnings and errors must never be ignored.'
applyTo: '**'
---

# Quality Gate Guidelines

Apply the repository-wide guidance from ../copilot-instructions.md to every task.

## Error Policy

- Do not ignore compiler warnings, lint warnings, runtime errors, failed checks, or failing tests.
- Do not mark work as complete while known warnings or errors remain undocumented.
- If a blocker cannot be resolved immediately, add it to TODO.md and docs/PROJECT_MAP.md with the exact command, output summary, impact, and owner action.

## Validation Policy

- Use the cheapest discriminating validation first.
- Prefer a focused lint, typecheck, test, or build command over manual inspection.
- Re-run the same focused validation after each fix until the touched slice is clean.
- Use broader validation only after the narrow validation succeeds.

## Sensitive Context Policy

- Never use `.env`, `.env.local`, `.env.*`, or other secret-bearing local environment files as AI working context, review input, or prompt material during normal repository tasks.
- Treat environment files as runtime-only local configuration unless the user explicitly requests secret-management work outside normal code changes.

## Living Documents

- Keep TODO.md current with stage status and unresolved issues.
- Keep docs/PROJECT_MAP.md current with runnable commands, expected outputs, blockers, and environment assumptions. (HARNESS_MAP.md now redirects to this file.)
- Keep skill references current when workflows or toolchains change.
- Update instruction files when the repository adopts new conventions or removes old ones.
- All sub-documents live under `/docs/`.

## Completion Rules

- A task is not complete unless the relevant validation command has been run or explicitly blocked.
- A task is not complete if warnings or errors were seen and not recorded.
- A stage transition is not complete unless TODO.md and docs/PROJECT_MAP.md reflect the new state.
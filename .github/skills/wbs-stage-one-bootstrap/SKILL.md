<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/github-copilot-starter/SKILL.md -->
<!-- Inspired by: https://github.com/github/awesome-copilot/blob/main/skills/suggest-awesome-github-copilot-instructions/SKILL.md -->
---
name: wbs-stage-one-bootstrap
description: 'Bootstrap or repair Stage 1 of this WBS project. Use when asked to initialize Next.js with TypeScript, add MUI and NextAuth foundations, update TODO.md and HARNESS_MAP.md, and finish with lint or build validation without ignoring warnings or errors.'
---

# WBS Stage 1 Bootstrap

Use this skill to execute the first stage from MasterPlan.md while keeping repository instructions, TODO.md, and HARNESS_MAP.md alive.

## When to Use This Skill

- User asks to start the project from the master plan.
- User asks to execute Stage 1.
- The repository needs initial Next.js, MUI, or NextAuth scaffolding.
- The repository workflow documents are missing or stale.

## Requirements

- Read MasterPlan.md before changing structure or dependencies.
- Keep TODO.md and HARNESS_MAP.md synchronized with real execution state.
- Do not ignore warnings or errors from setup, lint, build, or runtime checks.
- Prefer the smallest implementation that establishes a clean Stage 1 baseline.

## Step-by-Step Workflow

1. Confirm the current repository state and compare it with MasterPlan.md.
2. Ensure repository-wide instructions and path-specific instructions exist and reflect the current stack.
3. Bootstrap Next.js with TypeScript and App Router.
4. Add MUI theme wiring and a minimal authenticated application shell foundation.
5. Add NextAuth foundation with environment-variable-based configuration.
6. Update TODO.md and HARNESS_MAP.md with actual commands, assumptions, and blockers.
7. Run focused validation and record the result.

## Gotchas

- **Do not** treat setup output as success if lint, build, or dependency install still reports warnings or errors that matter to the touched slice.
- **Do not** leave placeholder validation commands in HARNESS_MAP.md after real commands are known.
- **Do not** add features beyond Stage 1. WBS CRUD, gantt, submissions, comments, and uploads belong to later stages.

## References

- See ./references/stage-one-checklist.md for the repository-specific Stage 1 checklist.
- See ../../instructions/nextjs-stack.instructions.md for stack rules.
- See ../../instructions/quality-gates.instructions.md for completion criteria.
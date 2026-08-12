---
name: wbs-project-digest-report
description: >-
  Repository workflow for WBSCowork project digest snapshots, manual previews,
  scheduled dry-runs, MariaDB run ledgers and idempotency, DOCX/PPTX report
  export, artifact download/retention, and approved delivery adapters. Use when
  adding, changing, or reviewing any of those report/digest concerns; do not use
  for unrelated WBS CRUD or general document authoring.
---

# WBS Project Digest & Report

## Trigger and scope

Use this skill when a WBSCowork task mentions one or more of: project digest/report snapshot, report preview/history, scheduler/cron trigger, machine token, run/artifact/delivery ledger, idempotency, DOCX/PPTX runtime export, report download/storage/retention, or report email/webhook delivery.

Do not trigger it for unrelated task/project CRUD, generic FSD moves, or one-off authoring of a document outside the application. For those, use the relevant repository guidance or document skill directly.

## Read first

1. `AGENTS.md`
2. `docs/PROJECT_DIGEST_REPORT_PLAN.md`
3. `docs/FSD_MIGRATION_PLAN.md`
4. `.github/instructions/quality-gates.instructions.md`
5. Format references: `.github/skills/document-skills/docx/SKILL.md` and `.github/skills/document-skills/pptx/SKILL.md`
6. Actual schema/auth/visibility sources: `src/shared/server/database-admin`, `src/entities/user`, `src/entities/submission`, and attachment repository APIs

Paths above are repository-root relative. If docs and code disagree, update the plan from actual schema/code evidence. Never read `.env*` as review context.

## Non-negotiable contracts

- The feature is backlog until its routes/schema/tests exist; never report a D-stage complete from plans alone.
- Follow implementation order `shared → entities → features → widgets → root app page/route`. Keep root `app/` as thin App Router adapters.
- Separate existing-code structure moves from behavior, SQL, permission, and UI changes.
- Start scheduled operation with `dryRun=true`, `public_only`, and `deliveryMode=none`.
- Do not invent completion/progress/change metrics absent from the schema. A past `end_date` means “기한 경과”, not incomplete or confirmed delayed.
- Apply audience-derived `SubmissionVisibilityFilter`; attachment/comment queries must be joined through visible submissions.
- Renderers accept one versioned snapshot and never query DB directly.
- Token unset is fail closed. Use safe constant-time comparison and a MariaDB unique idempotency claim.
- Runtime DB credentials must not receive DDL/global grants; migration/bootstrap credentials are separate.
- Store instants as UTC and compare task DATE values in the schedule's validated IANA timezone.
- Never log token, recipient address, private body, absolute artifact path, or raw exception data in API responses.
- D0–D4 provide no email/webhook delivery. D5 needs explicit recipient/consent and security approval.

## Workflow

### 1. Classify one stage

- D0 snapshot contract/fixture
- D1 manual JSON preview
- D2 DOCX/PPTX artifact export/download
- D3 scheduled dry-run/schema/idempotency
- D4 download-only operation/retention
- D5 approved delivery

Do not claim or automatically activate later stages. A vertical feature slice may add new FSD files, but do not combine it with unrelated migration of legacy files.

### 2. Confirm prerequisites

- Inspect `git status --short` and preserve unrelated user changes.
- Verify actual package scripts/dependencies, schema columns/indexes, auth helpers, visibility defaults, and deployment write/scheduler assumptions.
- Record missing schema/runner/test infrastructure rather than promising a nonexistent command.
- For D3, define least-privilege runtime versus migration GRANTs and test runtime DDL denial.

### 3. Build snapshot first

- Include `schemaVersion`, project/range/snapshot UTC instants, validated IANA timezone, audience mode, source counts, truncation/error metadata.
- Use `[periodStart, periodEnd)`, a single `snapshotAt`, row/range caps, and deterministic date→id ordering.
- Keep DATE calendar semantics separate from DATETIME/UTC assumptions.
- Use de-identified fixtures so privacy/render tests do not require DB.

### 4. Claim run idempotently

- Canonicalize schedule id, UTC occurrence, project, schema, sorted formats, audience, and dry-run before SHA-256.
- Insert the unique run claim in a short transaction; do not hold a transaction during render/file I/O.
- Use compare-and-set status transitions and a tested heartbeat/lease for stale recovery.
- Duplicate requests return the existing run/artifacts without rerendering or redelivery.

### 5. Render/store/download

- Reuse DOCX skill guidance for semantic OOXML and `docx` Buffer generation.
- Reuse PPTX skill palette/layout/readability guidance, but do not put its HTML/Playwright authoring pipeline in server runtime; use direct `pptxgenjs` Buffer generation.
- Move `docx` and `pptxgenjs` from devDependencies to dependencies only when runtime renderers are implemented.
- Write temp files inside `REPORT_DIR`, atomically rename, then verify and persist size/SHA-256.
- Reject traversal and symlink escape. Reauthorize artifact audience on every download.
- Return exact OOXML MIME, safe attachment filename, content length, private/no-store cache policy, and nosniff.

### 6. Add delivery last

Without project membership/recipient consent, stop at download-only. An approved adapter still needs a separate delivery attempt ledger/dedupe. Webhooks require HTTPS allowlist, DNS/IP checks for private/link-local targets, redirect revalidation, timeout/body limits, and tests.

## Verification gate

Run only scripts that exist in `package.json`; the current repository-wide commands are:

```bash
npm run lint
npm run build
npm run db:check -- --validate-only
```

`db:check -- --validate-only` validates environment parsing and may be blocked when runtime env is unavailable; report that as blocked rather than passed. Add named focused package scripts in the implementing stage before documenting them as runnable.

Required focused evidence by scope:

- D0: schema fixture, period/timezone/DST boundaries, private submission/comment/attachment exclusion
- D1: role×audience matrix, bounded SQL and representative `EXPLAIN`
- D2: OOXML ZIP CRC and required XML parts, hash/size, path/symlink escape, headers, DOCX/PPTX text parity; optional visual smoke only when LibreOffice/render tooling exists
- D3: fresh/existing migration, runtime DDL denial, bad/unset token, canonical hash vector, parallel duplicate run count=1, lease recovery/max attempts, redaction
- D4: retention dry-run/execute, expiry policy, cross-user denial, real NAS directory permission/free-space/atomic rename
- D5: recipient visibility/consent/audit, channel dedupe/retry, webhook SSRF/redirect/DNS rebinding tests

## Completion checklist

- [ ] Only the requested D-stage is implemented and later capabilities remain disabled/incomplete.
- [ ] FSD order and import boundary gate are respected; legacy relocation is a separate change.
- [ ] Output contains only facts available from the current schema.
- [ ] Query and download both enforce visibility.
- [ ] Timezone, DB grants, idempotency/state recovery, and output/delivery contracts have executable evidence for the touched stage.
- [ ] Runtime OOXML packages are production dependencies when renderers exist, and artifacts pass structural/parity checks.
- [ ] Actual lint/build/focused results and any blockers are reported without overstating completion.

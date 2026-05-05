# Repository Tooling

The AI Contributor Specification is maintained as documents plus executable
checks. The documents define the policy; the scripts keep cross-references,
generated tables, audit templates, and the shipped audit skill runtime aligned.
This page explains the tooling layout and which commands maintainers should use.

## Architecture

| Area | Role | Audience |
| --- | --- | --- |
| Root Markdown files | Specification, guide, audit templates, audit model, and contributor docs. | Readers, adopters, maintainers. |
| `skills/ai-contributor-audit/scripts/` | Canonical audit runtime shipped with the audit skill. | Installed-skill users, prompt-fetched runbooks, repo self-audits. |
| `tools/` | Repository-local check and test harness. | Maintainers and CI for this repository. |
| `tools/test-fixtures/` | Static audit artifact fixtures used by validator tests and reused by stamper smoke tests. | Test code only. |
| `.github/workflows/` | CI entry points that install `tools/` and run the checks. | GitHub Actions. |

The important separation is:

```text
skills/ai-contributor-audit/scripts/ = runtime shipped to audit users
tools/                                = local checks for maintaining this repo
```

The `tools` npm audit commands intentionally delegate to the skill runtime. This
keeps the installed skill and this repository's self-audit path on the same
implementation.

## Checked Invariants

The scripts enforce invariants that are easy to miss in prose review:

- every normative requirement has a stable `AIC-*` ID,
- checklist rows cite real specification IDs with matching scope,
- generated coverage tables are current,
- Markdown links, anchors, clause references, and pillar tables stay valid,
- audit templates remain structurally valid,
- the audit collector produces stable derived statuses on a known synthetic
  repository,
- the skill bootstrap manifest ships every file needed by an installed skill.

These checks make document relationships reviewable and repeatable.

## Local Commands

Use Node.js 24.x; `tools/package.json` enforces `>=24.0.0 <25` so local runs
match CI and the shipped audit-runtime tests. Install the tooling package once:

```sh
npm ci --prefix tools
```

Run the locally reproducible PR gate:

```sh
npm --prefix tools run check:ci-local
```

This is the command wired into the repository `pre-push` hook. It runs the
aggregate repository check, the strict audit-runtime coverage gate, and the
TypeScript pnpm scaffold verification before code leaves the workstation.
GitHub-hosted checks such as CodeQL, dependency review, and immutable
release-tag creation still run in CI because they depend on GitHub services.

Run only the aggregate repository check:

```sh
npm --prefix tools run check
```

Common focused commands:

| Command | Purpose |
| --- | --- |
| `npm --prefix tools run check:ci-local` | Run the locally reproducible PR gates: aggregate repository check, audit-runtime coverage gate, and TypeScript pnpm scaffold verification. |
| `npm --prefix tools run typecheck` | Typecheck `tools/` plus the skill audit runtime. |
| `npm --prefix tools run check:template-scaffold` | Verify the TypeScript pnpm reference scaffold with install, typecheck, lint, format check, tests, and build. |
| `npm --prefix tools run check:markdown` | Lint tracked Markdown files. |
| `npm --prefix tools run check:links` | Check internal Markdown links and anchors. |
| `npm --prefix tools run check:clauses` | Check that `§N` references resolve to real spec clauses. |
| `npm --prefix tools run check:hints` | Check example hint headings against their clause index. |
| `npm --prefix tools run check:checklist-pillars` | Check checklist rows sit under the pillar that owns their visible IDs. |
| `npm --prefix tools run check:normative-ids` | Verify every normative bullet has a valid visible `AIC-*` ID. |
| `npm --prefix tools run check:row-scope-vs-spec` | Check checklist row scopes against the referenced spec IDs. |
| `npm --prefix tools run check:collector-row-coverage` | Check collector mappings do not stamp partial multi-ID rows. |
| `npm --prefix tools run check:audit-evidence` | Cross-check audit-log evidence IDs against fulfilled checklist rows. |
| `npm --prefix tools run check:pillar-structure` | Check pillar tables, body sections, and README headline counts. |
| `npm --prefix tools run check:evergreen` | Check docs for transient or historical wording. |
| `npm --prefix tools run check:stamped-blocks` | Validate stamped-block checksum sentinels. |
| `npm --prefix tools run check:doc-version` | Verify version strings agree across spec, README, GUIDE, and CHANGELOG. |
| `npm --prefix tools run check:coverage` | Verify generated coverage blocks are current. |
| `npm --prefix tools run check:rule-catalog` | Validate and canonicalize the checked-in AI Contributor rule catalog. |
| `npm --prefix tools run check:rule-catalog-projections` | Verify specification and checklist markdown projections match the canonical rule catalog. |
| `npm --prefix tools run check:audit-profile-template` | Verify the audit-profile template applicability table is in sync with `PROFILE_QUESTIONS`. |
| `npm --prefix tools run check:conformance-levels` | Check accepted `conformance_level` values across docs and code. |
| `npm --prefix tools run check:audit-validate` | Validate the repository's blank audit templates in template mode. |
| `npm --prefix tools run check:test-shards-in-check` | Verify every declared `test:*` shard is reachable from the `check` script. |
| `npm --prefix tools run check:runbook-paths` | Verify `<path-to-pinned-runbook>/...` references in runbook docs resolve to bootstrap manifest entries. |
| `npm --prefix tools run check:audit-flow-diagram` | Verify the README "How The Audit Runs" section covers the full collect/stamp/auditor/stamp/validate lifecycle. |
| `npm --prefix tools run check:tooling-command-coverage` | Verify every `check:*`, `audit:*`, and aggregate `audit` script in `tools/package.json` is documented in this command table. |
| `npm --prefix tools run check:audit-frontmatter-docs` | Verify shipped audit frontmatter fields stay aligned across templates and canonical ownership docs. |
| `npm --prefix tools run check:golden-audit` | Run the collector against the synthetic golden-audit repo. |
| `npm --prefix tools run generate:coverage` | Rewrite generated coverage blocks. |
| `npm --prefix tools run generate:rule-catalog` | Rewrite the AI Contributor rule catalog in canonical JSON order. |
| `npm --prefix tools run generate:audit-profile-template` | Rewrite the audit-profile template applicability table from `PROFILE_QUESTIONS`. |
| `npm --prefix tools run audit` | Self-audit this repository through the skill runtime. |
| `npm --prefix tools run audit:collect` | Collect self-audit evidence into `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`. |
| `npm --prefix tools run audit:stamp` | Stamp derivable self-audit fields into the checklist, audit log, and root summary. |
| `npm --prefix tools run audit:validate` | Validate the filled self-audit checklist and audit log. |
| `npm --prefix tools run audit:summary` | Print a read-only summary of the current evidence JSON. |

The individual `test:*` commands in `tools/package.json` exercise parser,
collector, stamper, validator, bootstrap, and helper behavior. They are mostly
for maintainers iterating on a specific tool.

## Runtime Boundary

Prompt-based audits materialize the pinned runbook with `bootstrap.ts`. The
bootstrap/start command may use `npx --yes tsx@4.21.0` to acquire the TypeScript
executor. Once `audit-run.ts` is running, collect/stamp/validate child phases
invoke `tsx` from `PATH`; they do not invoke `npm` or `npx` for each phase.

Network use is intentionally explicit:

- `bootstrap.ts` fetches the pinned runbook files, and may perform a non-fatal
  GitHub staleness advisory unless `--skip-stale-check` or
  `AIC_BOOTSTRAP_SKIP_STALE_CHECK=1` is set.
- `audit-collect.ts` may query GitHub hosted settings through `gh` when network
  collection is enabled.
- `audit-run.ts --no-network` forwards the no-network boundary to the collector
  and skips the GitHub read-access preflight.

## Directory Responsibilities

### `skills/ai-contributor-audit/scripts/`

This is the canonical audit runtime. The high-level workflow is shown in the
[README audit flow diagram](README.md#how-the-audit-runs).

- `audit-run.ts` orchestrates collect, stamp, optional edit pause, stamp again,
  and validate.
- `audit-collect.ts` records machine-readable evidence from a target repo.
- `audit-stamp.ts` writes derivable audit fields into checklist, audit log, and
  root summary.
- `audit-validate.ts` checks audit artifact structure and cross-file
  consistency.
- `bootstrap.ts` fetches the pinned runbook file set for prompt-based audits.
- `internal/` contains implementation modules used by those entry points.

Only the top-level scripts are intended as entry points. Files under
`internal/` are shipped because the entry points import them, not because they
are public APIs.

### `tools/doc-checks/`

Repository document checks: Markdown links, clause references, evergreen wording,
hints consistency, pillar structure, and stamped-block checks.

### `tools/spec-authoring/`

Checks and generators that understand the specification/checklist model:
normative IDs, checklist pillar ownership, row scope consistency, audit evidence
cross-checking, conformance-level consistency, and coverage generation.

### `tools/tests/`

Executable tests for the audit runtime and repository tooling. These tests import
the skill runtime directly because the skill runtime is canonical.

### `tools/test-fixtures/`

Static test artifacts consumed by tests, especially validator fixtures under
`tools/test-fixtures/audit-validate/`. Each directory represents one expected
validator scenario, such as `valid`, `missing-comment`, or `bad-duration`.

## Adding Or Changing Tooling

- Prefer adding document consistency checks under `tools/doc-checks/`.
- Prefer adding spec/checklist model checks under `tools/spec-authoring/`.
- Put shipped audit behavior in `skills/ai-contributor-audit/scripts/`, not in
  `tools/`.
- Put helper modules for the shipped audit runtime under
  `skills/ai-contributor-audit/scripts/internal/`.
- Add or update tests under `tools/tests/` when a script parses structured
  Markdown, stamps audit artifacts, validates audit output, or changes collector
  behavior.
- Add static test inputs under `tools/test-fixtures/`, not beside production
  scripts.

Before committing script or generated-output changes, run:

```sh
npm --prefix tools run check:ci-local
```

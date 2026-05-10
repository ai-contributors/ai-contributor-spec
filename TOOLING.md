# Repository Tooling

The repository is documents plus executable checks. The documents define
policy; the scripts keep cross-references, generated projections, audit
templates, and the shipped audit-skill runtime aligned. This page
explains the layout and the commands maintainers use day-to-day.

## Architecture

| Area                                   | Role                                                                                                                                       | Audience                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Root Markdown files                    | Specification, guide, audit templates, audit model, contributor docs.                                                                      | Readers, adopters, maintainers.                                   |
| `skills/ai-contributor-audit/scripts/` | Canonical audit runtime shipped with the audit skill.                                                                                      | Installed-skill users, prompt-fetched runbooks, repo self-audits. |
| `tools/`                               | Repository-local check and test harness.                                                                                                   | Maintainers and CI for this repository.                           |
| `tools/test-fixtures/`                 | Static audit-artifact fixtures used by validator and stamper smoke tests.                                                                  | Test code only.                                                   |
| `.github/workflows/`                   | CI entry points that install `tools/` and run the checks.                                                                                  | GitHub Actions.                                                   |

The important separation is:

```text
skills/ai-contributor-audit/scripts/ = runtime shipped to audit users
tools/                                = local checks for maintaining this repo
```

The `tools` npm `audit*` commands intentionally delegate to the skill
runtime. This keeps the installed skill and this repository's self-audit
path on the same implementation.

## Checked invariants

The scripts enforce invariants that prose review will miss:

- every normative requirement has a stable `AIC-*` ID,
- publication Markdown does not start with website frontmatter,
- checklist rows cite real specification IDs with matching scope,
- generated checklist, coverage-map, and specification projections —
  including the full `## Specification clauses` body, generated scope
  lists, generated clause counts, and the conformance-workflow table —
  are current,
- generated root audit summary and audit-log templates are current with
  their source templates plus catalog-owned version + conformance-level
  metadata,
- visible checklist row IDs match the catalog and specification,
- Markdown links, anchors, clause references, and pillar tables stay
  valid,
- audit templates remain structurally valid,
- the audit collector produces stable derived statuses on a known
  synthetic repository,
- the skill bootstrap manifest ships every file needed by an installed
  skill.

These checks make document relationships reviewable and repeatable.

## Local commands

Use Node.js 24.x; `tools/package.json` enforces `>=24.0.0 <25` so local
runs match CI and the shipped audit-runtime tests. Install once:

```sh
npm ci --prefix tools
```

The locally reproducible PR gate — wired into the `pre-push` hook:

```sh
npm --prefix tools run check:ci-local
```

This runs the aggregate repository check, the strict audit-runtime
coverage gate, and the TypeScript pnpm scaffold verification before code
leaves the workstation. GitHub-hosted checks (CodeQL, dependency review,
immutable release-tag creation) still run in CI because they depend on
GitHub services.

### Headline commands

The three commands most maintainers run day-to-day:

| Command                                  | Purpose                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm --prefix tools run check:ci-local`  | Locally reproducible PR gate (above).                                                |
| `npm --prefix tools run check`           | Aggregate repository check.                                                          |
| `npm --prefix tools run audit`           | Self-audit this repository through the skill runtime.                                |

### Self-audit

| Command                                   | Purpose                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm --prefix tools run audit:collect`    | Collect self-audit evidence into `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`. |
| `npm --prefix tools run audit:stamp`      | Stamp derivable self-audit fields into checklist, audit log, and root summary.       |
| `npm --prefix tools run audit:validate`   | Validate the filled self-audit checklist and audit log.                              |
| `npm --prefix tools run audit:summary`    | Print a read-only summary of the current evidence JSON.                              |

### Quality and type checks

| Command                                            | Purpose                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm --prefix tools run check:quality`             | Run TypeScript, ESLint, and Prettier checks.                                           |
| `npm --prefix tools run typecheck`                 | Typecheck `tools/` plus the skill audit runtime.                                       |
| `npm --prefix tools run check:markdown`            | Lint tracked Markdown files.                                                           |
| `npm --prefix tools run check:template-scaffold`   | Verify the TypeScript pnpm reference scaffold (install, typecheck, lint, format, tests, build). |

### Documentation guardrails

| Command                                              | Purpose                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm --prefix tools run check:docs`                  | Run the full documentation guardrail group.                                                              |
| `npm --prefix tools run check:docs-core`             | Links, clause refs, hints, pillar structure, evergreen wording, stamped blocks.                          |
| `npm --prefix tools run check:docs-release`          | Version alignment, runbook paths, audit-flow docs, command coverage.                                     |
| `npm --prefix tools run check:docs-audit`            | Audit-frontmatter documentation alignment.                                                               |
| `npm --prefix tools run check:links`                 | Internal Markdown links and anchors.                                                                     |
| `npm --prefix tools run check:clauses`               | `§N` references resolve to real spec clauses.                                                            |
| `npm --prefix tools run check:hints`                 | Example hint headings against their clause index.                                                        |
| `npm --prefix tools run check:evergreen`             | Docs free of transient or historical wording.                                                            |
| `npm --prefix tools run check:stamped-blocks`        | Validate stamped-block checksum sentinels.                                                               |
| `npm --prefix tools run check:doc-frontmatter`       | Reject publication Markdown files that start with frontmatter; audit templates, validator fixtures, and skill manifests are excluded. |
| `npm --prefix tools run check:doc-version`           | Version strings agree across spec, README, GUIDE, CHANGELOG.                                             |
| `npm --prefix tools run check:pillar-structure`      | Pillar tables, body sections, README headline counts.                                                    |
| `npm --prefix tools run check:runbook-paths`         | `<path-to-pinned-runbook>/...` references resolve to bootstrap manifest entries.                         |
| `npm --prefix tools run check:audit-flow-diagram`    | README "How The Audit Runs" covers the full lifecycle.                                                   |
| `npm --prefix tools run check:tooling-command-coverage` | Every `check:*`, `audit:*`, aggregate `audit` script is documented in this command table.             |
| `npm --prefix tools run check:audit-frontmatter-docs` | Shipped audit frontmatter fields aligned across templates and ownership docs.                           |

### Catalog and checklist invariants

| Command                                              | Purpose                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm --prefix tools run check:catalog-assets`        | Catalog, generated projections, checklist, coverage, conformance-level checks.                   |
| `npm --prefix tools run check:rule-catalog`          | Validate and canonicalize the checked-in AI Contributor rule catalog.                            |
| `npm --prefix tools run check:specification`         | `AI-CONTRIBUTOR-SPECIFICATION.md` matches its template and rule catalog.                         |
| `npm --prefix tools run check:coverage`              | `AI-CONTRIBUTOR-COVERAGE.md` matches the coverage template and rule catalog.                     |
| `npm --prefix tools run check:checklist-assets`      | `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` matches the checklist template and catalog.  |
| `npm --prefix tools run check:audit-templates`       | `AI-CONTRIBUTOR-AUDIT.md` and `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md` are current.   |
| `npm --prefix tools run check:audit-profile-template` | Audit-profile template applicability table is in sync with `PROFILE_QUESTIONS`.                  |
| `npm --prefix tools run check:checklist-pillars`     | Rendered checklist rows vs. visible spec IDs, pillar headings, catalog row bindings.             |
| `npm --prefix tools run check:normative-ids`         | Rendered specification bullets and checklist rows have visible `AIC-*` coverage.                 |
| `npm --prefix tools run check:row-scope-vs-spec`     | Checklist row scopes match the referenced spec IDs.                                              |
| `npm --prefix tools run check:collector-row-coverage` | Collector mappings do not stamp partial multi-ID rows.                                           |
| `npm --prefix tools run check:audit-evidence`        | Audit-log evidence IDs cross-checked against fulfilled checklist rows.                           |
| `npm --prefix tools run check:conformance-levels`    | Accepted `conformance_level` values across docs and code.                                        |

### Generators (write to disk)

| Command                                              | Purpose                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm --prefix tools run generate:rule-catalog`       | Rewrite the AI Contributor rule catalog in canonical JSON order.                                 |
| `npm --prefix tools run generate:specification`      | Rewrite `AI-CONTRIBUTOR-SPECIFICATION.md` from template + catalog.                               |
| `npm --prefix tools run generate:coverage`           | Rewrite `AI-CONTRIBUTOR-COVERAGE.md` from template + catalog.                                    |
| `npm --prefix tools run generate:checklist-assets`   | Rewrite the checklist from template + catalog.                                                   |
| `npm --prefix tools run generate:audit-templates`    | Rewrite the root summary + audit-log templates.                                                  |
| `npm --prefix tools run generate:audit-profile-template` | Rewrite the audit-profile template applicability table.                                      |

Generators write to disk; the matching `check:*` commands fail if the
generated file is stale. **Workflow:** edit the catalog → run the
generator → run `npm --prefix tools run check:ci-local`.

### Audit fixtures and tests

| Command                                              | Purpose                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm --prefix tools run check:audit-runtime`         | Repository audit-template validation.                                                            |
| `npm --prefix tools run check:audit-validate`        | Validate the repository's blank audit templates in template mode.                                |
| `npm --prefix tools run check:golden-audit`          | Run the collector against the synthetic golden-audit repo.                                       |
| `npm --prefix tools run check:test-suite`            | Test-shard reachability check + aggregate test suite.                                            |
| `npm --prefix tools run check:test-shards-in-check`  | Every declared `test:*` shard is reachable from the `check` script.                              |

The individual `test:*` commands in `tools/package.json` exercise parser,
collector, stamper, validator, bootstrap, and helper behavior. They are
mostly for maintainers iterating on a specific tool.

## Runtime boundary

Prompt-based audits materialize the pinned runbook with `bootstrap.ts`.
The bootstrap/start command may use `npx --yes tsx@4.21.0` to acquire
the TypeScript executor. Once `audit-run.ts` is running, collect / stamp
/ validate child phases invoke `tsx` from `PATH`; they do not invoke
`npm` or `npx` for each phase.

Network use is intentionally explicit:

- **`bootstrap.ts` — pinned-runbook fetch.** Fetches the pinned runbook
  files. May perform a non-fatal GitHub staleness advisory unless
  `--skip-stale-check` or `AIC_BOOTSTRAP_SKIP_STALE_CHECK=1` is set.
- **`audit-collect.ts` — hosted-settings query.** May query GitHub
  hosted settings through `gh` when network collection is enabled.
  `audit-run.ts --no-network` forwards the no-network boundary to the
  collector and skips the GitHub read-access preflight.

## Directory responsibilities

### `skills/ai-contributor-audit/scripts/`

The canonical audit runtime. The high-level workflow is shown in the
[README audit flow diagram](README.md#how-the-audit-runs).

- `audit-run.ts` orchestrates collect, stamp, optional edit pause, stamp
  again, validate.
- `audit-collect.ts` records machine-readable evidence from a target
  repo.
- `audit-stamp.ts` writes derivable audit fields into checklist, audit
  log, root summary.
- `audit-validate.ts` checks artifact structure and cross-file
  consistency.
- `bootstrap.ts` fetches the pinned runbook file set for prompt-based
  audits.
- `internal/` — implementation modules the entry points import. Shipped
  because needed, not because they are a public API.

Only the top-level scripts are intended as entry points. Files under
`internal/` are shipped because the entry points import them, not
because they are public APIs.

### `tools/doc-checks/`

Repository document checks: Markdown links, clause references, evergreen
wording, hints consistency, pillar structure, stamped blocks.

### `tools/spec-authoring/`

Checks and generators that understand the specification/checklist model:
normative IDs, checklist pillar ownership, row-scope consistency,
audit-evidence cross-checking, conformance-level consistency,
specification + coverage template generation, checklist generation,
audit summary/log generation.

Template renderers use `{{generated:...}}` directives for catalog-owned
content resolved before Markdown is shipped. Those directives are an
authoring mechanism — they belong in `tools/spec-authoring/templates/`;
checks fail if generated projections still contain them. Examples are
generated specification clauses, coverage tables, checklist
conformance-level rows, checklist rule tables, root audit summary level
rows, and audit-log frontmatter values.

Shipped audit artifacts also contain paired HTML-comment markers like
`<!-- BEGIN:TEMPLATE-ONLY -->` and `<!-- BEGIN:STAMPED-VERIFICATION-GAPS -->`.
Those are *runtime* anchors — not catalog-generation placeholders — and
must remain in rendered files because `audit-run.ts`, `audit-stamp.ts`,
and `audit-validate.ts` need stable sections after an adopter copies the
template. Only add a new shipped marker when a parser, stamper,
validator, or auditor workflow consumes it; add tests in the same
change. Do not store generation metadata in shipped markers;
catalog-derived generation belongs in `AI-CONTRIBUTOR-RULE-CATALOG.json`
and `{{generated:...}}` template directives.

### `tools/tests/`

Executable tests for the audit runtime and repository tooling. Tests
import the skill runtime directly because the skill runtime is
canonical.

### `tools/test-fixtures/`

Static test inputs consumed by tests, especially validator fixtures
under `tools/test-fixtures/audit-validate/`. Each directory represents
one expected validator scenario — `valid`, `missing-comment`,
`bad-duration`, etc.

## Adding or changing tooling

- Prefer adding document-consistency checks under `tools/doc-checks/`.
- Prefer adding spec/checklist model checks under
  `tools/spec-authoring/`.
- Put shipped audit behavior in `skills/ai-contributor-audit/scripts/`,
  not `tools/`.
- Put helper modules for the shipped runtime under
  `skills/ai-contributor-audit/scripts/internal/`.
- Add or update tests under `tools/tests/` when a script parses
  structured Markdown, stamps audit artifacts, validates audit output,
  or changes collector behavior.
- Add static test inputs under `tools/test-fixtures/`, not beside
  production scripts.

Before committing script or generated-output changes:

```sh
npm --prefix tools run check:ci-local
```

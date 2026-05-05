# Checklist Template From Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` from a Markdown template plus `AI-CONTRIBUTOR-RULE-CATALOG.json`.

**Architecture:** Add a checklist Markdown template under `tools/spec-authoring/templates/`. Rework `generate-checklist-assets.ts` so the template owns checklist frame prose and placement, while the catalog supplies the generated conformance-level metadata and rule-table directives.

**Tech Stack:** Node 24, TypeScript, `tsx`, existing rule catalog model, no new dependencies.

---

## File Structure

- Create: `tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template`
  - Owns checklist prose, frontmatter placeholders, `TEMPLATE-ONLY` blocks, verification-gap stamped markers, and a single generated rule-table directive.
- Modify: `tools/spec-authoring/generate-checklist-assets.ts`
  - Loads the template, renders the full checklist output, renders catalog-backed conformance-level directives, and checks generated output against the shipped checklist file.
- Modify: `tools/tests/test-rule-catalog.ts`
  - Adds failing tests for template rendering and directive validation.
- Modify: `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
  - Regenerated output from the new template.
- Modify: `AGENTS.md`, `TOOLING.md`, `AI-CONTRIBUTOR-AUDIT-MODEL.md`
  - Document that the checklist is now a generated projection from template plus catalog.
- Modify: this design/plan pair as task status changes.

## Task 1: Template Renderer Tests

**Files:**

- Modify: `tools/tests/test-rule-catalog.ts`
- Modify: `tools/spec-authoring/generate-checklist-assets.ts`

- [x] **Step 1: Add failing renderer tests**

Add tests that call `renderChecklistAssets(catalog, templateContent)` with a
small template containing:

```md
# Checklist

Template prose stays.

{{generated:checklist-rule-tables}}

## Tail
```

Assert the result preserves `Template prose stays.`, includes `## Checklist row
tables`, includes the `Clean Setup` row, and contains no `{{generated:` text.
Add a second assertion that an unknown directive such as
`{{generated:checklist-unknown}}` reports `unknown checklist template directive`.

- [x] **Step 2: Run red test**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Observed: the new checklist template assertions failed because the current
renderer expected an existing checklist region instead of a template directive.

## Task 2: Full Template Renderer

**Files:**

- Modify: `tools/spec-authoring/generate-checklist-assets.ts`
- Create: `tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template`
- Modify: `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`

- [x] **Step 1: Implement directive rendering**

Update `renderChecklistAssets(catalog, templateContent)` so it validates the
catalog, replaces exactly one `{{generated:checklist-rule-tables}}`, rejects
unknown/missing/duplicate/unresolved directives, and returns a trailing-newline
terminated full checklist document.

- [x] **Step 2: Load template in CLI**

Change the CLI to read
`tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template`, compare
the rendered full document to `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
in `--check`, and write the full rendered document in generation mode.

- [x] **Step 3: Create template and regenerate**

Derive the template from the current checklist, replacing the current rule-table
section with `{{generated:checklist-rule-tables}}`, then run:

```sh
npm --prefix tools run generate:checklist-assets
```

Expected: the shipped checklist is regenerated from the template and catalog.

- [x] **Step 4: Run focused checks**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:checklist-assets
npm --prefix tools run check:rule-catalog-projections
```

Expected: all pass.

## Task 3: Documentation

**Files:**

- Modify: `AGENTS.md`
- Modify: `TOOLING.md`
- Modify: `AI-CONTRIBUTOR-AUDIT-MODEL.md`
- Modify: `docs/superpowers/specs/2026-05-05-checklist-template-from-catalog-design.md`
- Modify: `docs/superpowers/plans/2026-05-05-checklist-template-from-catalog.md`

- [x] **Step 1: Update workflow docs**

Replace wording that says only checklist rule tables are generated. Document
that the shipped checklist file is a generated projection from the checklist
template plus catalog, while audit-run fields remain stamper/auditor-owned when
an adopter fills the template.

- [x] **Step 2: Run docs checks**

Run:

```sh
npm --prefix tools run check:markdown
npm --prefix tools run check:links
npm --prefix tools run check:tooling-command-coverage
```

Expected: all pass.

## Task 4: Verification And Commit

**Files:**

- Verify all modified files.

- [x] **Step 1: Run full local gate**

Run:

```sh
npm --prefix tools run check:ci-local
```

Expected: full local gate passes.

- [x] **Step 2: Commit locally**

Run:

```sh
git status --short --branch
git add docs/superpowers/specs/2026-05-05-checklist-template-from-catalog-design.md docs/superpowers/plans/2026-05-05-checklist-template-from-catalog.md tools/spec-authoring/generate-checklist-assets.ts tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md tools/tests/test-rule-catalog.ts AGENTS.md TOOLING.md AI-CONTRIBUTOR-AUDIT-MODEL.md
git commit -m "refactor: generate checklist from template"
```

Expected: one local commit on `issue-4-checklist-template-from-catalog`; no push.

- [x] **Step 3: Verify after commit**

Run:

```sh
npm --prefix tools run check:ci-local
git status --short --branch
```

Expected: full local gate passes and the worktree is clean.

## Task 5: Catalog-Backed Checklist Level Metadata

**Files:**

- Modify: `tools/tests/test-rule-catalog.ts`
- Modify: `tools/spec-authoring/generate-checklist-assets.ts`
- Modify: `tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template`
- Modify: `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- Modify: `AI-CONTRIBUTOR-AUDIT.md`
- Modify: `docs/superpowers/specs/2026-05-05-checklist-template-from-catalog-design.md`
- Modify: `docs/superpowers/plans/2026-05-05-checklist-template-from-catalog.md`

- [x] **Step 1: Add failing level-metadata renderer tests**

Add test fixture catalog level labels/descriptions and a checklist template with:

```md
conformance_level: # one of: none, {{generated:conformance-level-values}}.
{{generated:conformance-level-summary-rows}}
{{generated:conformance-level-bullets}}
{{generated:checklist-rule-tables}}
```

Assert the rendered output uses catalog level labels/descriptions in the summary
table, quick-reference bullets, and generated rule-table headings.

- [x] **Step 2: Run red test**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Observed: the new checklist level-metadata assertions failed because the current
renderer does not support the conformance-level directives and still hard-codes
rule-table level headings.

- [x] **Step 3: Implement catalog-backed level rendering**

Update `generate-checklist-assets.ts` so it renders:

```md
{{generated:conformance-level-values}}
{{generated:conformance-level-summary-rows}}
{{generated:conformance-level-bullets}}
```

from `catalog.levels`, and uses catalog level labels for generated rule-table
headings. Keep status semantics, evidence rules, backlog policy, and lifecycle
instructions in the checklist template.

- [x] **Step 4: Update the checklist template**

Replace the hard-coded conformance-level values, summary rows, and
quick-reference bullets in
`tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template` with the
new directives. Regenerate:

```sh
npm --prefix tools run generate:checklist-assets
```

- [x] **Step 5: Run focused verification**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:checklist-assets
npm --prefix tools run check:rule-catalog-projections
```

Expected: all pass.

- [x] **Step 6: Amend the existing local commit**

Run the full local gate, stage the changes, amend `cd5e4c5`, and rerun the full
local gate:

```sh
npm --prefix tools run check:ci-local
git add docs/superpowers/specs/2026-05-05-checklist-template-from-catalog-design.md docs/superpowers/plans/2026-05-05-checklist-template-from-catalog.md tools/spec-authoring/generate-checklist-assets.ts tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md AI-CONTRIBUTOR-AUDIT.md tools/tests/test-rule-catalog.ts AGENTS.md AI-CONTRIBUTOR-AUDIT-MODEL.md
git commit --amend --no-edit
npm --prefix tools run check:ci-local
```

Expected: one amended local commit on `issue-4-checklist-template-from-catalog`;
no push.

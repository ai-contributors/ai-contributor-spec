# Specification Template From Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `AI-CONTRIBUTOR-SPECIFICATION.md` from a Markdown template
and `AI-CONTRIBUTOR-RULE-CATALOG.json`.

**Architecture:** Add a full specification renderer with a small Markdown
directive vocabulary. The catalog supplies structured facts; the template keeps
long-form prose and placement.

**Tech Stack:** TypeScript, `tsx`, existing catalog validation helpers,
Markdown templates.

---

## Task 1: Renderer Tests

**Files:**

- Modify: `tools/tests/test-rule-catalog.ts`
- Create: `tools/spec-authoring/generate-specification.ts`

- [x] **Step 1: Write failing renderer tests**

Add tests that import `renderSpecification` and
`specificationAssetProblems` from
`tools/spec-authoring/generate-specification.ts`.

The tests must cover:

- version token rendering
- generated pillar table rendering
- generated clause-count and scope-list rendering
- generated pillar and clause heading rendering
- generated per-scope rule bullets
- generated conformance-level bullets
- generated conformance workflow table rendering
- preservation of non-generated prose
- stale output detection
- unknown directive reporting
- missing rule-group directive reporting

- [x] **Step 2: Verify RED**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: failure because `generate-specification.ts` does not exist yet.

## Task 2: Renderer Implementation

**Files:**

- Create: `tools/spec-authoring/generate-specification.ts`
- Modify: `tools/package.json`

- [x] **Step 1: Implement catalog-backed rendering**

Create `renderSpecification(catalog, templateContent)` and
`specificationAssetProblems({ catalog, templateContent, specContent })`.
Support these directives:

- `{{specVersion}}`
- `{{generated:clause-count}}`
- `{{generated:spec-scope-list}}`
- `{{generated:pillars-table}}`
- `{{generated:conformance-levels}}`
- `{{generated:level-workflow-table}}`
- `{{generated:specification-clauses}}`
- `{{generated:pillar-heading:<number>}}`
- `{{generated:clause-heading:<number>}}`
- `{{generated:spec-rules:<clause>:<scope>}}`

- [x] **Step 2: Add CLI commands**

Add:

```json
"check:specification": "cd .. && tsx tools/spec-authoring/generate-specification.ts --check",
"generate:specification": "cd .. && tsx tools/spec-authoring/generate-specification.ts"
```

Keep the existing `check:spec-clauses` and `generate:spec-clauses` commands as
aliases to the new full-specification commands.

- [x] **Step 3: Verify GREEN**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: all rule-catalog assertions pass.

## Task 3: Template And Generated Spec

**Files:**

- Create:
  `tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template`
- Modify: `AI-CONTRIBUTOR-SPECIFICATION.md`

- [x] **Step 1: Create the template**

Derive the template from the current specification, replacing generated
regions with directives while preserving prose.

- [x] **Step 2: Regenerate the specification**

Run:

```sh
npm --prefix tools run generate:specification
```

Expected: `AI-CONTRIBUTOR-SPECIFICATION.md` is rendered from the template and
catalog.

- [x] **Step 3: Check generated output**

Run:

```sh
npm --prefix tools run check:specification
```

Expected: output confirms the generated specification matches the template and
catalog.

## Task 4: Documentation

**Files:**

- Modify: `AGENTS.md`
- Modify: `TOOLING.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Document source-of-truth boundaries**

Update agent/tooling guidance to say the specification is generated from the
template plus catalog, and direct edits to generated spec regions should be
made in the template or catalog.

- [x] **Step 2: Record the change**

Add an Unreleased changelog entry for the specification template generator.

## Task 5: Verification And Commit

**Files:** all changed files

- [x] **Step 1: Run focused checks**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:specification
```

- [x] **Step 2: Run full local gate**

Run:

```sh
npm --prefix tools run check:ci-local
```

- [x] **Step 3: Commit locally**

Commit all branch changes as one local commit with the required AI authorship
trailer. Do not push.

## Task 6: Fully Generated Specification Clauses Cleanup

**Files:**

- Modify:
  `tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template`
- Modify: `tools/spec-authoring/generate-specification.ts`
- Modify: `tools/tests/test-rule-catalog.ts`
- Modify: `AI-CONTRIBUTOR-SPECIFICATION.md`

- [x] **Step 1: Add failing full-section generation test**

Add a test for `{{generated:specification-clauses}}` that verifies pillar
headings, clause headings, scope headings, and rule bullets render from the
catalog without per-clause template directives.

- [x] **Step 2: Implement full-section generation**

Add support for `{{generated:specification-clauses}}`. Keep fine-grained
directives for focused tests and compatibility.

- [x] **Step 3: Move remaining clause prose**

Move solo-maintainer independence guidance to `## Scope and audience`, preserve
solo-maintainer implementation patterns in `AI-CONTRIBUTOR-GUIDE.md`, move
reusable terms to `## Definitions`, and rely on the adoption guide for
implementation examples and audit-scoring advice.

- [x] **Step 4: Regenerate and verify**

Run `npm --prefix tools run generate:specification` and focused checks before
the final full local gate.

## Task 7: Generated Metadata Scalars And Workflow Table

**Files:**

- Modify: `AI-CONTRIBUTOR-RULE-CATALOG.json`
- Modify: `AI-CONTRIBUTOR-RULE-CATALOG.schema.json`
- Modify:
  `tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template`
- Modify: `tools/spec-authoring/generate-specification.ts`
- Modify: `tools/spec-authoring/generate-rule-catalog.ts`
- Modify: `tools/spec-authoring/shared/spec-model.ts`
- Modify: `tools/tests/test-rule-catalog.ts`
- Modify: `AI-CONTRIBUTOR-SPECIFICATION.md`

- [x] **Step 1: Add failing renderer coverage**

Add tests for `{{generated:clause-count}}`,
`{{generated:spec-scope-list}}`, and `{{generated:level-workflow-table}}`.
Verify the focused test fails before implementation because the directives are
unknown.

- [x] **Step 2: Add catalog workflow summaries**

Add optional `workflowSummary` metadata to conformance levels, allow it in the
catalog schema/model, and validate that present values are non-blank.

- [x] **Step 3: Render the new directives**

Render clause counts from `catalog.clauses`, scope lists from the canonical
scope order, and the workflow table from conformance-level metadata while
excluding the optional `—` pseudo-level.

- [x] **Step 4: Update the template and regenerate**

Replace the remaining hand-authored clause count, scope lists, and "Which
level do you need?" table with directives, then regenerate the specification.

- [x] **Step 5: Verify before amend**

Run focused checks and the full local gate before amending the single local
branch commit.

## Task 8: Audit Model Cleanup

**Files:**

- Modify: `AI-CONTRIBUTOR-AUDIT-MODEL.md`

- [x] **Step 1: Update artifact ownership wording**

Replace the stale checklist-as-validated-only explanation with the current
three-way split: checked-in generated projections from the catalog and
template, audit-run stamping from evidence and stamp flags, and validation of
auditor-owned judgment fields plus cross-artifact consistency.

- [x] **Step 2: Verify and amend**

Run focused documentation checks and the full local gate before amending the
single local branch commit.

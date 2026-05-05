# Catalog-Backed Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AI-CONTRIBUTOR-COVERAGE.md` generation use a Markdown template
plus `AI-CONTRIBUTOR-RULE-CATALOG.json` directly for row counts, pillar labels,
and level labels.

**Architecture:** Add `tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template`
for coverage prose and placement. Refactor `generate-coverage.ts` so a
catalog-derived renderer replaces template directives and writes the full
coverage-map projection.

**Tech Stack:** TypeScript, existing spec-authoring scripts, markdownlint, npm
tooling.

---

## Task 1: Coverage Renderer Test

**Files:**

- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Add failing catalog-metadata test**

Import `coverageBlocksFromCatalog` and add a test that rewrites catalog pillar
and level labels, then verifies the generated pillar and level blocks use those
catalog values.

- [x] **Step 2: Verify RED**

Run `npm --prefix tools run test:rule-catalog`.
Expected: TypeScript fails because `coverageBlocksFromCatalog` is not exported.

## Task 2: Catalog-Only Coverage Renderer

**Files:**

- Modify: `tools/spec-authoring/generate-coverage.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Export catalog-backed blocks**

Add `coverageBlocksFromCatalog(catalog)` and use catalog pillar/level metadata
instead of parsing `AI-CONTRIBUTOR-SPECIFICATION.md`.

- [x] **Step 2: Verify GREEN**

Run `npm --prefix tools run test:rule-catalog`.
Expected: all rule-catalog assertions pass.

## Task 3: Documentation Cleanup

**Files:**

- Modify: `AI-CONTRIBUTOR-COVERAGE.md`
- Modify: `AI-CONTRIBUTOR-AUDIT-MODEL.md`

- [x] **Step 1: Update source-of-truth prose**

Replace stale wording that says coverage is generated from checklist or spec
sections with catalog-backed wording.

- [x] **Step 2: Verify generated output**

Run `npm --prefix tools run generate:coverage` and `git diff -- AI-CONTRIBUTOR-COVERAGE.md`.
Expected: generated numeric blocks remain unchanged except prose edits outside
generated blocks.

## Task 4: Full Verification And Commit

**Files:**

- All files modified by Tasks 1-3.

- [x] **Step 1: Run focused checks**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:coverage
npm --prefix tools run check:markdown
npm --prefix tools run check:links
```

- [x] **Step 2: Run full local gate**

Run `npm --prefix tools run check:ci-local`.

- [x] **Step 3: Commit locally**

Create one local commit with the required AI authorship trailer. Do not push.

## Task 5: Coverage Template Workflow

**Files:**

- Create: `tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template`
- Modify: `tools/spec-authoring/generate-coverage.ts`
- Modify: `tools/tests/test-rule-catalog.ts`
- Modify: `AI-CONTRIBUTOR-COVERAGE.md`
- Modify: `AI-CONTRIBUTOR-AUDIT-MODEL.md`
- Modify: `AGENTS.md`
- Modify: `TOOLING.md`

- [x] **Step 1: Add failing template renderer test**

Import `renderCoverageMap` and verify coverage directives render from catalog
metadata, template prose is preserved, and unknown coverage directives fail.

- [x] **Step 2: Verify RED**

Run `npm --prefix tools run test:rule-catalog`.
Expected: TypeScript fails because `renderCoverageMap` is not exported.

- [x] **Step 3: Implement template rendering**

Add `renderCoverageMap(catalog, templateContent)`, make `generate:coverage`
load `tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template`, and
render the full coverage map instead of stamping blocks in the output file.

- [x] **Step 4: Regenerate and update workflow docs**

Run `npm --prefix tools run generate:coverage`, then update `AGENTS.md`,
`TOOLING.md`, `AI-CONTRIBUTOR-AUDIT-MODEL.md`, and this branch's design/plan
docs to describe the template workflow.

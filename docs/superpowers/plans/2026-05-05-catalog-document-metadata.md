# Catalog Document Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical pillar, level, and clause metadata to the rule catalog without generating specification markdown yet.

**Architecture:** Extend the shared spec model with parsers for pillar details, clause details, level details, and spec version. Extend the catalog schema/types/validator to carry those arrays, then update projection checks to compare catalog metadata with the current markdown projection.

**Tech Stack:** Markdown, JSON Schema draft 2020-12, Node 24, TypeScript, `tsx`, existing spec-authoring checks, no new dependencies.

---

## Task 1: Parser And Catalog Tests

**Files:**

- Modify: `tools/tests/test-spec-model.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Add spec-model assertions for document metadata**

Add assertions that parse pillar details, clause details, level details, and
the specification version from a small fixture.

- [x] **Step 2: Add rule-catalog assertions for metadata validation**

Add assertions that `buildRuleCatalog` returns `pillars`, `levels`, and
`clauses`, that canonicalization sorts those arrays, and that validation
rejects missing referenced clauses/levels.

- [x] **Step 3: Run focused tests and verify RED**

Run:

```sh
npm --prefix tools run test:spec-model
npm --prefix tools run test:rule-catalog
```

Expected: tests fail because the parser and catalog model do not expose the
new metadata yet.

## Task 2: Parser And Catalog Model

**Files:**

- Modify: `tools/spec-authoring/shared/spec-model.ts`
- Modify: `tools/spec-authoring/generate-rule-catalog.ts`
- Modify: `AI-CONTRIBUTOR-RULE-CATALOG.schema.json`

- [x] **Step 1: Add shared spec metadata parsers**

Add exported parsers for pillar details, clause details, level details, and
the specification version.

- [x] **Step 2: Extend catalog interfaces and builder**

Add `pillars`, `levels`, and `clauses` to `RuleCatalog`. Populate them from
the new shared parsers in `buildRuleCatalog`.

- [x] **Step 3: Extend canonicalization and validation**

Sort document metadata arrays deterministically. Validate uniqueness,
non-empty display fields, and rule references to existing clauses/levels.

- [x] **Step 4: Extend JSON Schema**

Require the new top-level arrays and mirror the TypeScript validation shape.

- [x] **Step 5: Run focused tests and verify GREEN**

Run:

```sh
npm --prefix tools run test:spec-model
npm --prefix tools run test:rule-catalog
```

Expected: both focused tests pass.

## Task 3: Projection And Generated Catalog

**Files:**

- Modify: `tools/spec-authoring/check-rule-catalog-projections.ts`
- Modify: `AI-CONTRIBUTOR-RULE-CATALOG.json`
- Modify: `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- Modify: `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`

- [x] **Step 1: Add projection checks for document metadata**

Compare catalog `pillars`, `clauses`, `levels`, and `specVersion` against
the current specification/checklist projection.

- [x] **Step 2: Regenerate the catalog from markdown**

Run:

```sh
npm --prefix tools run generate:rule-catalog -- --from-markdown
```

Expected: the catalog contains document metadata and `specVersion: "0.2"`.

- [x] **Step 3: Align shipped audit template spec versions**

Update the checklist and audit-log template frontmatter to `spec_version:
"0.2"` so shipped templates match the current specification version.

- [x] **Step 4: Run focused projection checks**

Run:

```sh
npm --prefix tools run check:rule-catalog
npm --prefix tools run check:rule-catalog-projections
npm --prefix tools run check:checklist-assets
npm --prefix tools run check:audit-validate
```

Expected: every command exits 0.

## Task 4: Documentation And Commit

**Files:**

- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Create: `docs/superpowers/specs/2026-05-05-catalog-document-metadata-design.md`
- Create: `docs/superpowers/plans/2026-05-05-catalog-document-metadata.md`

- [x] **Step 1: Update repository instructions**

Document that the catalog is now canonical for pillar, clause, and level
metadata as well as per-rule metadata.

- [x] **Step 2: Update changelog**

Add a `0.2` entry noting that catalog metadata now includes pillars, clauses,
and levels, with no rule semantic changes.

- [x] **Step 3: Run local gate and commit**

Run:

```sh
npm --prefix tools run check:ci-local
```

Expected: local PR gate exits 0. Then commit locally with the AI co-author
trailer and do not push.

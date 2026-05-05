# Remove Migration Compatibility Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove migration-era and backward-compatibility code now that the catalog and templates are the source of truth.

**Architecture:** Keep the catalog renderers as the only document-generation path. Runtime audit tooling should parse the current generated audit artifacts, not older checklist layouts or one-time migration markers.

**Tech Stack:** TypeScript, Node.js, repository-local npm scripts, Markdown templates.

---

## Task 1: Authoring Compatibility Removal

**Files:**
- Modify: `tools/spec-authoring/generate-rule-catalog.ts`
- Modify: `tools/spec-authoring/generate-specification.ts`
- Delete: `tools/spec-authoring/check-rule-catalog-projections.ts`
- Modify: `tools/package.json`
- Modify: `TOOLING.md`
- Modify: `AGENTS.md`
- Modify: `tools/spec-authoring/generate-checklist-assets.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] Remove `generate-rule-catalog.ts --from-markdown` and direct Markdown-to-catalog construction.
- [x] Remove granular specification directives (`generated:pillar-heading`, `generated:clause-heading`, `generated:spec-rules`).
- [x] Remove `check:spec-clauses`, `generate:spec-clauses`, and the redundant projection parser check.
- [x] Remove the one-time checklist ID binding rejection path from checklist asset generation.
- [x] Update tests to use direct catalog fixtures and full-section specification generation.

## Task 2: Runtime Compatibility Removal

**Files:**
- Modify: `skills/ai-contributor-audit/scripts/internal/audit-markdown.ts`
- Modify: `skills/ai-contributor-audit/scripts/internal/stamper-evidence-blocks.ts`
- Modify: `skills/ai-contributor-audit/scripts/internal/stamper-frontmatter.ts`
- Modify: `skills/ai-contributor-audit/scripts/audit-stamp.ts`
- Modify: `skills/ai-contributor-audit/scripts/internal/validator-summary.ts`
- Modify: `tools/tests/test-audit-markdown.ts`
- Modify: `tools/tests/test-audit-stamp-check.ts`
- Modify: `tools/tests/test-stamper-internals.ts`
- Modify: `tools/test-fixtures/audit-validate/**`

- [x] Require current Level-section checklist tables with the `A` column.
- [x] Remove legacy scope-section checklist parsing and old audit-log marker prose normalization.
- [x] Use parsed checklist row IDs directly when stamping verification gaps.
- [x] Require Level 0 in conformance summaries.
- [x] Remove obsolete automated-marker rejection code and tests.
- [x] Update audit validator/stamper fixtures to current Level-section tables and checksum-protected stamped blocks.

## Task 3: Catalog-Owned Metadata Cleanup

**Files:**
- Modify: `tools/spec-authoring/check-conformance-levels.ts`
- Modify: `tools/spec-authoring/generate-coverage.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] Derive accepted conformance levels from `AI-CONTRIBUTOR-RULE-CATALOG.json`.
- [x] Render coverage at-a-glance level counts from catalog levels instead of hard-coded L0-L4 wording.

## Task 4: Verification

- [x] Run focused tests after each slice: `npm --prefix tools run test:rule-catalog`, `npm --prefix tools run test:audit-markdown`, `npm --prefix tools run test:stamper-internals`.
- [x] Regenerate generated docs if coverage wording changes.
- [x] Run `npm --prefix tools run check:ci-local`.
- [x] Commit the branch locally without pushing.

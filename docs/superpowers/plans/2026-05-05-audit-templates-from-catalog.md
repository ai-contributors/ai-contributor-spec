# Audit Templates From Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the shipped audit summary and audit-log templates from Markdown templates plus `AI-CONTRIBUTOR-RULE-CATALOG.json`.

**Architecture:** Add one audit-template renderer under `tools/spec-authoring/` and two source templates under `tools/spec-authoring/templates/`. The catalog owns version and conformance-level facts; templates own long-form audit prose and shipped stamped-marker anchors.

**Tech Stack:** TypeScript, Node built-ins, existing catalog model, existing Markdown table renderer, npm scripts under `tools/package.json`.

---

## Task 1: Projection Registry

**Files:**
- Modify: `tools/spec-authoring/generate-rule-catalog.ts`
- Modify: `AI-CONTRIBUTOR-RULE-CATALOG.schema.json`
- Modify: `AI-CONTRIBUTOR-RULE-CATALOG.json`
- Test: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Add the failing projection expectation**

Add assertions that `catalog.projections.coverage` exists and that blank coverage projection values fail validation.

- [x] **Step 2: Run the focused test**

Run: `npm --prefix tools run test:rule-catalog`

Expected: fails because `projections.coverage` is missing from the generated catalog type and validator.

- [x] **Step 3: Add coverage to the catalog projection model**

Update the TypeScript interface, catalog builder, validator, JSON schema, and checked-in catalog so `coverage` points to `AI-CONTRIBUTOR-COVERAGE.md`.

- [x] **Step 4: Re-run focused tests**

Run: `npm --prefix tools run test:rule-catalog`

Expected: passes.

## Task 2: Audit Template Renderer

**Files:**
- Create: `tools/spec-authoring/generate-audit-templates.ts`
- Create: `tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT.md.template`
- Create: `tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT-LOG.md.template`
- Modify: `tools/package.json`
- Test: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Add failing renderer tests**

Add tests for `renderAuditTemplates(catalog, templates)` that prove:

- `{{specVersion}}` renders in the audit-log frontmatter.
- `{{generated:conformance-level-values}}` renders from catalog levels.
- `{{generated:conformance-level-summary-rows}}` renders canonical summary rows in the root audit template.
- Template prose and shipped `<!-- BEGIN:... -->` markers are preserved.
- Unknown, duplicate, missing, and unresolved directives are reported.

- [x] **Step 2: Run the focused test**

Run: `npm --prefix tools run test:rule-catalog`

Expected: fails because `generate-audit-templates.ts` does not exist yet.

- [x] **Step 3: Implement the renderer**

Create `generate-audit-templates.ts` with exported `renderAuditTemplates` and `auditTemplateProblems`. The CLI checks or rewrites `AI-CONTRIBUTOR-AUDIT.md` and `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md` from their templates.

- [x] **Step 4: Wire commands**

Add `check:audit-templates` and `generate:audit-templates` scripts, and include `check:audit-templates` in `check`.

- [x] **Step 5: Re-run focused tests**

Run: `npm --prefix tools run test:rule-catalog`

Expected: passes.

## Task 3: Generated Artifacts And Docs

**Files:**
- Modify: `AI-CONTRIBUTOR-AUDIT.md`
- Modify: `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`
- Modify: `AGENTS.md`
- Modify: `TOOLING.md`
- Modify: `AI-CONTRIBUTOR-AUDIT-MODEL.md`
- Modify: `docs/superpowers/plans/2026-05-05-audit-templates-from-catalog.md`

- [x] **Step 1: Regenerate audit templates**

Run: `npm --prefix tools run generate:audit-templates`

Expected: the root audit summary and audit-log template match their source templates plus catalog.

- [x] **Step 2: Update agent/tooling docs**

Document that audit summary and audit log are generated projections, and document the new check/generate commands.

- [x] **Step 3: Run targeted checks**

Run:

```sh
npm --prefix tools run check:audit-templates
npm --prefix tools run check:rule-catalog
npm --prefix tools run check:rule-catalog-projections
npm --prefix tools run check:audit-validate
npm --prefix tools run check:tooling-command-coverage
```

Expected: all pass.

## Task 4: Branch Completion

**Files:**
- All files changed above.

- [x] **Step 1: Run broad verification**

Run:

```sh
npm --prefix tools run typecheck
npm --prefix tools run lint
npm --prefix tools run format:check
npm --prefix tools run check:markdown
npm --prefix tools run check:links
npm --prefix tools run check
```

Expected: all pass.

- [ ] **Step 2: Commit locally only**

Commit all branch changes as one local commit:

```sh
git add .
git commit -m "refactor: generate audit templates from catalog"
```

Use the required AI co-author trailer. Do not push.

- [ ] **Step 3: Final verification**

Run: `npm --prefix tools run check:ci-local`

Expected: passes. Confirm `git status --short --branch` is clean and the branch contains one local commit over `issue-4-checklist-template-from-catalog`.

# Specification Clauses From JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the normative `AIC-*` rule bullets in `AI-CONTRIBUTOR-SPECIFICATION.md` from `AI-CONTRIBUTOR-RULE-CATALOG.json`.

**Architecture:** Add one spec-authoring generator that uses the current specification as frame text and the catalog as rule source. It replaces only rule bullets under clause/scope headings, preserving non-normative prose. Wire a `check:spec-clauses` guardrail into the local aggregate check before projection checks.

**Tech Stack:** Markdown, Node 24, TypeScript, `tsx`, existing catalog model, no new dependencies.

---

## Task 1: Failing Generator Tests

**Files:**

- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Add spec-clause generation assertions**

Import the new functions:

```ts
import {
  renderSpecificationClauseRules,
  specificationClauseAssetProblems,
} from '../spec-authoring/generate-spec-clauses.ts';
```

Add assertions that render catalog rule bullets into a small spec frame, preserve
non-normative frame prose, detect stale rule edits, and report missing
clause/scope locations.

- [x] **Step 2: Run focused test and verify RED**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: fails because `tools/spec-authoring/generate-spec-clauses.ts` does
not exist.

## Task 2: Spec-Clause Generator

**Files:**

- Create: `tools/spec-authoring/generate-spec-clauses.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Implement catalog grouping and bullet rendering**

Create helpers that validate the catalog, group rules by `clause::scope`, and
render each rule as:

```md
- <catalog text> <sup>`AIC-example-id`</sup>
```

Sort each group by level, checklist rule label, then ID.

- [x] **Step 2: Implement frame-preserving replacement**

Parse `AI-CONTRIBUTOR-SPECIFICATION.md` lines under `## Specification clauses`.
Track clause headings and scope headings. Replace only contiguous `- ...AIC-*`
rule bullets under each scope with the catalog-rendered group.

- [x] **Step 3: Implement stale-check problems and CLI**

Export:

```ts
export function renderSpecificationClauseRules(catalog: RuleCatalog, specContent: string): string;
export function specificationClauseAssetProblems(input: {
  catalog: RuleCatalog;
  specContent: string;
}): string[];
```

The CLI reads the catalog and specification. `--check` exits non-zero when the
rendered output differs from disk.

- [x] **Step 4: Run focused test and verify GREEN**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: all rule-catalog assertions pass.

## Task 3: Wire Guardrail And Regenerate Spec

**Files:**

- Modify: `tools/package.json`
- Modify: `TOOLING.md`
- Modify: `AI-CONTRIBUTOR-SPECIFICATION.md`

- [x] **Step 1: Add npm commands**

Add:

```json
"check:spec-clauses": "cd .. && tsx tools/spec-authoring/generate-spec-clauses.ts --check",
"generate:spec-clauses": "cd .. && tsx tools/spec-authoring/generate-spec-clauses.ts"
```

Add `check:spec-clauses` to `check` after `check:checklist-assets` and before
`check:rule-catalog-projections`.

- [x] **Step 2: Document the focused command**

Add a `TOOLING.md` command-table row for `check:spec-clauses` and a generator
row for `generate:spec-clauses`.

- [x] **Step 3: Regenerate specification rule bullets**

Run:

```sh
npm --prefix tools run generate:spec-clauses
```

Expected: `AI-CONTRIBUTOR-SPECIFICATION.md` has catalog-rendered rule bullets;
non-normative frame text remains in place.

- [x] **Step 4: Run focused checks**

Run:

```sh
npm --prefix tools run check:spec-clauses
npm --prefix tools run check:rule-catalog-projections
npm --prefix tools run check:normative-ids
```

Expected: every command exits 0.

## Task 4: Documentation, Gate, Commit

**Files:**

- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Create: `docs/superpowers/specs/2026-05-05-spec-clauses-from-json-design.md`
- Create: `docs/superpowers/plans/2026-05-05-spec-clauses-from-json.md`

- [x] **Step 1: Update repository instructions**

Document that specification rule bullets are generated from the catalog, while
non-normative clause frame prose remains hand-authored.

- [x] **Step 2: Update changelog**

Add a `0.2` entry noting that the specification's normative rule bullets are
now generated from the canonical catalog with no rule semantic changes.

- [x] **Step 3: Run full local gate**

Run:

```sh
npm --prefix tools run check:ci-local
```

Expected: local PR gate exits 0.

- [x] **Step 4: Commit locally**

Commit all branch changes locally with the AI co-author trailer. Do not push.

# Spec Heading Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the heading hierarchy inside the specification clause
section without changing rule semantics.

**Architecture:** Update the shared spec parser to accept clause headings at
`####` and scope headings at `#####`, then rewrite the spec clause headings.
Keep catalog projection checks as the semantic safety net.

**Tech Stack:** Markdown, Node 24, TypeScript, `tsx`, existing spec-authoring
checks, no new dependencies.

---

## Task 1: Parser Coverage

**Files:**

- Modify: `tools/tests/test-spec-model.ts`
- Modify: `tools/spec-authoring/shared/spec-model.ts`

- [x] **Step 1: Update the spec-model fixture to the cleaned hierarchy**

Use `### Pillar`, `#### N. Clause`, and `##### Scope` headings in the
fixture.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```sh
npm --prefix tools run test:spec-model
```

Expected: parser assertions fail before the shared parser is updated.

- [x] **Step 3: Update the shared parser**

Teach the parser to recognize `#### N. Clause` headings and `#####` scope
headings while preserving compatibility with legacy heading levels.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```sh
npm --prefix tools run test:spec-model
```

Expected: all spec-model assertions pass.

## Task 2: Spec And Heading-Sensitive Checks

**Files:**

- Modify: `AI-CONTRIBUTOR-SPECIFICATION.md`
- Modify: `tools/doc-checks/check-clause-refs.ts`
- Modify: `tools/doc-checks/check-hints-consistency.ts`
- Modify: `tools/doc-checks/check-pillar-structure.ts`
- Modify: `tools/spec-authoring/check-normative-ids.ts`

- [x] **Step 1: Rewrite the specification clause headings**

Change only headings inside `## Specification clauses`: clauses become
`####`, scope groups and clause-local subsections become `#####`, and pillar
headings remain `###`.

- [x] **Step 2: Update heading-sensitive checks**

Allow clause-heading scanners to parse both cleaned `#### N. Clause` and
legacy `## N. Clause` forms.

- [x] **Step 3: Run focused checks**

Run:

```sh
npm --prefix tools run check:clauses
npm --prefix tools run check:pillar-structure
npm --prefix tools run check:hints
npm --prefix tools run check:normative-ids
npm --prefix tools run check:rule-catalog-projections
npm --prefix tools run check:links
npm --prefix tools run check:markdown
```

Expected: every command exits 0.

## Task 3: Documentation And Commit

**Files:**

- Create: `docs/superpowers/specs/2026-05-05-spec-heading-cleanup-design.md`
- Create: `docs/superpowers/plans/2026-05-05-spec-heading-cleanup.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Record the design and plan**

Add the design and implementation notes under `docs/superpowers/`.

- [x] **Step 2: Record the adopter-visible cleanup**

Add a `CHANGELOG.md` note under `0.2` saying only the spec heading hierarchy
changed and rule semantics did not.

- [x] **Step 3: Run the local gate and commit**

Run:

```sh
npm --prefix tools run check:ci-local
```

Expected: local PR gate exits 0. Then commit locally with the AI co-author
trailer and do not push.

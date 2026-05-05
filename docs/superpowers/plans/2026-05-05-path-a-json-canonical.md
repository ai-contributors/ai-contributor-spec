# Path A JSON Canonical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AI-CONTRIBUTOR-RULE-CATALOG.json` the canonical checked input for rule metadata and enforce that markdown projections match it.

**Architecture:** Keep the existing markdown extractor as an explicit migration aid, but change the rule-catalog CLI to validate/canonicalize checked-in JSON by default. Add a projection checker that compares specification and checklist markdown against the canonical catalog until full renderers replace those assets.

**Tech Stack:** Node 24, TypeScript, `tsx`, existing markdown/checklist/spec parsers, no new dependencies.

---

## File Structure

- Modify `tools/spec-authoring/generate-rule-catalog.ts`: add catalog read/canonicalize helpers; default CLI reads JSON, `--from-markdown` preserves extraction.
- Create `tools/spec-authoring/check-rule-catalog-projections.ts`: compare current spec/checklist markdown with catalog metadata.
- Modify `tools/tests/test-rule-catalog.ts`: add failing tests for canonicalization and projection mismatch detection.
- Modify `tools/package.json`: add `check:rule-catalog-projections`; keep `check:rule-catalog` as catalog validation/canonicalization.
- Modify `TOOLING.md`: document the new projection check and updated rule-catalog command semantics.
- Modify `AGENTS.md`: document the catalog source-of-truth boundary.
- Modify `CHANGELOG.md`: record the source-of-truth/process change required by `AGENTS.md`.

### Task 1: Catalog-First CLI

**Files:**

- Modify: `tools/spec-authoring/generate-rule-catalog.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Write the failing test**

Add assertions to `tools/tests/test-rule-catalog.ts`:

```ts
const unsortedCatalog = {
  ...catalog,
  rules: [catalog.rules[1]!, catalog.rules[0]!],
};
const canonicalCatalog = canonicalizeRuleCatalog(unsortedCatalog);
assert(
  'canonicalizes catalog rule order without markdown input',
  canonicalCatalog.rules.map((rule) => rule.id).join(',') ===
    'AIC-clean-clone-bootstrap,AIC-human-review-required',
);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: TypeScript fails because `canonicalizeRuleCatalog` is not exported.

- [x] **Step 3: Implement catalog canonicalization**

Update `tools/spec-authoring/generate-rule-catalog.ts`:

```ts
export function canonicalizeRuleCatalog(catalog: RuleCatalog): RuleCatalog {
  return {
    ...catalog,
    rules: [...catalog.rules].sort(compareCatalogEntries),
  };
}
```

Change `main()` so default behavior reads `AI-CONTRIBUTOR-RULE-CATALOG.json`,
validates it, canonicalizes it, and writes/checks that canonical rendering.
Move the current markdown extraction behavior behind `--from-markdown`.

- [x] **Step 4: Run test and catalog check**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:rule-catalog
```

Expected: both pass.

### Task 2: Projection Check

**Files:**

- Create: `tools/spec-authoring/check-rule-catalog-projections.ts`
- Modify: `tools/tests/test-rule-catalog.ts`
- Modify: `tools/package.json`
- Modify: `TOOLING.md`

- [x] **Step 1: Write the failing test**

Add assertions to `tools/tests/test-rule-catalog.ts`:

```ts
const projectionProblems = ruleCatalogProjectionProblems({
  catalog,
  specContent: specContent.replace('Repositories MUST bootstrap cleanly.', 'Repositories MUST drift.'),
  checklistContent,
});
assert(
  'detects spec projection drift from catalog',
  projectionProblems.some((problem) =>
    problem.includes('AIC-clean-clone-bootstrap text mismatch'),
  ),
);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: TypeScript fails because `ruleCatalogProjectionProblems` is not exported.

- [x] **Step 3: Implement projection checker**

Create `tools/spec-authoring/check-rule-catalog-projections.ts` exporting:

```ts
export function ruleCatalogProjectionProblems(input: {
  catalog: RuleCatalog;
  specContent: string;
  checklistContent: string;
}): string[] {
  // Compare spec normative rules and checklist rows against catalog entries.
}
```

The CLI reads `AI-CONTRIBUTOR-RULE-CATALOG.json`,
`AI-CONTRIBUTOR-SPECIFICATION.md`, and
`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, then fails on drift.

- [x] **Step 4: Wire package scripts and docs**

Add to `tools/package.json`:

```json
"check:rule-catalog-projections": "cd .. && tsx tools/spec-authoring/check-rule-catalog-projections.ts"
```

Add it to the aggregate `check` chain immediately after `check:rule-catalog`.
Document it in `TOOLING.md`.

- [x] **Step 5: Run targeted checks**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:rule-catalog
npm --prefix tools run check:rule-catalog-projections
npm --prefix tools run check:tooling-command-coverage
```

Expected: all pass.

### Task 3: Repository Instructions And Changelog

**Files:**

- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Update source-of-truth instructions**

Update `AGENTS.md` so it says `AI-CONTRIBUTOR-RULE-CATALOG.json` is canonical
for rule metadata, while the surrounding spec prose and audit template
instructions remain guarded projection/frame assets until their generators are
complete.

- [x] **Step 2: Record the process change**

Add an `Unreleased` entry to `CHANGELOG.md` noting that rule metadata authoring
now flows through the catalog and markdown projections are checked against it.
State that no rule semantics changed.

- [x] **Step 3: Run markdown checks**

Run:

```sh
npm --prefix tools run check:markdown
npm --prefix tools run check:links
```

Expected: both pass.

### Task 4: Final Verification

**Files:**

- Verify all modified files.

- [x] **Step 1: Run focused checks**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:rule-catalog
npm --prefix tools run check:rule-catalog-projections
```

Expected: all pass.

- [x] **Step 2: Run aggregate check**

Run:

```sh
npm --prefix tools run check
```

Expected: aggregate check passes.

- [x] **Step 3: Inspect branch**

Run:

```sh
git status --short --branch
git log --oneline --decorate --max-count=6
```

Expected: branch is `issue-4-path-a-json-canonical`, local-only, and unpushed.

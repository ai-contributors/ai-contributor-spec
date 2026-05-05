# Checklist Assets From JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the checklist rule tables from
`AI-CONTRIBUTOR-RULE-CATALOG.json` and derive checklist ID bindings directly
from that catalog in checks.

**Architecture:** Add a focused checklist-assets renderer that rewrites only
the rule-table region and removes the legacy binding comment. Keep surrounding
checklist prose hand-authored and continue using projection checks for semantic
drift.

**Tech Stack:** Node 24, TypeScript, `tsx`, existing catalog types and
markdown table rendering helpers, no new dependencies.

---

## File Structure

- Create `tools/spec-authoring/generate-checklist-assets.ts`: renderer,
  checker, and CLI for the generated checklist rule tables.
- Modify `tools/spec-authoring/check-checklist-pillars.ts`: compare visible
  checklist IDs to catalog-derived row bindings.
- Modify `tools/tests/test-rule-catalog.ts`: add TDD coverage for rendering and
  drift detection.
- Modify `tools/package.json`: add `check:checklist-assets` and
  `generate:checklist-assets`, and wire the check into aggregate gates.
- Modify `TOOLING.md`: document the new commands.
- Modify `AGENTS.md`: document generated checklist regions and the remaining
  prose boundary.
- Modify `CHANGELOG.md`: record the generation-process change.

### Task 1: Failing Renderer Tests

**Files:**

- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Add imports for generator functions**

```ts
import {
  checklistAssetProblems,
  renderChecklistAssets,
  renderChecklistRuleTables,
} from '../spec-authoring/generate-checklist-assets.ts';
```

- [x] **Step 2: Add assertions for rendered fragments**

```ts
assert(
  'does not store presentation order fields in catalog entries',
  !('specOrder' in catalog.rules[0]!) &&
    !('rowOrder' in catalog.rules[0]!.checklist) &&
    !('idOrder' in catalog.rules[0]!.checklist),
);
assert(
  'renders checklist rule tables from catalog',
  renderChecklistRuleTables(catalog).includes(
    '| `MUST` | `Clean Setup` | - |  |  | Repository bootstraps from a clean clone. | 1 | `AIC-clean-clone-bootstrap` |',
  ),
);
```

- [x] **Step 3: Add a drift assertion**

```ts
const checklistFrameWithLegacyBindings = [
  '# Checklist',
  '',
  '<!-- BEGIN:CHECKLIST-ID-BINDINGS',
  '{}',
  'END:CHECKLIST-ID-BINDINGS -->',
  '',
  '## Checklist row tables',
  'stale',
  '---',
  '',
  '## Verification gaps',
].join('\n');
const renderedChecklistAssets = renderChecklistAssets(catalog, checklistFrameWithLegacyBindings);
assert(
  'renders checklist assets without checklist ID bindings',
  !renderedChecklistAssets.includes('CHECKLIST-ID-BINDINGS') &&
    renderedChecklistAssets.includes(
      '| `MUST` | `Clean Setup` | - |  |  | Repository bootstraps from a clean clone. | 1 | `AIC-clean-clone-bootstrap` |',
    ),
);

const staleChecklist = checklistContent.replace('Clean Setup', 'Dirty Setup');
assert(
  'detects checklist asset drift from catalog',
  checklistAssetProblems({ catalog, checklistContent: staleChecklist }).some((problem) =>
    problem.includes('checklist rule tables are stale'),
  ),
);
assert(
  'does not require checklist ID bindings',
  !checklistAssetProblems({ catalog, checklistContent: staleChecklist }).some((problem) =>
    problem.includes('checklist ID bindings'),
  ),
);
```

- [x] **Step 4: Run the test and verify RED**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: TypeScript fails because `generate-checklist-assets.ts` does not
exist yet.

### Task 2: Checklist Asset Renderer

**Files:**

- Create: `tools/spec-authoring/generate-checklist-assets.ts`

- [x] **Step 1: Implement grouping helpers**

Group catalog entries by checklist row key:

```ts
type ChecklistAssetRow = {
  level: string;
  scope: string;
  clause: number;
  rule: string;
  requirement: string;
  pillar: number;
  ids: string[];
};
```

Group entries by checklist row name, require grouped entries to share `level`,
`scope`, `rule`, `requirement`, and `pillar`, and sort generated rows by
`level`, `scope`, `clause`, `rule`, then `id`. Do not add presentation-only
order fields to the catalog.

- [x] **Step 2: Implement renderers**

Render row IDs as backticked `AIC-id` tokens joined with comma separators.
Render generated rows with blank Status and Comment cells and `-` in the
automation column.

- [x] **Step 3: Implement fragment replacement and check mode**

Replace only the rule-table block and remove any legacy ID binding block. In
`--check`, compare the expected rule-table replacement to the current file and
emit stable problem messages.

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: all rule-catalog tests pass.

### Task 3: Tooling And Docs

**Files:**

- Modify: `tools/package.json`
- Modify: `TOOLING.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: Wire package scripts**

Add scripts:

```json
"check:checklist-assets": "cd .. && tsx tools/spec-authoring/generate-checklist-assets.ts --check",
"generate:checklist-assets": "cd .. && tsx tools/spec-authoring/generate-checklist-assets.ts"
```

Add `check:checklist-assets` to `check` and `coverage:chain`.

- [x] **Step 2: Document commands and source-of-truth rule**

Update `TOOLING.md` with both commands. Update `AGENTS.md` to say checklist
rule tables are generated from the catalog and must not be edited by hand.

- [x] **Step 3: Record the change**

Add a changelog bullet under `0.2` saying checklist row assets are now rendered
from `AI-CONTRIBUTOR-RULE-CATALOG.json`.

### Task 4: Verification And Commit

**Files:**

- Verify all modified files.

- [x] **Step 1: Run targeted checks**

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:checklist-assets
npm --prefix tools run check:rule-catalog-projections
npm --prefix tools run check:tooling-command-coverage
npm --prefix tools run check:markdown
```

Expected: every command exits 0.

- [x] **Step 2: Run aggregate local gate**

```sh
npm --prefix tools run check
```

Expected: aggregate check exits 0.

- [x] **Step 3: Create one local commit**

```sh
git add docs/superpowers/specs/2026-05-05-checklist-assets-from-json-design.md \
  docs/superpowers/plans/2026-05-05-checklist-assets-from-json.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  tools/spec-authoring/generate-checklist-assets.ts \
  tools/spec-authoring/check-checklist-pillars.ts \
  tools/tests/test-rule-catalog.ts \
  tools/package.json TOOLING.md AGENTS.md CHANGELOG.md
git commit -m "feat: generate checklist assets from rule catalog" \
  -m "Co-Authored-By: OpenAI Codex (GPT-5) <noreply@openai.com>"
```

# Rule Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generated `AI-CONTRIBUTOR-RULE-CATALOG.json` and schema without making it the normative source of truth.

**Architecture:** Reuse the existing specification, checklist, and collector-registry parsers. Add one generator with a `--check` mode, one schema artifact, and focused tests that prove the catalog is deterministic and drift-checked.

**Tech Stack:** Node 24, TypeScript, `tsx`, existing markdown/checklist parsers, no new runtime or dev dependencies.

---

## File Structure

- Modify `tools/spec-authoring/shared/spec-model.ts`: expose normative bullet text by `AIC-*` ID.
- Modify `tools/tests/test-spec-model.ts`: add red/green coverage for normative text extraction.
- Create `tools/spec-authoring/generate-rule-catalog.ts`: build, validate, write, and check the catalog.
- Create `tools/tests/test-rule-catalog.ts`: test catalog generation with representative inputs.
- Create `AI-CONTRIBUTOR-RULE-CATALOG.schema.json`: JSON Schema for the generated catalog.
- Create `AI-CONTRIBUTOR-RULE-CATALOG.json`: generated catalog artifact.
- Modify `tools/package.json`: add `check:rule-catalog`, `generate:rule-catalog`, and `test:rule-catalog`; wire them into `check`.
- Modify `TOOLING.md`: document the new local check command.

### Task 1: Normative Rule Text Parser

**Files:**

- Modify: `tools/spec-authoring/shared/spec-model.ts`
- Modify: `tools/tests/test-spec-model.ts`

- [x] **Step 1: Write the failing test**

Add assertions to `tools/tests/test-spec-model.ts`:

```ts
const rules = parseNormativeRules(spec);
assert('parses normative rule entries', rules.length === 3);
assert(
  'extracts normative sentence text',
  rules.find((rule) => rule.id === 'AIC-clean-setup')?.text ===
    'Repositories MUST be clean.',
);
assert(
  'maps normative rules by ID',
  normativeRuleMap(spec).get('AIC-branch-protection')?.text ===
    'Hosted repositories MUST protect branches.',
);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
npm --prefix tools run test:spec-model
```

Expected: TypeScript fails because `parseNormativeRules` and
`normativeRuleMap` are not exported.

- [x] **Step 3: Implement parser**

Add exported types and functions to `tools/spec-authoring/shared/spec-model.ts`:

```ts
export interface NormativeRule {
  id: string;
  clause: number;
  scope: SpecScope;
  line: number;
  text: string;
}

export function parseNormativeRules(specContent: string): NormativeRule[] {
  // Walk the same section and scope headings as parseNormativeIds.
  // For each bullet with an AIC ID, remove the trailing <sup>...</sup> marker
  // and return one NormativeRule per ID on the bullet.
}

export function normativeRuleMap(specContent: string): Map<string, NormativeRule> {
  const out = new Map<string, NormativeRule>();
  for (const rule of parseNormativeRules(specContent)) out.set(rule.id, rule);
  return out;
}
```

- [x] **Step 4: Run test to verify it passes**

Run:

```sh
npm --prefix tools run test:spec-model
```

Expected: all existing and new `test-spec-model` assertions pass.

- [x] **Step 5: Commit**

Run:

```sh
git add tools/spec-authoring/shared/spec-model.ts tools/tests/test-spec-model.ts
git commit -m "feat(tools): parse normative rule text" \
  -m "Co-Authored-By: OpenAI Codex (GPT-5) <noreply@openai.com>"
```

### Task 2: Rule Catalog Generator

**Files:**

- Create: `tools/spec-authoring/generate-rule-catalog.ts`
- Create: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Write the failing test**

Create `tools/tests/test-rule-catalog.ts` with representative spec/checklist
strings and a collector map:

```ts
const catalog = buildRuleCatalog({
  specContent,
  checklistContent,
  collectorAicIds: {
    'clean-clone-bootstrap': ['AIC-clean-clone-bootstrap'],
  },
});

assert('builds one entry per AIC ID', catalog.rules.length === 2);
assert(
  'joins checklist metadata',
  catalog.rules.find((rule) => rule.id === 'AIC-clean-clone-bootstrap')?.checklist.rule ===
    'Clean Setup',
);
assert(
  'joins detector metadata',
  catalog.rules.find((rule) => rule.id === 'AIC-clean-clone-bootstrap')?.detectors[0]?.id ===
    'clean-clone-bootstrap',
);
assert(
  'marks missing detector rows as manual',
  catalog.rules.find((rule) => rule.id === 'AIC-human-review-required')?.detectorConfidence ===
    'manual',
);
```

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
cd tools && npx tsx tests/test-rule-catalog.ts
```

Expected: module import fails because
`tools/spec-authoring/generate-rule-catalog.ts` does not exist.

- [x] **Step 3: Implement generator API**

Create `tools/spec-authoring/generate-rule-catalog.ts` with:

```ts
export interface RuleCatalog {
  $schema: string;
  schemaVersion: '0.1';
  specVersion: string;
  generatedFrom: {
    specification: string;
    checklist: string;
    collectorRegistry: string;
  };
  rules: RuleCatalogEntry[];
}

export interface RuleCatalogEntry {
  id: string;
  clause: number;
  pillar: number;
  scope: SpecScope;
  level: string;
  text: string;
  checklist: { rule: string; requirement: string };
  detectors: RuleCatalogDetector[];
  detectorConfidence: 'indicative' | 'manual';
}

export function buildRuleCatalog(input: {
  specContent: string;
  checklistContent: string;
  collectorAicIds: Record<string, readonly string[]>;
}): RuleCatalog {
  // Join normative rules, checklist rows, and collector mappings by AIC ID.
  // Sort entries by clause, checklist level, checklist rule, then AIC ID.
}
```

- [x] **Step 4: Run test to verify it passes**

Run:

```sh
cd tools && npx tsx tests/test-rule-catalog.ts
```

Expected: all rule-catalog assertions pass.

- [x] **Step 5: Commit**

Run:

```sh
git add tools/spec-authoring/generate-rule-catalog.ts tools/tests/test-rule-catalog.ts
git commit -m "feat(tools): build rule catalog model" \
  -m "Co-Authored-By: OpenAI Codex (GPT-5) <noreply@openai.com>"
```

### Task 3: Schema And Generated Artifact

**Files:**

- Create: `AI-CONTRIBUTOR-RULE-CATALOG.schema.json`
- Create: `AI-CONTRIBUTOR-RULE-CATALOG.json`
- Modify: `tools/spec-authoring/generate-rule-catalog.ts`

- [x] **Step 1: Write failing check behavior**

Extend `tools/tests/test-rule-catalog.ts` with:

```ts
const problems = validateRuleCatalog({
  ...catalog,
  rules: [{ ...catalog.rules[0]!, id: '' }],
});
assert('rejects blank IDs', problems.some((problem) => problem.includes('rules[0].id')));
```

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
cd tools && npx tsx tests/test-rule-catalog.ts
```

Expected: TypeScript fails because `validateRuleCatalog` is not exported.

- [x] **Step 3: Add schema and validation**

Create `AI-CONTRIBUTOR-RULE-CATALOG.schema.json` with a draft 2020-12 object
schema requiring the top-level catalog fields and every rule field.

Add `validateRuleCatalog(catalog: RuleCatalog): string[]` and CLI behavior:

```ts
if (process.argv.includes('--check')) {
  if (rendered !== current) {
    console.error(`${CATALOG} is stale. Run 'npm --prefix tools run generate:rule-catalog'.`);
    process.exit(1);
  }
  console.log(`OK — ${CATALOG} is current`);
  return;
}
```

- [x] **Step 4: Run test and generator**

Run:

```sh
cd tools && npx tsx tests/test-rule-catalog.ts
cd .. && tsx tools/spec-authoring/generate-rule-catalog.ts
cd tools && npx tsx ../tools/spec-authoring/generate-rule-catalog.ts --check
```

Expected: test passes, catalog is generated, and `--check` reports current.

- [x] **Step 5: Commit**

Run:

```sh
git add AI-CONTRIBUTOR-RULE-CATALOG.schema.json AI-CONTRIBUTOR-RULE-CATALOG.json tools/spec-authoring/generate-rule-catalog.ts tools/tests/test-rule-catalog.ts
git commit -m "feat: generate AI Contributor rule catalog" \
  -m "Co-Authored-By: OpenAI Codex (GPT-5) <noreply@openai.com>"
```

### Task 4: Package And Tooling Wiring

**Files:**

- Modify: `tools/package.json`
- Modify: `TOOLING.md`

- [x] **Step 1: Add failing package-script expectation**

Run:

```sh
npm --prefix tools run check:rule-catalog
```

Expected: npm reports a missing script.

- [x] **Step 2: Add scripts**

Modify `tools/package.json`:

```json
"check:rule-catalog": "cd .. && tsx tools/spec-authoring/generate-rule-catalog.ts --check",
"generate:rule-catalog": "cd .. && tsx tools/spec-authoring/generate-rule-catalog.ts",
"test:rule-catalog": "tsx tests/test-rule-catalog.ts"
```

Also add `npm run check:rule-catalog` and `npm run test:rule-catalog` to the
aggregate `check` script.

- [x] **Step 3: Document the check command**

Add a `TOOLING.md` command-table row:

```md
| `npm --prefix tools run check:rule-catalog` | Verify the generated rule catalog is current with the specification, checklist, and collector registry. |
```

- [x] **Step 4: Run targeted checks**

Run:

```sh
npm --prefix tools run check:rule-catalog
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:tooling-command-coverage
npm --prefix tools run check:test-shards-in-check
```

Expected: all four commands pass.

- [x] **Step 5: Commit**

Run:

```sh
git add tools/package.json TOOLING.md
git commit -m "chore(tools): wire rule catalog checks" \
  -m "Co-Authored-By: OpenAI Codex (GPT-5) <noreply@openai.com>"
```

### Task 5: Final Verification

**Files:**

- Verify all modified files.

- [x] **Step 1: Run focused test suite**

Run:

```sh
npm --prefix tools run test:spec-model
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:rule-catalog
```

Expected: all pass.

- [x] **Step 2: Run aggregate local check**

Run:

```sh
npm --prefix tools run check
```

Expected: aggregate check passes.

- [x] **Step 3: Inspect branch**

Run:

```sh
git status --short
git log --oneline --decorate --max-count=6
```

Expected: working tree is clean except any intentionally uncommitted final
verification output; branch is `issue-4-rule-catalog`; no push has happened.

### Task 6: Coverage Reads Rule Catalog

**Files:**

- Modify: `tools/spec-authoring/generate-rule-catalog.ts`
- Modify: `tools/spec-authoring/generate-coverage.ts`
- Modify: `tools/tests/test-rule-catalog.ts`
- Modify: `AI-CONTRIBUTOR-RULE-CATALOG.schema.json`
- Regenerate: `AI-CONTRIBUTOR-RULE-CATALOG.json`

- [x] **Step 1: Write the failing test**

Add assertions to `tools/tests/test-rule-catalog.ts` that call
`coverageRowsFromCatalog` with a catalog containing two `AIC-*` IDs mapped to
the same checklist row. The expected coverage row count is one for that grouped
row, and a `MUST when applicable` checklist scope is normalized to `MwA`.

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: TypeScript fails because `coverageRowsFromCatalog` is not exported.

- [x] **Step 3: Add checklist scope to catalog**

Extend generated catalog entries so `checklist` contains:

```ts
{
  rule: string;
  scope: SpecScope;
  requirement: string;
}
```

Update the schema and generated catalog accordingly.

- [x] **Step 4: Refactor coverage generation**

Export `coverageRowsFromCatalog` from `tools/spec-authoring/generate-coverage.ts`.
The CLI should read `AI-CONTRIBUTOR-RULE-CATALOG.json`, validate it through the
catalog validator, deduplicate by checklist row identity, then generate the same
coverage blocks as before.

- [x] **Step 5: Run targeted verification**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run generate:rule-catalog
npm --prefix tools run check:rule-catalog
npm --prefix tools run check:coverage
```

Expected: all commands pass and `AI-CONTRIBUTOR-COVERAGE.md` has no diff.

- [x] **Step 6: Commit or amend**

Keep this branch local and preserve the squashed one-commit shape before
handoff.

### Task 7: Collector Row Coverage Reads Rule Catalog

**Files:**

- Modify: `tools/spec-authoring/generate-rule-catalog.ts`
- Modify: `tools/spec-authoring/check-collector-row-coverage.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Write the failing test**

Add assertions to `tools/tests/test-rule-catalog.ts` for a
`collectorAicIdsFromCatalog` helper. The fixture should include one
collector-backed rule and one manual rule; the helper must return only the
collector-backed mapping.

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: TypeScript fails because `collectorAicIdsFromCatalog` is not
exported.

- [x] **Step 3: Implement detector mapping helper**

Export `collectorAicIdsFromCatalog(catalog: RuleCatalog): Record<string,
string[]>` from `generate-rule-catalog.ts`. It must read each
`collector-rule` detector and return sorted detector ID → AIC ID arrays.

- [x] **Step 4: Refactor collector row coverage check**

Update `tools/spec-authoring/check-collector-row-coverage.ts` to read
`AI-CONTRIBUTOR-RULE-CATALOG.json`, validate it, and derive its collector map
from `collectorAicIdsFromCatalog`. Remove the regex parser for
`collector-registry.ts`.

- [x] **Step 5: Run targeted verification**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:rule-catalog
npm --prefix tools run check:collector-row-coverage
```

Expected: all commands pass.

- [x] **Step 6: Amend and verify**

Amend the single local branch commit, rerun the aggregate check, and keep the
branch unpushed.

### Task 8: Row Scope Check Reads Rule Catalog

**Files:**

- Modify: `tools/spec-authoring/check-row-scope-vs-spec.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Write the failing test**

Add assertions to `tools/tests/test-rule-catalog.ts` for a
`rowScopeProblemsFromCatalog` helper. The fixture should include a documented
`MUST` → `MUST when applicable` exception and a mismatched row scope.

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: TypeScript fails because `rowScopeProblemsFromCatalog` is not
exported.

- [x] **Step 3: Refactor row scope check**

Update `tools/spec-authoring/check-row-scope-vs-spec.ts` to read
`AI-CONTRIBUTOR-RULE-CATALOG.json`, validate it, and compare catalog entry
scope metadata instead of independently parsing the spec and checklist.

- [x] **Step 4: Run targeted verification**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:row-scope-vs-spec
npm --prefix tools run check:rule-catalog
```

Expected: all commands pass.

- [x] **Step 5: Amend and verify**

Amend the single local branch commit, rerun the aggregate check, and keep the
branch unpushed.

### Task 9: Collector Row Coverage Groups From Rule Catalog

**Files:**

- Modify: `tools/spec-authoring/check-collector-row-coverage.ts`
- Modify: `tools/tests/test-rule-catalog.ts`

- [x] **Step 1: Write the failing test**

Add assertions to `tools/tests/test-rule-catalog.ts` for a
`collectorRowCoverageProblemsFromCatalog` helper. The fixture should include a
multi-ID checklist row with full collector coverage and a row with partial
collector coverage.

- [x] **Step 2: Run test to verify it fails**

Run:

```sh
npm --prefix tools run test:rule-catalog
```

Expected: TypeScript fails because `collectorRowCoverageProblemsFromCatalog`
is not exported.

- [x] **Step 3: Refactor collector row coverage grouping**

Update `tools/spec-authoring/check-collector-row-coverage.ts` so the check
groups checklist rows from `AI-CONTRIBUTOR-RULE-CATALOG.json` entries instead
of reparsing `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`.

- [x] **Step 4: Run targeted verification**

Run:

```sh
npm --prefix tools run test:rule-catalog
npm --prefix tools run check:collector-row-coverage
npm --prefix tools run check:rule-catalog
npm --prefix tools run typecheck
```

Expected: all commands pass.

- [x] **Step 5: Amend and verify**

Amend the single local branch commit, rerun the aggregate check, and keep the
branch unpushed.

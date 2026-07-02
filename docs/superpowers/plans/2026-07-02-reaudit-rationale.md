# Re-audit Status-Change Rationale Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a re-audit changes an auditor-owned checklist row's status, `audit-validate.ts` fails unless the row's Comment carries a `Changed from <old> to <new> because <reason>` rationale with a current-run citation (issue #9).

**Architecture:** A new pure check module `validator-reaudit-diff.ts` diffs the current checklist rows against a previous checklist supplied via a new `--previous <path>` validator flag. `audit-run.ts` extracts the previous committed checklist from git `HEAD` and passes the flag; the validator itself stays git-free. Ships as non-normative tooling — no catalog/spec change.

**Tech Stack:** TypeScript run via `tsx`, Node built-ins only in audit scripts, repo's bespoke test harnesses under `tools/tests/` (plain scripts, `OK`/`FAIL` lines, non-zero exit on failure).

**Design spec:** `docs/superpowers/specs/2026-07-02-reaudit-rationale-design.md` (committed on this branch).

## Global Constraints

- Work on branch `feat/reaudit-rationale-9` (already created; spec doc is its first commit).
- Audit scripts (`skills/ai-contributor-audit/scripts/**`) may import only `node:*` builtins and shipped sibling modules — no new dependencies.
- New validator error codes are `AUDIT070` (changed status, no rationale), `AUDIT071` (rationale without backtick citation), `AUDIT072` (previous checklist unreadable/unparseable). All are hard failures (exit 1); `--lenient` does NOT skip them.
- `VALIDATOR_VERSION` bumps `0.1.0` → `0.2.0` in BOTH `audit-validate.ts` and `audit-stamp.ts` (the stamper writes the value the validator later compares — they must match). `COLLECTOR_VERSION` stays `0.1.0`.
- No catalog (`AI-CONTRIBUTOR-RULE-CATALOG.json`), `specVersion`, or `schemaVersion` changes. No rule IDs added or renamed.
- Pre-commit runs lint-staged (eslint + prettier for `.ts`, markdownlint for `.md`); commits fail if these fail. Markdown code fences need a language tag.
- Test commands run with `npm --prefix tools run <script>` from the repo root.
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `validator-reaudit-diff.ts` check module with unit tests

**Files:**
- Create: `skills/ai-contributor-audit/scripts/internal/validator-reaudit-diff.ts`
- Modify: `tools/tests/test-validator-units.ts` (append test block at end, before the final exit-code lines)

**Interfaces:**
- Consumes: `parseChecklistRules`, `ChecklistRow` from `./audit-markdown.ts`; `AUTO_STAMP_PREFIX` from `./audit-evidence.ts`; `ProblemReporter` from `./validator-types.ts` (all existing).
- Produces: `checkReauditDiff(current: ChecklistRow[], previousLines: string[], previousPath: string, checklistPath: string, fail: ProblemReporter): void` and `isMechanicallyStamped(comment: string): boolean` — Task 2 wires `checkReauditDiff` into `audit-validate.ts`.

- [ ] **Step 1: Write the failing unit tests**

Append to `tools/tests/test-validator-units.ts`, just before the final `if (failed > 0) process.exit(1);` (or equivalent trailer — keep the trailer last). Add the two imports next to the existing import block at the top of the file:

```ts
import {
  checkReauditDiff,
  isMechanicallyStamped,
} from '../../skills/ai-contributor-audit/scripts/internal/validator-reaudit-diff.ts';
import { AUTO_STAMP_PREFIX } from '../../skills/ai-contributor-audit/scripts/internal/audit-evidence.ts';
import { parseChecklistRules } from '../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';
```

(If `parseChecklistRules` or `AUTO_STAMP_PREFIX` is already imported in this file, merge into the existing import instead of duplicating.)

Then append the test block:

```ts
// --------------------------------------------------------------------------
// checkReauditDiff (validator-reaudit-diff.ts)

function reauditChecklistLines(
  rows: Array<{ scope: string; rule: string; status: string; comment: string; ids: string }>,
): string[] {
  const lines = [
    '## Level 4 — AI Autonomous',
    '',
    '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |',
    '| ----- | ---- | - | ------ | ------- | ----------- | ------ | --- |',
  ];
  for (const r of rows) {
    lines.push(
      `| \`${r.scope}\` | \`${r.rule}\` | - | ${r.status} | ${r.comment} | Req. | 6 | \`${r.ids}\` |`,
    );
  }
  return lines;
}

function runReauditDiff(
  currentRows: Array<{ scope: string; rule: string; status: string; comment: string; ids: string }>,
  previousRows: Array<{ scope: string; rule: string; status: string; comment: string; ids: string }>,
): string[] {
  const codes: string[] = [];
  const collect: ProblemReporter = (code) => {
    codes.push(code);
  };
  const current = parseChecklistRules(reauditChecklistLines(currentRows));
  checkReauditDiff(current, reauditChecklistLines(previousRows), 'PREV.md', 'CHECKLIST.md', collect);
  return codes;
}

{
  const codes = runReauditDiff(
    [
      {
        scope: 'SHOULD',
        rule: 'Mock Mode',
        status: '⚠️ Warning',
        comment: '`README.md:42` — no mock-mode instructions',
        ids: 'AIC-mock-mode-fallback',
      },
    ],
    [
      {
        scope: 'SHOULD',
        rule: 'Mock Mode',
        status: '✅ Fulfilled',
        comment: '`README.md:40` documents mock mode',
        ids: 'AIC-mock-mode-fallback',
      },
    ],
  );
  if (codes.length === 1 && codes[0] === 'AUDIT070') {
    ok('checkReauditDiff: changed status without rationale -> AUDIT070');
  } else {
    bad('checkReauditDiff changed-without-rationale', `codes=${codes.join(',')}`);
  }
}

{
  const codes = runReauditDiff(
    [
      {
        scope: 'SHOULD',
        rule: 'Mock Mode',
        status: '✅ Fulfilled',
        comment:
          'Changed from ⚠️ Warning to ✅ Fulfilled because `README.md:42` now documents mock mode',
        ids: 'AIC-mock-mode-fallback',
      },
    ],
    [
      {
        scope: 'SHOULD',
        rule: 'Mock Mode',
        status: '⚠️ Warning',
        comment: '`README.md:42` — no mock-mode instructions',
        ids: 'AIC-mock-mode-fallback',
      },
    ],
  );
  if (codes.length === 0) {
    ok('checkReauditDiff: rationale with citation -> no problems');
  } else {
    bad('checkReauditDiff rationale-ok', `codes=${codes.join(',')}`);
  }
}

{
  const codes = runReauditDiff(
    [
      {
        scope: 'SHOULD',
        rule: 'Mock Mode',
        status: '✅ Fulfilled',
        comment: 'Changed from ⚠️ Warning to ✅ Fulfilled because the readme documents it now',
        ids: 'AIC-mock-mode-fallback',
      },
    ],
    [
      {
        scope: 'SHOULD',
        rule: 'Mock Mode',
        status: '⚠️ Warning',
        comment: '`README.md:42` — no mock-mode instructions',
        ids: 'AIC-mock-mode-fallback',
      },
    ],
  );
  if (codes.length === 1 && codes[0] === 'AUDIT071') {
    ok('checkReauditDiff: rationale without citation -> AUDIT071');
  } else {
    bad('checkReauditDiff rationale-no-citation', `codes=${codes.join(',')}`);
  }
}

{
  const codes = runReauditDiff(
    [
      {
        scope: 'MUST',
        rule: 'Branch Protection',
        status: '⚠️ Warning',
        comment: `${AUTO_STAMP_PREFIX} (rule: branch-protection). protection disabled`,
        ids: 'AIC-default-branch-protected',
      },
      {
        scope: 'SHOULD',
        rule: 'SBOM',
        status: '➖ Not relevant',
        comment:
          'Owner profile: `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` answers "no" to "Ships artifacts?", so this check is not applicable. Profile evidence: none provided.',
        ids: 'AIC-sbom-generation',
      },
    ],
    [
      {
        scope: 'MUST',
        rule: 'Branch Protection',
        status: '✅ Fulfilled',
        comment: `${AUTO_STAMP_PREFIX} (rule: branch-protection). protection enabled`,
        ids: 'AIC-default-branch-protected',
      },
      {
        scope: 'SHOULD',
        rule: 'SBOM',
        status: '⚠️ Warning',
        comment: '`docs/release.md:3` — SBOM missing',
        ids: 'AIC-sbom-generation',
      },
    ],
  );
  if (codes.length === 0) {
    ok('checkReauditDiff: mechanical and owner-profile rows exempt');
  } else {
    bad('checkReauditDiff mechanical-exempt', `codes=${codes.join(',')}`);
  }
}

{
  const codes = runReauditDiff(
    [
      {
        scope: 'SHOULD',
        rule: 'New Row',
        status: '⚠️ Warning',
        comment: '`src/a.ts:1` — new finding',
        ids: 'AIC-new-row',
      },
      {
        scope: 'SHOULD',
        rule: 'Was Blank',
        status: '✅ Fulfilled',
        comment: '`src/b.ts:1` evidence',
        ids: 'AIC-was-blank',
      },
    ],
    [
      {
        scope: 'SHOULD',
        rule: 'Removed Row',
        status: '✅ Fulfilled',
        comment: '`docs/x.md` evidence',
        ids: 'AIC-removed-row',
      },
      { scope: 'SHOULD', rule: 'Was Blank', status: '', comment: '', ids: 'AIC-was-blank' },
    ],
  );
  if (codes.length === 0) {
    ok('checkReauditDiff: unmatched rows and blank previous status ignored');
  } else {
    bad('checkReauditDiff unmatched-ignored', `codes=${codes.join(',')}`);
  }
}

{
  const codes: string[] = [];
  const collect: ProblemReporter = (code) => {
    codes.push(code);
  };
  checkReauditDiff([], ['# not a checklist', 'no table here'], 'PREV.md', 'CHECKLIST.md', collect);
  if (codes.length === 1 && codes[0] === 'AUDIT072') {
    ok('checkReauditDiff: previous file with no rows -> AUDIT072');
  } else {
    bad('checkReauditDiff unparseable-previous', `codes=${codes.join(',')}`);
  }
}

{
  if (
    isMechanicallyStamped(`${AUTO_STAMP_PREFIX} (rule: x). y`) &&
    isMechanicallyStamped('Owner profile: `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` answers "no"') &&
    !isMechanicallyStamped('`README.md:42` — manual evidence')
  ) {
    ok('isMechanicallyStamped: prefixes detected, manual comment not');
  } else {
    bad('isMechanicallyStamped');
  }
}
```

Note: `ok`, `bad`, and the `ProblemReporter` type import already exist in this file — reuse them.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix tools run test:validator-units`
Expected: FAILS to even start — `Cannot find module ... validator-reaudit-diff.ts` (import error). That is the expected red state.

- [ ] **Step 3: Implement the module**

Create `skills/ai-contributor-audit/scripts/internal/validator-reaudit-diff.ts`:

```ts
// SPDX-License-Identifier: Apache-2.0
//
// Re-audit diff check for audit-validate.ts: when the previous committed
// checklist is supplied via --previous, auditor-owned rows whose Status
// changed since that audit must carry a change rationale citing
// current-run evidence. Mechanically stamped rows (collector-derived or
// owner-profile stamps) are exempt — their provenance already explains
// the change. Error codes AUDIT070..072.

import { AUTO_STAMP_PREFIX } from './audit-evidence.ts';
import { parseChecklistRules, type ChecklistRow } from './audit-markdown.ts';
import type { ProblemReporter } from './validator-types.ts';

// Leading token of comments written by ownerProfileComment() in
// audit-evidence.ts.
const OWNER_PROFILE_STAMP_PREFIX = 'Owner profile: ';

export function isMechanicallyStamped(comment: string): boolean {
  return comment.startsWith(AUTO_STAMP_PREFIX) || comment.startsWith(OWNER_PROFILE_STAMP_PREFIX);
}

export function changeRationaleFragment(prevStatus: string, currStatus: string): string {
  return `Changed from ${prevStatus} to ${currStatus} because `;
}

export function checkReauditDiff(
  current: ChecklistRow[],
  previousLines: string[],
  previousPath: string,
  checklistPath: string,
  fail: ProblemReporter,
): void {
  const previous = parseChecklistRules(previousLines);
  if (previous.length === 0) {
    fail(
      'AUDIT072',
      previousPath,
      undefined,
      'previous checklist parsed no rule rows — --previous must point at the previously committed AI-CONTRIBUTOR-CHECKLIST.md',
    );
    return;
  }

  const prevByKey = new Map<string, ChecklistRow[]>();
  for (const r of previous) {
    const list = prevByKey.get(rowKey(r));
    if (list) list.push(r);
    else prevByKey.set(rowKey(r), [r]);
  }

  for (const row of current) {
    const candidates = prevByKey.get(rowKey(row));
    if (!candidates) continue; // row not present in the previous audit
    const prev = candidates.find((c) => c.ids.join(',') === row.ids.join(',')) ?? candidates[0];
    if (prev.status === '') continue; // unfinished previous audit row
    if (row.status === '') continue; // blank current status is AUDIT015's job
    if (row.status === prev.status) continue;
    if (isMechanicallyStamped(row.comment)) continue;

    const fragment = changeRationaleFragment(prev.status, row.status);
    if (!row.comment.includes(fragment)) {
      fail(
        'AUDIT070',
        checklistPath,
        row.line,
        `row "${row.rule}": status changed from "${prev.status}" to "${row.status}" since the previous committed audit; ` +
          `Comment must include "${fragment}<reason citing current-run evidence>"`,
      );
      continue;
    }
    if (!/`[^`]+`/.test(row.comment)) {
      fail(
        'AUDIT071',
        checklistPath,
        row.line,
        `row "${row.rule}": change rationale must cite current-run evidence in backticks`,
      );
    }
  }
}

// Rows are joined by scope + rule name (the rendered row identity); when
// duplicate names exist, prefer the candidate with the identical AIC ID set.
function rowKey(r: ChecklistRow): string {
  return `${r.scope}|${r.rule}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix tools run test:validator-units`
Expected: all `OK` lines including the 7 new `checkReauditDiff`/`isMechanicallyStamped` cases; exit 0.

Also run: `npm --prefix tools run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add skills/ai-contributor-audit/scripts/internal/validator-reaudit-diff.ts tools/tests/test-validator-units.ts
git commit -m "feat(audit): add re-audit status-change rationale check module

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire `--previous` into `audit-validate.ts` + fixture tests

**Files:**
- Modify: `skills/ai-contributor-audit/scripts/audit-validate.ts` (flag parsing ~line 280-312, check invocation ~line 350-356, header comment ~line 22-43, usage string ~line 300-303)
- Create: `tools/test-fixtures/audit-validate/reaudit-valid/` (3 files)
- Create: `tools/test-fixtures/audit-validate/reaudit-changed-without-rationale/` (3 files)
- Create: `tools/test-fixtures/audit-validate/reaudit-rationale-without-citation/` (3 files)
- Modify: `tools/tests/test-audit-validate.ts` (Case interface + CASES + arg loop)
- Modify: `tools/tests/test-audit-validate-cli.ts` (one new case)

**Interfaces:**
- Consumes: `checkReauditDiff(current, previousLines, previousPath, checklistPath, fail)` from Task 1.
- Produces: `runValidator` accepts `--previous <path>`; exit 2 with `--previous requires a path argument` when the value is missing.

- [ ] **Step 1: Create the fixtures**

Each fixture dir contains `AI-CONTRIBUTOR-CHECKLIST.md` and `AI-CONTRIBUTOR-AUDIT-LOG.md` copied from `tools/test-fixtures/audit-validate/valid/`, plus a `PREVIOUS-CHECKLIST.md`. Build them with:

```bash
cd tools/test-fixtures/audit-validate
for d in reaudit-valid reaudit-changed-without-rationale reaudit-rationale-without-citation; do
  mkdir -p "$d"
  cp valid/AI-CONTRIBUTOR-CHECKLIST.md valid/AI-CONTRIBUTOR-AUDIT-LOG.md "$d/"
  cp valid/AI-CONTRIBUTOR-CHECKLIST.md "$d/PREVIOUS-CHECKLIST.md"
done
```

Then edit (the `Mock Mode` row lives in the `## Level 4 — AI Autonomous` table; its `valid` form is status `⚠️ Warning`, comment `` `README.md:42` — no mock-mode instructions; deferred ``):

**All three `PREVIOUS-CHECKLIST.md` files** — change the `Mock Mode` row's Status to `✅ Fulfilled` and its Comment to `` `README.md:40` documents mock mode ``. In `reaudit-valid/PREVIOUS-CHECKLIST.md` only, additionally add one row to the Level 4 table that does not exist in the current checklist (tests the unmatched-row skip):

```text
| `SHOULD` | `Removed Row` | -   | ✅ Fulfilled | `docs/old.md` evidence | A requirement that no longer exists. | 6 | `AIC-removed-row` |
```

(Do not worry about column padding in `PREVIOUS-CHECKLIST.md` — it is parsed, never lint-checked as a rendered artifact. But keep the cell count at 8.)

**`reaudit-valid/AI-CONTRIBUTOR-CHECKLIST.md`** — change the `Mock Mode` row's Comment to:

```text
Changed from ✅ Fulfilled to ⚠️ Warning because `README.md:42` no longer documents a mock mode; deferred
```

(Status stays `⚠️ Warning`; the Backlog table row for Mock Mode stays as-is since the status did not change from `valid`.)

**`reaudit-changed-without-rationale/AI-CONTRIBUTOR-CHECKLIST.md`** — leave exactly as copied (comment has no rationale fragment → AUDIT070).

**`reaudit-rationale-without-citation/AI-CONTRIBUTOR-CHECKLIST.md`** — change the `Mock Mode` row's Comment to:

```text
Changed from ✅ Fulfilled to ⚠️ Warning because the mock mode section was removed; deferred
```

(No backticks and no `file:line` token → AUDIT071; AUDIT034 will also fire on this row, which is fine — the case asserts AUDIT071 is present, not that it is alone.)

- [ ] **Step 2: Add the failing test cases**

In `tools/tests/test-audit-validate.ts`, extend the `Case` interface:

```ts
interface Case {
  fixture: string;
  expectExit: 0 | 1;
  expectCodes?: string[];
  flags?: string[];
  previous?: string; // filename within the fixture dir passed via --previous
}
```

Append to `CASES`:

```ts
  { fixture: 'reaudit-valid', expectExit: 0, previous: 'PREVIOUS-CHECKLIST.md' },
  {
    fixture: 'reaudit-changed-without-rationale',
    expectExit: 1,
    expectCodes: ['AUDIT070'],
    previous: 'PREVIOUS-CHECKLIST.md',
  },
  {
    fixture: 'reaudit-rationale-without-citation',
    expectExit: 1,
    expectCodes: ['AUDIT071'],
    previous: 'PREVIOUS-CHECKLIST.md',
  },
  {
    fixture: 'valid',
    expectExit: 1,
    expectCodes: ['AUDIT072'],
    previous: 'MISSING-PREVIOUS.md',
  },
  {
    fixture: 'valid',
    expectExit: 1,
    expectCodes: ['AUDIT072'],
    previous: 'AI-CONTRIBUTOR-AUDIT-LOG.md',
  },
```

In the run loop, after `const args = [...]` add:

```ts
  if (c.previous) args.push('--previous', path.join(dir, c.previous));
```

In `tools/tests/test-audit-validate-cli.ts`, append next to the `--summary` cases:

```ts
// --previous requires a path argument.
{
  const r = runValidator(['--previous']);
  if (r.exitCode === 2 && /previous requires a path/.test(r.stderr)) {
    ok('runValidator: --previous with no value -> exit 2');
  } else {
    bad('runValidator --previous no value', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm --prefix tools run test:audit-validate && npm --prefix tools run test:audit-validate-cli`
Expected: the five new fixture cases FAIL (`--previous` is currently an unknown flag collected into `FLAGS` and ignored, so `reaudit-valid` passes but the failure cases exit 0 instead of 1); the CLI case FAILS (exit 0/1 instead of 2).

- [ ] **Step 4: Implement `--previous` in `audit-validate.ts`**

Four edits:

(a) Header comment — extend the usage lines (~line 22-24) to:

```text
// Usage:
//   tsx audit-validate.ts <checklist.md> <audit-log.md>
//                         [--previous <path>] [--template] [--lenient]
```

and add to the error-code table (~line 43, after `AUDIT060..069`):

```text
//   AUDIT070..079  re-audit status-change rationale (--previous)
```

(b) Import the new module alongside the other `./internal/` imports:

```ts
import { checkReauditDiff } from './internal/validator-reaudit-diff.ts';
```

(c) Flag parsing — inside the `for` loop over `argv` in `runValidator`, add a branch mirroring `--summary`, and declare `let previousOverride: string | null = null;` next to `let summaryOverride`:

```ts
    } else if (a === '--previous') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--previous requires a path argument');
        return finish(2);
      }
      previousOverride = v;
      i++;
    } else if (a.startsWith('--')) {
```

Also update the usage string in the `POSITIONAL.length !== 2` branch to:

```ts
    stderrBuf.push(
      'Usage: audit-validate.ts <checklist.md> <audit-log.md> [--summary <path>] [--previous <path>] [--template] [--lenient]',
    );
```

(d) Read + invoke — after the three `readLinesOrNull` blocks (which return `finish(2)` for the main files), read the previous checklist non-fatally:

```ts
  let previousLines: string[] | null = null;
  if (previousOverride !== null) {
    try {
      previousLines = fs.readFileSync(previousOverride, 'utf8').split(/\r?\n/);
    } catch (e) {
      fail(
        'AUDIT072',
        previousOverride,
        undefined,
        `cannot read previous checklist: ${(e as Error).message}`,
      );
    }
  }
```

and after the `checkTokenDisclosure(...)` call add:

```ts
  if (!TEMPLATE_MODE && previousLines !== null) {
    checkReauditDiff(rules, previousLines, previousOverride!, CHECKLIST_PATH, fail);
  }
```

(Template mode skips the check: the blank template diffs meaninglessly against a filled previous audit. A missing `--previous` skips it entirely — first audits and direct invocations behave exactly as today.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix tools run test:audit-validate && npm --prefix tools run test:audit-validate-cli && npm --prefix tools run typecheck`
Expected: all cases `OK`, exit 0, clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add skills/ai-contributor-audit/scripts/audit-validate.ts tools/tests/test-audit-validate.ts tools/tests/test-audit-validate-cli.ts tools/test-fixtures/audit-validate/reaudit-valid tools/test-fixtures/audit-validate/reaudit-changed-without-rationale tools/test-fixtures/audit-validate/reaudit-rationale-without-citation
git commit -m "feat(audit): validate re-audit status changes via --previous

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Bump `VALIDATOR_VERSION` to 0.2.0

**Files:**
- Modify: `skills/ai-contributor-audit/scripts/audit-validate.ts:79` (`VALIDATOR_VERSION`)
- Modify: `skills/ai-contributor-audit/scripts/audit-stamp.ts:83` (`VALIDATOR_VERSION`)
- Modify: every fixture under `tools/test-fixtures/` with `validator_version: "0.1.0"` frontmatter (checklists AND audit logs), EXCEPT `validator-version-mismatch/` which must keep its deliberately wrong `"0.0.1-mismatch"`.

**Interfaces:**
- Consumes: nothing new.
- Produces: stamper writes and validator expects `validator_version: "0.2.0"`. Validator behaviour changed (new check), which is exactly what this constant exists to record.

- [ ] **Step 1: Bump the two constants**

In `skills/ai-contributor-audit/scripts/audit-validate.ts`:

```ts
export const VALIDATOR_VERSION = '0.2.0';
```

In `skills/ai-contributor-audit/scripts/audit-stamp.ts`:

```ts
export const VALIDATOR_VERSION = '0.2.0';
```

Do NOT touch either file's `COLLECTOR_VERSION` (stays `0.1.0`).

- [ ] **Step 2: Run the validator tests to see the expected breakage**

Run: `npm --prefix tools run test:audit-validate`
Expected: FAIL — every fixture now trips AUDIT018 (`validator_version` frontmatter `"0.1.0"` ≠ runtime `0.2.0`). This confirms the version gate works.

- [ ] **Step 3: Update fixture frontmatter**

```bash
grep -rl 'validator_version: "0.1.0"' tools/test-fixtures | xargs sed -i 's/validator_version: "0.1.0"/validator_version: "0.2.0"/'
```

Then verify the mismatch fixture kept its wrong value:

```bash
grep -rn 'validator_version' tools/test-fixtures/audit-validate/validator-version-mismatch/
```

Expected: both files still say `"0.0.1-mismatch"`.

Also sweep the test scripts for a hardcoded old version:

```bash
grep -rn "'0\.1\.0'\|\"0\.1\.0\"" tools/tests/*.ts
```

Expected matches, if any, are `COLLECTOR_VERSION`-related and stay. If a test hardcodes the validator version instead of importing `VALIDATOR_VERSION`, update it to import the constant.

- [ ] **Step 4: Run the audit test suite**

Run: `npm --prefix tools run test:audit-all`
Expected: exit 0. (This shard includes validate, stamp, run, collect, units, and the golden audit — the golden audit pins collector-derived statuses only and is unaffected.)

- [ ] **Step 5: Commit**

```bash
git add skills/ai-contributor-audit/scripts/audit-validate.ts skills/ai-contributor-audit/scripts/audit-stamp.ts tools/test-fixtures
git commit -m "feat(audit): bump VALIDATOR_VERSION to 0.2.0 for re-audit diff check

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `audit-run.ts` extracts the previous committed checklist

**Files:**
- Modify: `skills/ai-contributor-audit/scripts/audit-run.ts` (new import, new exported helper, wiring in `main()` ~line 100)
- Modify: `tools/tests/test-audit-run-helpers.ts` (append test block)

**Interfaces:**
- Consumes: `runValidator --previous <path>` from Task 2 (only via CLI args, no import).
- Produces: `extractPreviousChecklist(target: string, checklistPath: string): string | null` — exported from `audit-run.ts`; returns a temp-file path containing the `HEAD` version of the checklist, or `null` when the file is untracked at `HEAD`, outside the target, or git cannot answer.

- [ ] **Step 1: Write the failing test**

Append to `tools/tests/test-audit-run-helpers.ts` (reuse the file's existing assert/ok/fail helpers and its imports of `fs`, `os`, `path`, `spawnSync` — add any of those imports that are missing; import `extractPreviousChecklist` alongside the other `audit-run.ts` helper imports):

```ts
// --------------------------------------------------------------------------
// extractPreviousChecklist

{
  const gitEnv = ['-c', 'user.name=T', '-c', 'user.email=t@example.invalid'];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-previous-'));
  try {
    const auditDir = path.join(tmp, '.ai-contributor-audit');
    fs.mkdirSync(auditDir, { recursive: true });
    const checklist = path.join(auditDir, 'AI-CONTRIBUTOR-CHECKLIST.md');
    fs.writeFileSync(checklist, '# previous audit v1\n');
    spawnSync('git', ['-C', tmp, 'init', '-b', 'main'], { encoding: 'utf8' });
    spawnSync('git', ['-C', tmp, 'add', '.'], { encoding: 'utf8' });
    spawnSync('git', ['-C', tmp, ...gitEnv, 'commit', '-m', 'init'], { encoding: 'utf8' });
    fs.writeFileSync(checklist, '# current working tree v2\n');

    const extracted = extractPreviousChecklist(tmp, checklist);
    assert(
      'extractPreviousChecklist returns HEAD content for tracked checklist',
      extracted !== null && fs.readFileSync(extracted, 'utf8') === '# previous audit v1\n',
      `extracted=${extracted}`,
    );

    const untracked = path.join(auditDir, 'UNTRACKED.md');
    fs.writeFileSync(untracked, 'x\n');
    assert(
      'extractPreviousChecklist returns null for untracked file',
      extractPreviousChecklist(tmp, untracked) === null,
    );

    assert(
      'extractPreviousChecklist returns null for path outside target',
      extractPreviousChecklist(tmp, path.join(os.tmpdir(), 'outside-checklist.md')) === null,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
```

(Adapt the assertion helper name/signature to what `test-audit-run-helpers.ts` already defines — it follows the same `OK`/`FAIL` counter pattern as the other test files. Do not introduce a second counter.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix tools run test:audit-run-helpers`
Expected: FAIL — `extractPreviousChecklist` is not exported yet (import error).

- [ ] **Step 3: Implement the helper and wire it into `main()`**

In `skills/ai-contributor-audit/scripts/audit-run.ts`:

(a) Add `import os from 'node:os';` next to the existing `node:fs` / `node:path` imports.

(b) Add the exported helper near `gitWorktreeState` (the other exported git helper):

```ts
// Extracts the previous committed checklist (the HEAD version) to a temp
// file so audit-validate.ts can require re-audit status-change rationales
// without running git itself. Returns null when the checklist is outside
// the target, not tracked at HEAD (first audit), or git cannot answer —
// the validator then skips the re-audit diff check.
export function extractPreviousChecklist(target: string, checklistPath: string): string | null {
  const rel = path.relative(target, checklistPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  // "HEAD:./<path>" resolves relative to the git cwd (the -C target).
  const gitPath = `HEAD:./${rel.split(path.sep).join('/')}`;
  const r = spawnSync('git', ['-C', target, 'show', gitPath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return null;
  const content = (r.stdout ?? '').toString();
  if (content.length === 0) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-previous-'));
  const out = path.join(dir, 'AI-CONTRIBUTOR-CHECKLIST.md');
  fs.writeFileSync(out, content);
  return out;
}
```

(c) In `main()`, directly after the two lines that build `validateArgs` (`const validateArgs = [VALIDATE, opts.checklist, opts.auditLog]; if (opts.lenient) ...`), add:

```ts
  const previousChecklist = extractPreviousChecklist(opts.target, opts.checklist);
  if (previousChecklist) validateArgs.push('--previous', previousChecklist);
```

(Extraction happens before the collect step on purpose: it snapshots `HEAD` at run start, and the pause-message that echoes the validate command then shows the real flag.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm --prefix tools run test:audit-run-helpers && npm --prefix tools run test:audit-run && npm --prefix tools run typecheck`
Expected: all `OK`, exit 0, clean typecheck. (`test:audit-run` exercises `--reset-templates` flows in temp git repos and must stay green with the new wiring. Its fixtures never reach the validate step with a filled checklist whose statuses changed, and blank-status rows are ignored by the check, so no interference is expected. If a run test does fail with AUDIT070, it committed a filled checklist and then changed statuses without rationale — fix that test fixture's Comment, not the check.)

- [ ] **Step 5: Commit**

```bash
git add skills/ai-contributor-audit/scripts/audit-run.ts tools/tests/test-audit-run-helpers.ts
git commit -m "feat(audit): audit-run passes previous committed checklist to validator

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Documentation + changelog

**Files:**
- Modify: `skills/ai-contributor-audit/references/audit-protocol.md`
- Modify: `tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template` (Re-audit protocol numbered list, after step 6)
- Regenerate: `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` (via `npm --prefix tools run generate:audit-templates`)
- Modify: `skills/ai-contributor-audit/SKILL.md` (final-checks list, after the `<FILL_` placeholder item)
- Modify: `TOOLING.md` (~line 202, the `audit-validate.ts` description)
- Modify: `CHANGELOG.md` (new `## [Unreleased]` section after the intro prose, before `## [0.1.3]`)

**Interfaces:**
- Consumes: behavior implemented in Tasks 1-4 (documented, not imported).
- Produces: nothing code-facing.

- [ ] **Step 1: audit-protocol.md**

Find the validation part: `grep -n "audit-validate" skills/ai-contributor-audit/references/audit-protocol.md`. After the paragraph/section that describes what `audit-validate.ts` checks (and before the backlog-stamping paragraph currently around line 261), insert:

```markdown
### Re-audit status changes need a rationale

`audit-run.ts` extracts the previous committed checklist (`git show
HEAD:.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`) at the start of the
run and passes it to `audit-validate.ts` via `--previous`. When an
auditor-owned row's Status differs from that previous audit, the row's
Comment must contain a change rationale in the exact form
`Changed from <old status> to <new status> because <reason>`, and the
Comment must cite current-run evidence in backticks (`AUDIT070`,
`AUDIT071`). Collector-derived and owner-profile stamped rows are exempt —
their provenance already explains the change. The previous audit is still
not evidence: the rationale must cite evidence from the current run only.
On a first audit (checklist not tracked at `HEAD`) the check is skipped.
```

- [ ] **Step 2: Checklist template**

In `tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template`, the `## Re-audit protocol (start from scratch)` section has a numbered list ending at step 6 (**Spec source must be immutable.**). Append step 7:

```markdown
7. **Status changes from the previous committed audit need a rationale.** `audit-run.ts` diffs the filled checklist against the version committed at `HEAD` and validation fails (`AUDIT070`) when an auditor-owned row's Status changed without a Comment rationale in the form `Changed from <old status> to <new status> because <reason>`, citing current-run evidence in backticks. Collector-derived and owner-profile stamped rows are exempt.
```

Then regenerate the projection and confirm no drift:

```bash
npm --prefix tools run generate:audit-templates
npm --prefix tools run check:audit-templates
```

Expected: `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` gains the same step 7; check passes.

- [ ] **Step 3: SKILL.md**

In `skills/ai-contributor-audit/SKILL.md`, the pre-commit checks list (items around lines 212-213: "**Template-only blocks removed.**", "**Placeholder tokens replaced.**") gets a new item after the placeholder-token item (renumber later items if the list continues):

```markdown
3. **Status changes from the previous audit carry rationales.** When the target repository has a previously committed checklist, `audit-run.ts` passes it to the validator via `--previous`; any auditor-owned row whose Status changed must say `Changed from <old status> to <new status> because <reason>` in its Comment with a backticked current-run citation. The validator (`AUDIT070`/`AUDIT071`) fails otherwise; collector-derived and owner-profile stamped rows are exempt.
```

- [ ] **Step 4: TOOLING.md**

In the section around line 202 where `audit-validate.ts` is described ("checks artifact structure and cross-file..."), append one sentence:

```markdown
When `audit-run.ts` finds the checklist tracked at `HEAD`, it passes that
previous version to `audit-validate.ts` via `--previous`, and auditor-owned
status changes then require a change rationale (`AUDIT070`–`AUDIT072`).
```

- [ ] **Step 5: CHANGELOG.md**

Insert after the intro prose (after the "Every released entry lists the release date..." line) and before `## [0.1.3] — 2026-07-02`:

```markdown
## [Unreleased]

### Added

- Re-audits now require a change rationale on auditor-owned checklist rows
  whose status changed since the previous committed audit. `audit-run.ts`
  extracts the `HEAD` version of the checklist and passes it to
  `audit-validate.ts --previous`; validation fails with `AUDIT070` (missing
  rationale), `AUDIT071` (rationale without a current-run citation), or
  `AUDIT072` (unreadable previous checklist). Collector-derived and
  owner-profile stamped rows are exempt. Non-normative tooling change;
  `validator_version` is now `0.2.0`.
```

- [ ] **Step 6: Run the docs checks and full suite**

```bash
npm --prefix tools run check:docs
npm --prefix tools run check:catalog-assets
npm --prefix tools run check:audit-runtime
npm --prefix tools run test:audit-all
```

Expected: all pass. If `check:tooling-command-coverage` (inside `check:docs`) complains about the new flag, add the `--previous` flag to whatever TOOLING.md command table it points at, following the error message.

- [ ] **Step 7: Commit**

```bash
git add skills/ai-contributor-audit/references/audit-protocol.md tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md skills/ai-contributor-audit/SKILL.md TOOLING.md CHANGELOG.md
git commit -m "docs(audit): document re-audit status-change rationale check

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the repository's full check target**

```bash
npm --prefix tools run check:quality
npm --prefix tools run check:docs
npm --prefix tools run check:catalog-assets
npm --prefix tools run check:audit-runtime
npm --prefix tools run check:test-suite
```

Expected: all exit 0. (`check:test-suite` re-runs `test:audit-all` including the golden audit.)

- [ ] **Step 2: End-to-end smoke of the new path**

Verify the validator actually consumes `--previous` end to end against the shipped fixtures:

```bash
tsx skills/ai-contributor-audit/scripts/audit-validate.ts \
  tools/test-fixtures/audit-validate/reaudit-changed-without-rationale/AI-CONTRIBUTOR-CHECKLIST.md \
  tools/test-fixtures/audit-validate/reaudit-changed-without-rationale/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --summary tools/test-fixtures/audit-validate/reaudit-changed-without-rationale/AI-CONTRIBUTOR-CHECKLIST.md \
  --previous tools/test-fixtures/audit-validate/reaudit-changed-without-rationale/PREVIOUS-CHECKLIST.md
```

Expected: exit 1, stderr contains `AUDIT070` with the `Mock Mode` row and the exact required fragment in the message.

- [ ] **Step 3: Report done**

No commit. Summarize the branch's commits and hand back for PR creation (do not push or open a PR without the user's go-ahead).

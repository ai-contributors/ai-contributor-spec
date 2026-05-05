#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  commentHasDirectEvidence,
  parseChecklistRules,
  parseSummary,
  renderMarkdownTable,
  splitRow,
} from '../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';
import { parseChecklistRows } from '../spec-authoring/shared/checklist-parser.ts';

let failed = 0;

function assert(name: string, condition: boolean): void {
  if (condition) {
    console.log(`OK   ${name}`);
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
}

const checklistLines = [
  '## Level 2 — Reviewed',
  '',
  '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |',
  '|---|---|---|---|---|---|---:|---|',
  '| `MUST when applicable` | `Env Template` | x | ⚠️ Warning | command `grep "A\\|B" .env.example` and `config/env.ts:12` | keep env examples | 1 | `AIC-env-example-placeholders` |',
  '',
  '## Optional',
  '',
  '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |',
  '|---|---|---|---|---|---|---:|---|',
  '| `MAY` | `Nice Extra` | - |  | optional | add extras | 2 | `AIC-nice-extra` |',
];

const rules = parseChecklistRules(checklistLines);
assert('parses current checklist rows', rules.length === 2);
assert('keeps modern MUST when applicable spelling', rules[0]?.scope === 'MUST when applicable');
assert('parses escaped pipes inside code spans', rules[0]?.comment.includes('A|B') === true);
assert('parses modern IDs', rules[0]?.ids[0] === 'AIC-env-example-placeholders');
assert('parses Optional rows as dash level', rules[1]?.minLevel === '—');

const authoringRows = parseChecklistRows(checklistLines.join('\n'));
assert('authoring parser maps MUST when applicable to MwA', authoringRows[0]?.scope === 'MwA');

const summary = parseSummary([
  '## Conformance level summary',
  '',
  '| Level | Status | Date reached | Notes |',
  '|---|---|---|---|',
  '| Level 1 | ✅ Yes | 2025-01-01 | ok |',
  '| Level 2 | ⚠️ Partial |  | needs `AI-CONTRIBUTOR-EVIDENCE.json` |',
  '',
  '## Next',
]);
assert('parses summary rows', summary.length === 2 && summary[1]?.status === '⚠️ Partial');

const row = splitRow('| `grep "a\\|b"` | plain \\| pipe |');
assert(
  'splitRow preserves escaped table pipes',
  row[0] === '`grep "a|b"`' && row[1] === 'plain | pipe',
);

const rendered = renderMarkdownTable(['A', 'Status'], [['x', '✅ Fulfilled']]);
assert('renders markdown table separator', rendered[1] === '| --- | ------------ |');

assert(
  'direct evidence rejects command-like tokens',
  !commentHasDirectEvidence('Ran `npm test` successfully.'),
);
assert(
  'direct evidence accepts file-line citations',
  commentHasDirectEvidence('See `src/index.ts:12`.'),
);

if (failed > 0) {
  console.error(`${failed} audit-markdown assertion(s) failed`);
  process.exit(1);
}

console.log('All audit-markdown assertions passed');

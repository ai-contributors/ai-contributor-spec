#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  clauseDetails,
  clauseToPillar,
  levelDetails,
  levelLabels,
  normativeRuleMap,
  parseNormativeIds,
  parseNormativeRules,
  pillarDetails,
  pillarNames,
  specVersion,
  specIdMap,
  specScopeById,
  validMinLevels,
} from '../spec-authoring/shared/spec-model.ts';

let failed = 0;

function assert(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`OK   ${name}`);
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
  if (detail) console.error(detail);
}

const spec = [
  '# Spec',
  '',
  '> **Version:** 0.2 · **Owner:** Example',
  '',
  '## Pillars',
  '',
  '| # | Pillar | Clauses | Scope |',
  '|---:|---|---|---|',
  '| 1 | 🏗️ Foundation | §1–1 | setup |',
  '| 2 | 🧭 Oversight | §2–2 | review |',
  '',
  '## Specification clauses',
  '',
  '### Pillar 1 — Foundation',
  '',
  '#### 1. Setup',
  '',
  '##### `MUST`',
  '',
  '- Repositories MUST be clean. <sup>`AIC-clean-setup`</sup>',
  '- Repositories MUST document setup.',
  '',
  '##### `SHOULD`',
  '',
  '- Repositories SHOULD have helper docs. <sup>`AIC-helper-docs`</sup>',
  '',
  '### Pillar 2 — Oversight',
  '',
  '#### 2. Review',
  '',
  '##### `MUST when applicable`',
  '',
  '- Hosted repositories MUST protect branches. <sup>`AIC-branch-protection`</sup>',
  '',
  '## Conformance levels',
  '',
  '- **Level 0 — Baseline.** Basic hygiene.',
  '- **Level 1 — Hardened.** Stronger checks.',
].join('\n');

const parsed = parseNormativeIds(spec);
assert('parses tagged normative IDs', parsed.ids.length === 3);
assert('counts normative bullets', parsed.bullets === 4);
assert(
  'records untagged normative bullets',
  parsed.untagged[0]?.preview.includes('document setup') === true,
);

const rules = parseNormativeRules(spec);
assert('parses normative rule entries', rules.length === 3);
assert(
  'extracts normative sentence text',
  rules.find((rule) => rule.id === 'AIC-clean-setup')?.text === 'Repositories MUST be clean.',
);
assert(
  'maps normative rules by ID',
  normativeRuleMap(spec).get('AIC-branch-protection')?.text ===
    'Hosted repositories MUST protect branches.',
);

const ids = specIdMap(spec);
assert('maps spec IDs to clauses', ids.get('AIC-branch-protection')?.clause === 2);
assert('maps spec IDs to line numbers', (ids.get('AIC-clean-setup')?.line ?? 0) > 0);

const scopes = specScopeById(spec);
assert('maps spec IDs to normative scopes', scopes.get('AIC-helper-docs') === 'SHOULD');
assert(
  'maps MUST when applicable scope',
  scopes.get('AIC-branch-protection') === 'MUST when applicable',
);

const c2p = clauseToPillar(spec);
assert('maps clauses to pillars', c2p.get(1) === 1 && c2p.get(2) === 2);

const pillars = pillarNames(spec);
assert('parses pillar names', pillars[2] === '🧭 Oversight');

const detailedPillars = pillarDetails(spec);
assert(
  'parses pillar details',
  detailedPillars[1]?.icon === '🧭' &&
    detailedPillars[1]?.title === 'Oversight' &&
    detailedPillars[1]?.description === 'review',
);

const clauses = clauseDetails(spec);
assert(
  'parses clause details',
  clauses[0]?.number === 1 && clauses[0]?.pillar === 1 && clauses[0]?.title === 'Setup',
);

const levels = levelLabels(spec);
assert('parses level labels', levels.L1 === 'L1 — Hardened');
const detailedLevels = levelDetails(spec);
assert(
  'parses level details',
  detailedLevels[0]?.id === 'L0' &&
    detailedLevels[0]?.order === 0 &&
    detailedLevels[0]?.label === 'Baseline' &&
    detailedLevels[0]?.description === 'Basic hygiene.',
);
assert('valid min levels include optional dash', validMinLevels(spec).has('—'));
assert('parses spec version', specVersion(spec) === '0.2');

if (failed > 0) {
  console.error(`${failed} spec-model assertion(s) failed`);
  process.exit(1);
}

console.log('All spec-model assertions passed');

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  clauseToPillar,
  parseNormativeIds,
  specIdMap,
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
  '> **Version:** 0.1.1 · **Owner:** Example',
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

const ids = specIdMap(spec);
assert('maps spec IDs to clauses', ids.get('AIC-branch-protection')?.clause === 2);
assert('maps spec IDs to line numbers', (ids.get('AIC-clean-setup')?.line ?? 0) > 0);

const c2p = clauseToPillar(spec);
assert('maps clauses to pillars', c2p.get(1) === 1 && c2p.get(2) === 2);

assert('valid min levels include optional dash', validMinLevels(spec).has('—'));
assert('valid min levels include rendered spec levels', validMinLevels(spec).has('L1'));

if (failed > 0) {
  console.error(`${failed} spec-model assertion(s) failed`);
  process.exit(1);
}

console.log('All spec-model assertions passed');

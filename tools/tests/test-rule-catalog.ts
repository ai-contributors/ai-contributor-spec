#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  buildRuleCatalog,
  collectorAicIdsFromCatalog,
  validateRuleCatalog,
} from '../spec-authoring/generate-rule-catalog.ts';
import { coverageRowsFromCatalog } from '../spec-authoring/generate-coverage.ts';
import { rowScopeProblemsFromCatalog } from '../spec-authoring/check-row-scope-vs-spec.ts';
import { collectorRowCoverageProblemsFromCatalog } from '../spec-authoring/check-collector-row-coverage.ts';

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

const specContent = [
  '# Spec',
  '',
  '## Pillars',
  '',
  '| # | Pillar | Clauses | Scope |',
  '|---:|---|---|---|',
  '| 1 | Foundation | §1–1 | setup |',
  '| 2 | Oversight | §2–2 | review |',
  '',
  '## Specification clauses',
  '',
  '### Pillar 1 — Foundation',
  '',
  '## 1. Setup',
  '',
  '### `MUST`',
  '',
  '- Repositories MUST bootstrap cleanly. <sup>`AIC-clean-clone-bootstrap`</sup>',
  '',
  '### Pillar 2 — Oversight',
  '',
  '## 2. Review',
  '',
  '### `MUST`',
  '',
  '- AI-authored changes MUST receive human review. <sup>`AIC-human-review-required`</sup>',
].join('\n');

const checklistContent = [
  '# Checklist',
  '',
  '## Level 0 — Baseline',
  '',
  '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |',
  '|---|---|---|---|---|---|---:|---|',
  '| `MUST` | `Clean Setup` | - |  |  | Repository bootstraps from a clean clone. | 1 | `AIC-clean-clone-bootstrap` |',
  '| `MUST` | `Human Review Required` | - |  |  | AI-authored changes receive human review. | 2 | `AIC-human-review-required` |',
].join('\n');

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

const problems = validateRuleCatalog({
  ...catalog,
  rules: [{ ...catalog.rules[0]!, id: '' }],
});
assert(
  'rejects blank IDs',
  problems.some((problem) => problem.includes('rules[0].id')),
);

const groupedCoverageRows = coverageRowsFromCatalog({
  ...catalog,
  rules: [
    {
      ...catalog.rules[0]!,
      id: 'AIC-runtime-version-pinned',
      checklist: {
        rule: 'Pinned Toolchain',
        scope: 'MUST',
        requirement: 'Runtime version and package manager version are pinned.',
      },
    },
    {
      ...catalog.rules[0]!,
      id: 'AIC-package-manager-pinned',
      checklist: {
        rule: 'Pinned Toolchain',
        scope: 'MUST',
        requirement: 'Runtime version and package manager version are pinned.',
      },
    },
    {
      ...catalog.rules[1]!,
      id: 'AIC-public-release-controls',
      level: 'L1',
      checklist: {
        rule: 'Public Release Controls',
        scope: 'MUST when applicable',
        requirement: 'Public releases have documented controls.',
      },
    },
  ],
});
assert('deduplicates multi-ID checklist rows for coverage', groupedCoverageRows.length === 2);
assert(
  'normalizes MUST when applicable scope for coverage',
  groupedCoverageRows.find((row) => row.rule === 'Public Release Controls')?.scope === 'MwA',
);

const collectorAicIds = collectorAicIdsFromCatalog(catalog);
assert(
  'derives collector mappings from catalog detector metadata',
  collectorAicIds['clean-clone-bootstrap']?.join(',') === 'AIC-clean-clone-bootstrap',
);
assert(
  'omits manual-only catalog rows from collector mappings',
  !Object.values(collectorAicIds).flat().includes('AIC-human-review-required'),
);

const allowedScopeProblems = rowScopeProblemsFromCatalog({
  ...catalog,
  rules: [
    {
      ...catalog.rules[0]!,
      id: 'AIC-deterministic-build-order',
      scope: 'MUST',
      checklist: {
        ...catalog.rules[0]!.checklist,
        scope: 'MUST when applicable',
      },
    },
  ],
});
assert('allows documented MUST to MWA exceptions', allowedScopeProblems.length === 0);

const mismatchedScopeProblems = rowScopeProblemsFromCatalog({
  ...catalog,
  rules: [
    {
      ...catalog.rules[0]!,
      scope: 'MUST',
      checklist: {
        ...catalog.rules[0]!.checklist,
        scope: 'SHOULD',
      },
    },
  ],
});
assert(
  'reports catalog row scope mismatches',
  mismatchedScopeProblems[0]?.includes('AIC-clean-clone-bootstrap') === true,
);

const collectorRowCatalog = {
  ...catalog,
  rules: [
    {
      ...catalog.rules[0]!,
      checklist: {
        ...catalog.rules[0]!.checklist,
        rule: 'Combined Detector Row',
      },
    },
    {
      ...catalog.rules[1]!,
      checklist: {
        ...catalog.rules[1]!.checklist,
        rule: 'Combined Detector Row',
      },
    },
  ],
};
const fullCollectorRowProblems = collectorRowCoverageProblemsFromCatalog(
  {
    ...collectorRowCatalog,
    rules: [
      collectorRowCatalog.rules[0]!,
      {
        ...collectorRowCatalog.rules[1]!,
        detectors: [
          {
            id: 'human-review-required',
            kind: 'collector-rule',
            path: 'skills/ai-contributor-audit/scripts/internal/collector-registry.ts',
          },
        ],
        detectorConfidence: 'indicative',
      },
    ],
  },
  { allowedPartialRows: new Map() },
);
assert(
  'accepts full collector coverage from catalog row groups',
  fullCollectorRowProblems.length === 0,
);

const partialCollectorRowProblems = collectorRowCoverageProblemsFromCatalog(collectorRowCatalog, {
  allowedPartialRows: new Map(),
});
assert(
  'reports partial collector coverage from catalog row groups',
  partialCollectorRowProblems[0]?.includes('Combined Detector Row') === true &&
    partialCollectorRowProblems[0]?.includes('AIC-human-review-required') === true,
);

if (failed > 0) {
  console.error(`${failed} rule-catalog assertion(s) failed`);
  process.exit(1);
}

console.log('All rule-catalog assertions passed');

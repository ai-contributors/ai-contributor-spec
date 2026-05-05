#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  buildRuleCatalog,
  canonicalizeRuleCatalog,
  collectorAicIdsFromCatalog,
  validateRuleCatalog,
} from '../spec-authoring/generate-rule-catalog.ts';
import {
  checklistAssetProblems,
  renderChecklistAssets,
  renderChecklistRuleTables,
} from '../spec-authoring/generate-checklist-assets.ts';
import {
  renderSpecificationClauseRules,
  specificationClauseAssetProblems,
} from '../spec-authoring/generate-spec-clauses.ts';
import { coverageRowsFromCatalog } from '../spec-authoring/generate-coverage.ts';
import { rowScopeProblemsFromCatalog } from '../spec-authoring/check-row-scope-vs-spec.ts';
import { collectorRowCoverageProblemsFromCatalog } from '../spec-authoring/check-collector-row-coverage.ts';
import { ruleCatalogProjectionProblems } from '../spec-authoring/check-rule-catalog-projections.ts';

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
  '',
  '## Conformance levels',
  '',
  '- **Level 0 — Baseline.** Basic hygiene.',
  '- **Level 1 — Hardened.** Stronger checks.',
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
assert('extracts catalog spec version from spec', catalog.specVersion === '0.2');
assert(
  'builds pillar metadata',
  catalog.pillars[0]?.number === 1 &&
    catalog.pillars[0]?.icon === '🏗️' &&
    catalog.pillars[0]?.title === 'Foundation' &&
    catalog.pillars[0]?.description === 'setup',
);
assert(
  'builds clause metadata',
  catalog.clauses[1]?.number === 2 &&
    catalog.clauses[1]?.pillar === 2 &&
    catalog.clauses[1]?.title === 'Review',
);
assert(
  'builds level metadata including optional rows',
  catalog.levels.some((level) => level.id === 'L0' && level.label === 'Baseline') &&
    catalog.levels.some((level) => level.id === '—' && level.label === 'Optional'),
);
assert(
  'does not store presentation order fields in catalog entries',
  !('specOrder' in catalog.rules[0]!) &&
    !('rowOrder' in catalog.rules[0]!.checklist) &&
    !('idOrder' in catalog.rules[0]!.checklist),
);
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

const unsortedCatalog = {
  ...catalog,
  pillars: [catalog.pillars[1]!, catalog.pillars[0]!],
  levels: [catalog.levels[1]!, catalog.levels[0]!],
  clauses: [catalog.clauses[1]!, catalog.clauses[0]!],
  rules: [catalog.rules[1]!, catalog.rules[0]!],
};
const canonicalCatalog = canonicalizeRuleCatalog(unsortedCatalog);
assert(
  'canonicalizes catalog rule order without markdown input',
  canonicalCatalog.rules.map((rule) => rule.id).join(',') ===
    'AIC-clean-clone-bootstrap,AIC-human-review-required',
);
assert(
  'canonicalizes catalog document metadata order',
  canonicalCatalog.pillars.map((pillar) => pillar.number).join(',') === '1,2' &&
    canonicalCatalog.levels[0]?.id === 'L0' &&
    canonicalCatalog.clauses.map((clause) => clause.number).join(',') === '1,2',
);

const problems = validateRuleCatalog({
  ...catalog,
  rules: [{ ...catalog.rules[0]!, id: '' }],
});
assert(
  'rejects blank IDs',
  problems.some((problem) => problem.includes('rules[0].id')),
);
const referenceProblems = validateRuleCatalog({
  ...catalog,
  rules: [{ ...catalog.rules[0]!, clause: 99, level: 'L9' }],
});
assert(
  'rejects missing clause and level references',
  referenceProblems.some((problem) => problem.includes('references missing clause 99')) &&
    referenceProblems.some((problem) => problem.includes('references missing level L9')),
);

const groupedCoverageRows = coverageRowsFromCatalog({
  ...catalog,
  rules: [
    {
      ...catalog.rules[0]!,
      id: 'AIC-runtime-version-pinned',
      checklist: {
        ...catalog.rules[0]!.checklist,
        rule: 'Pinned Toolchain',
        scope: 'MUST',
        requirement: 'Runtime version and package manager version are pinned.',
      },
    },
    {
      ...catalog.rules[0]!,
      id: 'AIC-package-manager-pinned',
      checklist: {
        ...catalog.rules[0]!.checklist,
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
        ...catalog.rules[1]!.checklist,
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

const projectionProblems = ruleCatalogProjectionProblems({
  catalog,
  specContent: specContent.replace(
    'Repositories MUST bootstrap cleanly.',
    'Repositories MUST drift.',
  ),
  checklistContent,
});
assert(
  'detects spec projection drift from catalog',
  projectionProblems.some((problem) => problem.includes('AIC-clean-clone-bootstrap text mismatch')),
);
const metadataProjectionProblems = ruleCatalogProjectionProblems({
  catalog: {
    ...catalog,
    specVersion: '0.1',
    pillars: [{ ...catalog.pillars[0]!, title: 'Wrong' }, catalog.pillars[1]!],
    levels: [{ ...catalog.levels[0]!, label: 'Wrong' }, ...catalog.levels.slice(1)],
    clauses: [{ ...catalog.clauses[0]!, title: 'Wrong' }, catalog.clauses[1]!],
  },
  specContent,
  checklistContent,
});
assert(
  'detects document metadata projection drift from catalog',
  metadataProjectionProblems.some((problem) => problem.includes('specVersion mismatch')) &&
    metadataProjectionProblems.some((problem) => problem.includes('pillar 1 title mismatch')) &&
    metadataProjectionProblems.some((problem) => problem.includes('level L0 label mismatch')) &&
    metadataProjectionProblems.some((problem) => problem.includes('clause 1 title mismatch')),
);

assert(
  'renders checklist rule tables from catalog',
  renderChecklistRuleTables(catalog).includes(
    '| `MUST` | `Clean Setup` | - |  |  | Repository bootstraps from a clean clone. | 1 | `AIC-clean-clone-bootstrap` |',
  ),
);

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

const checklistAssetDriftProblems = checklistAssetProblems({
  catalog,
  checklistContent: checklistContent.replace('Clean Setup', 'Dirty Setup'),
});
assert(
  'detects checklist asset drift from catalog',
  checklistAssetDriftProblems.some((problem) =>
    problem.includes('checklist rule tables are stale'),
  ),
);
assert(
  'does not require checklist ID bindings',
  !checklistAssetDriftProblems.some((problem) => problem.includes('checklist ID bindings')),
);

const renderedSpecificationClauses = renderSpecificationClauseRules(
  {
    ...catalog,
    rules: [
      {
        ...catalog.rules[0]!,
        text: 'Repositories MUST render rule text from the catalog.',
      },
      catalog.rules[1]!,
    ],
  },
  specContent,
);
assert(
  'renders specification rule bullets from catalog',
  renderedSpecificationClauses.includes(
    '- Repositories MUST render rule text from the catalog. <sup>`AIC-clean-clone-bootstrap`</sup>',
  ) && !renderedSpecificationClauses.includes('- Repositories MUST bootstrap cleanly.'),
);

const specFrameWithProse = specContent.replace(
  '## 1. Setup\n\n### `MUST`',
  '## 1. Setup\n\nThis non-normative frame text stays hand-authored.\n\n### `MUST`',
);
assert(
  'preserves non-normative specification frame prose',
  renderSpecificationClauseRules(catalog, specFrameWithProse).includes(
    'This non-normative frame text stays hand-authored.',
  ),
);

const specClauseDriftProblems = specificationClauseAssetProblems({
  catalog,
  specContent: specContent.replace('Repositories MUST bootstrap cleanly.', 'Repositories drift.'),
});
assert(
  'detects specification rule bullet drift from catalog',
  specClauseDriftProblems.some((problem) =>
    problem.includes('specification rule bullets are stale'),
  ),
);

const missingSpecClauseFrameProblems = specificationClauseAssetProblems({
  catalog,
  specContent: specContent.replace('### `MUST`', '### `SHOULD`'),
});
assert(
  'reports missing specification clause scope locations',
  missingSpecClauseFrameProblems.some((problem) =>
    problem.includes('No specification clause frame found for §1 `MUST`'),
  ),
);

if (failed > 0) {
  console.error(`${failed} rule-catalog assertion(s) failed`);
  process.exit(1);
}

console.log('All rule-catalog assertions passed');

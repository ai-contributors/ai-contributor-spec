#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  canonicalizeRuleCatalog,
  collectorAicIdsFromCatalog,
  type RuleCatalog,
  validateRuleCatalog,
} from '../spec-authoring/generate-rule-catalog.ts';
import {
  checklistAssetProblems,
  renderChecklistAssets,
  renderChecklistRuleTables,
} from '../spec-authoring/generate-checklist-assets.ts';
import {
  renderSpecification,
  specificationAssetProblems,
} from '../spec-authoring/generate-specification.ts';
import {
  auditTemplateProblems,
  renderAuditTemplates,
} from '../spec-authoring/generate-audit-templates.ts';
import {
  coverageBlocksFromCatalog,
  coverageRowsFromCatalog,
  renderCoverageMap,
} from '../spec-authoring/generate-coverage.ts';
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

const catalog: RuleCatalog = {
  $schema: './AI-CONTRIBUTOR-RULE-CATALOG.schema.json',
  schemaVersion: '0.1',
  specVersion: '0.1.1',
  sourceOfTruth: 'AI-CONTRIBUTOR-RULE-CATALOG.json',
  projections: {
    specification: 'AI-CONTRIBUTOR-SPECIFICATION.md',
    checklist: '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md',
    coverage: 'AI-CONTRIBUTOR-COVERAGE.md',
    collectorRegistry: 'skills/ai-contributor-audit/scripts/internal/collector-registry.ts',
  },
  pillars: [
    { number: 1, icon: '🏗️', title: 'Foundation', description: 'setup' },
    { number: 2, icon: '🧭', title: 'Oversight', description: 'review' },
  ],
  levels: [
    { id: 'L0', order: 0, label: 'Baseline', description: 'Basic hygiene.' },
    { id: 'L1', order: 1, label: 'Hardened', description: 'Stronger checks.' },
    {
      id: '—',
      order: 99,
      label: 'Optional',
      description: 'Optional rules are not required for any conformance level.',
    },
  ],
  clauses: [
    { number: 1, pillar: 1, title: 'Setup' },
    { number: 2, pillar: 2, title: 'Review' },
  ],
  rules: [
    {
      id: 'AIC-clean-clone-bootstrap',
      clause: 1,
      pillar: 1,
      scope: 'MUST',
      level: 'L0',
      text: 'Repositories MUST bootstrap cleanly.',
      checklist: {
        rule: 'Clean Setup',
        scope: 'MUST',
        requirement: 'Repository bootstraps from a clean clone.',
      },
      detectors: [
        {
          id: 'clean-clone-bootstrap',
          kind: 'collector-rule',
          path: 'skills/ai-contributor-audit/scripts/internal/collector-registry.ts',
        },
      ],
      detectorConfidence: 'indicative',
    },
    {
      id: 'AIC-human-review-required',
      clause: 2,
      pillar: 2,
      scope: 'MUST',
      level: 'L0',
      text: 'AI-authored changes MUST receive human review.',
      checklist: {
        rule: 'Human Review Required',
        scope: 'MUST',
        requirement: 'AI-authored changes receive human review.',
      },
      detectors: [
        {
          id: 'manual-review',
          kind: 'manual',
          manualEvidence:
            'Review checklist row "Human Review Required" and record current-run evidence.',
        },
      ],
      detectorConfidence: 'manual',
    },
  ],
};
const catalogWithWorkflowSummaries = {
  ...catalog,
  levels: catalog.levels.map((level) =>
    level.id === 'L0'
      ? {
          ...level,
          workflowSummary:
            'AI is not part of the contribution workflow yet; humans may use personal help outside repository context.',
        }
      : level.id === 'L1'
        ? {
            ...level,
            workflowSummary:
              'AI tools may read repository context and suggest commands, but do not produce shippable changes.',
          }
        : level,
  ),
};
const catalogWithChecklistLevelMetadata = {
  ...catalog,
  levels: catalog.levels.map((level) =>
    level.id === 'L0'
      ? {
          ...level,
          label: 'Catalog Baseline',
          description: 'Catalog-owned baseline definition.',
        }
      : level.id === 'L1'
        ? {
            ...level,
            label: 'Catalog Hardened',
            description: 'Catalog-owned hardened definition.',
          }
        : level,
  ),
};

assert('uses one catalog entry per AIC ID', catalog.rules.length === 2);
assert('uses catalog spec version', catalog.specVersion === '0.1.1');
assert(
  'records coverage as a catalog projection',
  (catalog.projections as Record<string, string>).coverage === 'AI-CONTRIBUTOR-COVERAGE.md',
);
assert(
  'uses pillar metadata',
  catalog.pillars[0]?.number === 1 &&
    catalog.pillars[0]?.icon === '🏗️' &&
    catalog.pillars[0]?.title === 'Foundation' &&
    catalog.pillars[0]?.description === 'setup',
);
assert(
  'uses clause metadata',
  catalog.clauses[1]?.number === 2 &&
    catalog.clauses[1]?.pillar === 2 &&
    catalog.clauses[1]?.title === 'Review',
);
assert(
  'uses level metadata including optional rows',
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
const projectionValidationProblems = validateRuleCatalog({
  ...catalog,
  projections: {
    ...catalog.projections,
    coverage: '',
  } as unknown as typeof catalog.projections,
});
assert(
  'rejects blank coverage projection',
  projectionValidationProblems.some((problem) =>
    problem.includes('projections.coverage must not be blank'),
  ),
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
const catalogMetadataCoverageBlocks = coverageBlocksFromCatalog({
  ...catalog,
  pillars: [
    { ...catalog.pillars[0]!, icon: '⚙️', title: 'Catalog Foundation' },
    { ...catalog.pillars[1]!, icon: '👁️', title: 'Catalog Oversight' },
  ],
  levels: catalog.levels.map((level) =>
    level.id === 'L0'
      ? { ...level, label: 'Catalog Baseline' }
      : level.id === 'L1'
        ? { ...level, label: 'Catalog Hardened' }
        : level,
  ),
});
assert(
  'renders coverage pillar and level labels from catalog metadata',
  catalogMetadataCoverageBlocks.byPillar.includes('| 1 · ⚙️ Catalog Foundation |') &&
    catalogMetadataCoverageBlocks.byPillar.includes('| 2 · 👁️ Catalog Oversight |') &&
    catalogMetadataCoverageBlocks.byLevel.includes('| L0 — Catalog Baseline |') &&
    catalogMetadataCoverageBlocks.byLevel.includes('| L1 — Catalog Hardened |'),
);
const coverageTemplateContent = [
  '# Coverage',
  '',
  '**Version:** {{specVersion}}',
  '',
  'Prose stays template-owned.',
  '',
  '{{generated:coverage-at-a-glance}}',
  '',
  '{{generated:coverage-by-scope}}',
  '',
  '{{generated:coverage-by-pillar}}',
  '',
  '{{generated:coverage-by-level}}',
  '',
  '{{generated:coverage-cumulative}}',
].join('\n');
const renderedCoverageMap = renderCoverageMap(catalog, coverageTemplateContent);
assert(
  'renders coverage map from catalog-backed template directives',
  renderedCoverageMap.includes('**Version:** 0.1.1') &&
    renderedCoverageMap.includes('Prose stays template-owned.') &&
    renderedCoverageMap.includes('- **2** total rows') &&
    renderedCoverageMap.includes('| `MUST` | 2 |') &&
    renderedCoverageMap.includes('| 1 · 🏗️ Foundation | 1 | 1 | 0 | 0 | 0 |') &&
    renderedCoverageMap.includes('| L0 — Baseline | 2 | 2 | 0 | 0 |') &&
    renderedCoverageMap.includes('| L0 | 2 | — |') &&
    !renderedCoverageMap.includes('{{generated:'),
);
assert(
  'reports unknown coverage template directives',
  (() => {
    try {
      renderCoverageMap(catalog, `${coverageTemplateContent}\n{{generated:coverage-unknown}}`);
      return false;
    } catch (err) {
      return err instanceof Error && err.message.includes('unknown coverage template directive');
    }
  })(),
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

assert(
  'renders checklist rule tables from catalog',
  renderChecklistRuleTables(catalog).includes(
    '| `MUST` | `Clean Setup` | - |  |  | Repository bootstraps from a clean clone. | 1 | `AIC-clean-clone-bootstrap` |',
  ),
);

const checklistTemplateContent = [
  '---',
  'spec_version: "{{specVersion}}"',
  'conformance_level: # one of: none, {{generated:conformance-level-values}}.',
  '---',
  '',
  '# Checklist',
  '',
  'Template prose stays checklist-owned.',
  '',
  '## Conformance level summary',
  '',
  '| Level | Status | Date reached | Notes |',
  '|---|---|---|---|',
  '{{generated:conformance-level-summary-rows}}',
  '',
  '## Conformance levels',
  '',
  '{{generated:conformance-level-bullets}}',
  '',
  '{{generated:checklist-rule-tables}}',
  '',
  '## Verification gaps',
].join('\n');
const renderedChecklistAssets = (() => {
  try {
    return renderChecklistAssets(catalogWithChecklistLevelMetadata, checklistTemplateContent);
  } catch {
    return '';
  }
})();
assert(
  'renders checklist from catalog-backed template directives',
  renderedChecklistAssets.includes('spec_version: "0.1.1"') &&
    renderedChecklistAssets.includes('conformance_level: # one of: none, 0, 1.') &&
    renderedChecklistAssets.includes('Template prose stays checklist-owned.') &&
    renderedChecklistAssets.includes(
      '| **Level 0 — Catalog Baseline** | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |',
    ) &&
    renderedChecklistAssets.includes(
      '- **Level 0 — Catalog Baseline:** Catalog-owned baseline definition.',
    ) &&
    renderedChecklistAssets.includes('## Level 0 — Catalog Baseline') &&
    renderedChecklistAssets.includes('## Checklist row tables') &&
    renderedChecklistAssets.includes(
      '| `MUST` | `Clean Setup` | - |  |  | Repository bootstraps from a clean clone. | 1 | `AIC-clean-clone-bootstrap` |',
    ) &&
    !renderedChecklistAssets.includes('{{generated:'),
);
assert(
  'reports unknown checklist template directives',
  (() => {
    try {
      renderChecklistAssets(
        catalog,
        `${checklistTemplateContent}\n{{generated:checklist-unknown}}`,
      );
      return false;
    } catch (err) {
      return err instanceof Error && err.message.includes('unknown checklist template directive');
    }
  })(),
);

const checklistAssetDriftProblems = checklistAssetProblems({
  catalog,
  templateContent: checklistTemplateContent,
  checklistContent: renderedChecklistAssets.replace('Clean Setup', 'Dirty Setup'),
});
assert(
  'detects checklist asset drift from catalog',
  checklistAssetDriftProblems.some((problem) => problem.includes('does not match')),
);

const auditSummaryTemplateContent = [
  '# AI Contributor Audit',
  '',
  'Summary prose stays template-owned.',
  '',
  '## Conformance level summary',
  '',
  '| Level | Status | Date reached | Notes |',
  '|---|---|---|---|',
  '{{generated:conformance-level-summary-rows}}',
  '',
  '## Backlog — what to address first',
  '',
  'Backlog prose stays template-owned.',
].join('\n');
const auditLogTemplateContent = [
  '---',
  'spec_version: "{{specVersion}}"',
  'conformance_level: # one of: none, {{generated:conformance-level-values}}.',
  '---',
  '',
  '# AI Contributor Audit Log',
  '',
  'Audit-log prose stays template-owned.',
  '',
  '<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->',
  '<!-- END:STAMPED-COLLECTOR-ROWS -->',
].join('\n');
const renderedAuditTemplates = renderAuditTemplates(catalogWithChecklistLevelMetadata, {
  summaryTemplateContent: auditSummaryTemplateContent,
  auditLogTemplateContent,
});
assert(
  'renders audit templates from catalog-backed directives',
  renderedAuditTemplates.summaryContent.includes('Summary prose stays template-owned.') &&
    renderedAuditTemplates.summaryContent.includes(
      '| **Level 0 — Catalog Baseline** | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |',
    ) &&
    renderedAuditTemplates.auditLogContent.includes('spec_version: "0.1.1"') &&
    renderedAuditTemplates.auditLogContent.includes('conformance_level: # one of: none, 0, 1.') &&
    renderedAuditTemplates.auditLogContent.includes('Audit-log prose stays template-owned.') &&
    renderedAuditTemplates.auditLogContent.includes('<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->') &&
    !renderedAuditTemplates.summaryContent.includes('{{generated:') &&
    !renderedAuditTemplates.auditLogContent.includes('{{generated:'),
);
assert(
  'reports unknown audit template directives',
  (() => {
    try {
      renderAuditTemplates(catalog, {
        summaryTemplateContent: `${auditSummaryTemplateContent}\n{{generated:audit-unknown}}`,
        auditLogTemplateContent,
      });
      return false;
    } catch (err) {
      return err instanceof Error && err.message.includes('unknown audit template directive');
    }
  })(),
);
assert(
  'reports missing audit template directives',
  auditTemplateProblems({
    catalog,
    summaryTemplateContent: auditSummaryTemplateContent.replace(
      '{{generated:conformance-level-summary-rows}}',
      '',
    ),
    auditLogTemplateContent,
    summaryContent: renderedAuditTemplates.summaryContent,
    auditLogContent: renderedAuditTemplates.auditLogContent,
  }).some((problem) =>
    problem.includes(
      'No audit summary template directive found for generated:conformance-level-summary-rows',
    ),
  ),
);
assert(
  'reports duplicate audit template directives',
  auditTemplateProblems({
    catalog,
    summaryTemplateContent: `${auditSummaryTemplateContent}\n{{generated:conformance-level-summary-rows}}`,
    auditLogTemplateContent,
    summaryContent: renderedAuditTemplates.summaryContent,
    auditLogContent: renderedAuditTemplates.auditLogContent,
  }).some((problem) =>
    problem.includes(
      'audit summary template contains 2 template directives for generated:conformance-level-summary-rows',
    ),
  ),
);
assert(
  'detects audit template drift from catalog-backed templates',
  auditTemplateProblems({
    catalog,
    summaryTemplateContent: auditSummaryTemplateContent,
    auditLogTemplateContent,
    summaryContent: renderedAuditTemplates.summaryContent.replace(
      'Summary prose stays template-owned.',
      'Summary drift.',
    ),
    auditLogContent: renderedAuditTemplates.auditLogContent,
  }).some((problem) => problem.includes('AI-CONTRIBUTOR-AUDIT.md does not match')),
);

const specTemplateContent = [
  '# Spec',
  '',
  '> **Version:** {{specVersion}} · **Owner:** Example',
  '',
  'Introductory prose stays hand-authored.',
  '',
  'Read {{generated:spec-scope-list}} for {{generated:clause-count}} clauses.',
  '',
  '## Pillars',
  '',
  '{{generated:pillars-table}}',
  '',
  '## Specification clauses',
  '',
  '{{generated:specification-clauses}}',
  '',
  '## Conformance levels',
  '',
  'Conformance introduction stays hand-authored.',
  '',
  '{{generated:conformance-levels}}',
  '',
  '{{generated:level-workflow-table}}',
].join('\n');

const renderedSpecification = renderSpecification(
  {
    ...catalogWithWorkflowSummaries,
    rules: [
      {
        ...catalog.rules[0]!,
        text: 'Repositories MUST render rule text from the catalog.',
      },
      catalog.rules[1]!,
    ],
  },
  specTemplateContent,
);
assert(
  'renders specification from catalog-backed template directives',
  renderedSpecification.includes('> **Version:** 0.1.1 · **Owner:** Example') &&
    renderedSpecification.includes('| 1 | 🏗️ Foundation | §1 | setup |') &&
    renderedSpecification.includes('### Pillar 1 — 🏗️ Foundation') &&
    renderedSpecification.includes('#### 1. Setup') &&
    renderedSpecification.includes('- **Level 0 — Baseline.** Basic hygiene.') &&
    renderedSpecification.includes(
      'Read `MUST`, `MUST when applicable`, `SHOULD`, and `MAY` for 2 clauses.',
    ) &&
    renderedSpecification.includes(
      '| **L1 Hardened** | AI tools may read repository context and suggest commands, but do not produce shippable changes. |',
    ) &&
    !renderedSpecification.includes('Optional rules are not required for any conformance level') &&
    renderedSpecification.includes(
      '- Repositories MUST render rule text from the catalog. <sup>`AIC-clean-clone-bootstrap`</sup>',
    ) &&
    !renderedSpecification.includes('{{generated:'),
);
assert(
  'renders complete specification clauses section from catalog',
  renderedSpecification.includes('### Pillar 1 — 🏗️ Foundation') &&
    renderedSpecification.includes('#### 1. Setup') &&
    renderedSpecification.includes('##### `MUST`') &&
    renderedSpecification.includes(
      '- Repositories MUST render rule text from the catalog. <sup>`AIC-clean-clone-bootstrap`</sup>',
    ) &&
    renderedSpecification.includes('### Pillar 2 — 🧭 Oversight') &&
    renderedSpecification.includes('#### 2. Review') &&
    !renderedSpecification.includes('{{generated:'),
);

assert(
  'preserves non-normative specification frame prose',
  renderSpecification(catalogWithWorkflowSummaries, specTemplateContent).includes(
    'Introductory prose stays hand-authored.',
  ),
);

const renderedSpecificationFromCatalog = renderSpecification(
  catalogWithWorkflowSummaries,
  specTemplateContent,
);
const specDriftProblems = specificationAssetProblems({
  catalog: catalogWithWorkflowSummaries,
  templateContent: specTemplateContent,
  specContent: renderedSpecificationFromCatalog.replace(
    'Repositories MUST bootstrap cleanly.',
    'Repositories drift.',
  ),
});
assert(
  'detects specification drift from catalog-backed template',
  specDriftProblems.some((problem) => problem.includes('specification is stale')),
);

const unknownDirectiveProblems = specificationAssetProblems({
  catalog: catalogWithWorkflowSummaries,
  templateContent: `${specTemplateContent}\n{{generated:unknown}}\n`,
  specContent: renderedSpecificationFromCatalog,
});
assert(
  'reports unknown specification template directives',
  unknownDirectiveProblems.some((problem) => problem.includes('unknown template directive')),
);

const missingSpecificationClausesDirectiveProblems = specificationAssetProblems({
  catalog: catalogWithWorkflowSummaries,
  templateContent: specTemplateContent.replace('{{generated:specification-clauses}}', ''),
  specContent: renderedSpecificationFromCatalog,
});
assert(
  'reports missing specification clauses directive',
  missingSpecificationClausesDirectiveProblems.some((problem) =>
    problem.includes('No template directive found for generated:specification-clauses'),
  ),
);

if (failed > 0) {
  console.error(`${failed} rule-catalog assertion(s) failed`);
  process.exit(1);
}

console.log('All rule-catalog assertions passed');

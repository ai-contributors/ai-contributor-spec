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

assert('builds one entry per AIC ID', catalog.rules.length === 2);
assert('extracts catalog spec version from spec', catalog.specVersion === '0.2');
assert(
  'records coverage as a catalog projection',
  (catalog.projections as Record<string, string>).coverage === 'AI-CONTRIBUTOR-COVERAGE.md',
);
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
  renderedCoverageMap.includes('**Version:** 0.2') &&
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
  renderedChecklistAssets.includes('spec_version: "0.2"') &&
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
  checklistContent: checklistContent.replace('Clean Setup', 'Dirty Setup'),
});
assert(
  'detects checklist asset drift from catalog',
  checklistAssetDriftProblems.some((problem) => problem.includes('does not match')),
);
assert(
  'does not allow checklist ID bindings',
  checklistAssetProblems({
    catalog,
    templateContent: checklistTemplateContent,
    checklistContent: [
      '# Checklist',
      '',
      '<!-- BEGIN:CHECKLIST-ID-BINDINGS',
      '{}',
      'END:CHECKLIST-ID-BINDINGS -->',
      '',
      renderChecklistRuleTables(catalog),
    ].join('\n'),
  }).some((problem) => problem.includes('checklist ID bindings')),
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
    renderedAuditTemplates.auditLogContent.includes('spec_version: "0.2"') &&
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
  '{{generated:pillar-heading:1}}',
  '',
  '{{generated:clause-heading:1}}',
  '',
  'This non-normative clause prose stays in the template.',
  '',
  '### `MUST`',
  '',
  '{{generated:spec-rules:1:MUST}}',
  '',
  '{{generated:pillar-heading:2}}',
  '',
  '{{generated:clause-heading:2}}',
  '',
  '### `MUST`',
  '',
  '{{generated:spec-rules:2:MUST}}',
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
  renderedSpecification.includes('> **Version:** 0.2 · **Owner:** Example') &&
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

const renderedSpecificationWithGeneratedClauses = renderSpecification(
  catalogWithWorkflowSummaries,
  [
    '# Spec',
    '',
    '> **Version:** {{specVersion}} · **Owner:** Example',
    '',
    '{{generated:clause-count}} clauses use {{generated:spec-scope-list}}.',
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
    '{{generated:conformance-levels}}',
    '',
    '{{generated:level-workflow-table}}',
  ].join('\n'),
);
assert(
  'renders complete specification clauses section from catalog',
  renderedSpecificationWithGeneratedClauses.includes('### Pillar 1 — 🏗️ Foundation') &&
    renderedSpecificationWithGeneratedClauses.includes('#### 1. Setup') &&
    renderedSpecificationWithGeneratedClauses.includes('##### `MUST`') &&
    renderedSpecificationWithGeneratedClauses.includes(
      '- Repositories MUST bootstrap cleanly. <sup>`AIC-clean-clone-bootstrap`</sup>',
    ) &&
    renderedSpecificationWithGeneratedClauses.includes('### Pillar 2 — 🧭 Oversight') &&
    renderedSpecificationWithGeneratedClauses.includes('#### 2. Review') &&
    !renderedSpecificationWithGeneratedClauses.includes('{{generated:clause-heading') &&
    !renderedSpecificationWithGeneratedClauses.includes('{{generated:spec-rules'),
);

const mixedSpecificationClauseDirectiveProblems = specificationAssetProblems({
  catalog: catalogWithWorkflowSummaries,
  templateContent: [
    '# Spec',
    '',
    '> **Version:** {{specVersion}} · **Owner:** Example',
    '',
    '{{generated:clause-count}} clauses use {{generated:spec-scope-list}}.',
    '',
    '## Pillars',
    '',
    '{{generated:pillars-table}}',
    '',
    '## Specification clauses',
    '',
    '{{generated:specification-clauses}}',
    '',
    '{{generated:clause-heading:1}}',
    '',
    '## Conformance levels',
    '',
    '{{generated:conformance-levels}}',
    '',
    '{{generated:level-workflow-table}}',
  ].join('\n'),
  specContent: renderedSpecificationWithGeneratedClauses,
});
assert(
  'rejects mixed full-section and granular specification clause directives',
  mixedSpecificationClauseDirectiveProblems.some((problem) =>
    problem.includes(
      'must use either generated:specification-clauses or granular clause directives',
    ),
  ),
);

assert(
  'preserves non-normative specification frame prose',
  renderSpecification(catalogWithWorkflowSummaries, specTemplateContent).includes(
    'This non-normative clause prose stays in the template.',
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
  templateContent: `${specTemplateContent}\n{{generated:clause-heading:99}}\n`,
  specContent: renderedSpecificationFromCatalog,
});
assert(
  'reports unknown specification template directives',
  unknownDirectiveProblems.some((problem) => problem.includes('references unknown clause 99')),
);

const missingRuleDirectiveProblems = specificationAssetProblems({
  catalog: catalogWithWorkflowSummaries,
  templateContent: specTemplateContent.replace('{{generated:spec-rules:1:MUST}}', ''),
  specContent: renderedSpecificationFromCatalog,
});
assert(
  'reports missing specification rule group directives',
  missingRuleDirectiveProblems.some((problem) =>
    problem.includes('No template directive found for §1 `MUST`'),
  ),
);

if (failed > 0) {
  console.error(`${failed} rule-catalog assertion(s) failed`);
  process.exit(1);
}

console.log('All rule-catalog assertions passed');

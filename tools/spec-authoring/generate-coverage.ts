#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Renders AI-CONTRIBUTOR-COVERAGE.md from a Markdown template and
// AI-CONTRIBUTOR-RULE-CATALOG.json. The template owns explanatory prose and
// placement; the catalog owns rule, pillar, level, and scope metadata.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { type ValidatedRuleCatalog } from './generate-rule-catalog.ts';
import { loadValidatedCatalog } from './shared/catalog-loader.ts';
import {
  renderTemplateDirectives,
  type TemplateDirectiveRenderer,
} from './shared/template-renderer.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const COVERAGE = 'docs/AI-CONTRIBUTOR-COVERAGE.md';
const TEMPLATE = 'tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const COVERAGE_PATH = path.join(REPO_ROOT, COVERAGE);
const TEMPLATE_PATH = path.join(REPO_ROOT, TEMPLATE);

type CoverageScope = 'MUST' | 'MwA' | 'SHOULD' | 'MAY';

interface CoverageRow {
  rule: string;
  pillar: number;
  level: string;
  scope: CoverageScope;
}

interface CoveragePillar {
  number: number;
  label: string;
}

interface CoverageLevel {
  id: string;
  label: string;
  order: number;
}

interface CoverageBlocks {
  atAGlance: string;
  byScope: string;
  byPillar: string;
  byLevel: string;
  cumulative: string;
}

const COVERAGE_DIRECTIVES = {
  'generated:coverage-at-a-glance': 'atAGlance',
  'generated:coverage-by-scope': 'byScope',
  'generated:coverage-by-pillar': 'byPillar',
  'generated:coverage-by-level': 'byLevel',
  'generated:coverage-cumulative': 'cumulative',
} satisfies Record<string, keyof CoverageBlocks>;
const REQUIRED_COVERAGE_DIRECTIVES = ['specVersion', ...Object.keys(COVERAGE_DIRECTIVES)];

function coverageBlocksFromCatalog(catalog: ValidatedRuleCatalog): CoverageBlocks {
  const rows = coverageRowsFromCatalog(catalog);
  const pillars = coveragePillarsFromCatalog(catalog);
  const levels = coverageLevelsFromCatalog(catalog);
  return {
    atAGlance: blockAtAGlance(rows, levels),
    byScope: blockByScope(rows),
    byPillar: blockByPillar(rows, pillars),
    byLevel: blockByLevel(rows, levels),
    cumulative: blockCumulative(rows, levels),
  };
}

export function renderCoverageMap(catalog: ValidatedRuleCatalog, templateContent: string): string {
  const blocks = coverageBlocksFromCatalog(catalog);
  const directives: Record<string, TemplateDirectiveRenderer> = {
    specVersion: () => catalog.specVersion,
  };
  for (const [directiveName, blockName] of Object.entries(COVERAGE_DIRECTIVES)) {
    directives[directiveName] = () => blocks[blockName];
  }
  const result = renderTemplateDirectives({
    templateContent,
    directives,
    requiredDirectives: REQUIRED_COVERAGE_DIRECTIVES,
    repeatableDirectives: ['specVersion'],
    messages: {
      templatePath: TEMPLATE,
      directiveLabel: 'coverage template directive',
    },
  });

  if (result.problems.length > 0) throw new Error(result.problems.join('\n'));
  return result.content;
}

function coverageRowsFromCatalog(catalog: ValidatedRuleCatalog): CoverageRow[] {
  const out = new Map<string, CoverageRow>();
  for (const entry of catalog.rules) {
    const row = {
      rule: entry.checklist.rule,
      pillar: entry.pillar,
      level: entry.level,
      scope: coverageScopeFromCatalogScope(entry.checklist.scope),
    };
    const key = `${row.level}\0${row.rule}`;
    const existing = out.get(key);
    if (existing) {
      if (
        existing.pillar !== row.pillar ||
        existing.scope !== row.scope ||
        existing.level !== row.level
      ) {
        throw new Error(
          `catalog entries for checklist row "${row.rule}" disagree on coverage data`,
        );
      }
      continue;
    }
    out.set(key, row);
  }
  return [...out.values()];
}

function coverageScopeFromCatalogScope(
  scope: ValidatedRuleCatalog['rules'][number]['checklist']['scope'],
): CoverageScope {
  return scope === 'MUST when applicable' ? 'MwA' : scope;
}

function count(rows: CoverageRow[], pred: (row: CoverageRow) => boolean): number {
  return rows.filter(pred).length;
}

function coveragePillarsFromCatalog(catalog: ValidatedRuleCatalog): CoveragePillar[] {
  return [...catalog.pillars]
    .sort((a, b) => a.number - b.number)
    .map((pillar) => ({
      number: pillar.number,
      label: `${pillar.icon} ${pillar.title}`,
    }));
}

function coverageLevelsFromCatalog(catalog: ValidatedRuleCatalog): CoverageLevel[] {
  return catalog.levels
    .filter((level) => level.id !== '—')
    .map((level) => ({
      id: level.id,
      label: `${level.id} — ${level.label}`,
      order: level.order,
    }))
    .sort((a, b) => a.order - b.order);
}

function blockAtAGlance(rows: CoverageRow[], levels: readonly CoverageLevel[]): string {
  const total = rows.length;
  const must = count(rows, (r) => r.scope === 'MUST');
  const mwa = count(rows, (r) => r.scope === 'MwA');
  const should = count(rows, (r) => r.scope === 'SHOULD');
  const may = count(rows, (r) => r.scope === 'MAY');
  const requiredLevelCounts = levels
    .map((level) => `**${count(rows, (r) => r.level === level.id)}** rows at ${level.label}`)
    .join('; ');
  const optional = count(rows, (r) => r.level === '—');
  return [
    `- **${total}** total rows`,
    `- **${must}** unconditional \`MUST\` + **${mwa}** \`MUST when applicable\` + **${should}** \`SHOULD\` + **${may}** \`MAY\``,
    `- ${requiredLevelCounts}`,
    `- **${optional}** optional \`MAY\` rows`,
  ].join('\n');
}

function blockByScope(rows: CoverageRow[]): string {
  const r = (s: CoverageScope) => count(rows, (x) => x.scope === s);
  return [
    '| Scope | Rows |',
    '|---|---:|',
    `| \`MUST\` | ${r('MUST')} |`,
    `| \`MUST when applicable\` | ${r('MwA')} |`,
    `| \`SHOULD\` | ${r('SHOULD')} |`,
    `| \`MAY\` | ${r('MAY')} |`,
    `| **Total** | **${rows.length}** |`,
  ].join('\n');
}

function blockByPillar(rows: CoverageRow[], pillars: readonly CoveragePillar[]): string {
  const out = [
    '| Pillar | Total | `MUST` | `MwA` | `SHOULD` | `MAY` |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const pillar of pillars) {
    const inP = rows.filter((r) => r.pillar === pillar.number);
    const must = count(inP, (r) => r.scope === 'MUST');
    const mwa = count(inP, (r) => r.scope === 'MwA');
    const should = count(inP, (r) => r.scope === 'SHOULD');
    const may = count(inP, (r) => r.scope === 'MAY');
    out.push(
      `| ${pillar.number} · ${pillar.label} | ${inP.length} | ${must} | ${mwa} | ${should} | ${may} |`,
    );
  }
  return out.join('\n');
}

function blockByLevel(rows: CoverageRow[], levels: readonly CoverageLevel[]): string {
  const out = ['| Level | Rows | `MUST` | `MwA` | `SHOULD` |', '|---|---:|---:|---:|---:|'];
  for (const level of levels) {
    const inL = rows.filter((r) => r.level === level.id);
    const must = count(inL, (r) => r.scope === 'MUST');
    const mwa = count(inL, (r) => r.scope === 'MwA');
    const should = count(inL, (r) => r.scope === 'SHOULD');
    out.push(`| ${level.label} | ${inL.length} | ${must} | ${mwa} | ${should} |`);
  }
  const may = count(rows, (r) => r.level === '—');
  out.push(`| — (\`MAY\` — never required) | ${may} | — | — | — |`);
  return out.join('\n');
}

function blockCumulative(rows: CoverageRow[], levels: readonly CoverageLevel[]): string {
  // closure(N) = MUST/MwA rows whose level ≤ N (interpreted as integer).
  const closure = (n: number) =>
    count(
      rows,
      (r) => r.level !== '—' && +r.level.slice(1) <= n && (r.scope === 'MUST' || r.scope === 'MwA'),
    );
  const should = count(rows, (r) => r.scope === 'SHOULD');
  const out = [
    '| Claiming level | Cumulative `MUST` + `MwA` (worst case) | New rows over previous level |',
    '|---|---:|---:|',
  ];
  let prev = 0;
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    const n = +level.id.slice(1);
    const c = closure(n);
    const isLast = i === levels.length - 1;
    const totalCol = isLast ? `${c} (plus ${should} \`SHOULD\` rows resolved)` : `${c}`;
    const deltaCol =
      i === 0
        ? '—'
        : isLast
          ? `+${c - prev} \`MUST\`/\`MwA\`, +${should} \`SHOULD\``
          : `+${c - prev}`;
    out.push(`| ${level.id} | ${totalCol} | ${deltaCol} |`);
    prev = c;
  }
  return out.join('\n');
}

function main(): void {
  const catalog = loadValidatedCatalog(CATALOG_PATH, CATALOG);
  const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const content = renderCoverageMap(catalog, templateContent);
  if (process.argv.includes('--check')) {
    const current = fs.readFileSync(COVERAGE_PATH, 'utf8');
    if (content !== current) {
      console.error(
        `${COVERAGE} is stale. Run 'npm --prefix tools run generate:coverage' locally and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`OK — ${COVERAGE} matches ${TEMPLATE} and ${CATALOG}`);
    return;
  }
  fs.writeFileSync(COVERAGE_PATH, content);
  console.log(
    `OK — regenerated 5 blocks in ${COVERAGE} from ${coverageRowsFromCatalog(catalog).length} catalog rows`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

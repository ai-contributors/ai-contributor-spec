#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Regenerates the numeric blocks of AI-CONTRIBUTOR-COVERAGE.md from the
// generated AI-CONTRIBUTOR-RULE-CATALOG.json.
//
// Each managed block in COVERAGE.md is delimited by:
//   <!-- BEGIN:GENERATED <id> -->
//   ...generated content...
//   <!-- END:GENERATED <id> -->
//
// Run locally to refresh. Pass `--check` to fail when the current coverage file
// content drifts from what the rule catalog generates.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { validateRuleCatalog, type RuleCatalog } from './generate-rule-catalog.ts';
import { levelLabels, pillarNames } from './shared/spec-model.ts';
import { stampGeneratedBlock } from './shared/stamp-generated-block.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const COVERAGE = 'AI-CONTRIBUTOR-COVERAGE.md';
const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const COVERAGE_PATH = path.join(REPO_ROOT, COVERAGE);
const SPEC_PATH = path.join(REPO_ROOT, SPEC);

export type CoverageScope = 'MUST' | 'MwA' | 'SHOULD' | 'MAY';

export interface CoverageRow {
  rule: string;
  pillar: number;
  level: string;
  scope: CoverageScope;
}

const specText = fs.readFileSync(SPEC_PATH, 'utf8');
const PILLAR_NAMES = pillarNames(specText);
const LEVEL_LABELS = levelLabels(specText);

function tally(): CoverageRow[] {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const problems = validateRuleCatalog(catalog);
  if (problems.length > 0) {
    throw new Error(`Invalid ${CATALOG}:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  }
  return coverageRowsFromCatalog(catalog);
}

export function coverageRowsFromCatalog(catalog: RuleCatalog): CoverageRow[] {
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
  scope: RuleCatalog['rules'][number]['checklist']['scope'],
): CoverageScope {
  return scope === 'MUST when applicable' ? 'MwA' : scope;
}

function count(rows: CoverageRow[], pred: (row: CoverageRow) => boolean): number {
  return rows.filter(pred).length;
}

function blockAtAGlance(rows: CoverageRow[]): string {
  const total = rows.length;
  const must = count(rows, (r) => r.scope === 'MUST');
  const mwa = count(rows, (r) => r.scope === 'MwA');
  const should = count(rows, (r) => r.scope === 'SHOULD');
  const may = count(rows, (r) => r.scope === 'MAY');
  const l0 = count(rows, (r) => r.level === 'L0');
  const l1 = count(rows, (r) => r.level === 'L1');
  const l2 = count(rows, (r) => r.level === 'L2');
  const l3 = count(rows, (r) => r.level === 'L3');
  const l4Mwa = count(rows, (r) => r.level === 'L4' && r.scope === 'MwA');
  const l4Should = count(rows, (r) => r.level === 'L4' && r.scope === 'SHOULD');
  return [
    `- **${total}** total rows`,
    `- **${must}** unconditional \`MUST\` + **${mwa}** \`MUST when applicable\` + **${should}** \`SHOULD\` + **${may}** \`MAY\``,
    `- **${l0}** rows at Level 0; **${l1}** rows at Level 1; **${l2}** rows at Level 2; **${l3}** rows at Level 3`,
    `- Level 4 adds **${l4Mwa}** autonomous-runner \`MUST when applicable\` rows plus **${l4Should}** \`SHOULD\` rows`,
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

// Iteration order derived from the SPEC-loaded maps so adding a new pillar or
// conformance level to the SPEC reshapes the output automatically.
const PILLAR_NUMBERS = Object.keys(PILLAR_NAMES)
  .map(Number)
  .sort((a, b) => a - b);
// Sort numerically by the integer suffix so future levels past L9 (L10, L11, ...)
// retain natural order. A bare `.sort()` would put "L10" between "L1" and "L2".
const LEVEL_KEYS = Object.keys(LEVEL_LABELS).sort(
  (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
);

function blockByPillar(rows: CoverageRow[]): string {
  const out = [
    '| Pillar | Total | `MUST` | `MwA` | `SHOULD` | `MAY` |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const p of PILLAR_NUMBERS) {
    const inP = rows.filter((r) => r.pillar === p);
    const must = count(inP, (r) => r.scope === 'MUST');
    const mwa = count(inP, (r) => r.scope === 'MwA');
    const should = count(inP, (r) => r.scope === 'SHOULD');
    const may = count(inP, (r) => r.scope === 'MAY');
    out.push(
      `| ${p} · ${PILLAR_NAMES[p]} | ${inP.length} | ${must} | ${mwa} | ${should} | ${may} |`,
    );
  }
  return out.join('\n');
}

function blockByLevel(rows: CoverageRow[]): string {
  const out = ['| Level | Rows | `MUST` | `MwA` | `SHOULD` |', '|---|---:|---:|---:|---:|'];
  for (const lvl of LEVEL_KEYS) {
    const inL = rows.filter((r) => r.level === lvl);
    const must = count(inL, (r) => r.scope === 'MUST');
    const mwa = count(inL, (r) => r.scope === 'MwA');
    const should = count(inL, (r) => r.scope === 'SHOULD');
    out.push(`| ${LEVEL_LABELS[lvl]} | ${inL.length} | ${must} | ${mwa} | ${should} |`);
  }
  const may = count(rows, (r) => r.level === '—');
  out.push(`| — (\`MAY\` — never required) | ${may} | — | — | — |`);
  return out.join('\n');
}

function blockCumulative(rows: CoverageRow[]): string {
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
  for (let i = 0; i < LEVEL_KEYS.length; i++) {
    const lvl = LEVEL_KEYS[i];
    const n = +lvl.slice(1);
    const c = closure(n);
    const isLast = i === LEVEL_KEYS.length - 1;
    const totalCol = isLast ? `${c} (plus ${should} \`SHOULD\` rows resolved)` : `${c}`;
    const deltaCol =
      i === 0
        ? '—'
        : isLast
          ? `+${c - prev} \`MUST\`/\`MwA\`, +${should} \`SHOULD\``
          : `+${c - prev}`;
    out.push(`| ${lvl} | ${totalCol} | ${deltaCol} |`);
    prev = c;
  }
  return out.join('\n');
}

function main(): void {
  const rows = tally();
  let content = fs.readFileSync(COVERAGE_PATH, 'utf8');
  content = stampGeneratedBlock(content, 'at-a-glance', blockAtAGlance(rows));
  content = stampGeneratedBlock(content, 'by-scope', blockByScope(rows));
  content = stampGeneratedBlock(content, 'by-pillar', blockByPillar(rows));
  content = stampGeneratedBlock(content, 'by-level', blockByLevel(rows));
  content = stampGeneratedBlock(content, 'cumulative', blockCumulative(rows));
  if (process.argv.includes('--check')) {
    const current = fs.readFileSync(COVERAGE_PATH, 'utf8');
    if (content !== current) {
      console.error(
        `${COVERAGE} is stale. Run 'npm --prefix tools run generate:coverage' locally and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`OK — ${COVERAGE} generated blocks are current`);
    return;
  }
  fs.writeFileSync(COVERAGE_PATH, content);
  console.log(`OK — regenerated 5 blocks in ${COVERAGE} from ${rows.length} catalog rows`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

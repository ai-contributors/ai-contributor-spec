#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Renders the rule-bearing checklist regions from
// AI-CONTRIBUTOR-RULE-CATALOG.json. The surrounding audit instructions remain
// hand-authored checklist frame text.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  validateRuleCatalog,
  type RuleCatalog,
  type RuleCatalogEntry,
} from './generate-rule-catalog.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const CHECKLIST_PATH = path.join(REPO_ROOT, CHECKLIST);

const LEGACY_ID_BINDINGS_START = '<!-- BEGIN:CHECKLIST-ID-BINDINGS';
const LEGACY_ID_BINDINGS_END = 'END:CHECKLIST-ID-BINDINGS -->';
const RULE_TABLES_START = '## Checklist row tables';
const RULE_TABLES_END = '---\n\n## Verification gaps';

const LEVEL_HEADINGS: Record<string, string> = {
  L0: '## Level 0 — Baseline Hygiene',
  L1: '## Level 1 — Hardened',
  L2: '## Level 2 — AI Assisted',
  L3: '## Level 3 — AI Authored',
  L4: '## Level 4 — AI Autonomous',
};

const LEVEL_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4'];
const SCOPE_ORDER = ['MUST', 'MUST when applicable', 'SHOULD', 'MAY'];
const CHECKLIST_HEADER = '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |';
const CHECKLIST_SEPARATOR = '|-------|------|---|--------|---------|-------------|--------|-----|';

interface Region {
  start: number;
  end: number;
  text: string;
}

interface ChecklistAssetRow {
  level: string;
  scope: string;
  clause: number;
  rule: string;
  requirement: string;
  pillar: number;
  ids: string[];
}

interface ChecklistAssetRowData extends Omit<ChecklistAssetRow, 'ids' | 'clause'> {
  entries: RuleCatalogEntry[];
}

export function renderChecklistRuleTables(catalog: RuleCatalog): string {
  const rows = checklistRowsFromCatalog(catalog);
  const lines = [
    '## Checklist row tables',
    '',
    "**Pillar legend.** The `Pillar` column in each table below holds the pillar number 1–7. The names, clause ranges, and scope summaries are defined once in [`AI-CONTRIBUTOR-SPECIFICATION.md` § Pillars](../AI-CONTRIBUTOR-SPECIFICATION.md#pillars). The pillar taxonomy is non-normative — it is a reader's map, not an additional requirement.",
    '',
    '**Scope legend.** `MUST` rows are unconditional at that level. `MUST when applicable` rows are required only when their trigger applies. `SHOULD` rows must be resolved for Level 4. `MAY` rows are optional and never required for conformance.',
    '',
  ];

  for (const level of LEVEL_ORDER) {
    const levelRows = rows.filter((row) => row.level === level);
    if (levelRows.length === 0) continue;
    lines.push(LEVEL_HEADINGS[level]!, '');
    if (level === 'L0') {
      lines.push(
        'Level 0 contains seven unconditional normative MUST IDs represented by five checklist rows because `Pinned Toolchain` groups runtime, package-manager, and lockfile pinning. The `Env Template` row remains a Level 0 requirement when its environment-variable trigger applies.',
        '',
      );
    }
    if (level === 'L2') {
      lines.push(
        "Level 2 is the AI-declared level. Every row below is required to formally declare AI as part of the repository's contribution workflow, or to close a feature-triggered risk control for AI-assisted work.",
        '',
      );
    }
    if (level === 'L3') {
      lines.push(
        'For any Level 3 claim, the Level 2 `Prompt Audit Trail` row is always applicable because Level 3 means AI materially authors code that ships.',
        '',
      );
    }
    lines.push(...renderChecklistTable(levelRows), '');
  }

  const optionalRows = rows.filter((row) => row.level === '—');
  if (optionalRows.length > 0) {
    lines.push('## Optional', '', ...renderChecklistTable(optionalRows));
  }

  return `${lines.join('\n')}\n\n`;
}

export function renderChecklistAssets(catalog: RuleCatalog, checklistContent: string): string {
  const withoutLegacyIdBindings = removeLegacyIdBindingsRegion(checklistContent);
  return replaceRegion(
    withoutLegacyIdBindings,
    extractRuleTablesRegion(withoutLegacyIdBindings),
    renderChecklistRuleTables(catalog),
    'checklist rule tables',
  );
}

export function checklistAssetProblems(input: {
  catalog: RuleCatalog;
  checklistContent: string;
}): string[] {
  const problems = validateRuleCatalog(input.catalog);
  if (problems.length > 0) return problems;

  if (extractLegacyIdBindingsRegion(input.checklistContent)) {
    problems.push(
      `${CHECKLIST} still contains legacy checklist ID bindings. Run 'npm --prefix tools run generate:checklist-assets'.`,
    );
  }

  const tableRegion = extractRuleTablesRegion(input.checklistContent);
  if (!tableRegion || tableRegion.text !== renderChecklistRuleTables(input.catalog)) {
    problems.push(
      `${CHECKLIST} checklist rule tables are stale. Run 'npm --prefix tools run generate:checklist-assets'.`,
    );
  }

  return problems;
}

function checklistRowsFromCatalog(catalog: RuleCatalog): ChecklistAssetRow[] {
  const rows = new Map<string, ChecklistAssetRowData>();

  for (const entry of catalog.rules) {
    const key = entry.checklist.rule;
    const existing = rows.get(key);
    if (!existing) {
      rows.set(key, {
        level: entry.level,
        scope: entry.checklist.scope,
        rule: entry.checklist.rule,
        requirement: entry.checklist.requirement,
        pillar: entry.pillar,
        entries: [entry],
      });
      continue;
    }

    assertSameRowMetadata(existing, entry);
    if (existing.entries.some((rowEntry) => rowEntry.id === entry.id)) {
      throw new Error(`${entry.id} appears multiple times in checklist row "${key}"`);
    }
    existing.entries.push(entry);
  }

  const grouped = [...rows.values()].map((row) => ({
    level: row.level,
    scope: row.scope,
    clause: Math.min(...row.entries.map((entry) => entry.clause)),
    rule: row.rule,
    requirement: row.requirement,
    pillar: row.pillar,
    ids: [...row.entries].sort(compareCatalogEntriesForGeneratedAssets).map((entry) => entry.id),
  }));
  return grouped.sort(compareChecklistAssetRows);
}

function compareChecklistAssetRows(a: ChecklistAssetRow, b: ChecklistAssetRow): number {
  return (
    levelSortValue(a.level) - levelSortValue(b.level) ||
    scopeSortValue(a.scope) - scopeSortValue(b.scope) ||
    a.clause - b.clause ||
    a.rule.localeCompare(b.rule) ||
    a.ids.join(',').localeCompare(b.ids.join(','))
  );
}

function compareCatalogEntriesForGeneratedAssets(a: RuleCatalogEntry, b: RuleCatalogEntry): number {
  return (
    a.clause - b.clause ||
    scopeSortValue(a.checklist.scope) - scopeSortValue(b.checklist.scope) ||
    a.checklist.rule.localeCompare(b.checklist.rule) ||
    a.id.localeCompare(b.id)
  );
}

function levelSortValue(level: string): number {
  if (level === '—') return Number.MAX_SAFE_INTEGER;
  const m = level.match(/^L(\d+)$/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER - 1;
}

function scopeSortValue(scope: string): number {
  const index = SCOPE_ORDER.indexOf(scope);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function assertSameRowMetadata(row: ChecklistAssetRowData, entry: RuleCatalogEntry): void {
  const mismatches = [
    row.level === entry.level ? null : 'level',
    row.scope === entry.checklist.scope ? null : 'scope',
    row.requirement === entry.checklist.requirement ? null : 'requirement',
    row.pillar === entry.pillar ? null : 'pillar',
  ].filter(Boolean);
  if (mismatches.length > 0) {
    throw new Error(
      `catalog entries for checklist row "${row.rule}" disagree on ${mismatches.join(', ')}`,
    );
  }
}

function renderChecklistTable(rows: readonly ChecklistAssetRow[]): string[] {
  return [CHECKLIST_HEADER, CHECKLIST_SEPARATOR, ...rows.map(renderChecklistTableRow)];
}

function renderChecklistTableRow(row: ChecklistAssetRow): string {
  return `| \`${row.scope}\` | \`${row.rule}\` | - |  |  | ${escapeMarkdownCell(row.requirement)} | ${row.pillar} | ${row.ids.map((id) => `\`${id}\``).join(', ')} |`;
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function extractLegacyIdBindingsRegion(content: string): Region | null {
  const start = content.indexOf(LEGACY_ID_BINDINGS_START);
  if (start < 0) return null;
  const endMarkerStart = content.indexOf(LEGACY_ID_BINDINGS_END, start);
  if (endMarkerStart < 0) return null;
  const end = endMarkerStart + LEGACY_ID_BINDINGS_END.length;
  return { start, end, text: content.slice(start, end) };
}

function removeLegacyIdBindingsRegion(content: string): string {
  const region = extractLegacyIdBindingsRegion(content);
  if (!region) return content;
  const before = content.slice(0, region.start).replace(/\n{0,2}$/, '\n');
  const after = content.slice(region.end).replace(/^\n{0,2}/, '\n');
  return `${before}${after}`;
}

function extractRuleTablesRegion(content: string): Region | null {
  const start = content.indexOf(RULE_TABLES_START);
  if (start < 0) return null;
  const end = content.indexOf(RULE_TABLES_END, start);
  if (end < 0) return null;
  return { start, end, text: content.slice(start, end) };
}

function replaceRegion(
  content: string,
  region: Region | null,
  replacement: string,
  label: string,
): string {
  if (!region) throw new Error(`Cannot find ${label} region in ${CHECKLIST}`);
  return `${content.slice(0, region.start)}${replacement}${content.slice(region.end)}`;
}

function main(): void {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const checklistContent = fs.readFileSync(CHECKLIST_PATH, 'utf8');
  const problems = checklistAssetProblems({ catalog, checklistContent });

  if (process.argv.includes('--check')) {
    if (problems.length > 0) {
      console.error('Problems:');
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(`OK — ${CHECKLIST} generated checklist assets match ${CATALOG}`);
    return;
  }

  const rendered = renderChecklistAssets(catalog, checklistContent);
  fs.writeFileSync(CHECKLIST_PATH, rendered);
  console.log(`OK — regenerated generated checklist assets in ${CHECKLIST}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

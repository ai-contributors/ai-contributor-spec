#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Renders .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md from a Markdown
// template and AI-CONTRIBUTOR-RULE-CATALOG.json. The template owns audit
// instructions and placement; the catalog owns rule-table facts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  validateRuleCatalog,
  type RuleCatalog,
  type RuleCatalogEntry,
  type RuleCatalogLevel,
} from './generate-rule-catalog.ts';
import { renderMarkdownTable } from '../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';
const TEMPLATE = 'tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const CHECKLIST_PATH = path.join(REPO_ROOT, CHECKLIST);
const TEMPLATE_PATH = path.join(REPO_ROOT, TEMPLATE);
const TEMPLATE_DIRECTIVE = /{{\s*([^{}]+?)\s*}}/g;

const SCOPE_ORDER = ['MUST', 'MUST when applicable', 'SHOULD', 'MAY'];
const CHECKLIST_HEADER = '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |';
const CHECKLIST_SEPARATOR = '|-------|------|---|--------|---------|-------------|--------|-----|';

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

interface RenderResult {
  content: string;
  problems: string[];
}

interface RenderContext {
  usedSpecVersion: number;
  usedConformanceLevelValues: number;
  usedConformanceLevelSummaryRows: number;
  usedConformanceLevelBullets: number;
  usedRuleTables: number;
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

  for (const level of conformanceLevelsFromCatalog(catalog)) {
    const levelRows = rows.filter((row) => row.level === level.id);
    if (levelRows.length === 0) continue;
    lines.push(`## ${levelDisplayName(level)}`, '');
    if (level.id === 'L0') {
      lines.push(
        'Level 0 contains seven unconditional normative MUST IDs represented by five checklist rows because `Pinned Toolchain` groups runtime, package-manager, and lockfile pinning. The `Env Template` row remains a Level 0 requirement when its environment-variable trigger applies.',
        '',
      );
    }
    if (level.id === 'L2') {
      lines.push(
        "Level 2 is the AI-declared level. Every row below is required to formally declare AI as part of the repository's contribution workflow, or to close a feature-triggered risk control for AI-assisted work.",
        '',
      );
    }
    if (level.id === 'L3') {
      lines.push(
        'For any Level 3 claim, the Level 2 `Prompt Audit Trail` row is always applicable because Level 3 means AI materially authors code that ships.',
        '',
      );
    }
    lines.push(...renderChecklistTable(levelRows), '');
  }

  const optionalRows = rows.filter((row) => row.level === '—');
  const optionalLevel = catalog.levels.find((level) => level.id === '—');
  if (optionalRows.length > 0) {
    lines.push(
      `## ${optionalLevel?.label ?? 'Optional'}`,
      '',
      ...renderChecklistTable(optionalRows),
    );
  }

  return `${lines.join('\n')}\n\n`;
}

export function renderChecklistAssets(catalog: RuleCatalog, templateContent: string): string {
  const catalogProblems = validateRuleCatalog(catalog);
  if (catalogProblems.length > 0) {
    throw new Error(`Rule catalog validation failed:\n${catalogProblems.join('\n')}`);
  }

  const result = renderChecklistResult(catalog, templateContent);
  if (result.problems.length > 0) {
    throw new Error(result.problems.join('\n'));
  }
  return result.content;
}

export function checklistAssetProblems(input: {
  catalog: RuleCatalog;
  templateContent: string;
  checklistContent: string;
}): string[] {
  const problems = validateRuleCatalog(input.catalog);
  if (problems.length > 0) return problems;

  const result = renderChecklistResult(input.catalog, input.templateContent);
  problems.push(...result.problems);
  if (result.problems.length === 0 && result.content !== input.checklistContent) {
    problems.push(
      `${CHECKLIST} does not match ${TEMPLATE} and ${CATALOG}. Run 'npm --prefix tools run generate:checklist-assets'.`,
    );
  }

  return problems;
}

function renderChecklistResult(catalog: RuleCatalog, templateContent: string): RenderResult {
  const problems: string[] = [];
  const context: RenderContext = {
    usedSpecVersion: 0,
    usedConformanceLevelValues: 0,
    usedConformanceLevelSummaryRows: 0,
    usedConformanceLevelBullets: 0,
    usedRuleTables: 0,
  };
  const content = templateContent.replace(TEMPLATE_DIRECTIVE, (marker, directive: string) => {
    const rendered = renderDirective(catalog, context, directive.trim(), problems);
    return rendered ?? marker;
  });

  validateDirectiveCoverage(context, problems);
  if (TEMPLATE_DIRECTIVE.test(content)) {
    problems.push(`${TEMPLATE} rendered output still contains unresolved template directives.`);
  }
  TEMPLATE_DIRECTIVE.lastIndex = 0;

  return {
    content: ensureTrailingNewline(content),
    problems,
  };
}

function renderDirective(
  catalog: RuleCatalog,
  context: RenderContext,
  directive: string,
  problems: string[],
): string | null {
  if (directive === 'specVersion') {
    context.usedSpecVersion++;
    return catalog.specVersion;
  }

  if (directive === 'generated:conformance-level-values') {
    context.usedConformanceLevelValues++;
    return renderConformanceLevelValues(catalog);
  }

  if (directive === 'generated:conformance-level-summary-rows') {
    context.usedConformanceLevelSummaryRows++;
    return renderConformanceLevelSummaryRows(catalog);
  }

  if (directive === 'generated:conformance-level-bullets') {
    context.usedConformanceLevelBullets++;
    return renderConformanceLevelBullets(catalog);
  }

  if (directive === 'generated:checklist-rule-tables') {
    context.usedRuleTables++;
    return renderChecklistRuleTables(catalog).trimEnd();
  }

  problems.push(`${TEMPLATE} contains unknown checklist template directive {{${directive}}}.`);
  return null;
}

function validateDirectiveCoverage(context: RenderContext, problems: string[]): void {
  validateSingleton('specVersion', context.usedSpecVersion, problems);
  validateSingleton(
    'generated:conformance-level-values',
    context.usedConformanceLevelValues,
    problems,
  );
  validateSingleton(
    'generated:conformance-level-summary-rows',
    context.usedConformanceLevelSummaryRows,
    problems,
  );
  validateSingleton(
    'generated:conformance-level-bullets',
    context.usedConformanceLevelBullets,
    problems,
  );
  validateSingleton('generated:checklist-rule-tables', context.usedRuleTables, problems);
}

function validateSingleton(name: string, count: number, problems: string[]): void {
  if (count === 0) {
    problems.push(`No checklist template directive found for ${name}.`);
  } else if (count > 1) {
    problems.push(`${TEMPLATE} contains ${count} checklist template directives for ${name}.`);
  }
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

function renderConformanceLevelValues(catalog: RuleCatalog): string {
  return conformanceLevelsFromCatalog(catalog).map(conformanceLevelValue).join(', ');
}

function renderConformanceLevelSummaryRows(catalog: RuleCatalog): string {
  return renderMarkdownTable(
    ['Level', 'Status', 'Date reached', 'Notes'],
    conformanceLevelsFromCatalog(catalog).map((level) => [
      `**${levelDisplayName(level)}**`,
      '<FILL_STATUS>',
      '<FILL_DATE>',
      '<FILL_NOTES>',
    ]),
  )
    .slice(2)
    .join('\n');
}

function renderConformanceLevelBullets(catalog: RuleCatalog): string {
  return conformanceLevelsFromCatalog(catalog)
    .map((level) => `- **${levelDisplayName(level)}:** ${level.description}`)
    .join('\n');
}

function conformanceLevelsFromCatalog(catalog: RuleCatalog): RuleCatalogLevel[] {
  return catalog.levels
    .filter((level) => level.id !== '—')
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function levelDisplayName(level: RuleCatalogLevel): string {
  const m = level.id.match(/^L(\d+)$/);
  return m ? `Level ${m[1]} — ${level.label}` : level.label;
}

function conformanceLevelValue(level: RuleCatalogLevel): string {
  const m = level.id.match(/^L(\d+)$/);
  return m ? m[1]! : level.id;
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

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function main(): void {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const checklistContent = fs.readFileSync(CHECKLIST_PATH, 'utf8');
  const problems = checklistAssetProblems({ catalog, templateContent, checklistContent });

  if (process.argv.includes('--check')) {
    if (problems.length > 0) {
      console.error('Problems:');
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(`OK — ${CHECKLIST} matches ${TEMPLATE} and ${CATALOG}`);
    return;
  }

  const rendered = renderChecklistAssets(catalog, templateContent);
  fs.writeFileSync(CHECKLIST_PATH, rendered);
  console.log(`OK — regenerated ${CHECKLIST} from ${TEMPLATE} and ${CATALOG}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

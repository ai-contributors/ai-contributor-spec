#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Renders AI-CONTRIBUTOR-SPECIFICATION.md from a Markdown template and
// AI-CONTRIBUTOR-RULE-CATALOG.json. The catalog owns structured facts; the
// template owns long-form prose and placement.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  type RuleCatalogClause,
  type RuleCatalogEntry,
  type RuleCatalogPillar,
  type ValidatedRuleCatalog,
} from './generate-rule-catalog.ts';
import { loadValidatedCatalog } from './shared/catalog-loader.ts';
import type { SpecScope } from './shared/spec-model.ts';
import {
  renderTemplateDirectives,
  type TemplateDirectiveRenderer,
} from './shared/template-renderer.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const TEMPLATE = 'tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const SPEC_PATH = path.join(REPO_ROOT, SPEC);
const TEMPLATE_PATH = path.join(REPO_ROOT, TEMPLATE);
const SCOPE_ORDER: readonly SpecScope[] = ['MUST', 'MUST when applicable', 'SHOULD', 'MAY'];

interface RenderResult {
  content: string;
  problems: string[];
}

interface RenderContext {
  ruleGroups: Map<string, RuleCatalogEntry[]>;
}

export function renderSpecification(
  catalog: ValidatedRuleCatalog,
  templateContent: string,
): string {
  const result = renderSpecificationResult(catalog, templateContent);
  if (result.problems.length > 0) {
    throw new Error(result.problems.join('\n'));
  }
  return result.content;
}

function specificationAssetProblems(input: {
  catalog: ValidatedRuleCatalog;
  templateContent: string;
  specContent: string;
}): string[] {
  const problems: string[] = [];

  const result = renderSpecificationResult(input.catalog, input.templateContent);
  problems.push(...result.problems);
  if (result.problems.length === 0 && result.content !== input.specContent) {
    problems.push(
      `${SPEC} specification is stale. Run 'npm --prefix tools run generate:specification'.`,
    );
  }
  return problems;
}

function renderSpecificationResult(
  catalog: ValidatedRuleCatalog,
  templateContent: string,
): RenderResult {
  const context = buildRenderContext(catalog);
  const directives: Record<string, TemplateDirectiveRenderer> = {
    specVersion: () => catalog.specVersion,
    'generated:pillars-table': () => renderPillarsTable(catalog),
    'generated:conformance-levels': () => renderConformanceLevels(catalog),
    'generated:clause-count': () => String(catalog.clauses.length),
    'generated:spec-scope-list': () => renderCodeList(SCOPE_ORDER),
    'generated:level-workflow-table': (problems) => renderLevelWorkflowTable(catalog, problems),
    'generated:specification-clauses': () => renderSpecificationClauses(catalog, context),
  };
  const result = renderTemplateDirectives({
    templateContent,
    directives,
    requiredDirectives: [
      'specVersion',
      'generated:pillars-table',
      'generated:conformance-levels',
      'generated:specification-clauses',
    ],
    messages: {
      templatePath: TEMPLATE,
    },
  });

  return {
    content: result.content,
    problems: result.problems,
  };
}

function buildRenderContext(catalog: ValidatedRuleCatalog): RenderContext {
  const ruleGroups = new Map<string, RuleCatalogEntry[]>();
  for (const entry of catalog.rules) {
    const key = ruleGroupKey(entry.clause, entry.scope);
    ruleGroups.set(key, [...(ruleGroups.get(key) ?? []), entry]);
  }
  for (const group of ruleGroups.values()) group.sort(compareEntriesForSpecification);

  return {
    ruleGroups,
  };
}

function renderPillarsTable(catalog: ValidatedRuleCatalog): string {
  const lines = ['| Pillar | Name | Clauses | Scope |', '|---|---|---|---|'];
  for (const pillar of [...catalog.pillars].sort((a, b) => a.number - b.number)) {
    lines.push(
      `| ${pillar.number} | ${markdownTableCell(pillarDisplayName(pillar))} | ${clauseRange(
        catalog,
        pillar.number,
      )} | ${markdownTableCell(pillar.description)} |`,
    );
  }
  return lines.join('\n');
}

function renderSpecificationClauses(catalog: ValidatedRuleCatalog, context: RenderContext): string {
  const lines: string[] = [];
  const pillars = [...catalog.pillars].sort((a, b) => a.number - b.number);
  const clauses = [...catalog.clauses].sort((a, b) => a.number - b.number);

  for (const pillar of pillars) {
    const pillarClauses = clauses.filter((clause) => clause.pillar === pillar.number);
    if (pillarClauses.length === 0) continue;

    lines.push(renderPillarHeading(pillar), '');
    for (const clause of pillarClauses) {
      lines.push(renderClauseHeading(clause), '');
      for (const scope of SCOPE_ORDER) {
        const entries = context.ruleGroups.get(ruleGroupKey(clause.number, scope));
        if (!entries) continue;
        lines.push(`##### \`${scope}\``, '', ...entries.map(renderSpecificationRuleBullet), '');
      }
      lines.push('---', '');
    }
  }

  return lines.join('\n').trimEnd();
}

function renderPillarHeading(pillar: RuleCatalogPillar): string {
  return `### Pillar ${pillar.number} — ${pillarDisplayName(pillar)}`;
}

function renderClauseHeading(clause: RuleCatalogClause): string {
  return `#### ${clause.number}. ${clause.title}`;
}

function renderSpecificationRuleBullet(entry: RuleCatalogEntry): string {
  return `- ${entry.text} <sup>\`${entry.id}\`</sup>`;
}

function renderConformanceLevels(catalog: ValidatedRuleCatalog): string {
  return [...catalog.levels]
    .filter((level) => level.id !== '—')
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((level) => `- **Level ${level.order} — ${level.label}.** ${level.description}`)
    .join('\n');
}

function renderLevelWorkflowTable(
  catalog: ValidatedRuleCatalog,
  problems: string[],
): string | null {
  const levels = [...catalog.levels]
    .filter((level) => level.id !== '—')
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const missingWorkflowSummaries = levels.filter((level) => !level.workflowSummary);
  if (missingWorkflowSummaries.length > 0) {
    problems.push(
      `${CATALOG} levels missing workflowSummary for ${missingWorkflowSummaries
        .map((level) => level.id)
        .join(', ')}; required by generated:level-workflow-table.`,
    );
    return null;
  }

  const lines = ['| Minimum level | If the repository allows... |', '|---|---|'];
  for (const level of levels) {
    lines.push(
      `| **${level.id} ${markdownTableCell(level.label)}** | ${markdownTableCell(
        level.workflowSummary ?? '',
      )} |`,
    );
  }
  return lines.join('\n');
}

function renderCodeList(values: readonly string[]): string {
  const items = values.map((value) => `\`${value}\``);
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function clauseRange(catalog: ValidatedRuleCatalog, pillarNumber: number): string {
  const clauses = catalog.clauses
    .filter((clause) => clause.pillar === pillarNumber)
    .map((clause) => clause.number)
    .sort((a, b) => a - b);
  if (clauses.length === 0) return '';
  const first = clauses[0]!;
  const last = clauses[clauses.length - 1]!;
  return first === last ? `§${first}` : `§${first}–${last}`;
}

function pillarDisplayName(pillar: RuleCatalogPillar): string {
  return [pillar.icon, pillar.title].filter(Boolean).join(' ');
}

function compareEntriesForSpecification(a: RuleCatalogEntry, b: RuleCatalogEntry): number {
  return (
    levelSortValue(a.level) - levelSortValue(b.level) ||
    a.checklist.rule.localeCompare(b.checklist.rule) ||
    a.id.localeCompare(b.id)
  );
}

function levelSortValue(level: string): number {
  if (level === '—') return Number.MAX_SAFE_INTEGER;
  const m = level.match(/^L(\d+)$/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER - 1;
}

function ruleGroupKey(clause: number, scope: SpecScope): string {
  return `${clause}\u0000${scope}`;
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function main(): void {
  const catalog = loadValidatedCatalog(CATALOG_PATH, CATALOG);
  const templateContent = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const specContent = fs.readFileSync(SPEC_PATH, 'utf8');
  const problems = specificationAssetProblems({ catalog, templateContent, specContent });

  if (process.argv.includes('--check')) {
    if (problems.length > 0) {
      console.error('Problems:');
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(`OK — ${SPEC} matches ${TEMPLATE} and ${CATALOG}`);
    return;
  }

  const rendered = renderSpecification(catalog, templateContent);
  fs.writeFileSync(SPEC_PATH, rendered);
  console.log(`OK — regenerated ${SPEC} from ${TEMPLATE} and ${CATALOG}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

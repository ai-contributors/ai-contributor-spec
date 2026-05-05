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
  validateRuleCatalog,
  type RuleCatalog,
  type RuleCatalogEntry,
  type RuleCatalogPillar,
} from './generate-rule-catalog.ts';
import type { ClauseDetail, SpecScope } from './shared/spec-model.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const TEMPLATE = 'tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const SPEC_PATH = path.join(REPO_ROOT, SPEC);
const TEMPLATE_PATH = path.join(REPO_ROOT, TEMPLATE);
const TEMPLATE_DIRECTIVE = /{{\s*([^{}]+?)\s*}}/g;
const SCOPE_ORDER: readonly SpecScope[] = ['MUST', 'MUST when applicable', 'SHOULD', 'MAY'];

interface RenderResult {
  content: string;
  problems: string[];
}

interface RenderContext {
  pillarsByNumber: Map<number, RuleCatalogPillar>;
  clausesByNumber: Map<number, ClauseDetail>;
  ruleGroups: Map<string, RuleCatalogEntry[]>;
  usedSpecVersion: number;
  usedPillarsTable: number;
  usedConformanceLevels: number;
  usedSpecificationClauses: number;
  usedPillarHeadings: Map<number, number>;
  usedClauseHeadings: Map<number, number>;
  usedRuleGroups: Map<string, number>;
}

export function renderSpecification(catalog: RuleCatalog, templateContent: string): string {
  const catalogProblems = validateRuleCatalog(catalog);
  if (catalogProblems.length > 0) {
    throw new Error(`Rule catalog validation failed:\n${catalogProblems.join('\n')}`);
  }

  const result = renderSpecificationResult(catalog, templateContent);
  if (result.problems.length > 0) {
    throw new Error(result.problems.join('\n'));
  }
  return result.content;
}

export function specificationAssetProblems(input: {
  catalog: RuleCatalog;
  templateContent: string;
  specContent: string;
}): string[] {
  const problems = validateRuleCatalog(input.catalog);
  if (problems.length > 0) return problems;

  const result = renderSpecificationResult(input.catalog, input.templateContent);
  problems.push(...result.problems);
  if (result.problems.length === 0 && result.content !== input.specContent) {
    problems.push(
      `${SPEC} specification is stale. Run 'npm --prefix tools run generate:specification'.`,
    );
  }
  return problems;
}

function renderSpecificationResult(catalog: RuleCatalog, templateContent: string): RenderResult {
  const problems: string[] = [];
  const context = buildRenderContext(catalog);
  const content = templateContent.replace(TEMPLATE_DIRECTIVE, (marker, directive: string) => {
    const rendered = renderDirective(catalog, context, directive.trim(), problems);
    return rendered ?? marker;
  });

  validateDirectiveCoverage(catalog, context, problems);
  if (TEMPLATE_DIRECTIVE.test(content)) {
    problems.push(`${TEMPLATE} rendered output still contains unresolved template directives.`);
  }
  TEMPLATE_DIRECTIVE.lastIndex = 0;

  return {
    content: ensureTrailingNewline(content),
    problems,
  };
}

function buildRenderContext(catalog: RuleCatalog): RenderContext {
  const ruleGroups = new Map<string, RuleCatalogEntry[]>();
  for (const entry of catalog.rules) {
    const key = ruleGroupKey(entry.clause, entry.scope);
    ruleGroups.set(key, [...(ruleGroups.get(key) ?? []), entry]);
  }
  for (const group of ruleGroups.values()) group.sort(compareEntriesForSpecification);

  return {
    pillarsByNumber: new Map(catalog.pillars.map((pillar) => [pillar.number, pillar])),
    clausesByNumber: new Map(catalog.clauses.map((clause) => [clause.number, clause])),
    ruleGroups,
    usedSpecVersion: 0,
    usedPillarsTable: 0,
    usedConformanceLevels: 0,
    usedSpecificationClauses: 0,
    usedPillarHeadings: new Map(),
    usedClauseHeadings: new Map(),
    usedRuleGroups: new Map(),
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

  if (directive === 'generated:pillars-table') {
    context.usedPillarsTable++;
    return renderPillarsTable(catalog);
  }

  if (directive === 'generated:conformance-levels') {
    context.usedConformanceLevels++;
    return renderConformanceLevels(catalog);
  }

  if (directive === 'generated:clause-count') {
    return String(catalog.clauses.length);
  }

  if (directive === 'generated:spec-scope-list') {
    return renderCodeList(SCOPE_ORDER);
  }

  if (directive === 'generated:level-workflow-table') {
    return renderLevelWorkflowTable(catalog, problems);
  }

  if (directive === 'generated:specification-clauses') {
    context.usedSpecificationClauses++;
    return renderSpecificationClauses(catalog, context);
  }

  const pillarHeading = directive.match(/^generated:pillar-heading:(\d+)$/);
  if (pillarHeading) {
    const number = Number(pillarHeading[1]);
    increment(context.usedPillarHeadings, number);
    const pillar = context.pillarsByNumber.get(number);
    if (!pillar) {
      problems.push(`${TEMPLATE} directive ${directive} references unknown pillar ${number}.`);
      return null;
    }
    return renderPillarHeading(pillar);
  }

  const clauseHeading = directive.match(/^generated:clause-heading:(\d+)$/);
  if (clauseHeading) {
    const number = Number(clauseHeading[1]);
    increment(context.usedClauseHeadings, number);
    const clause = context.clausesByNumber.get(number);
    if (!clause) {
      problems.push(`${TEMPLATE} directive ${directive} references unknown clause ${number}.`);
      return null;
    }
    return renderClauseHeading(clause);
  }

  const ruleGroup = directive.match(
    /^generated:spec-rules:(\d+):(MUST|MUST when applicable|SHOULD|MAY)$/,
  );
  if (ruleGroup) {
    const clause = Number(ruleGroup[1]);
    const scope = ruleGroup[2] as SpecScope;
    const key = ruleGroupKey(clause, scope);
    increment(context.usedRuleGroups, key);
    const entries = context.ruleGroups.get(key);
    if (!entries) {
      problems.push(
        `${TEMPLATE} directive ${directive} references empty §${clause} \`${scope}\` rule group.`,
      );
      return null;
    }
    return entries.map(renderSpecificationRuleBullet).join('\n');
  }

  problems.push(`${TEMPLATE} contains unknown template directive {{${directive}}}.`);
  return null;
}

function validateDirectiveCoverage(
  catalog: RuleCatalog,
  context: RenderContext,
  problems: string[],
): void {
  validateSingleton('specVersion', context.usedSpecVersion, problems);
  validateSingleton('generated:pillars-table', context.usedPillarsTable, problems);
  validateSingleton('generated:conformance-levels', context.usedConformanceLevels, problems);
  if (context.usedSpecificationClauses > 1) {
    problems.push(
      `${TEMPLATE} contains ${context.usedSpecificationClauses} directives for generated:specification-clauses.`,
    );
  }

  if (context.usedSpecificationClauses > 0) {
    const granularDirectiveCount =
      countUsedDirectives(context.usedPillarHeadings) +
      countUsedDirectives(context.usedClauseHeadings) +
      countUsedDirectives(context.usedRuleGroups);
    if (granularDirectiveCount > 0) {
      problems.push(
        `${TEMPLATE} must use either generated:specification-clauses or granular clause directives, not both.`,
      );
    }
    return;
  }

  for (const pillar of catalog.pillars) {
    validateSingleton(
      `generated:pillar-heading:${pillar.number}`,
      context.usedPillarHeadings.get(pillar.number) ?? 0,
      problems,
    );
  }

  for (const clause of catalog.clauses) {
    validateSingleton(
      `generated:clause-heading:${clause.number}`,
      context.usedClauseHeadings.get(clause.number) ?? 0,
      problems,
    );
  }

  for (const [key, entries] of context.ruleGroups) {
    const [clause, scope] = splitRuleGroupKey(key);
    const count = context.usedRuleGroups.get(key) ?? 0;
    if (count === 0) {
      problems.push(
        `No template directive found for §${clause} \`${scope}\` (${entries
          .map((entry) => entry.id)
          .join(', ')}).`,
      );
    } else if (count > 1) {
      problems.push(`${TEMPLATE} contains ${count} directives for §${clause} \`${scope}\`.`);
    }
  }
}

function validateSingleton(name: string, count: number, problems: string[]): void {
  if (count === 0) {
    problems.push(`No template directive found for ${name}.`);
  } else if (count > 1) {
    problems.push(`${TEMPLATE} contains ${count} directives for ${name}.`);
  }
}

function countUsedDirectives(used: Map<unknown, number>): number {
  return [...used.values()].reduce((sum, count) => sum + count, 0);
}

function renderPillarsTable(catalog: RuleCatalog): string {
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

function renderSpecificationClauses(catalog: RuleCatalog, context: RenderContext): string {
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

function renderClauseHeading(clause: ClauseDetail): string {
  return `#### ${clause.number}. ${clause.title}`;
}

function renderSpecificationRuleBullet(entry: RuleCatalogEntry): string {
  return `- ${entry.text} <sup>\`${entry.id}\`</sup>`;
}

function renderConformanceLevels(catalog: RuleCatalog): string {
  return [...catalog.levels]
    .filter((level) => level.id !== '—')
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((level) => `- **Level ${level.order} — ${level.label}.** ${level.description}`)
    .join('\n');
}

function renderLevelWorkflowTable(catalog: RuleCatalog, problems: string[]): string | null {
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

function clauseRange(catalog: RuleCatalog, pillarNumber: number): string {
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

function splitRuleGroupKey(key: string): [number, SpecScope] {
  const [clause, scope] = key.split('\u0000');
  return [Number(clause), scope as SpecScope];
}

function increment<K>(map: Map<K, number>, key: K): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function main(): void {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
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

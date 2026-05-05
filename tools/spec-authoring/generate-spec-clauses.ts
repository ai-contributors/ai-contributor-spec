#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Renders the normative AIC-* rule bullets in
// AI-CONTRIBUTOR-SPECIFICATION.md from AI-CONTRIBUTOR-RULE-CATALOG.json. The
// surrounding clause frame text remains hand-authored.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  validateRuleCatalog,
  type RuleCatalog,
  type RuleCatalogEntry,
} from './generate-rule-catalog.ts';
import type { SpecScope } from './shared/spec-model.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const SPEC_PATH = path.join(REPO_ROOT, SPEC);

const SPECIFICATION_CLAUSES_HEADING = /^## Specification clauses\s*$/;
const SPECIFICATION_CLAUSES_END_HEADING = /^## Conformance levels\s*$/;
const CLAUSE_HEADING = /^#{2,4}\s+(\d+)\.\s+/;
const SCOPE_HEADING = /^#{3,6}\s+`(MUST|MUST when applicable|SHOULD|MAY)`\s*$/;
const AIC_RULE_BULLET = /^- .*<sup>`AIC-[a-z0-9][a-z0-9-]*`<\/sup>\s*$/;

interface RenderResult {
  content: string;
  problems: string[];
}

export function renderSpecificationClauseRules(catalog: RuleCatalog, specContent: string): string {
  const catalogProblems = validateRuleCatalog(catalog);
  if (catalogProblems.length > 0) {
    throw new Error(`Rule catalog validation failed:\n${catalogProblems.join('\n')}`);
  }

  const result = renderSpecificationClauseRulesResult(catalog, specContent);
  if (result.problems.length > 0) {
    throw new Error(result.problems.join('\n'));
  }
  return result.content;
}

export function specificationClauseAssetProblems(input: {
  catalog: RuleCatalog;
  specContent: string;
}): string[] {
  const problems = validateRuleCatalog(input.catalog);
  if (problems.length > 0) return problems;

  const result = renderSpecificationClauseRulesResult(input.catalog, input.specContent);
  problems.push(...result.problems);
  if (result.problems.length === 0 && result.content !== input.specContent) {
    problems.push(
      `${SPEC} specification rule bullets are stale. Run 'npm --prefix tools run generate:spec-clauses'.`,
    );
  }
  return problems;
}

function renderSpecificationClauseRulesResult(
  catalog: RuleCatalog,
  specContent: string,
): RenderResult {
  const groups = specificationRuleGroups(catalog);
  const renderedGroups = new Set<string>();
  const problems: string[] = [];
  const lines = specContent.split(/\r?\n/);
  const out: string[] = [];
  let inClauses = false;
  let clause: number | null = null;
  let scope: SpecScope | null = null;

  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;

    if (SPECIFICATION_CLAUSES_HEADING.test(line)) {
      inClauses = true;
      clause = null;
      scope = null;
      out.push(line);
      i++;
      continue;
    }

    if (inClauses && SPECIFICATION_CLAUSES_END_HEADING.test(line)) {
      inClauses = false;
      clause = null;
      scope = null;
      out.push(line);
      i++;
      continue;
    }

    if (inClauses) {
      const clauseMatch = line.match(CLAUSE_HEADING);
      if (clauseMatch) {
        clause = Number(clauseMatch[1]);
        scope = null;
        out.push(line);
        i++;
        continue;
      }

      const scopeMatch = line.match(SCOPE_HEADING);
      if (scopeMatch) {
        scope = scopeMatch[1] as SpecScope;
        out.push(line);
        i++;
        continue;
      }

      if (clause !== null && scope !== null && AIC_RULE_BULLET.test(line)) {
        const key = ruleGroupKey(clause, scope);
        const group = groups.get(key);
        if (!group) {
          problems.push(
            `${SPEC} contains rule bullets for §${clause} \`${scope}\`, but the catalog has no matching group.`,
          );
        } else {
          out.push(...group.entries.map(renderSpecificationRuleBullet));
          renderedGroups.add(key);
        }

        while (i < lines.length && AIC_RULE_BULLET.test(lines[i]!)) i++;
        continue;
      }
    }

    out.push(line);
    i++;
  }

  for (const group of groups.values()) {
    if (renderedGroups.has(group.key)) continue;
    problems.push(
      `No specification clause frame found for §${group.clause} \`${group.scope}\` (${group.entries
        .map((entry) => entry.id)
        .join(', ')}).`,
    );
  }

  return {
    content: out.join('\n'),
    problems,
  };
}

function specificationRuleGroups(catalog: RuleCatalog): Map<
  string,
  {
    key: string;
    clause: number;
    scope: SpecScope;
    entries: RuleCatalogEntry[];
  }
> {
  const groups = new Map<
    string,
    {
      key: string;
      clause: number;
      scope: SpecScope;
      entries: RuleCatalogEntry[];
    }
  >();
  for (const entry of catalog.rules) {
    const key = ruleGroupKey(entry.clause, entry.scope);
    const group =
      groups.get(key) ??
      ({
        key,
        clause: entry.clause,
        scope: entry.scope,
        entries: [],
      } satisfies {
        key: string;
        clause: number;
        scope: SpecScope;
        entries: RuleCatalogEntry[];
      });
    group.entries.push(entry);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.entries.sort(compareEntriesForSpecification);
  }

  return groups;
}

function renderSpecificationRuleBullet(entry: RuleCatalogEntry): string {
  return `- ${entry.text} <sup>\`${entry.id}\`</sup>`;
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

function main(): void {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const specContent = fs.readFileSync(SPEC_PATH, 'utf8');
  const problems = specificationClauseAssetProblems({ catalog, specContent });

  if (process.argv.includes('--check')) {
    if (problems.length > 0) {
      console.error('Problems:');
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(`OK — ${SPEC} generated rule bullets match ${CATALOG}`);
    return;
  }

  const rendered = renderSpecificationClauseRules(catalog, specContent);
  fs.writeFileSync(SPEC_PATH, rendered);
  console.log(`OK — regenerated generated rule bullets in ${SPEC}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

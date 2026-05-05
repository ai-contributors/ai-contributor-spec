#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Verifies that the current markdown projections match the canonical
// AI-CONTRIBUTOR-RULE-CATALOG.json rule metadata.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  validateRuleCatalog,
  type RuleCatalog,
  type RuleCatalogEntry,
} from './generate-rule-catalog.ts';
import { parseChecklistRows, type ChecklistScope } from './shared/checklist-parser.ts';
import { clauseToPillar, normativeRuleMap, type SpecScope } from './shared/spec-model.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const SPEC_PATH = path.join(REPO_ROOT, SPEC);
const CHECKLIST_PATH = path.join(REPO_ROOT, CHECKLIST);

type ChecklistRow = ReturnType<typeof parseChecklistRows>[number];

export function ruleCatalogProjectionProblems(input: {
  catalog: RuleCatalog;
  specContent: string;
  checklistContent: string;
}): string[] {
  const problems = validateRuleCatalog(input.catalog);
  const catalogById = catalogEntriesById(input.catalog.rules, problems);
  const specRules = normativeRuleMap(input.specContent);
  const specPillars = clauseToPillar(input.specContent);
  const checklistById = checklistRowsById(input.checklistContent, problems);

  for (const entry of input.catalog.rules) {
    const specRule = specRules.get(entry.id);
    if (!specRule) {
      problems.push(`${entry.id} is present in ${CATALOG} but missing from ${SPEC}`);
    } else {
      if (specRule.text !== entry.text) {
        problems.push(
          `${entry.id} text mismatch: catalog "${entry.text}" vs ${SPEC} "${specRule.text}"`,
        );
      }
      if (specRule.clause !== entry.clause) {
        problems.push(
          `${entry.id} clause mismatch: catalog §${entry.clause} vs ${SPEC} §${specRule.clause}`,
        );
      }
      if (specRule.scope !== entry.scope) {
        problems.push(
          `${entry.id} scope mismatch: catalog "${entry.scope}" vs ${SPEC} "${specRule.scope}"`,
        );
      }
      const projectedPillar = specPillars.get(specRule.clause);
      if (projectedPillar !== entry.pillar) {
        problems.push(
          `${entry.id} pillar mismatch: catalog ${entry.pillar} vs ${SPEC} ${projectedPillar ?? 'unknown'}`,
        );
      }
    }

    const checklistRow = checklistById.get(entry.id);
    if (!checklistRow) {
      problems.push(`${entry.id} is present in ${CATALOG} but missing from ${CHECKLIST}`);
      continue;
    }
    compareChecklistProjection(entry, checklistRow, problems);
  }

  for (const id of specRules.keys()) {
    if (!catalogById.has(id))
      problems.push(`${id} is present in ${SPEC} but missing from ${CATALOG}`);
  }
  for (const id of checklistById.keys()) {
    if (!catalogById.has(id)) {
      problems.push(`${id} is present in ${CHECKLIST} but missing from ${CATALOG}`);
    }
  }

  return problems;
}

function catalogEntriesById(
  entries: readonly RuleCatalogEntry[],
  problems: string[],
): Map<string, RuleCatalogEntry> {
  const out = new Map<string, RuleCatalogEntry>();
  for (const entry of entries) {
    if (out.has(entry.id)) problems.push(`${entry.id} appears multiple times in ${CATALOG}`);
    out.set(entry.id, entry);
  }
  return out;
}

function checklistRowsById(content: string, problems: string[]): Map<string, ChecklistRow> {
  const out = new Map<string, ChecklistRow>();
  for (const row of parseChecklistRows(content)) {
    for (const id of row.ids) {
      if (out.has(id)) problems.push(`${id} appears in multiple ${CHECKLIST} rows`);
      out.set(id, row);
    }
  }
  return out;
}

function compareChecklistProjection(
  entry: RuleCatalogEntry,
  row: ChecklistRow,
  problems: string[],
): void {
  if (row.rule !== entry.checklist.rule) {
    problems.push(
      `${entry.id} checklist rule mismatch: catalog "${entry.checklist.rule}" vs ${CHECKLIST} "${row.rule}"`,
    );
  }
  const rowScope = catalogScopeFromChecklistScope(row.scope);
  if (rowScope !== entry.checklist.scope) {
    problems.push(
      `${entry.id} checklist scope mismatch: catalog "${entry.checklist.scope}" vs ${CHECKLIST} "${rowScope}"`,
    );
  }
  if (row.requirement !== entry.checklist.requirement) {
    problems.push(
      `${entry.id} checklist requirement mismatch: catalog "${entry.checklist.requirement}" vs ${CHECKLIST} "${row.requirement}"`,
    );
  }
  if (row.level !== entry.level) {
    problems.push(
      `${entry.id} level mismatch: catalog "${entry.level}" vs ${CHECKLIST} "${row.level}"`,
    );
  }
  if (row.pillar !== entry.pillar) {
    problems.push(
      `${entry.id} checklist pillar mismatch: catalog "${entry.pillar}" vs ${CHECKLIST} "${row.pillar}"`,
    );
  }
}

function catalogScopeFromChecklistScope(scope: ChecklistScope): SpecScope {
  return scope === 'MwA' ? 'MUST when applicable' : scope;
}

function main(): void {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const problems = ruleCatalogProjectionProblems({
    catalog,
    specContent: fs.readFileSync(SPEC_PATH, 'utf8'),
    checklistContent: fs.readFileSync(CHECKLIST_PATH, 'utf8'),
  });

  if (problems.length) {
    console.error('Problems:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  console.log(`OK — ${CATALOG} matches ${SPEC} and ${CHECKLIST} projections`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

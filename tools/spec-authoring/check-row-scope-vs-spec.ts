#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Compares each checklist row's declared scope (`MUST` / `MUST when
// applicable` / `SHOULD` / `MAY`) with the normative scope of every spec
// ID it references. Catches accidental SHOULD-promotion or MUST-demotion
// when a row is edited.
//
// One legitimate exception is allowed: a spec `MUST` may map to a
// `MUST when applicable` checklist row when the spec bullet's sentence
// itself carries an embedded applicability clause (e.g. "Multi-package
// repositories MUST…"). The mapping rule lives in
// `AI-CONTRIBUTOR-SPECIFICATION.md` § Normative language. The exempt IDs
// are enumerated below — adding a new entry requires that the spec bullet
// actually carries an embedded trigger; otherwise change the row scope.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateRuleCatalog, type RuleCatalog } from './generate-rule-catalog.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);

const MUST_TO_MWA_EXCEPTIONS = new Set<string>([
  // §1: "Multi-package repositories MUST…"
  'AIC-deterministic-build-order',
  // §7: "Data integrity constraints MUST exist where the persistence layer supports them"
  'AIC-data-integrity-constraints',
]);

export function rowScopeProblemsFromCatalog(catalog: RuleCatalog): string[] {
  const problems: string[] = [];
  for (const entry of catalog.rules) {
    const specScope = entry.scope;
    const rowScope = entry.checklist.scope;
    if (rowScope === specScope) continue;
    const allowed =
      specScope === 'MUST' &&
      rowScope === 'MUST when applicable' &&
      MUST_TO_MWA_EXCEPTIONS.has(entry.id);
    if (allowed) continue;
    problems.push(
      `${entry.id}: spec scope is "${specScope}" but row "${entry.checklist.rule}" is scoped "${rowScope}". ` +
        `Either split the row or — if the spec bullet carries an embedded applicability clause — ` +
        `add ${entry.id} to MUST_TO_MWA_EXCEPTIONS in this script.`,
    );
  }
  return problems;
}

function main(): void {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const problems = [...validateRuleCatalog(catalog), ...rowScopeProblemsFromCatalog(catalog)];

  if (problems.length) {
    console.error('Problems:');
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }

  console.log(
    `OK — ${checklistRowCount(catalog)} checklist rows; every referenced spec ID's scope matches its row scope ` +
      `(${MUST_TO_MWA_EXCEPTIONS.size} documented MUST → MUST-when-applicable exceptions)`,
  );
}

function checklistRowCount(catalog: RuleCatalog): number {
  return new Set(catalog.rules.map((entry) => `${entry.level}\0${entry.checklist.rule}`)).size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

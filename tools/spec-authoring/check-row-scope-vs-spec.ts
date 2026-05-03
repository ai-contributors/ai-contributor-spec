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
import { parseChecklistRows, type ChecklistScope } from './shared/checklist-parser.ts';
import { specScopeById, type SpecScope } from './shared/spec-model.ts';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';

const MUST_TO_MWA_EXCEPTIONS = new Set<string>([
  // §1: "Multi-package repositories MUST…"
  'AIC-deterministic-build-order',
  // §7: "Data integrity constraints MUST exist where the persistence layer supports them"
  'AIC-data-integrity-constraints',
]);

function rowScopeLabel(s: ChecklistScope): SpecScope {
  if (s === 'MwA') return 'MUST when applicable';
  // After excluding 'MwA', `s` narrows to 'MUST' | 'SHOULD' | 'MAY', all of
  // which are valid SpecScope values — no cast needed.
  return s;
}

function main(): void {
  const specScopes = specScopeById(fs.readFileSync(SPEC, 'utf8'));
  const rows = parseChecklistRows(fs.readFileSync(CHECKLIST, 'utf8'));
  const problems: string[] = [];

  for (const row of rows) {
    const rowScope = rowScopeLabel(row.scope);
    for (const id of row.ids) {
      const specScope = specScopes.get(id);
      if (!specScope) {
        problems.push(`row "${row.rule}" references unknown spec ID ${id}`);
        continue;
      }
      if (rowScope === specScope) continue;
      const allowed =
        specScope === 'MUST' &&
        rowScope === 'MUST when applicable' &&
        MUST_TO_MWA_EXCEPTIONS.has(id);
      if (allowed) continue;
      problems.push(
        `${id}: spec scope is "${specScope}" but row "${row.rule}" is scoped "${rowScope}". ` +
          `Either split the row or — if the spec bullet carries an embedded applicability clause — ` +
          `add ${id} to MUST_TO_MWA_EXCEPTIONS in this script.`,
      );
    }
  }

  if (problems.length) {
    console.error('Problems:');
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }

  console.log(
    `OK — ${rows.length} checklist rows; every referenced spec ID's scope matches its row scope ` +
      `(${MUST_TO_MWA_EXCEPTIONS.size} documented MUST → MUST-when-applicable exceptions)`,
  );
}

main();

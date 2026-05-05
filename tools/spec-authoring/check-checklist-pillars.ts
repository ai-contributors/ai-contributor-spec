#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Verifies that the `Pillar` column for every row in
// .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md matches the pillar of the row's visible
// `AIC-*` normative IDs. Catches:
//   - rows tagged to the wrong pillar after a clause moves
//   - rows whose visible IDs no longer exist in the spec
//   - rows missing visible IDs
//
// Pillar membership is derived from `### Pillar N — …` headings in
// AI-CONTRIBUTOR-SPECIFICATION.md, so a clause renumber reshapes the map
// automatically.
//
// The catalog is the canonical rule source, and the generated-asset checks
// already verify projection freshness. This script intentionally remains a
// rendered-artifact smoke check: it validates the visible checklist IDs and
// pillar values in the shipped Markdown, then compares the row bindings back
// to the catalog.

import fs from 'node:fs';
import { parseChecklistRows, type ChecklistScope } from './shared/checklist-parser.ts';
import { clauseToPillar, specIdMap, validMinLevels } from './shared/spec-model.ts';
import type { ValidatedRuleCatalog } from './generate-rule-catalog.ts';
import { loadValidatedCatalog } from './shared/catalog-loader.ts';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';

type Scope = ChecklistScope;
type ChecklistRow = ReturnType<typeof parseChecklistRows>[number];

function catalogIdBindings(
  catalog: ValidatedRuleCatalog,
  problems: string[],
): Map<string, string[]> {
  const bindings = new Map<string, string[]>();
  for (const entry of catalog.rules) {
    const ids = bindings.get(entry.checklist.rule) ?? [];
    if (ids.includes(entry.id)) {
      problems.push(`${CATALOG}: ${entry.id} appears multiple times in "${entry.checklist.rule}"`);
      continue;
    }
    ids.push(entry.id);
    bindings.set(entry.checklist.rule, ids);
  }

  for (const ids of bindings.values()) ids.sort();
  return bindings;
}

const specText = fs.readFileSync(SPEC, 'utf8');
const c2p = clauseToPillar(specText);
const idMap = specIdMap(specText);
const catalog = loadValidatedCatalog(CATALOG, CATALOG);
const checklistText = fs.readFileSync(CHECKLIST, 'utf8');
const rows: ChecklistRow[] = parseChecklistRows(checklistText);
const problems: string[] = [];
const bindings = catalogIdBindings(catalog, problems);

for (const { rule, ids, pillar } of rows) {
  if (ids.length === 0) {
    problems.push(`checklist row "${rule}" has no visible AIC-* IDs in the IDs column`);
    continue;
  }
  for (const id of ids) {
    const specId = idMap.get(id);
    if (!specId) {
      problems.push(
        `"${rule}" IDs column references "${id}", but no bullet in ${SPEC} carries that ID`,
      );
      continue;
    }
    const expectedPillar = c2p.get(specId.clause);
    if (expectedPillar === undefined) {
      problems.push(
        `"${rule}" ID "${id}" maps to §${specId.clause}, but that clause has no pillar`,
      );
      continue;
    }
    if (pillar !== expectedPillar) {
      problems.push(
        `"${rule}" tagged Pillar ${pillar}, but ID "${id}" lives in §${specId.clause} / Pillar ${expectedPillar}`,
      );
    }
  }
}

for (const { rule, ids } of rows) {
  const expected = bindings.get(rule);
  if (!expected) {
    problems.push(`checklist row "${rule}" has no matching checklist rule in ${CATALOG}`);
    continue;
  }
  const actualKey = [...ids].sort().join(',');
  const expectedKey = [...expected].sort().join(',');
  if (actualKey !== expectedKey) {
    problems.push(
      `"${rule}" IDs column is [${ids.join(', ')}], expected [${expected.join(', ')}] from ${CATALOG}`,
    );
  }
}

for (const rule of bindings.keys()) {
  if (!rows.some((row) => row.rule === rule)) {
    problems.push(`${CATALOG} has checklist rule "${rule}" but no matching checklist row`);
  }
}

// (A4) Level shape — must be one of the levels declared in the SPEC's
// `## Conformance levels` block, or `—` for MAY rows.
const validLevels = validMinLevels(specText);
const validList = [...validLevels].sort().join(', ');
for (const { rule, level } of rows) {
  if (!validLevels.has(level)) {
    problems.push(`"${rule}" has level "${level}" — must be one of ${validList} (— for MAY rows)`);
  }
}

// (A5) Rule names unique across all four scope tables.
const ruleSeen = new Map<string, Scope>(); // rule -> first scope it appeared in
for (const { rule, scope } of rows) {
  if (ruleSeen.has(rule)) {
    problems.push(
      `"${rule}" appears in both the ${ruleSeen.get(rule)} table and the ${scope} table — rule names must be unique`,
    );
  } else {
    ruleSeen.set(rule, scope);
  }
}

console.log(
  `checklist rows: ${rows.length}, checklist IDs: ${rows.reduce((n, r) => n + r.ids.length, 0)}, spec IDs: ${idMap.size}, spec clauses with pillar: ${c2p.size}`,
);
if (problems.length) {
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('OK — every checklist row sits in the pillar that owns its visible AIC-* IDs');

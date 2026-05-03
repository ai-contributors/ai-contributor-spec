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

import fs from 'node:fs';
import { parseChecklistRows, type ChecklistScope } from './shared/checklist-parser.ts';
import { clauseToPillar, specIdMap, validMinLevels } from './shared/spec-model.ts';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';
const WRITE_BINDINGS = process.argv.includes('--write-bindings');

type Scope = ChecklistScope;
type ChecklistRow = ReturnType<typeof parseChecklistRows>[number];

function bindingsObject(rows: ChecklistRow[]): Record<string, string[]> {
  return Object.fromEntries(rows.map((row) => [row.rule, row.ids]));
}

function bindingsBlock(rows: ChecklistRow[]): string {
  return `<!-- BEGIN:CHECKLIST-ID-BINDINGS\n${JSON.stringify(bindingsObject(rows), null, 2)}\nEND:CHECKLIST-ID-BINDINGS -->`;
}

function writeBindings(content: string, rows: ChecklistRow[], problems: string[]): void {
  const re = /<!-- BEGIN:CHECKLIST-ID-BINDINGS\s*[\s\S]*?\s*END:CHECKLIST-ID-BINDINGS -->/;
  if (!re.test(content)) {
    problems.push(`No CHECKLIST-ID-BINDINGS block found in ${CHECKLIST}`);
    return;
  }
  fs.writeFileSync(CHECKLIST, content.replace(re, bindingsBlock(rows)));
}

function checklistIdBindings(content: string, problems: string[]): Map<string, string[]> {
  const match = content.match(
    /<!-- BEGIN:CHECKLIST-ID-BINDINGS\s*([\s\S]*?)\s*END:CHECKLIST-ID-BINDINGS -->/,
  );
  if (!match) {
    problems.push(
      `No CHECKLIST-ID-BINDINGS block found in ${CHECKLIST}; run check-checklist-pillars.ts --write-bindings after reviewing checklist IDs`,
    );
    return new Map();
  }
  try {
    const raw = JSON.parse(match[1]) as Record<string, string[]>;
    return new Map(Object.entries(raw));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    problems.push(`CHECKLIST-ID-BINDINGS block is not valid JSON: ${message}`);
    return new Map();
  }
}

const specText = fs.readFileSync(SPEC, 'utf8');
const c2p = clauseToPillar(specText);
const idMap = specIdMap(specText);
const checklistText = fs.readFileSync(CHECKLIST, 'utf8');
const rows: ChecklistRow[] = parseChecklistRows(checklistText);
const problems: string[] = [];
if (WRITE_BINDINGS) {
  writeBindings(checklistText, rows, problems);
  if (problems.length) {
    console.error('Problems:');
    for (const p of problems) console.error(' -', p);
    process.exit(1);
  }
  // Exit immediately after writing; checklistText and rows still reflect the pre-write file.
  console.log(`OK — regenerated CHECKLIST-ID-BINDINGS in ${CHECKLIST} from ${rows.length} rows`);
  process.exit(0);
}
const bindings = checklistIdBindings(checklistText, problems);

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
    problems.push(`checklist row "${rule}" has no entry in CHECKLIST-ID-BINDINGS`);
    continue;
  }
  const actualKey = [...ids].sort().join(',');
  const expectedKey = [...expected].sort().join(',');
  if (actualKey !== expectedKey) {
    problems.push(
      `"${rule}" IDs column is [${ids.join(', ')}], expected [${expected.join(', ')}] from CHECKLIST-ID-BINDINGS`,
    );
  }
}

for (const rule of bindings.keys()) {
  if (!rows.some((row) => row.rule === rule)) {
    problems.push(`CHECKLIST-ID-BINDINGS has "${rule}" but no matching checklist row`);
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

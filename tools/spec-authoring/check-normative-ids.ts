#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Verifies normative-ID hygiene across the spec and the checklist.
//
// Each normative bullet (under a scope heading such as `##### `MUST`` inside
// the `## Specification clauses`
// section of AI-CONTRIBUTOR-SPECIFICATION.md) MUST carry a visible normative
// ID of the form `<sup>`AIC-<slug>`</sup>` at the end of the bullet, where
// <slug> is `[a-z0-9][a-z0-9-]*`. The aggregate `check` script runs this
// check with `--strict`. Without `--strict` the missing-ID count is reported
// but not failed (kept as an escape hatch for in-progress edits).
//
// What this script does fail on:
//   - duplicate IDs in the spec (each ID must identify exactly one bullet)
//   - malformed IDs (wrong prefix, illegal chars)
//   - checklist `IDs` entries that don't exist in the spec (dangling refs)
//   - spec IDs that do not appear in any checklist row
//
import fs from 'node:fs';
import { parseChecklistRows } from './shared/checklist-parser.ts';
import { parseNormativeIds, type SpecId } from './shared/spec-model.ts';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';

const STRICT = process.argv.includes('--strict');

const ID_VALID = /^AIC-[a-z0-9][a-z0-9-]*$/;

const { ids, bullets, untagged } = parseNormativeIds(fs.readFileSync(SPEC, 'utf8'));

const problems: string[] = [];

for (const { id, line } of ids) {
  if (!ID_VALID.test(id)) {
    problems.push(`${SPEC}:${line}: malformed ID "${id}" — must match ${ID_VALID}`);
  }
}

const seen = new Map<string, SpecId>();
for (const e of ids) {
  const prev = seen.get(e.id);
  if (prev) {
    problems.push(
      `duplicate normative ID "${e.id}" — first at ${SPEC}:${prev.line} (§${prev.clause}), again at ${SPEC}:${e.line} (§${e.clause})`,
    );
  } else {
    seen.set(e.id, e);
  }
}

const checklistText = fs.readFileSync(CHECKLIST, 'utf8');
const checklistRows = parseChecklistRows(checklistText);
const checklistIdToRules = new Map<string, string[]>();
for (const row of checklistRows) {
  for (const id of row.ids) {
    if (!checklistIdToRules.has(id)) checklistIdToRules.set(id, []);
    checklistIdToRules.get(id)!.push(row.rule);
  }
}

for (const id of checklistIdToRules.keys()) {
  if (!seen.has(id)) {
    const rules = checklistIdToRules.get(id)!;
    problems.push(
      `checklist references "${id}" (used by ${rules.map((r) => `"${r}"`).join(', ')}) but no bullet in ${SPEC} carries that ID`,
    );
  }
}

const summaryLines = [
  `normative bullets: ${bullets}, tagged: ${ids.length}, untagged: ${untagged.length}, checklist IDs: ${checklistIdToRules.size}`,
];
const unreferencedSpecIds = ids.filter(({ id }) => !checklistIdToRules.has(id));
for (const specId of unreferencedSpecIds) {
  problems.push(`${specId.id} is not listed in any checklist row`);
}
summaryLines.push(
  `spec ID coverage: ${ids.length - unreferencedSpecIds.length}/${ids.length} visible`,
);

if (untagged.length) {
  if (STRICT) {
    for (const u of untagged) {
      problems.push(
        `${SPEC}:${u.line}: untagged ${u.scope} bullet in §${u.clause} — ${u.preview}…`,
      );
    }
  } else {
    summaryLines.push(
      `  (permissive mode: ${untagged.length} bullets without IDs — run with --strict to fail)`,
    );
  }
}

if (problems.length) {
  for (const line of summaryLines) console.error(line);
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
for (const line of summaryLines) console.log(line);
console.log(
  STRICT
    ? 'OK — every normative bullet is tagged and IDs are clean'
    : 'OK — normative ID hygiene is clean (permissive mode)',
);

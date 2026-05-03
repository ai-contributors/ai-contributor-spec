#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Validates the cross-reference between .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md and
// .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md.
//
// AUDIT-LOG schema:
//   | Spec IDs | Rules | Command | Output excerpt |
//
// The `Spec IDs` cell (column 0) holds backtick-quoted `AIC-*`
// slugs from AI-CONTRIBUTOR-SPECIFICATION.md, separated by commas.
// The script validates two invariants:
//
//   1. Every `AIC-*` ID cited in the audit log exists in the spec.
//   2. Every `Fulfilled` row in the checklist is covered: at least one
//      audit-log row's `Spec IDs` column contains one of the rule's
//      IDs from the checklist's visible `IDs` column.
//
// In this repository the audit-log template carries no real evidence rows and
// the checklist has no `Fulfilled` rows, so the second check is trivially
// satisfied. Adopters that fill the templates inherit the script and get strict
// validation.

import fs from 'node:fs';
import { parseChecklistRows } from './shared/checklist-parser.ts';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';
const AUDIT = '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md';

const ID_PATTERN = /<sup>`(AIC-[a-z0-9][a-z0-9-]*)`<\/sup>/g;
const AIC_TOKEN = /`(AIC-[a-z0-9][a-z0-9-]*)`/g;
const PLACEHOLDER_COMMAND = /^`<command>`$/;

function specIds(): Set<string> {
  const out = new Set<string>();
  const text = fs.readFileSync(SPEC, 'utf8');
  let m: RegExpExecArray | null;
  ID_PATTERN.lastIndex = 0;
  while ((m = ID_PATTERN.exec(text))) out.add(m[1]);
  return out;
}

type AuditRow = { line: number; command: string; ids: string[] };

function parseAuditRows(): AuditRow[] {
  const out: AuditRow[] = [];
  const lines = fs.readFileSync(AUDIT, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+/.test(line)) continue; // separator row
    if (/^\|\s*Spec IDs\s*\|/.test(line)) continue; // header
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    const idsCell = cells[0];
    const command = cells[2];
    if (PLACEHOLDER_COMMAND.test(command)) continue; // template row
    const ids: string[] = [];
    let m: RegExpExecArray | null;
    AIC_TOKEN.lastIndex = 0;
    while ((m = AIC_TOKEN.exec(idsCell))) ids.push(m[1]);
    out.push({ line: i + 1, command, ids });
  }
  return out;
}

const ids = specIds();
const rows = parseAuditRows();
const checklist = parseChecklistRows(fs.readFileSync(CHECKLIST, 'utf8'));

const problems: string[] = [];

// (1) Every audit-log ID exists in the spec.
for (const row of rows) {
  for (const id of row.ids) {
    if (!ids.has(id)) {
      problems.push(`${AUDIT}:${row.line}: cites "${id}" but no bullet in ${SPEC} carries that ID`);
    }
  }
}

// (2) Every Fulfilled checklist row has audit-log evidence covering at least one of its IDs.
const fulfilled = checklist.filter((r) => /Fulfilled/i.test(r.status));
const evidencedIds = new Set<string>();
for (const row of rows) for (const id of row.ids) evidencedIds.add(id);

for (const { rule, ids: ruleIds } of fulfilled) {
  if (ruleIds.length === 0) {
    problems.push(
      `${CHECKLIST}: Fulfilled row "${rule}" has no IDs in the checklist — cannot evidence it from the audit log`,
    );
    continue;
  }
  if (!ruleIds.some((id) => evidencedIds.has(id))) {
    problems.push(
      `${CHECKLIST}: Fulfilled row "${rule}" is not evidenced — no audit-log row's Spec IDs include any of: ${ruleIds.join(', ')}`,
    );
  }
}

console.log(
  `audit rows: ${rows.length}, IDs cited: ${[...evidencedIds].length}, Fulfilled checklist rows: ${fulfilled.length}`,
);

if (problems.length) {
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('OK — audit-log evidence cross-check passes');

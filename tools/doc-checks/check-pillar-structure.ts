#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// (A2) For every pillar declared in the SPEC's `## Pillars` table, the
//      `### Pillar N — Name` body section must contain exactly the clauses
//      named in that pillar's `Clauses` column. Catches: a clause heading
//      that drifts to the wrong pillar header in the body, a pillar whose
//      table range disagrees with what the body actually holds.
//
// (A3) The pillar table in README.md must agree with the pillar table in
//      AI-CONTRIBUTOR-SPECIFICATION.md on names, clause ranges, and scope
//      text. Eliminates the last duplicated pillar metadata across docs.
//
// (A4) The README/SPEC headline sentence that states "29 clauses ... seven
//      pillars" must match the parsed spec body and pillar table counts.

import fs from 'node:fs';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const README = 'README.md';

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

type PillarRow = { n: number | null; name: string; clauses: string; scope: string };

// Parse pillar rows from a Markdown table. Returns:
//   [{ n?, name, clauses: "§5–9", scope }, ...]
// SPEC table has columns: Pillar | Name | Clauses | Scope (4 cells).
// README table has columns:       Name | Clauses | Scope (3 cells).
// We discriminate on shape — the unique signal is "second cell starts with
// §" — so this stays robust if pillar emoji ever change.
function parsePillarTable(file: string): PillarRow[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const rows: PillarRow[] = [];
  for (const line of lines) {
    // 4-cell variant (SPEC): leading numeric pillar column, then §-range in cell 3.
    let m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(§[^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (m) {
      rows.push({ n: Number(m[1]), name: m[2], clauses: m[3], scope: m[4] });
      continue;
    }
    // 3-cell variant (README): name, §-range, scope.
    m = line.match(/^\|\s*([^|]+?)\s*\|\s*(§[^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (m) rows.push({ n: null, name: m[1], clauses: m[2], scope: m[3] });
  }
  return rows;
}

// Expand a clause-range string like "§5–9" or "§23–26" into a Set of numbers.
function expandRange(s: string): Set<number> {
  const out = new Set<number>();
  for (const part of s.split(/[,，]/)) {
    const m = part.trim().match(/^§(\d+)(?:–(\d+))?$/);
    if (!m) throw new Error(`unparseable clause range: "${part}"`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let n = a; n <= b; n++) out.add(n);
  }
  return out;
}

// Walk the SPEC body collecting clauses-per-pillar from the actual headers.
function clausesByPillarFromBody(): Map<number, Set<number>> {
  const out = new Map<number, Set<number>>();
  let pillar: number | null = null;
  for (const line of fs.readFileSync(SPEC, 'utf8').split(/\r?\n/)) {
    const pm = line.match(/^###\s+Pillar\s+(\d+)\b/);
    if (pm) {
      pillar = Number(pm[1]);
      if (!out.has(pillar)) out.set(pillar, new Set());
      continue;
    }
    const cm = line.match(/^##\s+(\d+)\.\s+/);
    if (cm && pillar !== null) {
      const clauses = out.get(pillar);
      if (clauses) clauses.add(Number(cm[1]));
    }
  }
  return out;
}

function countBodyClauses(bodyMap: Map<number, Set<number>>): number {
  let count = 0;
  for (const clauses of bodyMap.values()) count += clauses.size;
  return count;
}

function parseHeadlineCounts(file: string): { clauses: number; pillars: number } | null {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/The\s+(\d+)\s+clauses\s+are\s+grouped\s+into\s+([a-z]+|\d+)\s+pillars\./i);
  if (!m) return null;
  const rawPillars = m[2].toLowerCase();
  const pillars = /^\d+$/.test(rawPillars) ? Number(rawPillars) : NUMBER_WORDS[rawPillars];
  if (!pillars) return null;
  return { clauses: Number(m[1]), pillars };
}

const specRows = parsePillarTable(SPEC).filter((r) => r.n !== null);
const readmeRows = parsePillarTable(README).filter((r) => r.n === null);
const bodyMap = clausesByPillarFromBody();
const problems: string[] = [];

if (specRows.length === 0) problems.push(`${SPEC}: pillar table not found or unparseable`);
if (readmeRows.length === 0) problems.push(`${README}: pillar table not found or unparseable`);

// (A2) Each spec table row's declared range = the actual body clauses for that pillar.
for (const row of specRows) {
  const declared = expandRange(row.clauses);
  const actual = bodyMap.get(row.n ?? -1) || new Set();
  const missing = [...declared].filter((n) => !actual.has(n));
  const extra = [...actual].filter((n) => !declared.has(n));
  if (missing.length) {
    problems.push(
      `${SPEC} Pillar ${row.n} table says clauses ${row.clauses}, but the body is missing §${missing.join(', §')}`,
    );
  }
  if (extra.length) {
    problems.push(
      `${SPEC} Pillar ${row.n} body contains §${extra.join(', §')} but those are not in the declared range ${row.clauses}`,
    );
  }
}

// (A3) README ↔ SPEC pillar tables must agree (row count, name, range, scope).
if (specRows.length !== readmeRows.length) {
  problems.push(
    `pillar-table row count mismatch: SPEC has ${specRows.length}, README has ${readmeRows.length}`,
  );
} else {
  // Match by clause range (order-independent so README format differences don't matter).
  for (const sr of specRows) {
    const rr = readmeRows.find((r) => r.clauses === sr.clauses);
    if (!rr) {
      problems.push(
        `README has no pillar row with clauses ${sr.clauses} (SPEC Pillar ${sr.n} = ${sr.name})`,
      );
      continue;
    }
    // Names: SPEC is "🛡️ Security", README wraps in **bold** as "🛡️ **Security**". Compare after stripping markdown.
    const norm = (s: string) => s.replace(/\*\*/g, '').trim();
    if (norm(sr.name) !== norm(rr.name)) {
      problems.push(
        `pillar name mismatch for ${sr.clauses}: SPEC "${sr.name}" vs README "${rr.name}"`,
      );
    }
    if (norm(sr.scope) !== norm(rr.scope)) {
      problems.push(
        `pillar scope text mismatch for ${sr.clauses} (SPEC vs README) — keep them in sync or refactor README to point at SPEC`,
      );
    }
  }
}

// (A4) README/SPEC headline counts must match parsed structure.
const bodyClauseCount = countBodyClauses(bodyMap);
for (const file of [SPEC, README]) {
  const counts = parseHeadlineCounts(file);
  if (!counts) {
    problems.push(`${file}: cannot find "The N clauses are grouped into M pillars." headline`);
    continue;
  }
  if (counts.clauses !== bodyClauseCount) {
    problems.push(
      `${file}: headline says ${counts.clauses} clauses, parsed spec body has ${bodyClauseCount}`,
    );
  }
  if (counts.pillars !== specRows.length) {
    problems.push(
      `${file}: headline says ${counts.pillars} pillars, spec table has ${specRows.length}`,
    );
  }
}

console.log(
  `spec pillars: ${specRows.length}, README pillars: ${readmeRows.length}, body pillars: ${bodyMap.size}`,
);
if (problems.length) {
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('OK — pillar tables, body sections, and README/SPEC headline counts agree');

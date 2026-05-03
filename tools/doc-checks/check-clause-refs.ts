#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Validates that every §N reference in repository docs and template comments
// resolves to a clause heading that actually exists in
// AI-CONTRIBUTOR-SPECIFICATION.md. Catches stale §-references when clauses
// are renumbered or removed.

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';
const specContent = fs.readFileSync(SPEC, 'utf8');

// Collect existing clause numbers from headings like "## 7. Authorization ..."
const valid = new Set<number>();
for (const line of specContent.split(/\r?\n/)) {
  const m = line.match(/^##\s+(\d+)\.\s+/);
  if (m) valid.add(Number(m[1]));
}
if (valid.size === 0) {
  console.error('No clause headings found in spec — script needs updating.');
  process.exit(2);
}
console.log(`spec clauses found: ${valid.size} (§${Math.min(...valid)}–§${Math.max(...valid)})`);

// (A1) Density check: clause numbers must be exactly 1..N consecutive — no
// gaps, no duplicates. Catches a PR that appends a clause heading past the
// existing range without renumbering, or accidentally removes a clause.
const sorted = [...valid].sort((a, b) => a - b);
const expected = Array.from({ length: sorted.length }, (_, i) => i + 1);
const densityProblems: string[] = [];
if (sorted[0] !== 1) {
  densityProblems.push(`first clause is §${sorted[0]}, expected §1`);
}
for (let i = 0; i < sorted.length; i++) {
  if (sorted[i] !== expected[i]) {
    densityProblems.push(
      `expected §${expected[i]} at position ${i + 1}, found §${sorted[i]} (gap or duplicate in clause numbering)`,
    );
    break;
  }
}
// Detect duplicate `## N.` headings (two clauses sharing a number).
const counts = new Map<number, number>();
for (const line of specContent.split(/\r?\n/)) {
  const m = line.match(/^##\s+(\d+)\.\s+/);
  if (m) counts.set(Number(m[1]), (counts.get(Number(m[1])) || 0) + 1);
}
for (const [n, c] of counts) {
  if (c > 1) densityProblems.push(`§${n} appears ${c} times — clause numbers must be unique`);
}
if (densityProblems.length) {
  console.error('Clause-density problems:');
  for (const p of densityProblems) console.error(' -', p);
  process.exit(1);
}

// Scan all tracked text files for §N references.
const files = execSync(
  "git ls-files '*.md' '*.ts' '*.js' '*.mjs' '*.yml' '*.yaml' '*.json' '.gitignore' '.env.example' 'CODEOWNERS' '.github/CODEOWNERS'",
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

const refRe = /§\s?(\d+)/g;
const problems: string[] = [];
let refs = 0;

for (const file of files) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  let m;
  while ((m = refRe.exec(content))) {
    refs++;
    const n = Number(m[1]);
    if (!valid.has(n)) {
      const before = content.slice(0, m.index);
      const lineNo = before.split('\n').length;
      problems.push(`${file}:${lineNo}: §${n} does not match any clause in ${SPEC}`);
    }
  }
}

console.log(`§-references checked: ${refs}`);
if (problems.length) {
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('OK — every §-reference resolves to a clause');

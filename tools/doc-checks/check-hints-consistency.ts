#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// (A) Verifies that every `## N. Title` clause heading in any
//     examples/*/hints-*.md file matches the corresponding clause
//     heading in AI-CONTRIBUTOR-SPECIFICATION.md.
// (B) Verifies that the `## Clause index` list in each hints file matches
//     the actual `## N. Title` headings further down in the same file.

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { githubSlug } from '../shared/_slug.ts';

const SPEC = 'AI-CONTRIBUTOR-SPECIFICATION.md';

type ClauseIndexEntry = { n: number; title: string; anchor: string };

function clauseHeadings(file: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^#{2,4}\s+(\d+)\.\s+(.+?)\s*$/);
    if (m) out.set(Number(m[1]), m[2].replace(/\s*\{#[a-z0-9][a-z0-9-]*\}\s*$/, ''));
  }
  return out;
}

function clauseIndexLinks(file: string): ClauseIndexEntry[] {
  // Parses the `## Clause index` block (until the next `---` or `##`).
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let i = lines.findIndex((l) => /^##\s+Clause index\b/.test(l));
  if (i === -1) return [];
  const out: ClauseIndexEntry[] = [];
  for (i++; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s+/.test(l) || /^---\s*$/.test(l)) break;
    const m = l.match(/^-\s+\[§(\d+)\s+([^\]]+)\]\(#([^)]+)\)/);
    if (m) out.push({ n: Number(m[1]), title: m[2], anchor: m[3] });
  }
  return out;
}

// Anchor slug for a single heading (no duplicate-heading disambiguation
// needed since clause headings appear once per file).
function slug(text: string): string {
  return githubSlug(text, new Map());
}

const specClauses = clauseHeadings(SPEC);
if (specClauses.size === 0) {
  console.error(`No clause headings parsed from ${SPEC} — script needs updating.`);
  process.exit(2);
}

const hintsFiles = execSync("git ls-files 'examples/*/hints-*.md'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const problems: string[] = [];
let titlesChecked = 0;
let indexChecked = 0;

for (const file of hintsFiles) {
  const hints = clauseHeadings(file);

  // (A) hints title vs spec title for each shared clause number
  for (const [n, title] of hints) {
    titlesChecked++;
    if (!specClauses.has(n)) {
      problems.push(`${file}: §${n} "${title}" — no matching clause in ${SPEC}`);
      continue;
    }
    const specTitle = specClauses.get(n);
    if (title !== specTitle) {
      problems.push(`${file}: §${n} title drift — hints "${title}" vs spec "${specTitle}"`);
    }
  }

  // (B) clause-index entries match headings in the same file
  const index = clauseIndexLinks(file);
  for (const entry of index) {
    indexChecked++;
    if (!hints.has(entry.n)) {
      problems.push(
        `${file}: clause-index lists §${entry.n} but file has no \`## ${entry.n}.\` heading`,
      );
      continue;
    }
    const headingTitle = hints.get(entry.n);
    if (entry.title !== headingTitle) {
      problems.push(
        `${file}: clause-index §${entry.n} text "${entry.title}" disagrees with heading "${headingTitle}"`,
      );
    }
    const expectedAnchor = slug(`${entry.n}. ${headingTitle}`);
    if (entry.anchor !== expectedAnchor) {
      problems.push(
        `${file}: clause-index §${entry.n} anchor "${entry.anchor}" should be "${expectedAnchor}"`,
      );
    }
  }
  // Reverse: every heading should appear in the clause index (warn if missing — except the file may intentionally omit some).
  // Skip enforcing this; the hints intro already says clauses are omitted when there's no stack-specific content.
}

console.log(
  `hints files: ${hintsFiles.length}, titles checked: ${titlesChecked}, clause-index entries checked: ${indexChecked}`,
);
if (problems.length) {
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('OK — hints headings and clause index are consistent with the spec');

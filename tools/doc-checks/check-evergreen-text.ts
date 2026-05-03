#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Enforces the "evergreen text" drafting convention from CONTRIBUTING.md:
// committed prose and code comments must read as if the reader arrived
// today, with no transient repo-history context. Banned phrasings include
// TODO/FIXME-style markers and "the recent X" / "in this repo's history"
// patterns.
//
// Whitelisting: append `<!-- evergreen-skip: <reason> -->` to the same
// line to allow a single legitimate occurrence (use sparingly).

import fs from 'node:fs';
import { execSync } from 'node:child_process';

type EvergreenRule = { id: string; re: RegExp };

// Each rule: a label + a case-insensitive regex.
const rules: EvergreenRule[] = [
  { id: 'todo-marker', re: /\b(TODO|FIXME|XXX|HACK|WIP)\b/ },
  {
    id: 'recent-event',
    re: /\bthe recent (renumber|rename|reshuffle|move|reorganization|refactor)/i,
  },
  { id: 'just-changed', re: /\bwe just (moved|renamed|added|fixed|changed|removed|introduced)\b/i },
  { id: 'repo-history', re: /\bin (this|our) repo'?s history\b/i },
  { id: 'now-fixed', re: /\b(now[- ]fixed|just fixed)\b/i },
  {
    id: 'after-recent',
    re: /\bafter (the )?(recent )?(rename|renumber|reshuffle|move|reorganization)\b/i,
  },
  { id: 'survived-renumber', re: /\bsurvived the (recent )?(rename|renumber|reshuffle)\b/i },
];

// Files that are historical by design or contain the banned terms as data.
const ALWAYS_SKIP = new Set([
  'CHANGELOG.md',
  'tools/doc-checks/check-evergreen-text.ts', // this file enumerates the patterns
  'CONTRIBUTING.md', // documents the rule and lists banned phrases
]);

// Whitelist marker is any line containing the token `evergreen-skip`,
// optionally followed by a `: reason`. Works in any comment style
// (`<!-- ... -->` for Markdown, `#` for YAML, `//` for JS/TS).
const SKIP_RE = /\bevergreen-skip\b/;

const tracked = execSync(
  "git ls-files '*.md' '*.mjs' '*.js' '*.ts' '*.tsx' '*.yml' '*.yaml' '*.json'",
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

const problems: string[] = [];
let scanned = 0;

for (const file of tracked) {
  if (ALWAYS_SKIP.has(file)) continue;
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  scanned++;
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_RE.test(line)) continue;
    for (const rule of rules) {
      const m = line.match(rule.re);
      if (m) {
        problems.push(`${file}:${i + 1}: [${rule.id}] "${m[0]}" — "${line.trim().slice(0, 120)}"`);
      }
    }
  }
}

console.log(`scanned ${scanned} files against ${rules.length} evergreen rules`);
if (problems.length) {
  console.error('Problems (write evergreen text — see CONTRIBUTING.md § Drafting conventions):');
  for (const p of problems) console.error(' -', p);
  console.error(
    'Whitelist a legitimate single occurrence with `<!-- evergreen-skip: <reason> -->` on the same line.',
  );
  process.exit(1);
}
console.log('OK — no transient/historical phrasings detected');

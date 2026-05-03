#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Asserts that every `<path-to-pinned-runbook>/<rel>` reference in the
// shipped runbook docs corresponds to a file the bootstrap actually writes
// (i.e. a path listed in bootstrap.ts MANIFEST). Prevents the recovery
// commands an adopter copies from drifting to a path the bootstrap never
// creates — the original motivation was that audit-protocol.md referenced
// `<runbook>/scripts/audit-collect.ts` while bootstrap writes
// `skills/ai-contributor-audit/scripts/audit-collect.ts`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const bootstrapPath = path.join(repoRoot, 'skills/ai-contributor-audit/scripts/bootstrap.ts');
const bootstrapSrc = fs.readFileSync(bootstrapPath, 'utf8');

const manifestMatch = bootstrapSrc.match(/const MANIFEST: readonly string\[\] = \[([\s\S]*?)\];/);
if (!manifestMatch) {
  console.error('check-runbook-paths: could not parse MANIFEST from bootstrap.ts');
  process.exit(2);
}
const manifest = new Set<string>(
  Array.from(manifestMatch[1].matchAll(/'([^']+)'/g)).map((m) => m[1]),
);

const docs = [
  'skills/ai-contributor-audit/references/audit-protocol.md',
  'skills/ai-contributor-audit/SKILL.md',
];

const REF = /<path-to-pinned-runbook>\/([^\s'")`]+)/g;

let violations = 0;
let checked = 0;
for (const rel of docs) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) continue;
  const text = fs.readFileSync(abs, 'utf8');
  for (const m of text.matchAll(REF)) {
    checked++;
    const referenced = m[1];
    if (!manifest.has(referenced)) {
      violations++;
      console.error(
        `${rel}: <path-to-pinned-runbook>/${referenced} is not written by bootstrap.ts MANIFEST`,
      );
    }
  }
}

if (violations > 0) {
  console.error('');
  console.error(
    `check-runbook-paths: ${violations} bootstrapped path reference(s) not in MANIFEST`,
  );
  process.exit(1);
}
console.log(
  `OK   all ${checked} <path-to-pinned-runbook>/... reference(s) resolve to bootstrap MANIFEST entries`,
);

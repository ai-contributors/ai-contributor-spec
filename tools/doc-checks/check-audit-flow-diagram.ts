#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Asserts that the README "The Audit Process" diagram describes the full
// canonical lifecycle from AI-CONTRIBUTOR-AUDIT-MODEL.md: collect -> stamp
// -> auditor edits -> stamp -> validate. Prevents the diagram from drifting
// back to a single-stamp shorthand that hides the auditor checkpoint.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const readmePath = path.join(repoRoot, 'README.md');
const text = fs.readFileSync(readmePath, 'utf8');

const sectionMatch = text.match(/## The Audit Process[\s\S]*?(?=\n## |\n# |$)/);
if (!sectionMatch) {
  console.error('check-audit-flow-diagram: "The Audit Process" section not found in README.md');
  process.exit(1);
}
const section = sectionMatch[0];

const requirements: { label: string; test: () => boolean }[] = [
  {
    label: 'mentions audit-collect.ts',
    test: () => /audit-collect\.ts/.test(section),
  },
  {
    label: 'mentions audit-stamp.ts at least twice (initial + final pass)',
    test: () => (section.match(/audit-stamp\.ts/g) ?? []).length >= 2,
  },
  {
    label: 'mentions auditor (edit/judgment phase)',
    test: () => /auditor/i.test(section),
  },
  {
    label: 'mentions audit-validate.ts',
    test: () => /audit-validate\.ts/.test(section),
  },
];

const failed = requirements.filter((r) => !r.test());
if (failed.length > 0) {
  console.error('check-audit-flow-diagram: README "The Audit Process" section is missing:');
  for (const r of failed) console.error(`  - ${r.label}`);
  console.error('');
  console.error(
    'Canonical lifecycle (AI-CONTRIBUTOR-AUDIT-MODEL.md): collect -> stamp -> auditor -> stamp -> validate',
  );
  process.exit(1);
}
console.log('OK   README audit-flow diagram covers collect/stamp(x2)/auditor/validate');

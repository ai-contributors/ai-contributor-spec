#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Asserts that every documented local guardrail or audit entry point declared
// in tools/package.json is documented in the TOOLING.md command-map table.
// Prevents a check or audit command from being added to package.json without a
// corresponding maintainer-facing command-map entry.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tools', 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

const documentedPrefixes = ['check:', 'audit:'];
const declared = Object.keys(pkg.scripts)
  .filter(
    (k) =>
      k === 'audit' || k === 'check' || documentedPrefixes.some((prefix) => k.startsWith(prefix)),
  )
  .sort();

const tooling = fs.readFileSync(path.join(repoRoot, 'TOOLING.md'), 'utf8');

const missing = declared.filter((name) => {
  const re = new RegExp(`run ${name.replace(/[-:]/g, '\\$&')}\\b`);
  return !re.test(tooling);
});

if (missing.length > 0) {
  console.error('check-tooling-command-coverage: the following local guardrail/audit scripts are');
  console.error('declared in tools/package.json but not documented in TOOLING.md:');
  for (const s of missing) console.error(`  - npm --prefix tools run ${s}`);
  console.error('');
  console.error('Add a row for each missing command to the TOOLING.md command table.');
  process.exit(1);
}
console.log(
  `OK   all ${declared.length} local guardrail/audit scripts are documented in TOOLING.md`,
);

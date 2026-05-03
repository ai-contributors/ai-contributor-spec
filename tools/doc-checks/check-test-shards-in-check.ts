#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Asserts that every `test:*` script declared in tools/package.json is invoked
// (transitively) by the `check` script. Prevents the situation where a new
// test shard is added but silently dropped from the documented guardrail
// suite — the original motivation was that `test:audit-run-helpers`,
// `test:audit-summary`, `test:bootstrap`, and `test:bootstrap-main` were
// declared but never run by `check`.
//
// A shard counts as "in check" if it appears in the right-hand side of any
// script transitively reachable from `check` (e.g. via `test:audit-all`).
// `test:audit-all` itself is exempt because it is an aggregator, not a shard.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(here, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
  scripts: Record<string, string>;
};
const scripts = pkg.scripts;

const SCRIPT_REF = /(?:^|\s|&&|\|\|)npm run (?:--silent\s+)?([\w:-]+)/g;

function reachable(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const body = scripts[entry];
  if (!body) return seen;
  for (const m of body.matchAll(SCRIPT_REF)) {
    reachable(m[1], seen);
  }
  return seen;
}

const reached = reachable('check');

const declaredShards = Object.keys(scripts)
  .filter((k) => k.startsWith('test:') && k !== 'test:audit-all')
  .sort();

const missing = declaredShards.filter((s) => !reached.has(s));

if (missing.length > 0) {
  console.error('check-test-shards-in-check: the following test:* shards are');
  console.error('declared in tools/package.json but never invoked by `check`');
  console.error('(directly or via test:audit-all):');
  for (const s of missing) console.error(`  - ${s}`);
  console.error('');
  console.error('Add each shard to `check` or to `test:audit-all`.');
  process.exit(1);
}

console.log(`OK   all ${declaredShards.length} test:* shards are reachable from \`check\``);

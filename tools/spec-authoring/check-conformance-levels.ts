#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Checks that the accepted conformance_level value set is consistent
// across the validator constant, the checklist frontmatter comment, and
// the audit-protocol handoff snippet. A mismatch lets one source say
// `0` is valid while another says it is not — that is exactly the kind
// of drift Copilot flagged after the Level 0 rollout.

import fs from 'node:fs';

interface Source {
  path: string;
  match: RegExp;
  describe: string;
}

const SOURCES: Source[] = [
  {
    path: 'skills/ai-contributor-audit/scripts/internal/validator-frontmatter.ts',
    match: /const VALID_CONFORMANCE_LEVELS\s*=\s*\[([^\]]+)\]/,
    describe: 'validator VALID_CONFORMANCE_LEVELS',
  },
  {
    path: '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md',
    match: /conformance_level:.*one of:\s*([^.]+?)\./,
    describe: 'checklist frontmatter comment',
  },
  {
    path: 'skills/ai-contributor-audit/references/audit-protocol.md',
    match: /conformance_level:\s*<([^>]+)>/,
    describe: 'audit-protocol handoff snippet',
  },
];

const CANONICAL = ['none', '0', '1', '2', '3', '4'];

function tokenize(s: string): string[] {
  return s
    .replace(/[`"'|<>,]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

const problems: string[] = [];

for (const src of SOURCES) {
  if (!fs.existsSync(src.path)) {
    problems.push(`missing source: ${src.path}`);
    continue;
  }
  const body = fs.readFileSync(src.path, 'utf8');
  const m = body.match(src.match);
  if (!m) {
    problems.push(`${src.path}: cannot locate ${src.describe} (pattern not found)`);
    continue;
  }
  const tokens = new Set(tokenize(m[1]));
  for (const expected of CANONICAL) {
    if (!tokens.has(expected)) {
      problems.push(
        `${src.path}: ${src.describe} is missing accepted value "${expected}" (parsed: ${[...tokens].join(', ')})`,
      );
    }
  }
}

if (problems.length === 0) {
  console.log(
    `OK — accepted conformance_level set [${CANONICAL.join(', ')}] is consistent across ${SOURCES.length} sources`,
  );
  process.exit(0);
}

console.error('Problems:');
for (const p of problems) console.error(`- ${p}`);
process.exit(1);

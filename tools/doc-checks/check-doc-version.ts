#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Enforces that the `**Version:**` header in each top-level normative
// document matches the latest released version recorded in CHANGELOG.md.
// Prevents the GUIDE / SPECIFICATION / README from drifting away from the
// canonical version when a release lands.
//
// Source of truth: the first `## [X.Y]` (or `## [X.Y.Z]`) heading in
// CHANGELOG.md. Every checked document must declare the same version in
// its `**Version:** X.Y` header. The GUIDE's secondary reference to the
// specification (`Reference specification: ... vX.Y`) must also match.

import fs from 'node:fs';

type Check = {
  file: string;
  // Regex with a single capture group that yields the version string.
  re: RegExp;
  // Human-readable label for the matched location.
  label: string;
};

const CHANGELOG = 'CHANGELOG.md';

const checks: Check[] = [
  {
    file: 'README.md',
    re: /^\*\*Version:\*\*\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)\b/m,
    label: '**Version:** header',
  },
  {
    file: 'AI-CONTRIBUTOR-SPECIFICATION.md',
    re: /\*\*Version:\*\*\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)\b/,
    label: '**Version:** header',
  },
  {
    file: 'AI-CONTRIBUTOR-GUIDE.md',
    re: /\*\*Version:\*\*\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)\b/,
    label: '**Version:** header',
  },
  {
    file: 'AI-CONTRIBUTOR-GUIDE.md',
    re: /Reference specification:\*\*[^\n]*?v([0-9]+\.[0-9]+(?:\.[0-9]+)?)\b/,
    label: 'Reference specification version',
  },
];

function readChangelogVersion(): { version: string; line: number } {
  const text = fs.readFileSync(CHANGELOG, 'utf8');
  const lines = text.split(/\r?\n/);
  const re = /^##\s*\[\s*([0-9]+\.[0-9]+(?:\.[0-9]+)?)\s*\]/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) return { version: m[1], line: i + 1 };
  }
  console.error(
    `${CHANGELOG}: no \`## [X.Y]\` release heading found — cannot determine canonical version`,
  );
  process.exit(1);
}

function locateMatch(content: string, re: RegExp): { value: string; line: number } | null {
  const m = content.match(re);
  if (!m || m.index === undefined) return null;
  const before = content.slice(0, m.index);
  const line = before.split(/\r?\n/).length;
  return { value: m[1], line };
}

const canonical = readChangelogVersion();
const problems: string[] = [];
let checked = 0;

for (const c of checks) {
  let content: string;
  try {
    content = fs.readFileSync(c.file, 'utf8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    problems.push(`${c.file}: cannot read (${message})`);
    continue;
  }
  const hit = locateMatch(content, c.re);
  if (!hit) {
    problems.push(`${c.file}: no ${c.label} matched ${c.re}`);
    continue;
  }
  checked++;
  if (hit.value !== canonical.version) {
    problems.push(
      `${c.file}:${hit.line}: ${c.label} declares "${hit.value}" but CHANGELOG.md:${canonical.line} pins "${canonical.version}"`,
    );
  }
}

console.log(
  `checked ${checked} version reference(s) against ${CHANGELOG} (canonical: ${canonical.version})`,
);
if (problems.length) {
  console.error('Version drift detected:');
  for (const p of problems) console.error(' -', p);
  console.error(
    "Update each `**Version:**` header (and the GUIDE's `Reference specification: ... vX.Y`) to match the latest CHANGELOG.md release, or land the new release entry first.",
  );
  process.exit(1);
}
console.log('OK — all version references agree with CHANGELOG.md');

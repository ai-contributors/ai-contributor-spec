#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// CLI-surface tests for runValidator: covers the argv parser branches and
// the path-resolution / summary-override / unreadable-file paths that the
// fixture-driven tests in test-audit-validate.ts don't exercise.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runValidator } from '../../skills/ai-contributor-audit/scripts/audit-validate.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function bad(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

// --summary requires a path argument.
{
  const r = runValidator(['--summary']);
  if (r.exitCode === 2 && /summary requires a path/.test(r.stderr)) {
    ok('runValidator: --summary with no value -> exit 2');
  } else {
    bad('runValidator --summary no value', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}

// --summary followed by another flag is rejected.
{
  const r = runValidator(['--summary', '--template', 'a.md', 'b.md']);
  if (r.exitCode === 2 && /summary requires a path/.test(r.stderr)) {
    ok('runValidator: --summary --template -> exit 2');
  } else {
    bad('runValidator --summary --template', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}

// Wrong positional count.
{
  const r = runValidator(['only-one-path']);
  if (r.exitCode === 2 && /Usage: audit-validate\.ts/.test(r.stderr)) {
    ok('runValidator: one positional -> exit 2 with usage');
  } else {
    bad('runValidator one positional', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}
{
  const r = runValidator(['a', 'b', 'c']);
  if (r.exitCode === 2 && /Usage: audit-validate\.ts/.test(r.stderr)) {
    ok('runValidator: three positionals -> exit 2 with usage');
  } else {
    bad('runValidator three positionals', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}

// Unreadable file -> AUDIT001.
{
  const r = runValidator(['/tmp/no-such-file-xyz', '/tmp/no-such-other']);
  if (r.exitCode === 2 && /AUDIT001/.test(r.stderr)) {
    ok('runValidator: unreadable input -> AUDIT001 exit 2');
  } else {
    bad('runValidator unreadable', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}

// --template mode + --lenient flag combination passes through.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-validate-cli-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const al = path.join(tmp, 'AL.md');
    const sum = path.join(tmp, 'SUM.md');
    // Minimal frontmatter so checkFrontmatter doesn't crash.
    const fm = '---\nspec_version: "0.1"\n---\n';
    fs.writeFileSync(cl, fm + '\n# Checklist\n');
    fs.writeFileSync(al, fm + '\n# Audit Log\n');
    fs.writeFileSync(sum, fm + '\n# Summary\n');
    const r = runValidator([cl, al, '--summary', sum, '--template', '--lenient']);
    // Either exit 0 (clean) or exit 1 (some other validator complaint) is
    // acceptable; the test is that the parser accepted these flags and got
    // through to the validation pass without an exit-2 parser error.
    if (r.exitCode !== 2) {
      ok(`runValidator: --template + --lenient + --summary parsed (exit=${r.exitCode})`);
    } else {
      bad('runValidator template+lenient', `exit=${r.exitCode} stderr=${r.stderr}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-validate CLI test(s) failed`);
  process.exit(1);
}
console.log('All audit-validate CLI tests passed');

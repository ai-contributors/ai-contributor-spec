#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// CLI-error tests for audit-collect.ts: cover the `fail()` exit-2 branch
// (non-git target) and the parser usage error.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SCRIPT = path.join(
  REPO_ROOT,
  'skills',
  'ai-contributor-audit',
  'scripts',
  'audit-collect.ts',
);
const TSX = path.join(HERE, '..', 'node_modules', '.bin', 'tsx');

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function bad(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

// audit-collect.ts against a non-git target -> fail(2, "not a git repository").
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-cli-nogit-'));
  try {
    const result = spawnSync(TSX, [SCRIPT, tmp, '--out', path.join(tmp, 'EVIDENCE.json')], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (result.status === 2 && /not a git repository/i.test(result.stderr)) {
      ok('audit-collect.ts: non-git target -> exit 2 with not-a-git-repo error');
    } else {
      bad(
        'audit-collect non-git',
        `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// audit-collect.ts with no positional -> usage error.
{
  const result = spawnSync(TSX, [SCRIPT], { encoding: 'utf8', timeout: 30_000 });
  if (result.status === 2 && /Usage/i.test(result.stderr)) {
    ok('audit-collect.ts: no positional -> exit 2 with usage');
  } else {
    bad('audit-collect no positional', `status=${result.status}\nstderr:\n${result.stderr}`);
  }
}

if (failed > 0) {
  console.error(`${failed} audit-collect-cli test(s) failed`);
  process.exit(1);
}
console.log('All audit-collect-cli tests passed');

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for formatting.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// formatting: config without invocation → Warning; config + script invocation → Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-fmt-config-only-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(path.join(target, '.editorconfig'), 'root = true\n');
    fs.writeFileSync(path.join(target, '.prettierrc'), '{}\n');
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({
        name: 'fmt',
        devDependencies: { prettier: '^3.0.0' },
        scripts: { test: 'echo' },
      }),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'f'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['formatting-automated']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL prettier config without invocation not Warning: ${JSON.stringify(r['formatting-automated'])}`,
      );
    } else {
      console.log('OK   formatter config without CI/script invocation is Warning');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-fmt-invoked-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(path.join(target, '.editorconfig'), 'root = true\n');
    fs.writeFileSync(path.join(target, '.prettierrc'), '{}\n');
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({
        name: 'fmt',
        devDependencies: { prettier: '^3.0.0' },
        scripts: { format: 'prettier --check .' },
      }),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'f'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['formatting-automated']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL prettier invoked via script not Fulfilled: ${JSON.stringify(r['formatting-automated'])}`,
      );
    } else {
      console.log('OK   formatter config + script invocation is Fulfilled');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-collect test(s) failed`);
  process.exit(1);
}
console.log('All audit-collect tests passed');

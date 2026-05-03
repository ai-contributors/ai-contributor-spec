#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for codeowners.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// codeowners: missing CODEOWNERS → Alarm; partial coverage → Warning naming uncovered paths.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-codeowners-partial-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(path.join(target, '.github', 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(target, '.github', 'workflows', 'ci.yml'),
      'name: ci\non: pull_request\njobs: {}\n',
    );
    fs.mkdirSync(path.join(target, 'terraform'), { recursive: true });
    fs.writeFileSync(path.join(target, 'terraform', 'main.tf'), '# tf\n');
    // CODEOWNERS covers .github/workflows but not terraform/
    fs.writeFileSync(
      path.join(target, '.github', 'CODEOWNERS'),
      '/.github/workflows/ @platform-team\n',
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'co'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['sensitive-path-ownership']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL partial CODEOWNERS coverage not Warning: ${JSON.stringify(r['sensitive-path-ownership'])}`,
      );
    } else if (!r['sensitive-path-ownership']?.derivation_reason?.includes('terraform/')) {
      failed++;
      console.error(
        `FAIL Warning reason did not name terraform/: ${r['sensitive-path-ownership']?.derivation_reason}`,
      );
    } else {
      console.log('OK   partial CODEOWNERS coverage names uncovered sensitive paths');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// codeowners: missing CODEOWNERS → Alarm.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-codeowners-missing-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['sensitive-path-ownership']?.derived_status !== 'Alarm') {
      failed++;
      console.error(
        `FAIL missing CODEOWNERS not Alarm: ${JSON.stringify(r['sensitive-path-ownership'])}`,
      );
    } else {
      console.log('OK   missing CODEOWNERS Alarms');
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

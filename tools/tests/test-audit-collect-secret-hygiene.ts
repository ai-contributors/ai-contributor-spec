#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for secret-hygiene.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// repo-hygiene: tracked .env triggers Alarm; .env.example does not.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-rh-secret-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(path.join(target, '.env.example'), 'API_KEY=<your-key>\nDB_URL=\n');
    // Non-placeholder-looking value so suspectRe trips, but not key-shaped
    // enough to trip hosted secret-scanners (GitHub push protection runs
    // on the test fixture string too).
    fs.writeFileSync(
      path.join(target, '.env'),
      'DATABASE_URL=postgres://user:hunter2hunter2hunter2@db/app\n',
    );
    fs.writeFileSync(
      path.join(target, '.gitignore'),
      '.env\nnode_modules/\n*.pem\nid_rsa\n*.pfx\nservice-account*.json\n',
    );
    run('git', ['add', '-A', '-f'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'rh'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['secret-vcs-exclude']?.derived_status !== 'Alarm') {
      failed++;
      console.error(`FAIL tracked .env did not Alarm: ${JSON.stringify(r['secret-vcs-exclude'])}`);
    } else if (!r['secret-vcs-exclude']?.derivation_reason?.includes('.env')) {
      failed++;
      console.error(
        `FAIL Alarm reason did not cite .env: ${r['secret-vcs-exclude']?.derivation_reason}`,
      );
    } else if (r['secret-vcs-exclude']?.derivation_reason?.includes('.env.example')) {
      failed++;
      console.error(
        `FAIL .env.example incorrectly flagged as offender: ${r['secret-vcs-exclude']?.derivation_reason}`,
      );
    } else if (r['env-example-placeholders']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL placeholder-only .env.example not Fulfilled: ${JSON.stringify(r['env-example-placeholders'])}`,
      );
    } else {
      console.log(
        'OK   tracked .env Alarms; .env.example with placeholders is Fulfilled and not a false positive',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// repo-hygiene: clean repo with protective .gitignore → Fulfilled secret-vcs-exclude.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-rh-clean-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, '.gitignore'),
      '.env\n*.pem\nid_rsa\n*.pfx\nservice-account*.json\n',
    );
    fs.writeFileSync(
      path.join(target, 'CONTRIBUTING.md'),
      [
        '# Contributing',
        '',
        'Local secrets live in `.env`, which is gitignored. Do not commit credentials;',
        'use the team secrets manager (1Password) and rotate API keys quarterly.',
        '',
      ].join('\n'),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'rh'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['secret-vcs-exclude']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL clean repo with protective .gitignore not Fulfilled: ${JSON.stringify(r['secret-vcs-exclude'])}`,
      );
    } else if (r['credential-handling-documented']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL CONTRIBUTING.md credential guidance not Fulfilled: ${JSON.stringify(r['credential-handling-documented'])}`,
      );
    } else {
      console.log(
        'OK   clean repo with protective .gitignore + documented credential handling is Fulfilled',
      );
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

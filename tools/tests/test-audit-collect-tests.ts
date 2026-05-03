#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for tests.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// test-shape: multi-layer + non-zero coverage threshold → Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-tests-good-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'vitest.config.ts'),
      'export default { test: { coverage: { branches: 80, lines: 80, functions: 80, statements: 80 } } }\n',
    );
    fs.writeFileSync(path.join(target, 'playwright.config.ts'), 'export default {}\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 't'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['multiple-test-layers']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL vitest+playwright not multi-layer: ${JSON.stringify(r['multiple-test-layers'])}`,
      );
    } else if (r['coverage-as-minimum']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL coverage threshold 80 not Fulfilled: ${JSON.stringify(r['coverage-as-minimum'])}`,
      );
    } else {
      console.log(
        'OK   vitest + playwright + non-zero coverage threshold → multi-layer + coverage Fulfilled',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// test-shape: coverage threshold = 0 is Warning, not Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-tests-zero-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'jest.config.js'),
      'module.exports = { coverageThreshold: { global: { branches: 0, lines: 0, functions: 0, statements: 0 } } }\n',
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 't'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['coverage-as-minimum']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL coverage threshold 0 not Warning: ${JSON.stringify(r['coverage-as-minimum'])}`,
      );
    } else {
      console.log('OK   coverage threshold = 0 is Warning, not Fulfilled');
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

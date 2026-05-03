#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for code-quality.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// code-quality-tooling: installed-but-not-invoked → Warning, not Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-cq-installed-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({
        name: 'cq-fixture',
        devDependencies: { knip: '^5.0.0', 'dependency-cruiser': '^16.0.0', secretlint: '^8.0.0' },
        scripts: { test: 'echo no-invoke' },
      }),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'cq'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['dead-code-and-cycles-surfaced']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL knip installed-but-not-invoked not Warning: ${JSON.stringify(r['dead-code-and-cycles-surfaced'])}`,
      );
    } else if (
      !r['dead-code-and-cycles-surfaced']?.derivation_reason?.includes('not invoked') &&
      !r['dead-code-and-cycles-surfaced']?.derivation_reason?.includes('no invocation')
    ) {
      failed++;
      console.error(
        `FAIL knip warning reason missing invocation language: ${r['dead-code-and-cycles-surfaced']?.derivation_reason}`,
      );
    } else if (r['architecture-rules-automated']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL dependency-cruiser installed-but-not-invoked not Warning: ${JSON.stringify(r['architecture-rules-automated'])}`,
      );
    } else if (r['credential-leakage-checks']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL secretlint installed-but-not-invoked not Warning: ${JSON.stringify(r['credential-leakage-checks'])}`,
      );
    } else {
      console.log('OK   code-quality tools installed but not invoked are Warning, not Fulfilled');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// code-quality-tooling: dep + script invocation → Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-cq-invoked-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({
        name: 'cq-fixture',
        devDependencies: { knip: '^5.0.0', 'dependency-cruiser': '^16.0.0', secretlint: '^8.0.0' },
        scripts: {
          'check:dead': 'knip',
          'check:arch': 'depcruise src',
          'check:secrets': 'secretlint',
        },
      }),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'cq'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    const ids = [
      'dead-code-and-cycles-surfaced',
      'architecture-rules-automated',
      'credential-leakage-checks',
    ];
    const wrong = ids.filter((id) => r[id]?.derived_status !== 'Fulfilled');
    if (wrong.length > 0) {
      failed++;
      console.error(
        `FAIL invoked code-quality tools not Fulfilled: ${wrong.map((id) => `${id}=${r[id]?.derived_status}`).join(', ')}`,
      );
    } else {
      console.log('OK   code-quality tools declared and invoked are Fulfilled');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// code-quality-tooling: pre-commit invocation alone counts.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-cq-precommit-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, '.pre-commit-config.yaml'),
      [
        'repos:',
        '  - repo: https://github.com/gitleaks/gitleaks',
        '    rev: v8.18.0',
        '    hooks:',
        '      - id: gitleaks',
        '',
      ].join('\n'),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'pc'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['credential-leakage-checks']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL gitleaks pre-commit hook not Fulfilled: ${JSON.stringify(r['credential-leakage-checks'])}`,
      );
    } else {
      console.log('OK   credential-leakage-checks accepts pre-commit hook invocation');
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

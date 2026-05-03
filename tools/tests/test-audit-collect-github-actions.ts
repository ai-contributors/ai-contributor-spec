#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for github-actions.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  run,
  initRepo,
  writeWorkflow,
  runCollect,
  type GhaTestEvidence,
} from './audit-collect-test-utils.ts';

let failed = 0;

// Floating-tag, missing-permissions, no-publish workflow → expected warnings.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-gha-floating-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeWorkflow(
      target,
      'ci.yml',
      [
        'name: ci',
        'on:',
        '  pull_request:',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - run: echo hi',
        '',
      ].join('\n'),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'wf'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['build-immutable-refs']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL floating-tag uses: not Warning: ${JSON.stringify(r['build-immutable-refs'])}`,
      );
    } else if (r['workflow-token-least-privilege']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL missing permissions: not Warning: ${JSON.stringify(r['workflow-token-least-privilege'])}`,
      );
    } else if (r['sbom-generation']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL absent SBOM action: not Warning: ${JSON.stringify(r['sbom-generation'])}`,
      );
    } else if (r['release-from-ci']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL no publish step: release-from-ci not Warning: ${JSON.stringify(r['release-from-ci'])}`,
      );
    } else {
      console.log(
        'OK   gha-supply-chain warns on floating tag, missing permissions, no SBOM, no publish',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// permissions: write-all → Alarm.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-gha-writeall-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeWorkflow(
      target,
      'broad.yml',
      [
        'name: broad',
        'on: push',
        'permissions: write-all',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11',
        '',
      ].join('\n'),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'wf'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['workflow-token-least-privilege']?.derived_status !== 'Alarm') {
      failed++;
      console.error(
        `FAIL write-all not Alarm: ${JSON.stringify(r['workflow-token-least-privilege'])}`,
      );
    } else if (r['build-immutable-refs']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL SHA-pinned ref not Fulfilled: ${JSON.stringify(r['build-immutable-refs'])}`,
      );
    } else {
      console.log('OK   write-all is Alarm; SHA-pinned uses are Fulfilled');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Signed tag-gated release with SBOM and provenance → all Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-gha-release-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeWorkflow(
      target,
      'release.yml',
      [
        'name: release',
        'on:',
        '  release:',
        '    types: [published]',
        'permissions:',
        '  contents: read',
        '  id-token: write',
        'jobs:',
        '  publish:',
        '    runs-on: ubuntu-latest',
        '    permissions:',
        '      contents: write',
        '      id-token: write',
        '    steps:',
        '      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11',
        '      - uses: anchore/sbom-action@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '      - uses: actions/attest-build-provenance@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        '      - uses: sigstore/cosign-installer@cccccccccccccccccccccccccccccccccccccccc',
        '      - uses: softprops/action-gh-release@dddddddddddddddddddddddddddddddddddddddd',
        '',
      ].join('\n'),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'wf'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    const ids: Array<keyof typeof r> = [
      'build-immutable-refs',
      'workflow-token-least-privilege',
      'sbom-generation',
      'artifact-signing',
      'build-provenance-attestation',
      'release-from-ci',
    ];
    const notFulfilled = ids.filter((id) => r[id]?.derived_status !== 'Fulfilled');
    if (notFulfilled.length > 0) {
      failed++;
      console.error(
        `FAIL signed tag-gated release rules not all Fulfilled: ${notFulfilled.map((id) => `${id}=${r[id]?.derived_status}`).join(', ')}`,
      );
    } else {
      console.log('OK   signed tag-gated release is Fulfilled across all 6 gha-supply-chain rules');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Tag-gated publish via `if: startsWith(github.ref, 'refs/tags/')` → Fulfilled
// even on a `push` trigger without `release:` event.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-gha-tag-if-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeWorkflow(
      target,
      'release.yml',
      [
        'name: release',
        'on: push',
        'permissions:',
        '  contents: write',
        'jobs:',
        '  publish:',
        "    if: startsWith(github.ref, 'refs/tags/')",
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11',
        '      - run: npm publish',
        '',
      ].join('\n'),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'wf'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['release-from-ci']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL tag-gated if-publish not Fulfilled: ${JSON.stringify(r['release-from-ci'])}`,
      );
    } else {
      console.log(
        'OK   `if: startsWith(github.ref, refs/tags/...)` gating is recognized as tag-gated publish',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// No workflows → all 6 rules are Not relevant / not_applicable.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-gha-empty-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    const ids = [
      'build-immutable-refs',
      'workflow-token-least-privilege',
      'sbom-generation',
      'artifact-signing',
      'build-provenance-attestation',
      'release-from-ci',
    ];
    const wrong = ids.filter(
      (id) =>
        r[id]?.derived_status !== 'Not relevant' ||
        r[id]?.applicability?.verdict !== 'not_applicable',
    );
    if (wrong.length > 0) {
      failed++;
      console.error(
        `FAIL no-workflow gha rules not Not relevant: ${wrong.map((id) => `${id}=${r[id]?.derived_status}`).join(', ')}`,
      );
    } else {
      console.log('OK   no .github/workflows yields Not relevant for all 6 gha-supply-chain rules');
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

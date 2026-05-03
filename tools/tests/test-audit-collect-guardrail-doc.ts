#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for guardrail-doc.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// guardrail-docs: file present but unlinked → Warning; linked → Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-guard-unlinked-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(path.join(target, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(target, 'docs/guardrails.md'), '# Guardrails\n\nSafety rules.\n');
    fs.writeFileSync(path.join(target, 'README.md'), '# repo\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'g'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['authoritative-guardrail-doc']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL unlinked guardrail doc not Warning: ${JSON.stringify(r['authoritative-guardrail-doc'])}`,
      );
    } else {
      console.log('OK   guardrail doc present but unlinked from README/canonical → Warning');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-guard-linked-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(path.join(target, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(target, 'docs/guardrails.md'), '# Guardrails\n\nSafety rules.\n');
    fs.writeFileSync(path.join(target, 'README.md'), '# repo\n\nSee docs/guardrails.md.\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'g'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['authoritative-guardrail-doc']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL linked guardrail doc not Fulfilled: ${JSON.stringify(r['authoritative-guardrail-doc'])}`,
      );
    } else {
      console.log('OK   guardrail doc linked from README → Fulfilled');
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

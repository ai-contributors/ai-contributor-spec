#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for authorship.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  run,
  initRepo,
  runCollect,
  type GhaTestEvidence,
  REPO_ROOT,
} from './audit-collect-test-utils.ts';

let failed = 0;

// ai-authorship-trail: Co-Authored-By Claude trailer → Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-authorship-yes-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(path.join(target, 'src.ts'), 'console.log("hi");\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.invalid',
        'commit',
        '-m',
        'feat: refactor\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>',
      ],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      ai_authorship_trail?: {
        window: number;
        total_commits_scanned: number;
        ai_authored: Array<{ sha: string; matched_authors: string[] }>;
        ratio: number;
        most_recent_ai_sha: string | null;
      };
    };
    const r = ev.rules ?? {};
    if (r['ai-authorship-traceability']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL Co-Authored-By Claude trailer not Fulfilled: ${JSON.stringify(r['ai-authorship-traceability'])}`,
      );
    } else if (!ev.ai_authorship_trail?.ai_authored?.[0]?.matched_authors?.includes('Claude')) {
      failed++;
      console.error(
        `FAIL ai_authorship_trail did not match Claude: ${JSON.stringify(ev.ai_authorship_trail)}`,
      );
    } else if (ev.ai_authorship_trail?.window !== 200) {
      failed++;
      console.error(`FAIL default authorship window not 200: ${ev.ai_authorship_trail?.window}`);
    } else {
      console.log('OK   Co-Authored-By Claude trailer → AI Authorship Traceability Fulfilled');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ai-authorship-trail: no AI trailers in window → Warning; deterministic across re-runs.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-authorship-no-'));
  try {
    const target = path.join(tmp, 'repo');
    const out1 = path.join(tmp, 'evid1.json');
    const out2 = path.join(tmp, 'evid2.json');
    initRepo(target);
    fs.writeFileSync(path.join(target, 'a.ts'), 'export const a = 1;\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      [
        '-c',
        'user.name=Alice',
        '-c',
        'user.email=a@example.invalid',
        'commit',
        '-m',
        'feat: add a',
      ],
      target,
    );
    fs.writeFileSync(path.join(target, 'b.ts'), 'export const b = 2;\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=Bob', '-c', 'user.email=b@example.invalid', 'commit', '-m', 'feat: add b'],
      target,
    );
    runCollect(target, out1);
    runCollect(target, out2);
    const ev1 = JSON.parse(fs.readFileSync(out1, 'utf8')) as GhaTestEvidence & {
      ai_authorship_trail?: { ai_authored: unknown[]; total_commits_scanned: number };
    };
    const ev2 = JSON.parse(fs.readFileSync(out2, 'utf8')) as { ai_authorship_trail?: unknown };
    const r = ev1.rules ?? {};
    if (r['ai-authorship-traceability']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL no-AI-trailer commits not Warning: ${JSON.stringify(r['ai-authorship-traceability'])}`,
      );
    } else if (ev1.ai_authorship_trail?.total_commits_scanned !== 3) {
      failed++;
      console.error(
        `FAIL window did not see all 3 commits: ${JSON.stringify(ev1.ai_authorship_trail)}`,
      );
    } else if (
      JSON.stringify(ev1.ai_authorship_trail) !== JSON.stringify(ev2.ai_authorship_trail)
    ) {
      failed++;
      console.error(
        'FAIL ai_authorship_trail differs between two runs at same commit (non-deterministic)',
      );
    } else {
      console.log(
        'OK   no AI trailers → Warning; ai_authorship_trail deterministic across re-runs',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ai-authorship-trail: --authorship-window flag is honored.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-authorship-window-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'evid.json');
    initRepo(target);
    for (let i = 0; i < 4; i++) {
      fs.writeFileSync(path.join(target, `f${i}.ts`), `export const f${i} = ${i};\n`);
      run('git', ['add', '-A'], target);
      run(
        'git',
        ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', `feat: f${i}`],
        target,
      );
    }
    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
        '--authorship-window',
        '2',
      ],
      REPO_ROOT,
    );
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      ai_authorship_trail?: { window: number; total_commits_scanned: number };
    };
    if (ev.ai_authorship_trail?.window !== 2) {
      failed++;
      console.error(
        `FAIL --authorship-window 2 not honored: window=${ev.ai_authorship_trail?.window}`,
      );
    } else if (ev.ai_authorship_trail?.total_commits_scanned !== 2) {
      failed++;
      console.error(
        `FAIL window=2 did not limit commits to 2: total=${ev.ai_authorship_trail?.total_commits_scanned}`,
      );
    } else {
      console.log('OK   --authorship-window flag limits the commit window');
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

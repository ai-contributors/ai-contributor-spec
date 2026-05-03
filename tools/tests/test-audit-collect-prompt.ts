#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for prompt.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// prompt-skill-inventory: documented audit trail → Fulfilled; absent → Warning.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-prompt-doc-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'AGENTS.md'),
      '# Agents\n\nAll prompt versions are recorded via Co-Authored-By trailers and the model identifier in commit messages.\n',
    );
    fs.mkdirSync(path.join(target, 'prompts'), { recursive: true });
    fs.writeFileSync(
      path.join(target, 'prompts', 'review.md'),
      '---\nversion: 1.2.3\n---\n# Review prompt\n',
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'p'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      prompt_skill_inventory?: Array<{ path: string; tracked: boolean; version_pinned: boolean }>;
    };
    const r = ev.rules ?? {};
    if (r['prompt-audit-trail']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL documented prompt audit trail not Fulfilled: ${JSON.stringify(r['prompt-audit-trail'])}`,
      );
    } else if (
      !ev.prompt_skill_inventory?.some(
        (p) => p.path === 'prompts/review.md' && p.tracked && p.version_pinned,
      )
    ) {
      failed++;
      console.error(
        `FAIL prompt_skill_inventory missing tracked+versioned entry: ${JSON.stringify(ev.prompt_skill_inventory)}`,
      );
    } else {
      console.log(
        'OK   AGENTS.md mentioning Co-Authored-By + tracked versioned prompt → Prompt Audit Trail Fulfilled',
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

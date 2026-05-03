#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for ai-instructions.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// ai-instructions: divergent instruction files → Warning.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-ai-instr-divergent-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    const long = Array.from(
      { length: 50 },
      (_, i) => `Step ${i}: do this carefully and review the outcome.`,
    ).join('\n');
    fs.writeFileSync(
      path.join(target, 'AGENTS.md'),
      `# Agents\n\n${long}\n\nDo not commit secrets to the repo.\n`,
    );
    fs.writeFileSync(
      path.join(target, 'CLAUDE.md'),
      `# Claude\n\n${long}\nClaude-specific clarification: prefer concise responses.\n`,
    );
    fs.writeFileSync(path.join(target, 'README.md'), '# repo\n\nSee AGENTS.md for AI guidance.\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'inst'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      instruction_quality_hints?: {
        canonical_file?: string;
        pointer_files?: Array<{ path: string; classification: string }>;
      };
    };
    const r = ev.rules ?? {};
    const hints = ev.instruction_quality_hints;
    if (r['ai-instruction-authoritative']?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL two divergent instruction files not Warning: ${JSON.stringify(r['ai-instruction-authoritative'])}`,
      );
    } else if (!hints?.pointer_files?.some((p) => p.classification === 'divergent')) {
      failed++;
      console.error(`FAIL no pointer file classified divergent: ${JSON.stringify(hints)}`);
    } else {
      console.log(
        'OK   two canonical-length instruction files → AI Instruction Authoritative Warning',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ai-instructions: canonical + thin pointer + README ref + forbidden action → Fulfilled across all 3 rules.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-ai-instr-clean-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    const long = Array.from({ length: 50 }, (_, i) => `Section ${i}: rule for AI agents.`).join(
      '\n',
    );
    fs.writeFileSync(
      path.join(target, 'AGENTS.md'),
      `# Agents\n\n${long}\n\nDo not modify production data without approval.\nNever bypass code review.\n`,
    );
    fs.writeFileSync(
      path.join(target, 'CLAUDE.md'),
      '# Claude\n\nSee AGENTS.md for the authoritative agent instructions.\n',
    );
    fs.writeFileSync(path.join(target, 'README.md'), '# repo\n\nAI agents: read AGENTS.md.\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'inst'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    const ids = [
      'ai-instruction-authoritative',
      'tool-specific-pointer-only',
      'ai-forbidden-actions',
    ];
    const wrong = ids.filter((id) => r[id]?.derived_status !== 'Fulfilled');
    if (wrong.length > 0) {
      failed++;
      console.error(
        `FAIL clean ai-instructions setup not all Fulfilled: ${wrong.map((id) => `${id}=${r[id]?.derived_status}`).join(', ')}`,
      );
    } else {
      console.log(
        'OK   single canonical + thin pointer + README ref + forbidden-actions → all 3 ai-instructions rules Fulfilled',
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

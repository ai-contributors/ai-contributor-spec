// SPDX-License-Identifier: Apache-2.0
//
// Shared fixtures for audit-collect smoke-test shards.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROFILE_QUESTIONS } from '../../skills/ai-contributor-audit/scripts/internal/collector-profile.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');

export function run(cmd: string, args: string[], cwd: string, env = process.env): void {
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed with ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
  }
}

export function runStatus(
  cmd: string,
  args: string[],
  cwd: string,
  env = process.env,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

export function commandDir(command: string): string {
  const r = spawnSync('which', [command], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`could not locate ${command}: ${r.stderr}`);
  return path.dirname(r.stdout.trim().split('\n')[0]!);
}

export function initRepo(target: string): void {
  fs.mkdirSync(target, { recursive: true });
  run('git', ['init', '-b', 'main'], target);
  fs.writeFileSync(path.join(target, 'README.md'), '# audit collect fixture\n');
  run('git', ['add', 'README.md'], target);
  run(
    'git',
    [
      '-c',
      'user.name=Audit Test',
      '-c',
      'user.email=audit@example.invalid',
      'commit',
      '-m',
      'init',
    ],
    target,
  );
}

interface RowOverride {
  answer?: string;
  evidence?: string;
  affected?: string;
}

function renderProfileTable(
  rows: ReadonlyArray<{ area: string; question: string; affected: string; cells?: RowOverride }>,
): string {
  const header =
    '| Area | Question | Answer | Evidence / rationale | Affected checks (rule and IDs) |';
  const separator =
    '| ---- | -------- | ------ | -------------------- | ------------------------------ |';
  const lines = rows.map(
    (r) =>
      `| ${r.area} | ${r.question} | ${r.cells?.answer ?? ''} | ${r.cells?.evidence ?? ''} | ${r.cells?.affected ?? r.affected} |`,
  );
  return ['# AI Contributor Audit Profile', '', header, separator, ...lines, ''].join('\n');
}

export function writeProfile(target: string, answer: string, affected?: string): void {
  const auditDir = path.join(target, '.ai-contributor-audit');
  fs.mkdirSync(auditDir, { recursive: true });
  const rows = PROFILE_QUESTIONS.map((q) => ({
    area: q.area,
    question: q.question,
    affected: q.affectedRender,
    cells:
      q.id === 'env-required' ? { answer, evidence: 'No runtime env vars.', affected } : undefined,
  }));
  fs.writeFileSync(
    path.join(auditDir, 'AI-CONTRIBUTOR-AUDIT-PROFILE.md'),
    renderProfileTable(rows),
  );
}

export function writePushProtectionProfile(target: string, answer: string): void {
  const auditDir = path.join(target, '.ai-contributor-audit');
  fs.mkdirSync(auditDir, { recursive: true });
  const q = PROFILE_QUESTIONS.find((q) => q.id === 'host-push-protection');
  if (!q) throw new Error('host-push-protection question missing from PROFILE_QUESTIONS');
  fs.writeFileSync(
    path.join(auditDir, 'AI-CONTRIBUTOR-AUDIT-PROFILE.md'),
    renderProfileTable([
      {
        area: q.area,
        question: q.question,
        affected: q.affectedRender,
        cells: {
          answer,
          evidence:
            'GitHub private user-owned plan does not include repository push protection; secretlint is the blocking fallback.',
        },
      },
    ]),
  );
}

export function writePushProtectionAgentsPolicy(target: string): void {
  fs.writeFileSync(
    path.join(target, 'AGENTS.md'),
    [
      '# Agent Instructions',
      '',
      'GitHub hosted push protection is unavailable for this private user-owned repository because of the current plan tier.',
      'Secretlint is configured as the blocking fallback for secret scanning before changes are pushed.',
      '',
    ].join('\n'),
  );
  run('git', ['add', 'AGENTS.md'], target);
  run(
    'git',
    [
      '-c',
      'user.name=Audit Test',
      '-c',
      'user.email=audit@example.invalid',
      'commit',
      '-m',
      'document push protection plan exclusion',
    ],
    target,
  );
}

export function writeWorkflow(target: string, name: string, body: string): void {
  const dir = path.join(target, '.github', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), body);
}

export function runCollect(target: string, out: string): void {
  run(
    'tsx',
    [
      'skills/ai-contributor-audit/scripts/audit-collect.ts',
      target,
      '--working-tree',
      '--no-network',
      '--out',
      out,
    ],
    REPO_ROOT,
  );
}

export interface GhaTestEvidence {
  rules?: Record<
    string,
    {
      derived_status?: string | null;
      derivation_reason?: string;
      applicability?: { verdict?: string };
      judgment_required?: boolean;
    }
  >;
}

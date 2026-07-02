#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'skills', 'ai-contributor-audit', 'scripts', 'audit-run.ts');
const SPEC_VERSION: string = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'AI-CONTRIBUTOR-RULE-CATALOG.json'), 'utf8'),
).specVersion;

function run(cmd: string, args: string[], cwd: string): void {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

let failed = 0;
function assert(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`OK   ${name}`);
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
  if (detail) console.error(detail);
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-reset-spec-version-'));
  try {
    run('git', ['init', '-b', 'main'], tmp);
    fs.writeFileSync(path.join(tmp, 'README.md'), '# audit run fixture\n');
    run('git', ['add', 'README.md'], tmp);
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
      tmp,
    );

    const result = spawnSync(
      'tsx',
      [
        SCRIPT,
        '.',
        '--reset-templates',
        '--template-root',
        REPO_ROOT,
        '--no-network',
        '--auditor',
        'test',
        '--runner-agent',
        'test',
        '--runner-model',
        'test',
      ],
      { cwd: tmp, encoding: 'utf8', timeout: 180_000 },
    );

    assert(
      'reset-template run reports template spec_version before target checklist exists',
      result.status === 0 && result.stdout.includes(`spec_version=${SPEC_VERSION}`),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    assert(
      'reset-template run stops at edit checkpoint in non-interactive mode',
      result.status === 0 && result.stdout.includes('initial stamp complete'),
      `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    assert(
      'audit-run child phases use tsx from PATH',
      result.stdout.includes('[audit-run] collect: tsx ') &&
        !result.stdout.includes('[audit-run] collect: npx --yes'),
      `stdout:\n${result.stdout.slice(0, 1200)}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-missing-template-root-'));
  try {
    run('git', ['init', '-b', 'main'], tmp);
    fs.writeFileSync(path.join(tmp, 'README.md'), '# audit run fixture\n');
    run('git', ['add', 'README.md'], tmp);
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
      tmp,
    );

    const specSource =
      'https://github.com/ai-contributors/ai-contributor-spec/tree/0123456789abcdef0123456789abcdef01234567';
    const result = spawnSync(
      'tsx',
      [
        SCRIPT,
        '.',
        '--reset-templates',
        '--template-root',
        path.join(tmp, 'missing-runbook'),
        '--spec-source',
        specSource,
        '--no-network',
      ],
      { cwd: tmp, encoding: 'utf8', timeout: 60_000 },
    );

    assert(
      'missing template root recommends bootstrapping full pinned runbook',
      result.status === 2 &&
        result.stderr.includes('Bootstrap the full pinned runbook') &&
        result.stderr.includes('bootstrap.ts 0123456789abcdef0123456789abcdef01234567'),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-deleted-profile-'));
  try {
    run('git', ['init', '-b', 'main'], tmp);
    fs.writeFileSync(path.join(tmp, 'README.md'), '# audit run fixture\n');
    const auditDir = path.join(tmp, '.ai-contributor-audit');
    fs.mkdirSync(auditDir);
    const profileRel = path.join('.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
    fs.writeFileSync(path.join(tmp, profileRel), '# profile\n');
    run('git', ['add', 'README.md', profileRel], tmp);
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
      tmp,
    );
    fs.unlinkSync(path.join(tmp, profileRel));

    const result = spawnSync(
      'tsx',
      [SCRIPT, '.', '--no-network', '--no-pause', '--no-bootstrap-smoke'],
      { cwd: tmp, encoding: 'utf8', timeout: 60_000 },
    );

    assert(
      'tracked-deleted profile emits fresh-start boundary warning',
      result.stderr.includes(`${profileRel} is a tracked deletion`) &&
        result.stderr.includes('deliberate fresh-start signal'),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-missing-tsx-'));
  const pathWithoutTsx = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-empty-path-'));
  try {
    run('git', ['init', '-b', 'main'], tmp);
    fs.writeFileSync(path.join(tmp, 'README.md'), '# audit run fixture\n');
    run('git', ['add', 'README.md'], tmp);
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
      tmp,
    );

    const tsxCli = fs.realpathSync(path.join(REPO_ROOT, 'tools', 'node_modules', '.bin', 'tsx'));
    const result = spawnSync(
      process.execPath,
      [tsxCli, SCRIPT, '.', '--no-network', '--no-pause', '--no-bootstrap-smoke'],
      {
        cwd: tmp,
        encoding: 'utf8',
        env: { ...process.env, PATH: pathWithoutTsx },
        timeout: 60_000,
      },
    );

    assert(
      'missing child tsx emits startup diagnostic',
      result.status === 1 &&
        result.stderr.includes('[audit-run] failed to start tsx:') &&
        result.stderr.includes(
          'Start audit-run with `npx --yes tsx@4.21.0 audit-run.ts ...` or put `tsx` on PATH.',
        ),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(pathWithoutTsx, { recursive: true, force: true });
  }
}

// --help short-circuits with usage on stdout, exit 0.
{
  const result = spawnSync('tsx', [SCRIPT, '--help'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert(
    '--help prints usage and exits 0',
    result.status === 0 &&
      result.stdout.includes('Usage: audit-run.ts') &&
      result.stdout.includes('--reset-templates'),
    `status=${result.status}\nstdout:\n${result.stdout}`,
  );
}

// Full orchestration with --no-pause: covers stamp final + validate + OK message.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-no-pause-'));
  try {
    run('git', ['init', '-b', 'main'], tmp);
    fs.writeFileSync(path.join(tmp, 'README.md'), '# audit run fixture\n');
    run('git', ['add', 'README.md'], tmp);
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
      tmp,
    );

    // The validate step will likely fail on the just-template fixture; we
    // only care that audit-run reaches stamp-final + validate before the
    // failure, so coverage exercises the full chain.
    const result = spawnSync(
      'tsx',
      [
        SCRIPT,
        '.',
        '--reset-templates',
        '--template-root',
        REPO_ROOT,
        '--no-network',
        '--no-pause',
        '--no-bootstrap-smoke',
        '--auditor',
        'test',
        '--runner-agent',
        'test',
        '--runner-model',
        'test',
      ],
      { cwd: tmp, encoding: 'utf8', timeout: 180_000 },
    );

    // Any exit (0 success or 1 from validator failing on partial fixture) is
    // fine — the test is that the script reached the validate step,
    // exercising stamp-final and validate. We can confirm by looking for
    // the final-stamp banner in stdout.
    assert(
      'no-pause path: reaches stamp final and validate',
      result.stdout.includes('[audit-run] stamp final') &&
        result.stdout.includes('[audit-run] validate'),
      `stdout:\n${result.stdout.slice(0, 1500)}\nstderr:\n${result.stderr.slice(0, 500)}`,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-run test(s) failed`);
  process.exit(1);
}
console.log('All audit-run tests passed');

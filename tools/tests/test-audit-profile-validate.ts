#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROFILE_QUESTIONS } from '../../skills/ai-contributor-audit/scripts/internal/collector-profile.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SCRIPT = path.join(
  REPO_ROOT,
  'skills',
  'ai-contributor-audit-profile',
  'scripts',
  'profile-validate.ts',
);
const TEMPLATE = path.join(
  REPO_ROOT,
  'skills',
  'ai-contributor-audit',
  'references',
  'audit-profile-template.md',
);

function run(
  args: string[],
  cwd = REPO_ROOT,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('tsx', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function fixtureRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-profile-validate-'));
  fs.mkdirSync(path.join(root, '.ai-contributor-audit'), { recursive: true });
  fs.copyFileSync(
    TEMPLATE,
    path.join(root, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md'),
  );
  return root;
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
  const root = fixtureRepo();
  try {
    const result = run([root]);
    assert(
      'canonical template profile validates',
      result.status === 0 &&
        result.stdout.includes(
          `OK — profile has ${PROFILE_QUESTIONS.length} canonical applicability rows`,
        ),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    assert(
      'first stdout line emits skill version banner',
      result.stdout
        .split('\n')[0]!
        .startsWith('ai-contributor-audit-profile profile-validate skill version:'),
      `stdout first line:\n${result.stdout.split('\n')[0]}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = fixtureRepo();
  try {
    const profilePath = path.join(root, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
    const text = fs.readFileSync(profilePath, 'utf8');
    fs.writeFileSync(
      profilePath,
      text.replace(
        '| Technology shape | Apply environment-variable template checks? |  |  | `Env Template` - `AIC-env-example-placeholders` |\n',
        '',
      ),
    );
    const result = run([root]);
    assert(
      'missing canonical question fails',
      result.status === 1 &&
        result.stderr.includes(
          'missing canonical question: Apply environment-variable template checks?',
        ),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = fixtureRepo();
  try {
    const profilePath = path.join(root, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
    const text = fs.readFileSync(profilePath, 'utf8');
    fs.writeFileSync(
      profilePath,
      text.replace(
        '| Technology shape | Apply environment-variable template checks? |  |  | `Env Template` - `AIC-env-example-placeholders` |',
        '| Technology shape | Apply environment-variable template checks? | maybe | rationale | `Env Template` - `AIC-env-example-placeholders` |',
      ),
    );
    const result = run([root]);
    assert(
      'invalid answer fails',
      result.status === 1 && result.stderr.includes('invalid answer'),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = fixtureRepo();
  try {
    const profilePath = path.join(root, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
    const text = fs.readFileSync(profilePath, 'utf8');
    fs.writeFileSync(
      profilePath,
      text.replace(
        '| Technology shape | Apply environment-variable template checks? |  |  | `Env Template` - `AIC-env-example-placeholders` |',
        '| Technology shape | Apply environment-variable template checks? | no | Owner reconfirmed 2026-13-99. No env vars. | `Env Template` - `AIC-env-example-placeholders` |',
      ),
    );
    const result = run([root]);
    assert(
      'invalid Owner reconfirmed date fails',
      result.status === 1 &&
        result.stderr.includes('"Owner (re)confirmed" date "2026-13-99" is not a valid ISO 8601'),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = fixtureRepo();
  try {
    const profilePath = path.join(root, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
    const text = fs.readFileSync(profilePath, 'utf8');
    fs.writeFileSync(
      profilePath,
      text.replace(
        '| Technology shape | Apply environment-variable template checks? |  |  | `Env Template` - `AIC-env-example-placeholders` |',
        '| Technology shape | Apply environment-variable template checks? | no | Owner confirmed 2099-01-01. No env vars. | `Env Template` - `AIC-env-example-placeholders` |',
      ),
    );
    const result = run([root]);
    assert(
      'future Owner confirmed date fails',
      result.status === 1 &&
        result.stderr.includes('"Owner (re)confirmed" date "2099-01-01" is in the future'),
      `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// Missing target profile -> exit 1.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-profile-missing-'));
  try {
    fs.mkdirSync(path.join(root, '.ai-contributor-audit'), { recursive: true });
    // Don't create the profile file at all.
    const result = run([root]);
    assert(
      'missing profile file -> exit 1',
      result.status === 1,
      `status=${result.status}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// Unsupported (extra) question in profile -> exit 1 with helpful error.
{
  const root = fixtureRepo();
  try {
    const profilePath = path.join(root, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
    const text = fs.readFileSync(profilePath, 'utf8');
    // Append an extra row that doesn't match any canonical question.
    fs.writeFileSync(
      profilePath,
      text + '| Custom shape | Apply some made-up question? | no |  | `Custom` - `AIC-custom` |\n',
    );
    const result = run([root]);
    assert(
      'unsupported question rejected',
      result.status === 1 && /unsupported.*question|made-up/i.test(result.stderr),
      `status=${result.status}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// yes answer with empty evidence cell -> exit 1.
{
  const root = fixtureRepo();
  try {
    const profilePath = path.join(root, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
    const text = fs.readFileSync(profilePath, 'utf8');
    fs.writeFileSync(
      profilePath,
      text.replace(
        '| Technology shape | Apply environment-variable template checks? |  |  | `Env Template` - `AIC-env-example-placeholders` |',
        '| Technology shape | Apply environment-variable template checks? | yes |  | `Env Template` - `AIC-env-example-placeholders` |',
      ),
    );
    const result = run([root]);
    // "yes without evidence" is reported as a Warning, not a hard failure
    // (status 0). Verify the warning surfaces.
    assert(
      'yes without evidence reported as warning',
      result.status === 0 && /Warnings/i.test(result.stderr) && /evidence/i.test(result.stderr),
      `status=${result.status}\nstderr:\n${result.stderr}`,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// --help / --bogus flag -> usage error path.
{
  const result = run(['--bogus-flag']);
  if (result.status !== 0) {
    assert('unknown flag -> nonzero exit', true);
  } else {
    assert(
      'unknown flag -> nonzero exit',
      false,
      `status=${result.status}\nstderr=${result.stderr}`,
    );
  }
}

if (failed > 0) {
  console.error(`${failed} audit-profile-validate test(s) failed`);
  process.exit(1);
}
console.log('All audit-profile-validate tests passed');

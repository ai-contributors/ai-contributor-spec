#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for github-hosted-rules.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, REPO_ROOT } from './audit-collect-test-utils.ts';

let failed = 0;

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-sast-dependency-review-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(path.join(target, '.github', 'workflows'), { recursive: true });
    fs.mkdirSync(path.join(target, 'src'), { recursive: true });
    fs.writeFileSync(path.join(target, 'src', 'index.ts'), 'export const value = 1;\n');
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@10.19.0' }, null, 2) + '\n',
    );
    fs.writeFileSync(
      path.join(target, '.github', 'workflows', 'sast.yml'),
      [
        'name: SAST',
        'on: push',
        'jobs:',
        '  semgrep:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - run: semgrep scan --error --metrics=off --config p/default .',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(target, '.github', 'workflows', 'dependency-review.yml'),
      [
        'name: Dependency Review',
        'on: pull_request',
        'jobs:',
        '  dependency-review:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - name: Review dependency changes',
        "        if: github.event.repository.visibility == 'public'",
        '        uses: actions/dependency-review-action@v4',
        '      - name: Record private-repository fallback',
        "        if: github.event.repository.visibility != 'public'",
        '        run: echo "Dependency Review is not supported for this private repository."',
        '',
      ].join('\n'),
    );
    run(
      'git',
      [
        'add',
        'package.json',
        'src/index.ts',
        '.github/workflows/sast.yml',
        '.github/workflows/dependency-review.yml',
      ],
      target,
    );
    run(
      'git',
      [
        '-c',
        'user.name=Audit Test',
        '-c',
        'user.email=audit@example.invalid',
        'commit',
        '-m',
        'add sast and dependency review workflows',
      ],
      target,
    );

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
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      rules?: {
        'sast-in-ci'?: {
          derived_status?: string;
          judgment_required?: boolean;
          derivation_reason?: string;
          aic_ids?: string[];
        };
        'dependency-review-visibility'?: {
          derived_status?: string;
          judgment_required?: boolean;
          derivation_reason?: string;
          aic_ids?: string[];
        };
      };
    };
    const sast = evidence.rules?.['sast-in-ci'];
    const dependencyReview = evidence.rules?.['dependency-review-visibility'];
    if (
      sast?.derived_status !== 'Fulfilled' ||
      sast.judgment_required !== false ||
      !sast.derivation_reason?.includes('.github/workflows/sast.yml') ||
      !sast.aic_ids?.includes('AIC-sast-in-ci')
    ) {
      failed++;
      console.error(
        `FAIL SAST workflow was not collector-derived Fulfilled: ${JSON.stringify(sast)}`,
      );
    } else if (
      dependencyReview?.derived_status !== 'Warning' ||
      dependencyReview.judgment_required !== false ||
      !dependencyReview.derivation_reason?.includes('public-repo gated') ||
      !dependencyReview.derivation_reason?.includes(
        'private fallback must run a blocking scanner',
      ) ||
      !dependencyReview.aic_ids?.includes('AIC-dependency-review-visibility')
    ) {
      failed++;
      console.error(
        `FAIL private-repo dependency review fallback was not collector-derived Warning: ${JSON.stringify(dependencyReview)}`,
      );
    } else {
      console.log(
        'OK   SAST is collector-derived Fulfilled and private dependency review fallback is Warning',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-equivalent-dependency-gate-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(path.join(target, '.github', 'workflows'), { recursive: true });
    fs.mkdirSync(path.join(target, 'src'), { recursive: true });
    fs.mkdirSync(fakeBin);
    fs.writeFileSync(path.join(target, 'src', 'index.ts'), 'export const value = 1;\n');
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@10.19.0' }, null, 2) + '\n',
    );
    fs.writeFileSync(
      path.join(target, '.github', 'workflows', 'security-scan.yml'),
      [
        'name: Security Scan',
        'on: pull_request',
        'jobs:',
        '  dependency-security:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: anchore/scan-action@v6',
        '        with:',
        '          fail-build: true',
        '',
      ].join('\n'),
    );
    run(
      'git',
      ['add', 'package.json', 'src/index.ts', '.github/workflows/security-scan.yml'],
      target,
    );
    run(
      'git',
      [
        '-c',
        'user.name=Audit Test',
        '-c',
        'user.email=audit@example.invalid',
        'commit',
        '-m',
        'add required dependency security gate',
      ],
      target,
    );
    run(
      'git',
      ['remote', 'add', 'origin', 'https://github.com/example/equivalent-dependency-gate.git'],
      target,
    );

    const gh = path.join(fakeBin, 'gh');
    fs.writeFileSync(
      gh,
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  echo "gh version 2.0.0"
  exit 0
fi
if [[ "\${1:-}" == "auth" && "\${2:-}" == "status" ]]; then
  printf "github.com\\n  OK Logged in to github.com account audit-bot\\n  - Token scopes: 'read:org'\\n" >&2
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "user" ]]; then
  echo "audit-bot"
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/equivalent-dependency-gate" ]]; then
  echo '{"name":"equivalent-dependency-gate","private":true,"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}'
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/equivalent-dependency-gate/rules/branches/main" ]]; then
  cat <<'JSON'
[{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"Security Scan"}]}}]
JSON
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/equivalent-dependency-gate/secret-scanning/alerts" ]]; then
  echo "[]"
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/equivalent-dependency-gate/dependabot/alerts?state=open&severity=high&per_page=1" ]]; then
  echo "[]"
  exit 0
fi
echo "{}"
`,
      { mode: 0o755 },
    );

    const env = { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` };
    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--out',
        out,
      ],
      REPO_ROOT,
      env,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      rules?: {
        'dependency-review-visibility'?: {
          derived_status?: string;
          judgment_required?: boolean;
          derivation_reason?: string;
        };
      };
    };
    const dependencyReview = evidence.rules?.['dependency-review-visibility'];
    if (
      dependencyReview?.derived_status !== 'Fulfilled' ||
      dependencyReview.judgment_required !== false ||
      !dependencyReview.derivation_reason?.includes('required dependency security gate') ||
      !dependencyReview.derivation_reason?.includes('Security Scan')
    ) {
      failed++;
      console.error(
        `FAIL required equivalent dependency security gate was not Fulfilled: ${JSON.stringify(dependencyReview)}`,
      );
    } else {
      console.log(
        'OK   required equivalent dependency security gate is collector-derived Fulfilled',
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

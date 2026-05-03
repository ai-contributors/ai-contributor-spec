#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for hosted-settings.

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

// hosted-settings-normalization: --no-network → every field is a verification gap.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-hosted-gap-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'evid.json');
    initRepo(target);
    run('git', ['remote', 'add', 'origin', 'https://github.com/example/gap-test.git'], target);
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      hosted_settings?: Record<string, { value: unknown; source: string }>;
    };
    const hs = ev.hosted_settings ?? {};
    const fields = [
      'branch_protection',
      'required_status_checks',
      'required_reviews',
      'codeowners_enforced',
      'secret_scanning',
      'push_protection',
      'dependency_alerts',
      'deployment_environments',
    ];
    const wrong = fields.filter((f) => hs[f]?.value !== null || hs[f]?.source !== 'no-host-access');
    if (wrong.length > 0) {
      failed++;
      console.error(`FAIL --no-network did not produce verification gaps for: ${wrong.join(', ')}`);
    } else {
      console.log('OK   --no-network → hosted_settings reports verification gaps for every field');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// hosted-settings-normalization: hosted_settings shape is byte-identical
// across re-runs against unchanged settings (modulo time fields).
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-hosted-deterministic-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out1 = path.join(tmp, 'evid1.json');
    const out2 = path.join(tmp, 'evid2.json');
    initRepo(target);
    fs.mkdirSync(fakeBin);
    run('git', ['remote', 'add', 'origin', 'https://github.com/example/det-test.git'], target);
    fs.writeFileSync(
      path.join(fakeBin, 'gh'),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo "gh version 2.0.0"; exit 0; fi
if [[ "\${1:-}" == "auth" && "\${2:-}" == "status" ]]; then printf "github.com\\n  - Token scopes: 'read:org'\\n" >&2; exit 0; fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "user" ]]; then echo "audit-bot"; exit 0; fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/det-test" ]]; then
  echo '{"name":"det-test","security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}'
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/det-test/rules/branches/main" ]]; then
  echo '[{"type":"pull_request","parameters":{"required_approving_review_count":2,"dismiss_stale_reviews_on_push":true,"require_code_owner_review":true}},{"type":"required_status_checks","parameters":{"required_status_checks":[{"context":"ci"},{"context":"lint"}]}}]'
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/det-test/secret-scanning/alerts" ]]; then echo "[]"; exit 0; fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/det-test/dependabot/alerts?state=open&severity=high&per_page=1" ]]; then echo "[]"; exit 0; fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/det-test/environments" ]]; then
  echo '{"environments":[{"name":"production","protection_rules":[{"type":"required_reviewers","reviewers":[{"type":"User","reviewer":{"login":"x"}}]}]}]}'
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
        out1,
      ],
      REPO_ROOT,
      env,
    );
    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--out',
        out2,
      ],
      REPO_ROOT,
      env,
    );
    type Field = { value: unknown; source: string; last_checked: string };
    const stripTime = (h: Record<string, Field>): Record<string, Omit<Field, 'last_checked'>> =>
      Object.fromEntries(
        Object.entries(h).map(([k, v]) => [k, { value: v.value, source: v.source }]),
      );
    const ev1 = JSON.parse(fs.readFileSync(out1, 'utf8')) as {
      hosted_settings: Record<string, Field>;
    };
    const ev2 = JSON.parse(fs.readFileSync(out2, 'utf8')) as {
      hosted_settings: Record<string, Field>;
    };
    if (
      JSON.stringify(stripTime(ev1.hosted_settings)) !==
      JSON.stringify(stripTime(ev2.hosted_settings))
    ) {
      failed++;
      console.error('FAIL hosted_settings differs between two runs at unchanged settings');
    } else if (
      ev1.hosted_settings.required_reviews?.value === null ||
      (ev1.hosted_settings.required_reviews.value as { count: number }).count !== 2
    ) {
      failed++;
      console.error(
        `FAIL ruleset required_reviews.count not parsed: ${JSON.stringify(ev1.hosted_settings.required_reviews)}`,
      );
    } else if (
      (ev1.hosted_settings.required_status_checks.value as string[]).join(',') !== 'ci,lint'
    ) {
      failed++;
      console.error(
        `FAIL required_status_checks not parsed: ${JSON.stringify(ev1.hosted_settings.required_status_checks)}`,
      );
    } else if (ev1.hosted_settings.push_protection.value !== 'enabled') {
      failed++;
      console.error(
        `FAIL push_protection not enabled: ${JSON.stringify(ev1.hosted_settings.push_protection)}`,
      );
    } else {
      console.log(
        'OK   hosted_settings is byte-identical across re-runs (modulo last_checked) and parses ruleset / repo / environments',
      );
    }

    // deploy-env-approvals: production env with required reviewers → Fulfilled
    const r = (ev1 as unknown as GhaTestEvidence).rules ?? {};
    if (r['deploy-env-approvals']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL production env with reviewers not Fulfilled: ${JSON.stringify(r['deploy-env-approvals'])}`,
      );
    } else {
      console.log(
        'OK   deployment environment with required reviewers → AIC-deploy-env-approvals Fulfilled',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// hosted-settings-normalization: production env without reviewers → Alarm.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-hosted-deploy-bad-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'evid.json');
    initRepo(target);
    fs.mkdirSync(fakeBin);
    run('git', ['remote', 'add', 'origin', 'https://github.com/example/depbad.git'], target);
    fs.writeFileSync(
      path.join(fakeBin, 'gh'),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo "gh version 2.0.0"; exit 0; fi
if [[ "\${1:-}" == "auth" && "\${2:-}" == "status" ]]; then printf "github.com\\n  - Token scopes: 'read:org'\\n" >&2; exit 0; fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "user" ]]; then echo "audit-bot"; exit 0; fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/depbad" ]]; then echo '{"name":"depbad"}'; exit 0; fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/depbad/environments" ]]; then
  echo '{"environments":[{"name":"production","protection_rules":[]}]}'
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
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['deploy-env-approvals']?.derived_status !== 'Alarm') {
      failed++;
      console.error(
        `FAIL production env without reviewers not Alarm: ${JSON.stringify(r['deploy-env-approvals'])}`,
      );
    } else {
      console.log(
        'OK   production environment without required reviewers → AIC-deploy-env-approvals Alarm',
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

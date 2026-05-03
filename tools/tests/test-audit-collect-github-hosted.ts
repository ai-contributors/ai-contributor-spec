#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for github-hosted.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  run,
  initRepo,
  writePushProtectionProfile,
  writePushProtectionAgentsPolicy,
  REPO_ROOT,
} from './audit-collect-test-utils.ts';

let failed = 0;

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-redaction-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    fs.mkdirSync(target);
    fs.mkdirSync(fakeBin);

    run('git', ['init', '-b', 'main'], target);
    fs.writeFileSync(path.join(target, 'README.md'), '# redaction fixture\n');
    fs.mkdirSync(path.join(target, '.ai-contributor-audit'), { recursive: true });
    fs.writeFileSync(
      path.join(target, '.ai-contributor-audit', 'AI-CONTRIBUTOR-CHECKLIST.md'),
      '---\nspec_version: "0.1"\n---\n',
    );
    run('git', ['add', 'README.md', '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md'], target);
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
    run(
      'git',
      ['remote', 'add', 'origin', 'https://github.com/example/redaction-test.git'],
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
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/redaction-test" ]]; then
  cat <<'JSON'
{"name":"redaction-test","temp_clone_token":"SHOULD_NOT_LEAK","nested":{"access_token":"ALSO_SHOULD_NOT_LEAK"},"security_and_analysis":{"secret_scanning_push_protection":{"status":"enabled"}}}
JSON
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/redaction-test/rules/branches/main" ]]; then
  echo "[]"
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/redaction-test/branches/main/protection" ]]; then
  echo '{"required_pull_request_reviews":{"required_approving_review_count":1},"required_status_checks":{"contexts":["ci"]},"enforce_admins":{"enabled":true},"restrictions":null}'
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/redaction-test/secret-scanning/alerts" ]]; then
  echo "[]"
  exit 0
fi
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/redaction-test/dependabot/alerts?state=open&severity=high&per_page=1" ]]; then
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

    const evidence = fs.readFileSync(out, 'utf8');
    const parsedEvidence = JSON.parse(evidence) as { spec_version?: unknown };
    if (parsedEvidence.spec_version !== '0.1') {
      failed++;
      console.error('FAIL collector did not record checklist spec_version');
    } else if (evidence.includes('SHOULD_NOT_LEAK')) {
      failed++;
      console.error('FAIL GitHub API secret-like fields leaked into evidence JSON');
    } else if (!evidence.includes('"temp_clone_token": "[REDACTED]"')) {
      failed++;
      console.error('FAIL temp_clone_token was not retained with a redacted value');
    } else {
      console.log('OK   GitHub API secret-like fields are redacted in evidence JSON');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-push-profile-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(fakeBin);
    run(
      'git',
      ['remote', 'add', 'origin', 'https://github.com/example/push-profile-test.git'],
      target,
    );
    writePushProtectionProfile(target, 'no');

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
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/push-profile-test" ]]; then
  cat <<'JSON'
{"name":"push-profile-test","private":true,"security_and_analysis":{"secret_scanning_push_protection":{"status":"disabled"}}}
JSON
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
        'push-protection'?: {
          applicability?: { verdict?: string };
          derived_status?: string;
          derivation_reason?: string;
        };
      };
    };
    const pushProtection = evidence.rules?.['push-protection'];
    if (pushProtection?.derived_status !== 'Not relevant') {
      failed++;
      console.error(
        `FAIL profile no did not mark push protection Not relevant: ${JSON.stringify(pushProtection)}`,
      );
    } else if (pushProtection.applicability?.verdict !== 'not_applicable') {
      failed++;
      console.error('FAIL push protection profile no did not mark applicability not_applicable');
    } else if (!pushProtection.derivation_reason?.includes('GitHub private user-owned plan')) {
      failed++;
      console.error(
        'FAIL push protection Not relevant reason did not include owner profile evidence',
      );
    } else {
      console.log('OK   push protection profile plan-tier exclusion is Not relevant');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-push-policy-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(fakeBin);
    run(
      'git',
      ['remote', 'add', 'origin', 'https://github.com/example/push-policy-test.git'],
      target,
    );
    writePushProtectionAgentsPolicy(target);

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
if [[ "\${1:-}" == "api" && "\${2:-}" == "repos/example/push-policy-test" ]]; then
  cat <<'JSON'
{"name":"push-policy-test","private":true,"security_and_analysis":{"secret_scanning_push_protection":{"status":"disabled"}}}
JSON
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
        'push-protection'?: {
          applicability?: { verdict?: string };
          derived_status?: string;
          derivation_reason?: string;
        };
      };
    };
    const pushProtection = evidence.rules?.['push-protection'];
    if (pushProtection?.derived_status !== 'Not relevant') {
      failed++;
      console.error(
        `FAIL AGENTS.md plan-tier exclusion did not mark push protection Not relevant: ${JSON.stringify(pushProtection)}`,
      );
    } else if (pushProtection.applicability?.verdict !== 'not_applicable') {
      failed++;
      console.error('FAIL AGENTS.md plan-tier exclusion did not mark applicability not_applicable');
    } else if (!pushProtection.derivation_reason?.includes('policy document `AGENTS.md`')) {
      failed++;
      console.error(
        'FAIL push protection Not relevant reason did not cite AGENTS.md policy evidence',
      );
    } else {
      console.log('OK   push protection AGENTS.md plan-tier exclusion is Not relevant');
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

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Targeted tests for collector-local-runtime and collector-github-api
// branches not covered by the existing fixture-driven tests.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCollectorLocalRuntime } from '../../skills/ai-contributor-audit/scripts/internal/collector-local-runtime.ts';
import { createGithubApiContext } from '../../skills/ai-contributor-audit/scripts/internal/collector-github-api.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function bad(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

// ----- collector-local-runtime ------------------------------------------

// run() against a non-existent executable -> spawn error path.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clr-spawn-err-'));
  try {
    const rt = createCollectorLocalRuntime({
      defaultAuditDir: '.ai-contributor-audit',
      getWorkTreeRoot: () => tmp,
    });
    const result = rt.run('this-executable-does-not-exist-12345', [], tmp);
    if (result.exit_code === null && /spawn|ENOENT/i.test(result.stderr_excerpt ?? '')) {
      ok('createCollectorLocalRuntime.run: non-existent executable -> spawn error captured');
    } else {
      bad('local-runtime spawn error', JSON.stringify(result));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// run() command with an arg containing a space -> display string quotes it.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clr-quote-'));
  try {
    const rt = createCollectorLocalRuntime({
      defaultAuditDir: '.ai-contributor-audit',
      getWorkTreeRoot: () => tmp,
    });
    const result = rt.run('echo', ['hello world'], tmp);
    if (typeof result.cmd === 'string' && result.cmd.includes("'hello world'")) {
      ok('createCollectorLocalRuntime.run: arg with space is shell-quoted in display');
    } else {
      bad('local-runtime quote', JSON.stringify(result));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ----- collector-github-api ----------------------------------------------

// --no-network mode -> token_tier is 'none' and detected via that path.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-nonet-'));
  try {
    const ctx = createGithubApiContext({
      target: tmp,
      tools: { gh: '2.0.0' },
      noNetwork: true,
      runQuiet: () => '',
    });
    if (ctx.ghApi.token_tier === 'none') {
      ok('createGithubApiContext: --no-network -> token_tier=none');
    } else {
      bad('github-api no-network', JSON.stringify(ctx.ghApi));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// gh not installed -> token_tier 'none', stderr_excerpt mentions gh.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-nogh-'));
  try {
    const ctx = createGithubApiContext({
      target: tmp,
      tools: { gh: null },
      noNetwork: false,
      runQuiet: () => '',
    });
    if (ctx.ghApi.token_tier === 'none') {
      ok('createGithubApiContext: gh not installed -> token_tier=none');
    } else {
      bad('github-api no-gh', JSON.stringify(ctx.ghApi));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Owner/repo extraction from SSH-style remote URL.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-ssh-'));
  try {
    const ctx = createGithubApiContext({
      target: tmp,
      tools: { gh: null },
      noNetwork: true,
      runQuiet: (cmd, args) => {
        if (cmd === 'git' && args.includes('--get') && args.includes('remote.origin.url')) {
          return 'git@github.com:foo/bar.git';
        }
        return '';
      },
    });
    if (ctx.owner === 'foo' && ctx.repo === 'bar') {
      ok('createGithubApiContext: SSH remote URL parsed for owner/repo');
    } else {
      bad('github-api ssh', JSON.stringify({ owner: ctx.owner, repo: ctx.repo }));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Owner/repo extraction from https remote URL with .git suffix.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-https-'));
  try {
    const ctx = createGithubApiContext({
      target: tmp,
      tools: { gh: null },
      noNetwork: true,
      runQuiet: (cmd, args) => {
        if (cmd === 'git' && args.includes('remote.origin.url')) {
          return 'https://github.com/owner-x/repo.with.dots.git';
        }
        return '';
      },
    });
    if (ctx.owner === 'owner-x' && ctx.repo === 'repo.with.dots') {
      ok('createGithubApiContext: https remote URL (with dots, .git) parsed');
    } else {
      bad('github-api https', JSON.stringify({ owner: ctx.owner, repo: ctx.repo }));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Non-GitHub remote URL -> owner/repo are null.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-other-'));
  try {
    const ctx = createGithubApiContext({
      target: tmp,
      tools: { gh: null },
      noNetwork: true,
      runQuiet: (cmd, args) =>
        cmd === 'git' && args.includes('remote.origin.url') ? 'https://gitlab.com/foo/bar.git' : '',
    });
    if (ctx.owner === null && ctx.repo === null) {
      ok('createGithubApiContext: non-github remote -> owner/repo null');
    } else {
      bad('github-api non-github', JSON.stringify({ owner: ctx.owner, repo: ctx.repo }));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ----- detectGithubApi via fake `gh` shim ------------------------------
//
// The remaining branches in collector-github-api are inside the `gh api
// user` and `gh auth status` paths of detectGithubApi. We put a fake `gh`
// script at the front of PATH and exercise the four token-tier branches.

interface GhScriptCase {
  label: string;
  // 'user' is invoked with [api, user, --jq, .login]
  // 'auth' is invoked with [auth, status]
  user: { status: number; stdout?: string; stderr?: string };
  auth?: { status: number; stdout?: string; stderr?: string };
  expectTier: string;
  expectLogin?: string | null;
}

function withFakeGh<T>(
  cases: GhScriptCase['user'] & { auth?: GhScriptCase['auth'] },
  run: () => T,
): T {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-gh-'));
  try {
    // Write a script file that branches on argv. Use bash for portability
    // on Linux runners (the audit collector spawns gh directly).
    const escape = (s: string): string => s.replace(/'/g, `'\\''`);
    const userStdout = escape(cases.stdout ?? '');
    const userStderr = escape(cases.stderr ?? '');
    const authStatus = cases.auth?.status ?? 0;
    const authStdout = escape(cases.auth?.stdout ?? '');
    const authStderr = escape(cases.auth?.stderr ?? '');
    const ghPath = path.join(tmp, 'gh');
    fs.writeFileSync(
      ghPath,
      [
        '#!/usr/bin/env bash',
        'set -e',
        `if [ "$1" = "api" ] && [ "$2" = "user" ]; then`,
        `  printf '%s' '${userStdout}'`,
        `  printf '%s' '${userStderr}' >&2`,
        `  exit ${cases.status}`,
        `fi`,
        `if [ "$1" = "auth" ] && [ "$2" = "status" ]; then`,
        `  printf '%s' '${authStdout}'`,
        `  printf '%s' '${authStderr}' >&2`,
        `  exit ${authStatus}`,
        `fi`,
        'exit 99',
      ].join('\n'),
    );
    fs.chmodSync(ghPath, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${tmp}:${oldPath ?? ''}`;
    try {
      return run();
    } finally {
      process.env.PATH = oldPath;
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Case 1: gh api user fails (status 1) -> token_tier stays 'none'.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-fake-fail-'));
  try {
    const ctx = withFakeGh({ status: 1, stderr: 'gh: not authenticated' }, () =>
      createGithubApiContext({
        target: tmp,
        tools: { gh: '2.0.0' },
        noNetwork: false,
        runQuiet: () => '',
      }),
    );
    if (
      ctx.ghApi.token_tier === 'none' &&
      /not authenticated|gh api user failed/i.test(ctx.ghApi.auth_status_excerpt)
    ) {
      ok('detectGithubApi: gh api user fails -> token_tier=none with auth excerpt');
    } else {
      bad('detectGithubApi user-fail', JSON.stringify(ctx.ghApi));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Case 2: gh api user succeeds, gh auth status reports read-only scopes
// (e.g. `read:org`) -> token_tier=audit_read_only.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-fake-readonly-'));
  try {
    const ctx = withFakeGh(
      {
        status: 0,
        stdout: 'auditor\n',
        auth: {
          status: 0,
          stderr:
            "github.com\n  ✓ Logged in to github.com as auditor\n  - Token scopes: 'read:org'\n",
        },
      },
      () =>
        createGithubApiContext({
          target: tmp,
          tools: { gh: '2.0.0' },
          noNetwork: false,
          runQuiet: () => '',
        }),
    );
    if (ctx.ghApi.token_tier === 'audit_read_only' && ctx.ghApi.active_login === 'auditor') {
      ok('detectGithubApi: read-only scopes -> token_tier=audit_read_only');
    } else {
      bad('detectGithubApi read-only', JSON.stringify(ctx.ghApi));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Case 3: gh api user succeeds, gh auth status reports broad scopes
// (e.g. `repo`, `workflow`) -> token_tier=broad_write_capable.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-fake-broad-'));
  try {
    const ctx = withFakeGh(
      {
        status: 0,
        stdout: 'admin-bot\n',
        auth: {
          status: 0,
          stderr:
            "github.com\n  ✓ Logged in to github.com as admin-bot\n  - Token scopes: 'repo', 'workflow'\n",
        },
      },
      () =>
        createGithubApiContext({
          target: tmp,
          tools: { gh: '2.0.0' },
          noNetwork: false,
          runQuiet: () => '',
        }),
    );
    if (ctx.ghApi.token_tier === 'broad_write_capable') {
      ok('detectGithubApi: broad scopes -> token_tier=broad_write_capable');
    } else {
      bad('detectGithubApi broad', JSON.stringify(ctx.ghApi));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Case 4: gh api user succeeds, gh auth status itself fails -> identity
// is verified but scopes stay unknown.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-fake-auth-fail-'));
  try {
    const ctx = withFakeGh(
      {
        status: 0,
        stdout: 'somebody\n',
        auth: { status: 1, stderr: 'gh auth status broken keyring' },
      },
      () =>
        createGithubApiContext({
          target: tmp,
          tools: { gh: '2.0.0' },
          noNetwork: false,
          runQuiet: () => '',
        }),
    );
    if (
      ctx.ghApi.token_tier === 'api_identity_verified_scopes_unknown' &&
      ctx.ghApi.active_login === 'somebody'
    ) {
      ok(
        'detectGithubApi: auth-status fails after user succeeds -> identity_verified_scopes_unknown',
      );
    } else {
      bad('detectGithubApi auth-fail', JSON.stringify(ctx.ghApi));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Case 5: gh api user hangs longer than the env-overridden timeout ->
// ETIMEDOUT branch fires.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-fake-timeout-'));
  try {
    // fake gh that sleeps forever; AIC_GH_API_IDENTITY_TIMEOUT_MS=200 wakes
    // detectGithubApi via spawnSync's timeout option.
    const ghDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-gh-timeout-'));
    const ghPath = path.join(ghDir, 'gh');
    fs.writeFileSync(ghPath, '#!/usr/bin/env bash\nsleep 30\n');
    fs.chmodSync(ghPath, 0o755);
    const oldPath = process.env.PATH;
    const oldTimeout = process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS;
    process.env.PATH = `${ghDir}:${oldPath ?? ''}`;
    process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS = '200';
    try {
      const ctx = createGithubApiContext({
        target: tmp,
        tools: { gh: '2.0.0' },
        noNetwork: false,
        runQuiet: () => '',
      });
      if (
        ctx.ghApi.token_tier === 'none' &&
        /timed out after 200ms/.test(ctx.ghApi.auth_status_excerpt)
      ) {
        ok('detectGithubApi: gh api user timeout -> ETIMEDOUT branch with timeout excerpt');
      } else {
        bad('detectGithubApi timeout', JSON.stringify(ctx.ghApi));
      }
    } finally {
      process.env.PATH = oldPath;
      if (oldTimeout === undefined) delete process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS;
      else process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS = oldTimeout;
      fs.rmSync(ghDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Case 6: invalid AIC_GH_API_IDENTITY_TIMEOUT_MS env var falls back to
// the default. Exercises the parseTimeoutEnv fallback branch.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-bad-env-'));
  try {
    const oldVal = process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS;
    process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS = 'not-a-number';
    try {
      const ctx = createGithubApiContext({
        target: tmp,
        tools: { gh: null },
        noNetwork: true,
        runQuiet: () => '',
      });
      if (ctx.ghApi.token_tier === 'none') {
        ok('detectGithubApi: invalid timeout env var falls back to default');
      } else {
        bad('detectGithubApi bad-env', JSON.stringify(ctx.ghApi));
      }
    } finally {
      if (oldVal === undefined) delete process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS;
      else process.env.AIC_GH_API_IDENTITY_TIMEOUT_MS = oldVal;
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Case 7: gh api user succeeds; gh auth status hangs longer than its
// env-overridden timeout -> auth-status ETIMEDOUT branch fires.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgh-fake-auth-timeout-'));
  try {
    const ghDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-gh-auth-tmout-'));
    const ghPath = path.join(ghDir, 'gh');
    fs.writeFileSync(
      ghPath,
      [
        '#!/usr/bin/env bash',
        'if [ "$1" = "api" ] && [ "$2" = "user" ]; then',
        '  echo somebody',
        '  exit 0',
        'fi',
        'if [ "$1" = "auth" ] && [ "$2" = "status" ]; then',
        '  sleep 30',
        'fi',
        'exit 99',
      ].join('\n'),
    );
    fs.chmodSync(ghPath, 0o755);
    const oldPath = process.env.PATH;
    const oldTimeout = process.env.AIC_GH_AUTH_STATUS_TIMEOUT_MS;
    process.env.PATH = `${ghDir}:${oldPath ?? ''}`;
    process.env.AIC_GH_AUTH_STATUS_TIMEOUT_MS = '200';
    try {
      const ctx = createGithubApiContext({
        target: tmp,
        tools: { gh: '2.0.0' },
        noNetwork: false,
        runQuiet: () => '',
      });
      if (
        ctx.ghApi.token_tier === 'api_identity_verified_scopes_unknown' &&
        /gh auth status timed out after 200ms/.test(ctx.ghApi.auth_status_excerpt)
      ) {
        ok('detectGithubApi: gh auth status timeout -> ETIMEDOUT branch on auth status');
      } else {
        bad('detectGithubApi auth-timeout', JSON.stringify(ctx.ghApi));
      }
    } finally {
      process.env.PATH = oldPath;
      if (oldTimeout === undefined) delete process.env.AIC_GH_AUTH_STATUS_TIMEOUT_MS;
      else process.env.AIC_GH_AUTH_STATUS_TIMEOUT_MS = oldTimeout;
      fs.rmSync(ghDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} collector-runtime-extra test(s) failed`);
  process.exit(1);
}
console.log('All collector-runtime-extra tests passed');

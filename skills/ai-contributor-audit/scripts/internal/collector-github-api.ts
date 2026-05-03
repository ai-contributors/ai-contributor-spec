// SPDX-License-Identifier: Apache-2.0
//
// GitHub API detection and cached API calls for audit-collect.

import { spawnSync } from 'node:child_process';
import { excerpt, redactSensitiveText, sanitizeForEvidence } from './collector-runtime.ts';
import type { CommandRun, Evidence, RuleStatus } from './collector-types.ts';

// Timeouts default to 10s; tests can override via env vars (read at call
// time) to exercise the ETIMEDOUT branch without making the test suite slow.
function ghAuthStatusTimeoutMs(): number {
  return parseTimeoutEnv('AIC_GH_AUTH_STATUS_TIMEOUT_MS', 10_000);
}
function ghApiIdentityTimeoutMs(): number {
  return parseTimeoutEnv('AIC_GH_API_IDENTITY_TIMEOUT_MS', 10_000);
}
function parseTimeoutEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export interface GithubApiContext {
  ghApi: Evidence['github_api'];
  hostKind: 'github' | 'unknown';
  owner: string | null;
  repo: string | null;
  defaultBranch: string | null;
  ghApiCall: (endpoint: string) => CommandRun;
  ghApiCallUncached: (endpoint: string) => CommandRun;
  withTokenTierCaveat: (
    reason: string,
    status: RuleStatus,
    hostedEvidence?: boolean | null,
  ) => string;
}

export function createGithubApiContext(input: {
  target: string;
  tools: Record<string, string | null>;
  noNetwork: boolean;
  runQuiet: (cmd: string, args: string[], cwd: string) => string;
}): GithubApiContext {
  const ghApi = detectGithubApi(input.tools, input.noNetwork);
  const remoteUrl = input.runQuiet(
    'git',
    ['-C', input.target, 'config', '--get', 'remote.origin.url'],
    input.target,
  );
  // Match `github.com:<owner>/<repo>` and `github.com/<owner>/<repo>` shapes,
  // stripping a trailing `.git`. This allows repo names containing dots.
  const ghMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  const owner = ghMatch?.[1] ?? null;
  const repo = ghMatch?.[2] ?? null;
  const defaultBranch = resolveDefaultBranch(input.target, input.runQuiet);
  const ghApiCache = new Map<string, CommandRun>();

  function ghApiCall(endpoint: string): CommandRun {
    const cached = ghApiCache.get(endpoint);
    if (cached) return cached;
    const fresh = ghApiCallUncached(endpoint);
    ghApiCache.set(endpoint, fresh);
    return fresh;
  }

  function ghApiCallUncached(endpoint: string): CommandRun {
    const display = `gh api ${endpoint}`;
    const t0 = Date.now();
    if (!input.tools.gh || input.noNetwork) {
      return {
        cmd: display,
        exit_code: null,
        duration_ms: 0,
        stdout_excerpt: '',
        stderr_excerpt: input.noNetwork ? '--no-network set' : 'gh not installed',
        kind: 'gh_api',
      };
    }
    const r = spawnSync('gh', ['api', endpoint], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    const stdout = r.stdout?.toString() ?? '';
    let summary: unknown;
    let stdoutForEvidence = redactSensitiveText(stdout);
    if (r.status === 0) {
      try {
        summary = sanitizeForEvidence(JSON.parse(stdout));
        stdoutForEvidence = JSON.stringify(summary, null, 2);
      } catch {
        /* not json */
      }
    }
    return {
      cmd: display,
      exit_code: r.status,
      duration_ms: Date.now() - t0,
      stdout_excerpt: excerpt(stdoutForEvidence),
      stderr_excerpt: r.stderr?.toString() ? excerpt(r.stderr.toString()) : undefined,
      kind: 'gh_api',
      response_summary: summary,
    };
  }

  function withTokenTierCaveat(
    reason: string,
    status: RuleStatus,
    hostedEvidence: boolean | null = true,
  ): string {
    if (hostedEvidence && status === 'Fulfilled' && ghApi.token_tier === 'broad_write_capable') {
      return `${reason}; verified with broad_write_capable GitHub token`;
    }
    if (
      hostedEvidence &&
      status === 'Fulfilled' &&
      ghApi.token_tier === 'api_identity_verified_scopes_unknown'
    ) {
      return `${reason}; verified with GitHub API identity; token scopes not reported`;
    }
    return reason;
  }

  return {
    ghApi,
    hostKind: ghMatch ? 'github' : 'unknown',
    owner,
    repo,
    defaultBranch,
    ghApiCall,
    ghApiCallUncached,
    withTokenTierCaveat,
  };
}

function detectGithubApi(
  tools: Record<string, string | null>,
  noNetwork: boolean,
): Evidence['github_api'] {
  const out: Evidence['github_api'] = {
    token_tier: 'none',
    active_login: null,
    scopes_observed: [],
    auth_status_excerpt: '',
  };
  if (!tools.gh || noNetwork) return out;

  // Use a direct API call as the primary identity probe. `gh auth status`
  // walks every stored account and can hang on a stale or locked keyring
  // entry even when the active account can make API requests successfully.
  const userTimeoutMs = ghApiIdentityTimeoutMs();
  const user = spawnSync('gh', ['api', 'user', '--jq', '.login'], {
    encoding: 'utf8',
    timeout: userTimeoutMs,
  });
  const userError = user.error as NodeJS.ErrnoException | undefined;
  if (userError?.code === 'ETIMEDOUT') {
    out.auth_status_excerpt = `gh api user timed out after ${userTimeoutMs}ms`;
    return out;
  }
  if (userError) {
    out.auth_status_excerpt = `gh api user failed: ${userError.message}`;
    return out;
  }
  if (user.status !== 0) {
    out.auth_status_excerpt = excerpt(
      `${user.stderr || ''}${user.stdout || ''}` || 'gh api user failed',
    );
    return out;
  }
  out.active_login = (user.stdout ?? '').toString().trim() || null;
  out.token_tier = 'api_identity_verified_scopes_unknown';

  // `gh auth status` writes to stderr.
  const authTimeoutMs = ghAuthStatusTimeoutMs();
  const r = spawnSync('gh', ['auth', 'status'], {
    encoding: 'utf8',
    timeout: authTimeoutMs,
  });
  const authOutput = `${r.stderr || ''}${r.stdout || ''}`;
  const authError = r.error as NodeJS.ErrnoException | undefined;
  if (authError?.code === 'ETIMEDOUT') {
    out.auth_status_excerpt = `gh api user login=${out.active_login ?? 'unknown'}; gh auth status timed out after ${authTimeoutMs}ms; token scopes not reported`;
    return out;
  }
  if (authError) {
    out.auth_status_excerpt = `gh api user login=${out.active_login ?? 'unknown'}; gh auth status failed: ${authError.message}; token scopes not reported`;
    return out;
  }
  out.auth_status_excerpt = `gh api user login=${out.active_login ?? 'unknown'}\n${excerpt(authOutput)}`;
  if (r.status !== 0) {
    out.auth_status_excerpt = `gh api user login=${out.active_login ?? 'unknown'}; gh auth status exited ${r.status}; token scopes not reported\n${excerpt(authOutput)}`;
    return out;
  }
  const scopeMatch = (r.stderr || '').match(/Token scopes:\s*(.*)/);
  if (scopeMatch) {
    out.scopes_observed = scopeMatch[1]!
      .split(',')
      .map((s) => s.replace(/['"\s]/g, ''))
      .filter(Boolean);
  }
  const broadIndicators = /^(repo|workflow|admin:|delete:|write:)/;
  const isBroad = out.scopes_observed.some((s) => broadIndicators.test(s));
  out.token_tier = isBroad ? 'broad_write_capable' : 'audit_read_only';
  return out;
}

function resolveDefaultBranch(
  target: string,
  runQuiet: (cmd: string, args: string[], cwd: string) => string,
): string | null {
  const head = runQuiet(
    'git',
    ['-C', target, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
    target,
  );
  if (head.startsWith('origin/')) return head.slice('origin/'.length);
  for (const guess of ['main', 'master']) {
    if (runQuiet('git', ['-C', target, 'rev-parse', '--verify', `refs/heads/${guess}`], target))
      return guess;
  }
  return null;
}

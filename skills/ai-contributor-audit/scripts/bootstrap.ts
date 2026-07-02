#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// bootstrap.ts — single-command runbook materializer for the AI Contributor
// Specification audit. Given an immutable spec source SHA (or version tag),
// fetches every file the audit skill needs into a target directory and
// prints the resolved paths so an agent can invoke them deterministically.
//
// Why this exists: the README copy-paste prompt previously asked the agent
// to enumerate runbook files in prose and fetch them one by one. Different
// agents inferred different file lists, which broke comparability of audits
// across models. This script is the canonical, machine-checkable file list:
// adding a runbook file means adding it here, not changing prose.
//
// MUST remain a single self-contained file with only Node builtin imports.
// The audit prompt invokes this directly via `npx --yes tsx@4.21.0` from
// the pinned spec_source ref. Adding a sibling-module import or an npm
// dependency silently breaks that bootstrap path.
//
// Usage:
//   tsx bootstrap.ts <spec-sha-or-tag> [--out <dir> | --out=<dir>] [--skip-stale-check]
//
// Tip: bash expands "$VAR" in the parent shell BEFORE inline env-var
// assignments take effect, so `RUNBOOK=/tmp/x cmd --out "$RUNBOOK"` (and
// `--out="$RUNBOOK"`) silently receives an empty string when $RUNBOOK
// was unset in the parent. Either assign the variable on its own line
// first, or pass a literal `--out=/tmp/x`.
//
// `<spec-sha-or-tag>` MUST be a 40-char commit SHA, a compact vN.N spec
// release tag, or a vN.N.N patch tag. Branch names (main, master) are rejected
// so two audits at different times cannot read different rule sets.
// When bootstrapping from the canonical GitHub source, the script also performs
// a best-effort, non-fatal GitHub API check and warns if the pinned runbook ref
// is behind upstream main or the latest release tag. It never auto-updates
// during an audit; refresh installed skills outside the audit with:
//  npx skills update ai-contributor-audit
// Skip the advisory GitHub API check with --skip-stale-check or
// AIC_BOOTSTRAP_SKIP_STALE_CHECK=1 when network policy only allows fetching
// the pinned runbook files.
//
// Default output directory: <system tmp>/ai-contributor-audit-<sha>/
// The runbook intentionally lives outside the target repository so tools such
// as TypeScript, linters, and formatters cannot accidentally treat downloaded
// audit scripts as part of the audited project. The directory is treated as a
// write target; pre-existing files are overwritten so re-running the bootstrap
// with the same SHA is a no-op from the agent's perspective.
//
// Also writes AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json in the output directory.
// The stamper reads that manifest to stamp `spec_source` without asking the
// auditor to type the resolved SHA into both audit files.
//
// Exit codes:
//   0  bootstrap complete; paths printed to stdout
//   2  CLI / preflight failure (bad SHA, network error, write error)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { pathToFileURL } from 'node:url';

// Bumped whenever the runbook file list or layout changes.
export const BOOTSTRAP_VERSION = '0.1.0';
const SPEC_REPO = 'https://github.com/ai-contributors/ai-contributor-spec';

// Where the runbook manifest is fetched from. Defaults to GitHub raw; tests
// override via AIC_BOOTSTRAP_RAW_BASE so they can point at a localhost
// http server. Format: "<scheme>://<host>[:port]/<owner>/<repo>".
const DEFAULT_RAW_BASE = 'https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec';
const DEFAULT_REF_CHECK_API_BASE =
  'https://api.github.com/repos/ai-contributors/ai-contributor-spec';
const RAW_BASE = process.env.AIC_BOOTSTRAP_RAW_BASE ?? DEFAULT_RAW_BASE;
const REF_CHECK_API_BASE =
  process.env.AIC_BOOTSTRAP_REF_CHECK_API_BASE ?? DEFAULT_REF_CHECK_API_BASE;
// Ten pages is 1,000 matching release-tag refs, far beyond the expected spec
// release volume; bounding it avoids pathological advisory-only probes.
const MAX_RELEASE_TAG_REF_PAGES = 10;

// Canonical runbook manifest. Each entry is a path relative to the spec
// repo root; the bootstrap fetches it from that same ref and writes it to
// the same relative path inside the output directory. Order doesn't matter
// for correctness but is grouped for readability.
const MANIFEST: readonly string[] = [
  // Skill entry point + protocol references
  'skills/ai-contributor-audit/SKILL.md',
  'skills/ai-contributor-audit/references/audit-protocol.md',
  'skills/ai-contributor-audit/references/evidence-rules.md',
  'skills/ai-contributor-audit/references/audit-profile-template.md',
  // Scripts (executable runbook tooling)
  'skills/ai-contributor-audit/scripts/package.json',
  'skills/ai-contributor-audit/scripts/internal/collector-hosted-settings.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-github-api.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-local-runtime.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-profile.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-registry.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-ai-instructions.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-authorship.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-bootstrap.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-codeowners.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-code-quality.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-formatting.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-guardrail-doc.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-github-actions.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-github-hosted.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-mcp.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-package-baseline.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-policy-docs.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-prompt.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-secret-hygiene.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-rules-tests.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-run.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-runtime.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-stack-scope.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-surface-inventory.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-types.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-workflow-helpers.ts',
  'skills/ai-contributor-audit/scripts/internal/collector-worktree.ts',
  'skills/ai-contributor-audit/scripts/internal/github-api-schemas.ts',
  'skills/ai-contributor-audit/scripts/internal/stamped-block.ts',
  'skills/ai-contributor-audit/scripts/internal/stamper-audit-summary.ts',
  'skills/ai-contributor-audit/scripts/internal/stamper-checklist-status.ts',
  'skills/ai-contributor-audit/scripts/internal/stamper-evidence-blocks.ts',
  'skills/ai-contributor-audit/scripts/internal/stamper-frontmatter.ts',
  'skills/ai-contributor-audit/scripts/internal/validator-audit-log.ts',
  'skills/ai-contributor-audit/scripts/internal/validator-backlog.ts',
  'skills/ai-contributor-audit/scripts/internal/validator-evidence-linkage.ts',
  'skills/ai-contributor-audit/scripts/internal/validator-frontmatter.ts',
  'skills/ai-contributor-audit/scripts/internal/validator-summary.ts',
  'skills/ai-contributor-audit/scripts/internal/validator-types.ts',
  'skills/ai-contributor-audit/scripts/internal/audit-evidence.ts',
  'skills/ai-contributor-audit/scripts/internal/audit-markdown.ts',
  'skills/ai-contributor-audit/scripts/audit-collect.ts',
  'skills/ai-contributor-audit/scripts/audit-stamp.ts',
  'skills/ai-contributor-audit/scripts/audit-validate.ts',
  'skills/ai-contributor-audit/scripts/audit-run.ts',
  'skills/ai-contributor-audit/scripts/audit-summary.ts',
  'skills/ai-contributor-audit/scripts/bootstrap.ts',
  // Templates the agent fills
  'AI-CONTRIBUTOR-AUDIT.md',
  '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md',
  '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md',
  // Specification and audit model (read-only reference)
  'AI-CONTRIBUTOR-SPECIFICATION.md',
  'AI-CONTRIBUTOR-AUDIT-MODEL.md',
];

export function isImmutableRef(ref: string): boolean {
  if (/^[0-9a-f]{40}$/.test(ref)) return true;
  if (/^v\d+\.\d+(?:\.\d+)?$/.test(ref)) return true;
  return false;
}

// Exported so tests can drive it against a localhost http server. The URL
// scheme is auto-detected: http:// uses node:http, https:// uses node:https.
// At runtime against the GitHub raw endpoint the path is always https://.
interface FetchTextOptions {
  headers?: Record<string, string>;
  maxRedirects?: number;
  timeoutMs?: number;
}

function discardResponseBody(res: IncomingMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      res.off('end', done);
      res.off('close', done);
      res.off('aborted', done);
      res.off('error', fail);
    };
    const done = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (e: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e);
    };
    res.on('end', done);
    res.on('close', done);
    res.on('aborted', done);
    res.on('error', fail);
    res.resume();
  });
}

function redirectLocation(location: string | string[] | undefined, baseUrl: string): string | null {
  const first = Array.isArray(location) ? location[0] : location;
  if (!first) return null;
  try {
    return new URL(first, baseUrl).toString();
  } catch {
    return null;
  }
}

export function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  const request = url.startsWith('http://') ? httpRequest : httpsRequest;
  const redirectsRemaining = options.maxRedirects ?? 1;
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        headers: {
          'user-agent': 'ai-contributor-bootstrap',
          ...options.headers,
        },
      },
      (res) => {
        const location = redirectLocation(res.headers.location, url);
        // Follow one level of redirect by default (raw.githubusercontent.com
        // normally returns 200 directly, but tag URLs may 302 once).
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && location) {
          if (redirectsRemaining <= 0) {
            discardResponseBody(res).then(
              () => reject(new Error(`GET ${url} exceeded redirect limit`)),
              reject,
            );
            return;
          }
          discardResponseBody(res).then(
            () =>
              fetchText(location, {
                ...options,
                maxRedirects: redirectsRemaining - 1,
              }).then(resolve, reject),
            reject,
          );
          return;
        }
        if (res.statusCode !== 200) {
          discardResponseBody(res).then(
            () => reject(new Error(`GET ${url} -> HTTP ${res.statusCode ?? '<no status>'}`)),
            reject,
          );
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      },
    );
    if (options.timeoutMs !== undefined) {
      req.setTimeout(options.timeoutMs, () => {
        req.destroy(new Error(`GET ${url} timed out after ${options.timeoutMs}ms`));
      });
    }
    req.on('error', reject);
    req.end();
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url, {
    headers: { accept: 'application/vnd.github+json' },
    timeoutMs: 2500,
  });
  return JSON.parse(text) as T;
}

interface ReleaseTag {
  name: string;
  major: number;
  minor: number;
  patch: number;
}

interface GitHubRef {
  ref: string;
}

interface GitHubCompare {
  status?: string;
  behind_by?: number;
}

export function parseReleaseTag(tag: string): ReleaseTag | null {
  const match = /^v(\d+)\.(\d+)(?:\.(\d+))?$/.exec(tag);
  if (!match) return null;
  return {
    name: tag,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: match[3] === undefined ? 0 : Number(match[3]),
  };
}

export function compareReleaseTags(a: ReleaseTag, b: ReleaseTag): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

async function releaseTagRefs(): Promise<GitHubRef[]> {
  const refs: GitHubRef[] = [];
  for (let page = 1; page <= MAX_RELEASE_TAG_REF_PAGES; page++) {
    const batch = await fetchJson<GitHubRef[]>(
      `${REF_CHECK_API_BASE}/git/matching-refs/tags/v?per_page=100&page=${page}`,
    );
    refs.push(...batch);
    if (batch.length < 100) break;
  }
  return refs;
}

async function latestReleaseTag(): Promise<ReleaseTag | null> {
  const refs = await releaseTagRefs();
  const tags = refs
    .map((entry) => parseReleaseTag(entry.ref.replace(/^refs\/tags\//, '')))
    .filter((tag): tag is ReleaseTag => tag !== null);
  tags.sort((a, b) => compareReleaseTags(b, a));
  return tags[0] ?? null;
}

async function stalenessWarnings(ref: string): Promise<string[]> {
  if (RAW_BASE !== DEFAULT_RAW_BASE && REF_CHECK_API_BASE === DEFAULT_REF_CHECK_API_BASE) return [];
  if (process.env.AIC_BOOTSTRAP_SKIP_STALE_CHECK === '1') return [];

  const warnings: string[] = [];
  try {
    const compare = await fetchJson<GitHubCompare>(
      `${REF_CHECK_API_BASE}/compare/main...${encodeURIComponent(ref)}`,
    );
    if (compare.status === 'behind' || (compare.behind_by ?? 0) > 0) {
      warnings.push(`installed skill/runbook ref is behind upstream main: ${ref}`);
    }
  } catch {
    // Non-fatal advisory only. If GitHub is unreachable or cannot compare the
    // ref safely, the pinned audit still proceeds reproducibly.
  }

  try {
    const currentTag = parseReleaseTag(ref);
    const latestTag = await latestReleaseTag();
    if (currentTag && latestTag && compareReleaseTags(currentTag, latestTag) < 0) {
      warnings.push(
        `installed skill/runbook ref is behind upstream latest tag: ${ref} < ${latestTag.name}`,
      );
    }
  } catch {
    // Same rule as the main comparison: no warning is better than a noisy or
    // blocking check when the upstream tag list cannot be read.
  }

  return warnings;
}

async function warnIfStale(ref: string): Promise<void> {
  const warnings = await stalenessWarnings(ref);
  if (warnings.length === 0) return;
  for (const warning of warnings) {
    process.stderr.write(`[audit-bootstrap] warning: ${warning}\n`);
  }
  process.stderr.write(
    '[audit-bootstrap] warning: do not auto-update during an audit; the audit skill and spec are coupled, and silent updates hurt reproducibility. ' +
      'Refresh installed skills outside the audit with `npx skills update ai-contributor-audit`, then bootstrap the audit runbook from a pinned SHA or release tag.\n',
  );
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (typeof parsed === 'string') {
    process.stderr.write(
      parsed === ''
        ? 'Usage: bootstrap.ts <spec-sha-or-tag> [--out <dir> | --out=<dir>] [--skip-stale-check]\n'
        : `${parsed}\n`,
    );
    process.exit(2);
  }

  const { ref, outDir, skipStaleCheck } = parsed;
  if (!isImmutableRef(ref)) {
    process.stderr.write(
      `error: <spec-sha-or-tag> must be a 40-char commit SHA, vN.N spec release tag, or vN.N.N patch tag, got "${ref}"\n`,
    );
    process.exit(2);
  }

  if (!skipStaleCheck) {
    await warnIfStale(ref);
  }

  fs.mkdirSync(outDir, { recursive: true });

  for (const rel of MANIFEST) {
    const url = `${RAW_BASE}/${ref}/${rel}`;
    let body: string;
    try {
      body = await fetchText(url);
    } catch (e) {
      process.stderr.write(`error fetching ${url}: ${(e as Error).message}\n`);
      process.exit(2);
    }
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
    process.stdout.write(`fetched ${rel}\n`);
  }

  const manifestPath = path.join(outDir, 'AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        $schema_version: '1',
        bootstrap_version: BOOTSTRAP_VERSION,
        spec_source: `${SPEC_REPO}/tree/${ref}`,
        spec_ref: ref,
        files: MANIFEST,
      },
      null,
      2,
    ) + '\n',
  );
  process.stdout.write(`wrote AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json\n`);

  process.stdout.write(`\nbootstrap complete (${MANIFEST.length} files) -> ${outDir}\n`);
  process.stdout.write(
    `next: follow ${path.join(outDir, 'skills/ai-contributor-audit/SKILL.md')}\n`,
  );
}

export function parseArgs(
  argv: string[],
): { ref: string; outDir: string; skipStaleCheck: boolean } | string {
  let ref: string | null = null;
  let outDir: string | null = null;
  let skipStaleCheck = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--skip-stale-check') {
      skipStaleCheck = true;
      continue;
    }
    if (arg === '--out' || arg.startsWith('--out=')) {
      let value: string | undefined;
      let flag: string;
      if (arg.startsWith('--out=')) {
        value = arg.slice('--out='.length);
        flag = '--out=';
      } else {
        value = argv[++i];
        flag = '--out';
      }
      if (value === undefined)
        return 'error: --out requires a directory (e.g. --out /tmp/runbook or --out=/tmp/runbook)';
      if (value === '') {
        return (
          'error: --out received an empty value. ' +
          'A common cause is `VAR=x cmd ... --out "$VAR"` (or `--out="$VAR"`) — bash expands "$VAR" in the parent shell BEFORE the inline assignment runs, so $VAR is empty. ' +
          'Fix: assign the variable on its own line first, then run the command on a separate line:\n' +
          '  RUNBOOK=/tmp/runbook\n' +
          '  npx --yes tsx@4.21.0 bootstrap.ts <ref> --out="$RUNBOOK"\n' +
          'Or pass the literal path: --out=/tmp/runbook'
        );
      }
      if (value.startsWith('--'))
        return `error: ${flag} requires a directory, got flag-shaped value ${value}`;
      outDir = value;
      continue;
    }
    if (arg.startsWith('--')) return `error: unknown flag ${arg}`;
    if (ref) return '';
    ref = arg;
  }

  if (!ref) return '';

  return {
    ref,
    outDir: outDir ?? path.join(os.tmpdir(), `ai-contributor-audit-${ref}`),
    skipStaleCheck,
  };
}

// Only run main() when invoked as a script. This lets tests import the
// exported helpers (parseArgs, isImmutableRef, MANIFEST) without fetching
// from the network at module-load time.
const invokedAsScript =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main().catch((e) => {
    process.stderr.write(`bootstrap failed: ${(e as Error).message}\n`);
    process.exit(2);
  });
}

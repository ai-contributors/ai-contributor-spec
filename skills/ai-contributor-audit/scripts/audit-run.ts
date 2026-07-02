#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-run.ts — small umbrella command for the normal audit cycle:
// collect evidence, stamp derivable cells, pause for auditor edits when
// interactive, stamp again, then validate.
//
// Usage:
//   tsx audit-run.ts [target-repo-path]
//     [--summary <path>] [--checklist <path>] [--audit-log <path>] [--evidence <path>]
//     [--commit <sha>] [--working-tree] [--no-network]
//     [--allow-missing-host-access]
//     [--auditor <name>] [--runner-agent <id>] [--runner-model <id>]
//     [--spec-source <immutable-source>] [--lenient] [--no-pause]
//     [--reset-templates] [--template-root <path>] [--keep-template-instructions]
//     [--no-bootstrap-smoke] [--bootstrap-smoke-timeout-ms <n>]

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface Options {
  target: string;
  summary: string;
  checklist: string;
  auditLog: string;
  evidence: string;
  commit?: string;
  workingTree: boolean;
  noNetwork: boolean;
  allowMissingHostAccess: boolean;
  auditor?: string;
  runnerAgent?: string;
  runnerModel?: string;
  specSource?: string;
  lenient: boolean;
  noPause: boolean;
  resetTemplates: boolean;
  templateRoot?: string;
  keepTemplateInstructions: boolean;
  forceResetTemplates: boolean;
  bootstrapSmoke: boolean;
  bootstrapSmokeTimeoutMs?: string;
}
type ValueResult = { value: string } | { error: string };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COLLECT = path.join(HERE, 'audit-collect.ts');
const STAMP = path.join(HERE, 'audit-stamp.ts');
const VALIDATE = path.join(HERE, 'audit-validate.ts');
const DEFAULT_AUDIT_DIR = '.ai-contributor-audit';
const TSX_COMMAND = 'tsx';

// Gate top-level execution so tests can import helpers without triggering
// the orchestrator (collect/stamp/validate spawns). Mirrors the pattern used
// by audit-stamp.ts, audit-summary.ts, and bootstrap.ts.
const invokedAsScript =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) main();

function main(): void {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    process.stdout.write(usage());
    process.exit(0);
  }
  const parsed = parseArgs(rawArgs);
  if (typeof parsed === 'string') die(parsed, 2);
  const opts = parsed;

  printRunContext(opts);
  preflightProfileBoundary(opts);
  preflightGitHubReadAccess(opts);
  if (opts.resetTemplates) resetAuditTemplates(opts);

  const collectArgs = [COLLECT, opts.target, '--out', opts.evidence];
  if (opts.commit) collectArgs.push('--commit', opts.commit);
  if (opts.workingTree) collectArgs.push('--working-tree');
  if (opts.noNetwork) collectArgs.push('--no-network');
  if (opts.bootstrapSmoke) collectArgs.push('--enable-bootstrap-smoke');
  if (opts.bootstrapSmokeTimeoutMs)
    collectArgs.push('--bootstrap-smoke-timeout-ms', opts.bootstrapSmokeTimeoutMs);

  const stampArgs = [
    STAMP,
    opts.checklist,
    opts.auditLog,
    '--evidence',
    opts.evidence,
    '--summary',
    opts.summary,
  ];
  if (opts.auditor) stampArgs.push('--auditor', opts.auditor);
  if (opts.runnerAgent) stampArgs.push('--runner-agent', opts.runnerAgent);
  if (opts.runnerModel) stampArgs.push('--runner-model', opts.runnerModel);
  if (opts.specSource) stampArgs.push('--spec-source', opts.specSource);

  const validateArgs = [VALIDATE, opts.checklist, opts.auditLog];
  if (opts.lenient) validateArgs.push('--lenient');
  const previousChecklist = extractPreviousChecklist(opts.target, opts.checklist);
  if (previousChecklist) validateArgs.push('--previous', previousChecklist);

  step('collect', executorCommand(collectArgs));
  const collectExit = runTsx(collectArgs, [0, 3]);
  if (collectExit === 3) {
    process.stderr.write(
      '[audit-run] collector exited 3 (partial evidence); continuing so the audit can record the gaps.\n',
    );
  }

  step('stamp initial', executorCommand(stampArgs));
  runTsx(stampArgs, [0]);

  if (!opts.noPause) {
    const editsReady = pauseForEdits();
    if (!editsReady) {
      process.stdout.write(
        '[audit-run] initial stamp complete; judgment-required edits still need review.\n' +
          `[audit-run] When edits are ready, run: ${executorCommand(stampArgs).map(shellQuote).join(' ')}\n` +
          `[audit-run] Then run: ${executorCommand(validateArgs).map(shellQuote).join(' ')}\n` +
          '[audit-run] Use --no-pause only when you intentionally want to skip the edit checkpoint.\n',
      );
      process.exit(0);
    }
  }

  step('stamp final', executorCommand(stampArgs));
  runTsx(stampArgs, [0]);

  step('validate', executorCommand(validateArgs));
  runTsx(validateArgs, [0]);

  process.stdout.write('[audit-run] OK — collect/stamp/validate cycle complete\n');
}

export function usage(): string {
  return [
    'Usage: audit-run.ts [target-repo-path] [flags]',
    '',
    'Runs the audit cycle: collect evidence, stamp, optional edit pause, stamp again, validate.',
    '',
    'Flags:',
    '  --summary <path>               Root summary path (default: AI-CONTRIBUTOR-AUDIT.md)',
    '  --checklist <path>             Checklist path',
    '  --audit-log <path>             Audit log path',
    '  --evidence <path>              Evidence JSON path',
    '  --commit <sha>                 Pin audited commit (default: HEAD)',
    '  --working-tree                 Audit the dirty working tree (records boundary as <sha>+dirty)',
    '  --no-network                   Skip GitHub preflight and network probes',
    '  --allow-missing-host-access    Continue when gh read-access preflight fails',
    '  --auditor "AGENT | MODEL | EFFORT"  Auditor identity stamped into artifacts',
    '  --runner-agent <id>            Runner agent identifier',
    '  --runner-model <id>            Runner model identifier',
    '  --spec-source <url>            Immutable spec source (must be a pinned ref)',
    '  --lenient                      Validator runs in lenient mode',
    '  --no-pause                     Skip the edit checkpoint and continue directly to final stamp + validate',
    '  --reset-templates              Reset summary/checklist/audit-log from runbook templates before collection',
    '  --template-root <path>         Template root for --reset-templates (default: runbook root)',
    '  --keep-template-instructions   Keep <!-- TEMPLATE-ONLY --> instructional blocks during --reset-templates (default: stripped)',
    '  --force-reset-templates        Allow --reset-templates to overwrite uncommitted edits to summary/checklist/audit-log (default: refuse)',
    '  --no-bootstrap-smoke           Skip the clean-clone bootstrap smoke test (Clean Setup row stays judgment-required)',
    '  --bootstrap-smoke-timeout-ms <n>  Timeout for the smoke test (default: 600000)',
    '  -h, --help                     Show this help and exit',
    '',
  ].join('\n');
}

export function parseArgs(argv: string[]): Options | string {
  const positional: string[] = [];
  const opts: Options = {
    target: '.',
    summary: 'AI-CONTRIBUTOR-AUDIT.md',
    checklist: path.join(DEFAULT_AUDIT_DIR, 'AI-CONTRIBUTOR-CHECKLIST.md'),
    auditLog: path.join(DEFAULT_AUDIT_DIR, 'AI-CONTRIBUTOR-AUDIT-LOG.md'),
    evidence: path.join(DEFAULT_AUDIT_DIR, 'AI-CONTRIBUTOR-EVIDENCE.json'),
    workingTree: false,
    noNetwork: false,
    allowMissingHostAccess: false,
    lenient: false,
    noPause: false,
    resetTemplates: false,
    keepTemplateInstructions: false,
    forceResetTemplates: false,
    bootstrapSmoke: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--working-tree') {
      opts.workingTree = true;
      continue;
    }
    if (a === '--no-network') {
      opts.noNetwork = true;
      continue;
    }
    if (a === '--allow-missing-host-access') {
      opts.allowMissingHostAccess = true;
      continue;
    }
    if (a === '--lenient') {
      opts.lenient = true;
      continue;
    }
    if (a === '--no-pause') {
      opts.noPause = true;
      continue;
    }
    if (a === '--reset-templates') {
      opts.resetTemplates = true;
      continue;
    }
    if (a === '--keep-template-instructions') {
      opts.keepTemplateInstructions = true;
      continue;
    }
    if (a === '--force-reset-templates') {
      opts.forceResetTemplates = true;
      continue;
    }
    if (a === '--no-bootstrap-smoke') {
      opts.bootstrapSmoke = false;
      continue;
    }
    if (a === '--enable-bootstrap-smoke') {
      // Accepted for symmetry with audit-collect; audit-run enables it by
      // default so this is a no-op that keeps copy-pasted commands working.
      opts.bootstrapSmoke = true;
      continue;
    }
    if (a === '--bootstrap-smoke-timeout-ms') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.bootstrapSmokeTimeoutMs = v.value;
      continue;
    }
    if (a === '--checklist') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.checklist = v.value;
      continue;
    }
    if (a === '--summary') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.summary = v.value;
      continue;
    }
    if (a === '--audit-log') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.auditLog = v.value;
      continue;
    }
    if (a === '--evidence') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.evidence = v.value;
      continue;
    }
    if (a === '--commit') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.commit = v.value;
      continue;
    }
    if (a === '--auditor') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.auditor = v.value;
      continue;
    }
    if (a === '--runner-agent') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.runnerAgent = v.value;
      continue;
    }
    if (a === '--runner-model') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.runnerModel = v.value;
      continue;
    }
    if (a === '--spec-source') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.specSource = v.value;
      continue;
    }
    if (a === '--template-root') {
      const v = requireValue(argv, ++i, a);
      if ('error' in v) return v.error;
      opts.templateRoot = v.value;
      continue;
    }
    if (a.startsWith('--')) return `unknown flag: ${a}`;
    positional.push(a);
  }

  if (positional.length > 1) return 'Usage: audit-run.ts [target-repo-path] [flags]';
  if (positional[0]) opts.target = positional[0];

  opts.target = path.resolve(opts.target);
  opts.summary = path.resolve(opts.summary);
  opts.checklist = path.resolve(opts.checklist);
  opts.auditLog = path.resolve(opts.auditLog);
  opts.evidence = path.resolve(opts.evidence);
  if (opts.templateRoot) opts.templateRoot = path.resolve(opts.templateRoot);
  return opts;
}

function requireValue(argv: string[], index: number, flag: string): ValueResult {
  const v = argv[index];
  if (v === undefined || v.startsWith('--')) return { error: `${flag} requires a value` };
  return { value: v };
}

function printRunContext(opts: Options): void {
  const specVersion = readRunSpecVersion(opts);
  const collectorVersion = readConstVersion(COLLECT, 'COLLECTOR_VERSION');
  const stampValidatorVersion = readConstVersion(STAMP, 'VALIDATOR_VERSION');
  const stampCollectorVersion = readConstVersion(STAMP, 'COLLECTOR_VERSION');
  const validateValidatorVersion = readConstVersion(VALIDATE, 'VALIDATOR_VERSION');

  process.stdout.write(`[audit-run] AI Contributor Specification spec_version=${specVersion}\n`);
  process.stdout.write(
    `[audit-run] tooling: audit-run.ts; audit-collect.ts collector_version=${collectorVersion}; ` +
      `audit-stamp.ts validator_version=${stampValidatorVersion} collector_version=${stampCollectorVersion}; ` +
      `audit-validate.ts validator_version=${validateValidatorVersion}\n`,
  );
  process.stdout.write(
    '[audit-run] collector probes local tools when available: git, gh, node, pnpm, npm\n',
  );
  process.stdout.write(
    '[audit-run] child phases run through `tsx` from PATH; bootstrap/startup may use pinned `npx --yes tsx@4.21.0` to provide that executor.\n',
  );
}

function readRunSpecVersion(opts: Options): string {
  if (opts.resetTemplates) {
    const templateRoot = opts.templateRoot ?? path.resolve(HERE, '..', '..', '..');
    const templateChecklist = path.join(
      templateRoot,
      DEFAULT_AUDIT_DIR,
      'AI-CONTRIBUTOR-CHECKLIST.md',
    );
    const templateSpecVersion = readSpecVersion(templateChecklist);
    if (templateSpecVersion !== 'unknown') return templateSpecVersion;
  }
  return readSpecVersion(opts.checklist);
}

function readSpecVersion(checklistPath: string): string {
  try {
    const text = fs.readFileSync(checklistPath, 'utf8');
    const m = text.match(/^spec_version:\s*["']?([^"'\s#]+)["']?/m);
    return m?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function readConstVersion(scriptPath: string, constName: string): string {
  try {
    const text = fs.readFileSync(scriptPath, 'utf8');
    const re = new RegExp(`export\\s+const\\s+${constName}\\s*=\\s*['"]([^'"]+)['"]`);
    return text.match(re)?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function runTsx(args: string[], ok: number[]): number {
  const res = spawnSync(TSX_COMMAND, args, {
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (res.error) {
    process.stderr.write(
      `[audit-run] failed to start ${TSX_COMMAND}: ${res.error.message}\n` +
        '[audit-run] Start audit-run with `npx --yes tsx@4.21.0 audit-run.ts ...` or put `tsx` on PATH.\n',
    );
  }
  const status = res.status ?? 1;
  if (!ok.includes(status)) process.exit(status);
  return status;
}

function executorCommand(args: string[]): string[] {
  return [TSX_COMMAND, ...args];
}

function preflightProfileBoundary(opts: Options): void {
  const profileRel = path.join(DEFAULT_AUDIT_DIR, 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
  const profileAbs = path.join(opts.target, profileRel);
  const fileExists = fs.existsSync(profileAbs);

  const r = spawnSync('git', ['-C', opts.target, 'status', '--porcelain=v1', '--', profileRel], {
    encoding: 'utf8',
  });
  if (r.status !== 0) return;
  const line = (r.stdout ?? '')
    .toString()
    .split('\n')
    .find((l) => l.trim().length > 0);

  // Tracked deletion: file removed from worktree but tracked at HEAD. We treat
  // this as the owner's fresh-start signal (mirrors the audit-profile skill's
  // behaviour) and surface it explicitly so the audit boundary is honest.
  // Without this branch, audit-run is silent and the collector merely warns
  // "applicability profile not found", which does not distinguish "never set
  // up" from "owner deliberately removed it".
  if (!fileExists) {
    if (line && /^[ MARC?]?D/.test(line)) {
      process.stderr.write(
        `[audit-run] ${profileRel} is a tracked deletion. Treating it as a deliberate fresh-start signal; the audit will run with no owner applicability input. To restore the prior profile, run \`git restore -- ${profileRel}\` before audit-run.\n`,
      );
    }
    return;
  }
  if (!line) return;

  const code = line.slice(0, 2);
  const isUntracked = code === '??';
  const isDirty = !isUntracked && code.trim().length > 0;
  if (!isUntracked && !isDirty) return;

  const state = isUntracked ? 'untracked' : 'uncommitted';
  process.stderr.write(
    `[audit-run] ${profileRel} is ${state}. The audit boundary will record dirty working tree state. ` +
      `Commit the profile (and any audit artifacts) before publishing an external conformance claim.\n`,
  );
  if (!opts.workingTree) {
    process.stderr.write(
      '[audit-run] Continuing in pinned-commit mode; the profile changes will NOT be visible to the collector. ' +
        'Pass --working-tree to audit the dirty tree, or commit the profile first.\n',
    );
  }
}

function preflightGitHubReadAccess(opts: Options): void {
  if (opts.noNetwork) {
    process.stderr.write(
      '[audit-run] --no-network set; skipping GitHub read-access preflight. Hosted checks may remain Verification gaps.\n',
    );
    return;
  }

  const remote = githubRemote(opts.target);
  if (!remote) {
    process.stderr.write(
      '[audit-run] no GitHub origin remote detected; skipping GitHub read-access preflight.\n',
    );
    return;
  }

  const check = checkGitHubReadAccess(remote.owner, remote.repo);
  if (check.ok) {
    const user = check.login ? ` as ${check.login}` : '';
    process.stdout.write(
      `[audit-run] GitHub read access OK${user}: ${remote.owner}/${remote.repo}\n`,
    );
    return;
  }

  const accountMismatch =
    check.login && check.login.toLowerCase() !== remote.owner.toLowerCase()
      ? githubReadAccessHint(remote.owner, remote.repo, check.login)
      : '';

  const warning =
    `[audit-run] GitHub read access was not verified for ${remote.owner}/${remote.repo}` +
    (check.login ? ` as ${check.login}` : '') +
    `: ${check.reason}\n` +
    '[audit-run] Without GitHub read access, hosted checks such as branch protection, CI gates, review enforcement, secret scanning, push protection, and dependency security may be stamped as Warning / Verification gap instead of Fulfilled.\n' +
    accountMismatch +
    (accountMismatch ? '' : githubReadAccessHint(remote.owner, remote.repo, check.login));

  process.stderr.write(warning);

  if (process.stdin.isTTY) {
    if (opts.allowMissingHostAccess) {
      process.stderr.write(
        '[audit-run] --allow-missing-host-access is set, but interactive runs still require confirmation.\n',
      );
    }
    if (confirm('[audit-run] Continue anyway? [y/N] ')) return;
    die(
      'aborted before evidence collection; run gh auth login/switch or pass --allow-missing-host-access to continue',
      2,
    );
  }

  if (opts.allowMissingHostAccess) {
    process.stderr.write(
      '[audit-run] --allow-missing-host-access set; continuing with lower-confidence hosted evidence.\n',
    );
    return;
  }

  die(
    'GitHub read-access preflight failed in non-interactive mode; fix gh auth or pass --allow-missing-host-access to continue with Verification gaps',
    2,
  );
}

function resetAuditTemplates(opts: Options): void {
  const templateRoot = opts.templateRoot ?? path.resolve(HERE, '..', '..', '..');
  const copies: Array<{ label: string; src: string; dst: string }> = [
    {
      label: 'root summary',
      src: path.join(templateRoot, 'AI-CONTRIBUTOR-AUDIT.md'),
      dst: opts.summary,
    },
    {
      label: 'checklist',
      src: path.join(templateRoot, DEFAULT_AUDIT_DIR, 'AI-CONTRIBUTOR-CHECKLIST.md'),
      dst: opts.checklist,
    },
    {
      label: 'audit log',
      src: path.join(templateRoot, DEFAULT_AUDIT_DIR, 'AI-CONTRIBUTOR-AUDIT-LOG.md'),
      dst: opts.auditLog,
    },
  ];
  for (const c of copies) {
    if (!fs.existsSync(c.src)) {
      die(
        `cannot reset templates: ${c.label} template not found at ${c.src}. ` +
          bootstrapTemplateHint(opts),
        2,
      );
    }
  }
  // Refuse to silently overwrite uncommitted local edits to the three reset
  // targets. A tracked deletion is fine (the agent likely deleted them on
  // purpose to start fresh); modified-in-worktree is not, because the user
  // may have hand-edited the audit and would lose it. --force-reset-templates
  // opts out for the rare case where the overwrite is intentional.
  if (!opts.forceResetTemplates) {
    const dirty: string[] = [];
    for (const c of copies) {
      const state = gitWorktreeState(opts.target, c.dst);
      if (state === 'modified' || state === 'untracked') {
        dirty.push(`  ${c.label} (${state}): ${c.dst}`);
      }
    }
    if (dirty.length > 0) {
      die(
        `cannot reset templates: the following audit artifact${dirty.length === 1 ? ' has' : 's have'} uncommitted changes that --reset-templates would overwrite:\n` +
          dirty.join('\n') +
          '\nCommit (or revert) the changes, or pass --force-reset-templates if the overwrite is intentional.',
        2,
      );
    }
  }
  for (const c of copies) {
    fs.mkdirSync(path.dirname(c.dst), { recursive: true });
    if (path.resolve(c.src) !== path.resolve(c.dst)) fs.copyFileSync(c.src, c.dst);
  }
  let strippedTotal = 0;
  if (!opts.keepTemplateInstructions) {
    for (const c of copies) {
      strippedTotal += stripTemplateOnlyBlocks(c.dst);
    }
  }
  const strippedNote = opts.keepTemplateInstructions
    ? ' (TEMPLATE-ONLY blocks kept per --keep-template-instructions)'
    : strippedTotal > 0
      ? ` (stripped ${strippedTotal} TEMPLATE-ONLY block${strippedTotal === 1 ? '' : 's'})`
      : '';
  process.stdout.write(
    `[audit-run] reset root summary, checklist, and audit log from runbook templates${strippedNote}; owner profile and evidence JSON were preserved.\n`,
  );
}

// Returns 'modified' (tracked + dirty), 'untracked' (untracked file present),
// 'deleted' (tracked but deleted from worktree), 'clean', or null when git
// can't answer (no repo, file outside repo). Used by the reset-templates
// preflight: 'modified' / 'untracked' should block the reset; 'deleted' and
// 'clean' should not.
export function gitWorktreeState(
  repoTarget: string,
  filePath: string,
): 'modified' | 'untracked' | 'deleted' | 'clean' | null {
  const r = spawnSync('git', ['-C', repoTarget, 'status', '--porcelain=v1', '--', filePath], {
    encoding: 'utf8',
  });
  if (r.status !== 0) return null;
  const line = (r.stdout ?? '')
    .toString()
    .split('\n')
    .find((l) => l.trim().length > 0);
  if (!line) {
    // No status entry: either a tracked-clean file or a path git doesn't
    // know about. Use file existence to decide whether to call it 'clean'.
    return fs.existsSync(filePath) ? 'clean' : null;
  }
  const code = line.slice(0, 2);
  if (code === '??') return 'untracked';
  if (/D/.test(code)) return 'deleted';
  if (code.trim().length > 0) return 'modified';
  return 'clean';
}

// Extracts the previous committed checklist (the HEAD version) to a temp
// file so audit-validate.ts can require re-audit status-change rationales
// without running git itself. Returns null when the checklist is outside
// the target, not tracked at HEAD (first audit), or git cannot answer —
// the validator then skips the re-audit diff check.
export function extractPreviousChecklist(target: string, checklistPath: string): string | null {
  const rel = path.relative(target, checklistPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  // "HEAD:./<path>" resolves relative to the git cwd (the -C target).
  const gitPath = `HEAD:./${rel.split(path.sep).join('/')}`;
  const r = spawnSync('git', ['-C', target, 'show', gitPath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) return null;
  const content = (r.stdout ?? '').toString();
  if (content.length === 0) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-previous-'));
  const out = path.join(dir, 'AI-CONTRIBUTOR-CHECKLIST.md');
  fs.writeFileSync(out, content);
  return out;
}

export function stripTemplateOnlyBlocks(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split('\n');
  const out: string[] = [];
  let inBlock = false;
  let stripped = 0;
  for (const line of lines) {
    if (!inBlock && /<!--\s*BEGIN:TEMPLATE-ONLY\b/.test(line)) {
      inBlock = true;
      stripped++;
      continue;
    }
    if (inBlock) {
      if (/<!--\s*END:TEMPLATE-ONLY\s*-->/.test(line)) inBlock = false;
      continue;
    }
    out.push(line);
  }
  if (inBlock) {
    process.stderr.write(
      `[audit-run] WARN: ${filePath} has an unterminated TEMPLATE-ONLY block; leaving file unchanged. Pass --keep-template-instructions to bypass stripping.\n`,
    );
    return 0;
  }
  // Collapse runs of 3+ blank lines that strip may have produced.
  const collapsed: string[] = [];
  let blankRun = 0;
  for (const line of out) {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun <= 2) collapsed.push(line);
    } else {
      blankRun = 0;
      collapsed.push(line);
    }
  }
  const next = collapsed.join('\n');
  if (next !== original) fs.writeFileSync(filePath, next);
  return stripped;
}

export function specSourceRef(specSource?: string): string | null {
  if (!specSource) return null;
  const tree = specSource.match(/\/tree\/([^/?#]+)/);
  if (tree?.[1]) return tree[1];
  const raw = specSource.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([^/?#]+)/);
  if (raw?.[1]) return raw[1];
  if (/^[0-9a-f]{7,40}$/i.test(specSource) || /^v?\d+\.\d+(?:\.\d+)?$/.test(specSource))
    return specSource;
  return null;
}

function bootstrapTemplateHint(opts: Options): string {
  const ref = specSourceRef(opts.specSource);
  if (!ref) return 'Run bootstrap.ts for the pinned spec source or pass --template-root.';
  const out = path.join('/tmp', `ai-contributor-audit-${ref}`);
  const bootstrap = path.join(HERE, 'bootstrap.ts');
  const runbookAuditRun = path.join(
    out,
    'skills',
    'ai-contributor-audit',
    'scripts',
    'audit-run.ts',
  );
  return (
    'Bootstrap the full pinned runbook instead of fetching templates only: ' +
    `npx --yes tsx@4.21.0 ${bootstrap} ${ref} --out=${out} && ` +
    `npx --yes tsx@4.21.0 ${runbookAuditRun} . --reset-templates --template-root ${out} ` +
    `--spec-source ${opts.specSource}`
  );
}

function githubRemote(target: string): { owner: string; repo: string } | null {
  const r = spawnSync('git', ['-C', target, 'config', '--get', 'remote.origin.url'], {
    encoding: 'utf8',
  });
  if (r.status !== 0) return null;
  const remoteUrl = (r.stdout ?? '').toString().trim();
  const m = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]! };
}

function checkGitHubReadAccess(
  owner: string,
  repo: string,
): { ok: true; login: string | null } | { ok: false; login: string | null; reason: string } {
  const gh = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (gh.error || gh.status !== 0)
    return { ok: false, login: null, reason: 'gh CLI is not available' };

  const user = spawnSync('gh', ['api', 'user', '--jq', '.login'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  const login = user.status === 0 ? (user.stdout ?? '').toString().trim() || null : null;
  if (user.status !== 0) {
    return {
      ok: false,
      login,
      reason: excerptForLog(
        (user.stderr ?? '').toString() ||
          (user.stdout ?? '').toString() ||
          'gh is not authenticated',
      ),
    };
  }

  const repoAccess = spawnSync('gh', ['api', `repos/${owner}/${repo}`, '--jq', '.full_name'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (repoAccess.status !== 0) {
    return {
      ok: false,
      login,
      reason: excerptForLog(
        (repoAccess.stderr ?? '').toString() ||
          (repoAccess.stdout ?? '').toString() ||
          'repo API check failed',
      ),
    };
  }
  return { ok: true, login };
}

export function githubReadAccessHint(owner: string, repo: string, login: string | null): string {
  const activeLogin = login ? ` Active gh login: ${login}.` : '';
  return (
    `[audit-run]${activeLogin} If another GitHub account has read access to ${owner}/${repo}, run: gh auth switch\n` +
    `[audit-run] Then verify access with: gh api repos/${owner}/${repo} --jq .full_name\n`
  );
}

export function excerptForLog(s: string): string {
  return s.replace(/\r\n/g, '\n').split('\n').filter(Boolean).slice(0, 3).join(' ');
}

function confirm(prompt: string): boolean {
  process.stderr.write(prompt);
  const answer = readLineFromStdin().trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

function readLineFromStdin(): string {
  const chunks: string[] = [];
  const buf = Buffer.alloc(1);
  while (true) {
    const n = fs.readSync(0, buf, 0, 1, null);
    if (n === 0 || buf[0] === 10 || buf[0] === 13) break;
    chunks.push(String.fromCharCode(buf[0]));
  }
  return chunks.join('');
}

function step(label: string, cmd: string[]): void {
  process.stdout.write(`\n[audit-run] ${label}: ${cmd.map(shellQuote).join(' ')}\n`);
}

function pauseForEdits(): boolean {
  if (!process.stdin.isTTY) {
    process.stdout.write(
      '[audit-run] non-interactive stdin; stopping after initial stamp instead of skipping the edit checkpoint.\n',
    );
    return false;
  }
  process.stdout.write(
    '\n[audit-run] Fill judgment-required checklist rows, root backlog owner/action/date cells, conformance notes/date, and manual audit-log rows now.\n' +
      '[audit-run] Press Enter when edits are ready for the final stamp + validate pass.\n',
  );
  const buf = Buffer.alloc(1);
  while (true) {
    const n = fs.readSync(0, buf, 0, 1, null);
    if (n === 0 || buf[0] === 10 || buf[0] === 13) return true;
  }
}

export function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`;
}

function die(message: string | Error, code: number): never {
  process.stderr.write(`[audit-run] ${message instanceof Error ? message.message : message}\n`);
  process.exit(code);
}

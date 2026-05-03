#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Unit tests for the importable helpers in audit-run.ts:
//   - parseArgs       (every flag branch + defaults)
//   - gitWorktreeState (clean / modified / untracked / deleted / outside-repo)
//   - stripTemplateOnlyBlocks (no marker / one block / two blocks / unterminated)
//   - specSourceRef  (tree URL / raw URL / SHA / tag / garbage)
//   - githubReadAccessHint (org-safe gh account guidance)
//
// The orchestration paths (preflight, runTsx, the main() chain) are covered
// by test-audit-run.ts via spawnSync. This file exists so the helper logic
// is unit-testable and tracked by c8 with no subprocess overhead.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  excerptForLog,
  gitWorktreeState,
  githubReadAccessHint,
  parseArgs,
  shellQuote,
  specSourceRef,
  stripTemplateOnlyBlocks,
  usage,
  type Options,
} from '../../skills/ai-contributor-audit/scripts/audit-run.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function fail(label: string, detail: string): void {
  console.error(`FAIL ${label}: ${detail}`);
  failed++;
}

function asOptions(v: Options | string): Options {
  if (typeof v === 'string') throw new Error(`expected Options, got error string: ${v}`);
  return v;
}

// ----- parseArgs ---------------------------------------------------------

{
  const r = parseArgs([]);
  const opts = asOptions(r);
  if (opts.target.endsWith('.') || path.isAbsolute(opts.target))
    ok('parseArgs []: defaults applied, target resolved');
  else fail('parseArgs []: target', opts.target);
  if (opts.bootstrapSmoke === true && opts.workingTree === false && opts.noPause === false)
    ok('parseArgs []: bootstrap-smoke on by default; non-flag defaults');
  else fail('parseArgs []: defaults', JSON.stringify(opts));
}

{
  const opts = asOptions(parseArgs(['/some/repo']));
  if (path.isAbsolute(opts.target)) ok('parseArgs single positional sets target');
  else fail('parseArgs positional', opts.target);
}

{
  const r = parseArgs(['a', 'b']);
  if (r === 'Usage: audit-run.ts [target-repo-path] [flags]')
    ok('parseArgs two positionals -> usage');
  else fail('parseArgs two positionals', String(r));
}

{
  const r = parseArgs(['--unknown-flag']);
  if (typeof r === 'string' && r.includes('unknown flag')) ok('parseArgs unknown flag rejected');
  else fail('parseArgs unknown flag', String(r));
}

{
  const flags: Array<[string[], (o: Options) => boolean, string]> = [
    [['--working-tree'], (o) => o.workingTree, '--working-tree'],
    [['--no-network'], (o) => o.noNetwork, '--no-network'],
    [
      ['--allow-missing-host-access'],
      (o) => o.allowMissingHostAccess,
      '--allow-missing-host-access',
    ],
    [['--lenient'], (o) => o.lenient, '--lenient'],
    [['--no-pause'], (o) => o.noPause, '--no-pause'],
    [['--reset-templates'], (o) => o.resetTemplates, '--reset-templates'],
    [
      ['--keep-template-instructions'],
      (o) => o.keepTemplateInstructions,
      '--keep-template-instructions',
    ],
    [['--force-reset-templates'], (o) => o.forceResetTemplates, '--force-reset-templates'],
    [
      ['--no-bootstrap-smoke'],
      (o) => o.bootstrapSmoke === false,
      '--no-bootstrap-smoke flips bootstrap-smoke off',
    ],
    [
      ['--enable-bootstrap-smoke'],
      (o) => o.bootstrapSmoke === true,
      '--enable-bootstrap-smoke is a no-op alias',
    ],
  ];
  for (const [argv, predicate, label] of flags) {
    const opts = asOptions(parseArgs(argv));
    if (predicate(opts)) ok(`parseArgs ${label}`);
    else fail(`parseArgs ${label}`, JSON.stringify(opts));
  }
}

{
  const cases: Array<[string[], (o: Options) => boolean, string]> = [
    [['--checklist', '/tmp/cl.md'], (o) => o.checklist === '/tmp/cl.md', '--checklist <path>'],
    [['--summary', '/tmp/sum.md'], (o) => o.summary === '/tmp/sum.md', '--summary <path>'],
    [['--audit-log', '/tmp/al.md'], (o) => o.auditLog === '/tmp/al.md', '--audit-log <path>'],
    [['--evidence', '/tmp/ev.json'], (o) => o.evidence === '/tmp/ev.json', '--evidence <path>'],
    [['--commit', 'abc123'], (o) => o.commit === 'abc123', '--commit <sha>'],
    [['--auditor', 'a | m | h'], (o) => o.auditor === 'a | m | h', '--auditor <name>'],
    [['--runner-agent', 'cli'], (o) => o.runnerAgent === 'cli', '--runner-agent <id>'],
    [['--runner-model', 'gpt-5'], (o) => o.runnerModel === 'gpt-5', '--runner-model <id>'],
    [
      ['--spec-source', 'https://x/y/tree/z'],
      (o) => o.specSource === 'https://x/y/tree/z',
      '--spec-source <url>',
    ],
    [['--template-root', '/tmp/rb'], (o) => o.templateRoot === '/tmp/rb', '--template-root <path>'],
    [
      ['--bootstrap-smoke-timeout-ms', '900000'],
      (o) => o.bootstrapSmokeTimeoutMs === '900000',
      '--bootstrap-smoke-timeout-ms <n>',
    ],
  ];
  for (const [argv, predicate, label] of cases) {
    const opts = asOptions(parseArgs(argv));
    if (predicate(opts)) ok(`parseArgs ${label}`);
    else fail(`parseArgs ${label}`, JSON.stringify(opts));
  }
}

{
  // requireValue error path: any value-flag with no value.
  const valueFlags = [
    '--checklist',
    '--summary',
    '--audit-log',
    '--evidence',
    '--commit',
    '--auditor',
    '--runner-agent',
    '--runner-model',
    '--spec-source',
    '--template-root',
    '--bootstrap-smoke-timeout-ms',
  ];
  for (const flag of valueFlags) {
    const r = parseArgs([flag]);
    if (typeof r === 'string' && r.includes('requires a value')) {
      ok(`parseArgs ${flag} with no value -> requires-a-value error`);
    } else {
      fail(`parseArgs ${flag} no value`, String(r));
    }
  }
}

// ----- specSourceRef -----------------------------------------------------

{
  const cases: Array<[string | undefined, string | null, string]> = [
    [undefined, null, 'undefined returns null'],
    ['', null, 'empty string returns null'],
    ['https://github.com/x/y/tree/abc1234', 'abc1234', 'GitHub /tree/<ref> URL extracts ref'],
    [
      'https://raw.githubusercontent.com/x/y/v0.1/skills/SKILL.md',
      'v0.1',
      'raw.githubusercontent.com URL extracts ref',
    ],
    [
      '0123456789abcdef0123456789abcdef01234567',
      '0123456789abcdef0123456789abcdef01234567',
      'plain SHA',
    ],
    ['v0.1', 'v0.1', '2-segment compact tag accepted'],
    ['0.1', '0.1', '2-segment compact tag without v prefix accepted'],
    ['v0.1.0', 'v0.1.0', '3-segment patch tag accepted'],
    ['main', null, 'branch name returns null'],
    ['random-string', null, 'garbage returns null'],
  ];
  for (const [input, expected, label] of cases) {
    const got = specSourceRef(input);
    if (got === expected) ok(`specSourceRef: ${label}`);
    else fail(`specSourceRef: ${label}`, `expected ${expected}, got ${got}`);
  }
}

// ----- stripTemplateOnlyBlocks ------------------------------------------

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-strip-'));
  try {
    // No file -> 0 stripped, no throw.
    const missing = path.join(tmp, 'nope.md');
    if (stripTemplateOnlyBlocks(missing) === 0)
      ok('stripTemplateOnlyBlocks: missing file returns 0');
    else fail('stripTemplateOnlyBlocks: missing file', 'returned non-zero');

    // No marker -> 0 stripped, file unchanged.
    const noMarker = path.join(tmp, 'no-marker.md');
    fs.writeFileSync(noMarker, '# title\n\nbody\n');
    const before = fs.readFileSync(noMarker, 'utf8');
    if (stripTemplateOnlyBlocks(noMarker) === 0 && fs.readFileSync(noMarker, 'utf8') === before) {
      ok('stripTemplateOnlyBlocks: no marker returns 0 and leaves file unchanged');
    } else {
      fail('stripTemplateOnlyBlocks: no marker', 'returned non-zero or modified file');
    }

    // One block -> 1 stripped.
    const oneBlock = path.join(tmp, 'one.md');
    fs.writeFileSync(
      oneBlock,
      '# title\n\nbefore\n\n<!-- BEGIN:TEMPLATE-ONLY auditor: delete -->\nimportant template prose\nmore lines\n<!-- END:TEMPLATE-ONLY -->\n\nafter\n',
    );
    if (stripTemplateOnlyBlocks(oneBlock) === 1) {
      const out = fs.readFileSync(oneBlock, 'utf8');
      if (!out.includes('TEMPLATE-ONLY') && out.includes('before') && out.includes('after')) {
        ok('stripTemplateOnlyBlocks: one block stripped, surrounding content preserved');
      } else fail('stripTemplateOnlyBlocks: one block content', out);
    } else {
      fail('stripTemplateOnlyBlocks: one block return', 'expected 1');
    }

    // Two non-overlapping blocks -> 2 stripped.
    const twoBlocks = path.join(tmp, 'two.md');
    fs.writeFileSync(
      twoBlocks,
      'a\n<!-- BEGIN:TEMPLATE-ONLY -->\nx\n<!-- END:TEMPLATE-ONLY -->\nb\n<!-- BEGIN:TEMPLATE-ONLY -->\ny\n<!-- END:TEMPLATE-ONLY -->\nc\n',
    );
    if (stripTemplateOnlyBlocks(twoBlocks) === 2)
      ok('stripTemplateOnlyBlocks: two blocks stripped');
    else
      fail('stripTemplateOnlyBlocks: two blocks', `returned ${stripTemplateOnlyBlocks(twoBlocks)}`);

    // Unterminated block -> 0 stripped, file untouched, stderr warning.
    const unterminated = path.join(tmp, 'bad.md');
    const badContent = 'a\n<!-- BEGIN:TEMPLATE-ONLY -->\nb\nc\n';
    fs.writeFileSync(unterminated, badContent);
    if (
      stripTemplateOnlyBlocks(unterminated) === 0 &&
      fs.readFileSync(unterminated, 'utf8') === badContent
    ) {
      ok('stripTemplateOnlyBlocks: unterminated block leaves file unchanged');
    } else {
      fail('stripTemplateOnlyBlocks: unterminated', 'modified or returned non-zero');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ----- gitWorktreeState --------------------------------------------------

function shellRun(cmd: string, args: string[], cwd: string): void {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.stderr}`);
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-run-git-state-'));
  try {
    // Outside any git repo.
    const outside = gitWorktreeState(tmp, path.join(tmp, 'never-existed.md'));
    if (outside === null) ok('gitWorktreeState: outside-repo returns null');
    else fail('gitWorktreeState: outside-repo', String(outside));

    shellRun('git', ['init', '-b', 'main'], tmp);
    shellRun(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-m', 'init'],
      tmp,
    );

    const tracked = path.join(tmp, 'README.md');
    fs.writeFileSync(tracked, '# r\n');
    shellRun('git', ['add', 'README.md'], tmp);
    shellRun('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'add'], tmp);

    if (gitWorktreeState(tmp, tracked) === 'clean') ok('gitWorktreeState: clean tracked file');
    else fail('gitWorktreeState: clean', String(gitWorktreeState(tmp, tracked)));

    fs.writeFileSync(tracked, '# r\nmore\n');
    if (gitWorktreeState(tmp, tracked) === 'modified')
      ok('gitWorktreeState: modified tracked file');
    else fail('gitWorktreeState: modified', String(gitWorktreeState(tmp, tracked)));

    shellRun('git', ['restore', 'README.md'], tmp);

    const untracked = path.join(tmp, 'NEW.md');
    fs.writeFileSync(untracked, 'fresh\n');
    if (gitWorktreeState(tmp, untracked) === 'untracked') ok('gitWorktreeState: untracked file');
    else fail('gitWorktreeState: untracked', String(gitWorktreeState(tmp, untracked)));

    fs.unlinkSync(tracked);
    if (gitWorktreeState(tmp, tracked) === 'deleted') ok('gitWorktreeState: tracked-deleted file');
    else fail('gitWorktreeState: deleted', String(gitWorktreeState(tmp, tracked)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ----- usage / shellQuote / auth hint / excerptForLog --------------------

{
  const u = usage();
  if (
    u.includes('Usage: audit-run.ts') &&
    u.includes('--reset-templates') &&
    u.includes('--no-bootstrap-smoke')
  ) {
    ok('usage() lists known flags');
  } else {
    fail('usage()', u);
  }
}

{
  const hint = githubReadAccessHint('ExampleOrg', 'demo-repo', 'alice');
  if (
    hint.includes('Active gh login: alice') &&
    hint.includes('gh auth switch\n') &&
    hint.includes('gh api repos/ExampleOrg/demo-repo --jq .full_name') &&
    !hint.includes('--user ExampleOrg')
  ) {
    ok('githubReadAccessHint: org-safe switch guidance with explicit probe');
  } else {
    fail('githubReadAccessHint: org-safe guidance', hint);
  }
}

{
  const cases: Array<[string, string]> = [
    ['plain', 'plain'],
    ['has space', `'has space'`],
    [`it's quoted`, `'it'\\''s quoted'`],
    ['/abs/path/file.ts', '/abs/path/file.ts'],
    ['k=v', 'k=v'],
    ['', `''`],
  ];
  for (const [input, expected] of cases) {
    const got = shellQuote(input);
    if (got === expected) ok(`shellQuote(${JSON.stringify(input)})`);
    else fail(`shellQuote(${JSON.stringify(input)})`, `expected ${expected}, got ${got}`);
  }
}

{
  const cases: Array<[string, string]> = [
    ['', ''],
    ['one line', 'one line'],
    ['line1\nline2\nline3\nline4', 'line1 line2 line3'],
    ['line1\r\nline2\r\nline3', 'line1 line2 line3'],
    ['\n\n\nfirst real\nlast', 'first real last'],
  ];
  for (const [input, expected] of cases) {
    const got = excerptForLog(input);
    if (got === expected) ok(`excerptForLog(${JSON.stringify(input)})`);
    else
      fail(
        `excerptForLog(${JSON.stringify(input)})`,
        `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`,
      );
  }
}

if (failed > 0) {
  console.error(`${failed} audit-run helper test(s) failed`);
  process.exit(1);
}
console.log('All audit-run helper tests passed');

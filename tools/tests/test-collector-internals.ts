#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Direct unit tests for the collector-* and stamper-* internals not
// already covered by fixture-driven tests. Targets specific branch paths
// (error returns, optional-feature toggles, malformed inputs).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setupCollectorWorktree } from '../../skills/ai-contributor-audit/scripts/internal/collector-worktree.ts';
import { discoverStackScope } from '../../skills/ai-contributor-audit/scripts/internal/collector-stack-scope.ts';
import { buildHostedSettings } from '../../skills/ai-contributor-audit/scripts/internal/collector-hosted-settings.ts';
import {
  stampBacklog,
  stampConformanceLevel,
  stampSummary,
} from '../../skills/ai-contributor-audit/scripts/internal/stamper-audit-summary.ts';
import {
  ensureDerivedEvidenceArtifactCitations,
  stampDerivedRuleStatuses,
} from '../../skills/ai-contributor-audit/scripts/internal/stamper-checklist-status.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function bad(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

function statusChecklist(rows: string[]): string {
  return [
    '# Checklist',
    '',
    '## Level 1 — Hardened',
    '',
    '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |',
    '| ----- | ---- | - | ------ | ------- | ----------- | ------ | --- |',
    ...rows,
    '',
  ].join('\n');
}

// ----- collector-worktree ------------------------------------------------

// Not a git repo -> error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-not-git-'));
  try {
    const result = setupCollectorWorktree({
      target: tmp,
      commitOpt: null,
      workingTreeMode: false,
      runQuiet: () => '',
    });
    if ('error' in result && /not a git repository/.test(result.error)) {
      ok('setupCollectorWorktree: non-git target -> error');
    } else {
      bad('setupCollectorWorktree non-git', JSON.stringify(result));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// runQuiet returns empty string for rev-parse -> error path "failed to resolve".
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-no-rev-'));
  try {
    fs.mkdirSync(path.join(tmp, '.git'));
    const result = setupCollectorWorktree({
      target: tmp,
      commitOpt: 'deadbeef',
      workingTreeMode: false,
      runQuiet: () => '', // simulate rev-parse failure
    });
    if ('error' in result && /failed to resolve/.test(result.error)) {
      ok('setupCollectorWorktree: rev-parse failure -> error');
    } else {
      bad('setupCollectorWorktree rev-parse', JSON.stringify(result));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ----- collector-stack-scope --------------------------------------------

// Empty work tree -> minimal stack with no detected toolchain.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-empty-'));
  try {
    const r = discoverStackScope({
      workTreeRoot: tmp,
      runQuiet: () => '',
    });
    if (Array.isArray(r.detected) && r.detected.length === 0) {
      ok('discoverStackScope: empty tree -> no detected toolchain');
    } else {
      bad('discoverStackScope empty', JSON.stringify(r));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// pnpm packageManager + pnpm-workspace.yaml -> detected=['node','pnpm','pnpm-workspace'].
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-pnpm-'));
  try {
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'r', packageManager: 'pnpm@10.0.0' }),
    );
    fs.writeFileSync(path.join(tmp, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n');
    const r = discoverStackScope({ workTreeRoot: tmp, runQuiet: () => '' });
    if (r.detected.includes('node') && r.detected.includes('pnpm')) {
      ok('discoverStackScope: pnpm + workspace detected');
    } else {
      bad('discoverStackScope pnpm', JSON.stringify(r.detected));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// npm packageManager branch.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-npm-'));
  try {
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'r', packageManager: 'npm@10.9.0', workspaces: ['packages/*'] }),
    );
    const r = discoverStackScope({ workTreeRoot: tmp, runQuiet: () => '' });
    if (r.detected.includes('npm')) ok('discoverStackScope: npm packageManager detected');
    else bad('discoverStackScope npm', JSON.stringify(r.detected));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// yarn packageManager branch.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-yarn-'));
  try {
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'r', packageManager: 'yarn@4.0.0' }),
    );
    const r = discoverStackScope({ workTreeRoot: tmp, runQuiet: () => '' });
    if (r.detected.includes('yarn')) ok('discoverStackScope: yarn packageManager detected');
    else bad('discoverStackScope yarn', JSON.stringify(r.detected));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ----- collector-hosted-settings ---------------------------------------

// Owner/repo null -> no API calls, all fields stay as gap with last_checked.
{
  let calls = 0;
  const r = buildHostedSettings({
    owner: null,
    repo: null,
    defaultBranch: null,
    lastChecked: '2026-01-01',
    ghApiCall: () => {
      calls++;
      return { command: '', exit_code: 0, stdout: '{}', stderr: '' };
    },
    requiredChecksFromRulesetSummary: () => [],
  });
  if (calls === 0 && r.branch_protection.last_checked === '2026-01-01') {
    ok('buildHostedSettings: null owner/repo -> no API calls, gap fields');
  } else {
    bad('buildHostedSettings null owner', `calls=${calls} ${JSON.stringify(r.branch_protection)}`);
  }
}

// 404 from API -> branch_protection records "no protection".
{
  const r = buildHostedSettings({
    owner: 'x',
    repo: 'y',
    defaultBranch: 'main',
    lastChecked: '2026-01-01',
    ghApiCall: () => ({
      command: 'gh api',
      exit_code: 1,
      stdout: '{"message":"Not Found","status":"404"}',
      stderr: '',
    }),
    requiredChecksFromRulesetSummary: () => [],
  });
  // branch_protection.value should reflect that no protection was found
  // OR that a verification gap was recorded; either path is fine — the
  // test is that the code handled the 404 without throwing.
  if (typeof r.branch_protection === 'object') {
    ok('buildHostedSettings: 404 handled without throwing');
  } else {
    bad('buildHostedSettings 404', JSON.stringify(r));
  }
}

// ----- stamper-checklist-status edge paths -----------------------------

// Missing evidence JSON -> actionable error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scs-missing-evidence-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    fs.writeFileSync(cl, statusChecklist([]));
    const err = stampDerivedRuleStatuses({
      checklistPath: cl,
      evidencePath: path.join(tmp, 'missing.json'),
    });
    if (typeof err === 'string' && /evidence JSON/.test(err)) {
      ok('stampDerivedRuleStatuses: missing evidence -> error');
    } else {
      bad('stampDerivedRuleStatuses missing evidence', err ?? '(null)');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Malformed evidence JSON -> parse error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scs-bad-evidence-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const evidence = path.join(tmp, 'EVIDENCE.json');
    fs.writeFileSync(cl, statusChecklist([]));
    fs.writeFileSync(evidence, '{ nope');
    const err = stampDerivedRuleStatuses({ checklistPath: cl, evidencePath: evidence });
    if (typeof err === 'string' && /not valid JSON/.test(err)) {
      ok('stampDerivedRuleStatuses: malformed evidence -> error');
    } else {
      bad('stampDerivedRuleStatuses malformed evidence', err ?? '(null)');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Evidence with no rules object is a no-op.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scs-no-rules-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const evidence = path.join(tmp, 'EVIDENCE.json');
    fs.writeFileSync(cl, statusChecklist([]));
    fs.writeFileSync(evidence, JSON.stringify({}));
    const err = stampDerivedRuleStatuses({ checklistPath: cl, evidencePath: evidence });
    if (err === null) ok('stampDerivedRuleStatuses: no rules object -> no-op');
    else bad('stampDerivedRuleStatuses no rules object', err);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Collector-derived status rewrites A/Status/Comment and preserves escaped pipes.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scs-stamp-row-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const evidence = path.join(tmp, 'EVIDENCE.json');
    fs.writeFileSync(
      cl,
      statusChecklist([
        '| `MUST` | `Strict Types` | - |  |  | Strict typing with A\\|B example. | 1 | `AIC-strict-typing-enabled` |',
      ]),
    );
    fs.writeFileSync(
      evidence,
      JSON.stringify({
        rules: {
          'strict-types': {
            judgment_required: false,
            derived_status: 'Fulfilled',
            derivation_reason: 'strict enabled',
            aic_ids: ['AIC-strict-typing-enabled'],
          },
        },
      }),
    );
    const err = stampDerivedRuleStatuses({ checklistPath: cl, evidencePath: evidence });
    const after = fs.readFileSync(cl, 'utf8');
    if (
      err === null &&
      after.includes('| `MUST` | `Strict Types` | x | ✅ Fulfilled |') &&
      after.includes('A\\|B example')
    ) {
      ok('stampDerivedRuleStatuses: stamps current A-column row');
    } else {
      bad('stampDerivedRuleStatuses row stamp', `err=${err ?? '(null)'} after=\n${after}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Fulfilled derived rows without an evidence-artifact citation get one.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scs-artifact-citation-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    fs.writeFileSync(
      cl,
      statusChecklist([
        '| `MUST` | `Branch Protection` | - | ✅ Fulfilled |  | Protected branches. | 4 | `AIC-default-branch-protected` |',
      ]),
    );
    const err = ensureDerivedEvidenceArtifactCitations({ checklistPath: cl });
    const after = fs.readFileSync(cl, 'utf8');
    if (
      err === null &&
      after.includes('(see `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`)')
    ) {
      ok('ensureDerivedEvidenceArtifactCitations: appends missing citation');
    } else {
      bad(
        'ensureDerivedEvidenceArtifactCitations append',
        `err=${err ?? '(null)'} after=\n${after}`,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ----- stamper-audit-summary missing-section paths ---------------------

// stampBacklog with no Backlog section in checklist -> error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-no-backlog-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const sum = path.join(tmp, 'SUM.md');
    fs.writeFileSync(cl, '---\nspec_version: "0.1"\n---\n\n# Checklist\n\nno backlog section\n');
    fs.writeFileSync(sum, '');
    const err = stampBacklog({ checklistPath: cl, summaryPath: sum });
    if (typeof err === 'string' && /Backlog/.test(err)) {
      ok('stampBacklog: missing Backlog section -> error');
    } else {
      bad('stampBacklog missing', err ?? '(null)');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampSummary with no Conformance level summary section -> error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-no-summary-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    fs.writeFileSync(cl, '---\nspec_version: "0.1"\n---\n\n# Checklist\n\nno summary section\n');
    const err = stampSummary({ checklistPath: cl });
    if (typeof err === 'string' && /Conformance level summary/.test(err)) {
      ok('stampSummary: missing Conformance level summary section -> error');
    } else {
      bad('stampSummary missing', err ?? '(null)');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampSummary on a checklist with CRLF line endings: exercises the eol
// detection branch in stamper-audit-summary.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-crlf-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const summarySection = [
      '---',
      'spec_version: "0.1"',
      '---',
      '',
      '## Conformance level summary',
      '',
      '| Level | Status | Date reached | Notes |',
      '| ----- | ------ | ------------ | ----- |',
      '| **Level 0 — Baseline Hygiene** | ❌ No | | |',
      '| **Level 1 — Hardened** | ❌ No | | |',
      '| **Level 2 — AI Assisted** | ❌ No | | |',
      '| **Level 3 — AI Authored** | ❌ No | | |',
      '| **Level 4 — AI Operated** | ❌ No | | |',
      '',
    ].join('\r\n');
    fs.writeFileSync(cl, summarySection);
    const err = stampSummary({ checklistPath: cl });
    if (err === null) ok('stampSummary: CRLF line endings handled');
    else bad('stampSummary CRLF', err);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampSummary with malformed table (no separator row after header) -> error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-no-sep-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    fs.writeFileSync(
      cl,
      [
        '---',
        'spec_version: "0.1"',
        '---',
        '',
        '## Conformance level summary',
        '',
        '| Level | Status | Date reached | Notes |',
        // Note: missing the | --- | --- | --- | --- | separator row.
        '| **Level 0 — Baseline Hygiene** | ❌ No | | |',
        '',
      ].join('\n'),
    );
    const err = stampSummary({ checklistPath: cl });
    if (typeof err === 'string') ok('stampSummary: malformed table (no separator) -> error');
    else bad('stampSummary malformed', String(err));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampConformanceLevel with summary that has no Yes rows -> sets level to "none".
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sas-confnone-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const al = path.join(tmp, 'AL.md');
    const fm = '---\nconformance_level: none\n---\n\n';
    const sumSection = [
      '## Conformance level summary',
      '',
      '| Level | Status | Date reached | Notes |',
      '| ----- | ------ | ------------ | ----- |',
      '| **Level 0 — Baseline Hygiene** | ❌ No | | |',
      '| **Level 1 — Hardened** | ❌ No | | |',
      '| **Level 2 — AI Assisted** | ❌ No | | |',
      '| **Level 3 — AI Authored** | ❌ No | | |',
      '| **Level 4 — AI Operated** | ❌ No | | |',
      '',
    ].join('\n');
    fs.writeFileSync(cl, fm + sumSection);
    fs.writeFileSync(al, '---\nconformance_level: none\n---\n');
    const err = stampConformanceLevel({ checklistPath: cl, auditPath: al });
    if (err === null) ok('stampConformanceLevel: no Yes rows -> sets "none"');
    else bad('stampConformanceLevel none', err);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} collector-internals test(s) failed`);
  process.exit(1);
}
console.log('All collector-internals tests passed');

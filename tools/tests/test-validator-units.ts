#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Unit tests for the validator-* modules under skills/ai-contributor-audit/
// scripts/internal/. Drives each exported helper with synthetic line arrays
// so we hit error branches the existing fixture-based tests don't reach
// without paying for a directory per AUDIT code.

import { checkFrontmatter } from '../../skills/ai-contributor-audit/scripts/internal/validator-frontmatter.ts';
import {
  checkBacklog,
  parseBacklog,
} from '../../skills/ai-contributor-audit/scripts/internal/validator-backlog.ts';
import { checkSummary } from '../../skills/ai-contributor-audit/scripts/internal/validator-summary.ts';
import {
  checkCollectorDerivedRowsMatchEvidence,
  checkDerivedEvidenceArtifactCitations,
  checkProfileEvidence,
  checkTokenDisclosure,
} from '../../skills/ai-contributor-audit/scripts/internal/validator-evidence-linkage.ts';
import { checkReauditStatusRationales } from '../../skills/ai-contributor-audit/scripts/internal/validator-reaudit.ts';
import type { AuditLogRow } from '../../skills/ai-contributor-audit/scripts/internal/validator-types.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  ChecklistRow,
  SummaryRow,
} from '../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';
import type {
  BacklogRow,
  Frontmatter,
} from '../../skills/ai-contributor-audit/scripts/internal/validator-types.ts';
import type {
  ProblemReporter,
  ValidatorContext,
} from '../../skills/ai-contributor-audit/scripts/internal/validator-types.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function bad(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

function makeContext(
  checklistLines: string[],
  auditLines: string[] = checklistLines,
): ValidatorContext {
  return {
    checklistPath: '/tmp/CHECKLIST.md',
    auditPath: '/tmp/AUDIT-LOG.md',
    evidencePath: '/tmp/EVIDENCE.json',
    summaryPath: '/tmp/SUMMARY.md',
    templateMode: false,
    lenient: false,
    checklistLines,
    auditLines,
    summaryLines: [],
  };
}

function collect(): { fail: ProblemReporter; problems: Array<{ code: string; message: string }> } {
  const problems: Array<{ code: string; message: string }> = [];
  const fail: ProblemReporter = (code, _file, _line, message) => {
    problems.push({ code, message });
  };
  return { fail, problems };
}

const VALID_FRONTMATTER = [
  '---',
  'spec_version: "0.1"',
  'spec_source: https://github.com/x/y/tree/0123456789abcdef0123456789abcdef01234567',
  'assessment_started_at: "2025-01-15T10:00:00Z"',
  'assessment_completed_at: "2025-01-15T10:00:05Z"',
  'assessment_duration: "00:00:05"',
  'audited_commit: 0123456789abcdef0123456789abcdef01234567',
  'auditor: "Test Bot"',
  'validator_version: "0.1.0"',
  'collector_version: "0.1.0"',
  'runner_agent: "claude-code"',
  'runner_model: "claude-opus"',
  'conformance_level: 1',
  '---',
  '',
];

// ----- validator-frontmatter ---------------------------------------------

// 1. AUDIT002: missing frontmatter (no leading '---').
{
  const ctx = makeContext(['# title', '', 'no frontmatter here']);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => p.code === 'AUDIT002' && /first line/.test(p.message))) {
    ok('AUDIT002: missing frontmatter (no leading marker)');
  } else {
    bad('AUDIT002 missing', JSON.stringify(problems));
  }
}

// 2. AUDIT002: unclosed frontmatter (leading '---' but no closing).
{
  const ctx = makeContext(['---', 'spec_version: "0.1"', 'auditor: "x"', '# no closing marker']);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => p.code === 'AUDIT002' && /not closed/.test(p.message))) {
    ok('AUDIT002: unclosed frontmatter');
  } else {
    bad('AUDIT002 unclosed', JSON.stringify(problems));
  }
}

// 3. AUDIT003: unparseable frontmatter line (no key:value shape).
{
  const ctx = makeContext(['---', 'this line has no colon', 'spec_version: "0.1"', '---']);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => p.code === 'AUDIT003')) {
    ok('AUDIT003: unparseable frontmatter line');
  } else {
    bad('AUDIT003 unparseable', JSON.stringify(problems));
  }
}

// 4. AUDIT005: cross-file conformance_level mismatch.
{
  const checklistLines = [...VALID_FRONTMATTER];
  const auditLines = [...VALID_FRONTMATTER];
  // Audit log has a different conformance_level than the checklist.
  const idx = auditLines.findIndex((l) => l.startsWith('conformance_level:'));
  auditLines[idx] = 'conformance_level: 2';
  const ctx = makeContext(checklistLines, auditLines);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => p.code === 'AUDIT005' && /conformance_level/.test(p.message))) {
    ok('AUDIT005: cross-file conformance_level mismatch');
  } else {
    bad('AUDIT005 conformance mismatch', JSON.stringify(problems));
  }
}

// 5. AUDIT006: empty required field (spec_version blank).
{
  const lines = [...VALID_FRONTMATTER];
  lines[lines.findIndex((l) => l.startsWith('spec_version:'))] = 'spec_version: ""';
  const ctx = makeContext(lines);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => p.code === 'AUDIT006' && /spec_version/.test(p.message))) {
    ok('AUDIT006: empty spec_version');
  } else {
    bad('AUDIT006 empty', JSON.stringify(problems));
  }
}

// 6. AUDIT018: validator_version mismatch.
{
  const lines = [...VALID_FRONTMATTER];
  lines[lines.findIndex((l) => l.startsWith('validator_version:'))] = 'validator_version: "9.9.9"';
  const ctx = makeContext(lines);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => p.code === 'AUDIT018' || /validator_version/.test(p.message))) {
    ok('AUDIT018-class: validator_version mismatch surfaced');
  } else {
    bad('validator_version mismatch', JSON.stringify(problems));
  }
}

// 7. spec_source must pin an immutable ref. Branch name should fail.
{
  const lines = [...VALID_FRONTMATTER];
  lines[lines.findIndex((l) => l.startsWith('spec_source:'))] =
    'spec_source: https://github.com/x/y/tree/main';
  const ctx = makeContext(lines);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => /spec_source/.test(p.message))) {
    ok('spec_source: branch ref rejected (immutable-ref check)');
  } else {
    bad('spec_source mutable ref', JSON.stringify(problems));
  }
}

// 8. AUDIT009: malformed assessment_duration value.
{
  const lines = [...VALID_FRONTMATTER];
  lines[lines.findIndex((l) => l.startsWith('assessment_duration:'))] =
    'assessment_duration: "five seconds"';
  const ctx = makeContext(lines);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => p.code === 'AUDIT009' || /assessment_duration/.test(p.message))) {
    ok('AUDIT009: malformed assessment_duration');
  } else {
    bad('AUDIT009 duration', JSON.stringify(problems));
  }
}

// 9. invalid conformance_level value.
{
  const lines = [...VALID_FRONTMATTER];
  lines[lines.findIndex((l) => l.startsWith('conformance_level:'))] = 'conformance_level: bogus';
  const ctx = makeContext(lines);
  const { fail, problems } = collect();
  checkFrontmatter(ctx, fail, { validatorVersion: '0.1.0' });
  if (problems.some((p) => /conformance_level/.test(p.message))) {
    ok('invalid conformance_level rejected');
  } else {
    bad('invalid conformance_level', JSON.stringify(problems));
  }
}

// ----- validator-backlog -------------------------------------------------

// 10. parseBacklog: empty input -> empty array.
{
  const rows = parseBacklog([]);
  if (Array.isArray(rows) && rows.length === 0) ok('parseBacklog: empty input -> empty array');
  else bad('parseBacklog empty', JSON.stringify(rows));
}

// 11. parseBacklog: text without a Backlog section -> empty array.
{
  const rows = parseBacklog(['# Title', '', 'random prose', '## Some Other Section', '']);
  if (Array.isArray(rows) && rows.length === 0) ok('parseBacklog: no backlog section -> empty');
  else bad('parseBacklog no section', JSON.stringify(rows));
}

// 12. parseBacklog: properly-formed backlog table with two rows.
{
  const lines = [
    '# Summary',
    '',
    '## Backlog — what to address first',
    '',
    '| Priority | Blocks level | Rule | Scope | Current status | Next action | Owner | Target date |',
    '| -------- | ------------ | ---- | ----- | -------------- | ----------- | ----- | ----------- |',
    '| 1 | L1 | `Branch Protection` | MUST | Warning | enable status checks | sec-team | 2026-06-01 |',
    '| 3 | L2 | `Coverage as Minimum` | MUST | Warning | raise threshold | core | 2026-07-01 |',
    '',
  ];
  const rows = parseBacklog(lines);
  if (
    rows.length === 2 &&
    rows[0].rule === 'Branch Protection' &&
    rows[1].rule === 'Coverage as Minimum'
  ) {
    ok('parseBacklog: parses two-row backlog table');
  } else {
    bad('parseBacklog two rows', JSON.stringify(rows));
  }
}

// 13. parseBacklog: skips blank-row separators (the table sometimes has a
//     placeholder row when the backlog is empty).
{
  const lines = [
    '## Backlog — what to address first',
    '',
    '| Priority | Blocks level | Rule | Scope | Current status | Next action | Owner | Target date |',
    '| -------- | ------------ | ---- | ----- | -------------- | ----------- | ----- | ----------- |',
    '|          |              |      |       |                |             |       |             |',
    '',
  ];
  const rows = parseBacklog(lines);
  // parseBacklog is a low-level parser that returns every data row; the
  // empty-row filter happens in checkBacklog. Verify that a placeholder
  // row parses to a row with empty cells, not that it gets skipped.
  if (Array.isArray(rows) && rows.length === 1 && rows[0].rule === '' && rows[0].priority === '') {
    ok('parseBacklog: empty placeholder row parsed with empty cells');
  } else {
    bad('parseBacklog placeholder', JSON.stringify(rows));
  }
}

// ----- validator-backlog: checkBacklog drift detection ------------------

function makeChecklistRow(rule: string, partial: Partial<ChecklistRow>): ChecklistRow {
  return {
    line: 1,
    rule,
    scope: 'MUST',
    pillar: 1,
    minLevel: 'L1',
    requirement: '',
    automationMarker: '-',
    status: '⚠️ Warning',
    comment: '`evidence here`',
    ids: [],
    ...partial,
  };
}

function makeBacklogRow(partial: Partial<BacklogRow>): BacklogRow {
  return {
    line: 10,
    priority: '3',
    blocksLevel: 'L1',
    rule: '',
    scope: 'MUST',
    currentStatus: '⚠️ Warning',
    nextAction: '',
    owner: '',
    targetDate: '',
    ...partial,
  };
}

// ----- validator-reaudit: auditor-owned status drift rationales ----------

// 14. AUDIT070: Fulfilled -> Warning needs a current-run rationale.
{
  const previous = [
    makeChecklistRow('A11y Keyboard Focus', {
      status: '✅ Fulfilled',
      ids: ['AIC-keyboard-focus'],
    }),
  ];
  const current = [
    makeChecklistRow('A11y Keyboard Focus', {
      status: '⚠️ Warning',
      comment: 'docs/reviews/a-accessibility.md:12 records unresolved focus findings.',
      ids: ['AIC-keyboard-focus'],
    }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkReauditStatusRationales(current, ctx, fail, previous);
  if (problems.some((p) => p.code === 'AUDIT070' && /changed from/.test(p.message))) {
    ok('AUDIT070: Fulfilled -> Warning needs status-change rationale');
  } else {
    bad('AUDIT070 missing for Fulfilled -> Warning', JSON.stringify(problems));
  }
}

// 15. Warning -> Fulfilled passes when the comment explains the change.
{
  const previous = [
    makeChecklistRow('Strict Types', {
      status: '⚠️ Warning',
      ids: ['AIC-strict-typing-enabled'],
    }),
  ];
  const current = [
    makeChecklistRow('Strict Types', {
      status: '✅ Fulfilled',
      comment:
        'Changed from `⚠️ Warning` to `✅ Fulfilled` because tsconfig.json:4 now enables `"strict": true`.',
      ids: ['AIC-strict-typing-enabled'],
    }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkReauditStatusRationales(current, ctx, fail, previous);
  if (problems.length === 0) {
    ok('checkReauditStatusRationales: Warning -> Fulfilled with rationale');
  } else {
    bad('AUDIT070 false positive for Warning -> Fulfilled', JSON.stringify(problems));
  }
}

// 16. Mechanically stamped rows are exempt from auditor-owned rationale checks.
{
  const previous = [
    makeChecklistRow('Branch Protection', {
      automationMarker: 'x',
      status: '✅ Fulfilled',
      ids: ['AIC-default-branch-protected'],
    }),
  ];
  const current = [
    makeChecklistRow('Branch Protection', {
      automationMarker: 'x',
      status: '⚠️ Warning',
      comment:
        'Mechanical (collector-derived) from `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`.',
      ids: ['AIC-default-branch-protected'],
    }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkReauditStatusRationales(current, ctx, fail, previous);
  if (problems.length === 0) {
    ok('checkReauditStatusRationales: mechanical rows exempt');
  } else {
    bad('AUDIT070 false positive for mechanical rows', JSON.stringify(problems));
  }
}

// 17. AUDIT040: duplicate rule in backlog.
{
  const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', {})];
  const backlog: BacklogRow[] = [
    makeBacklogRow({ rule: 'Branch Protection' }),
    makeBacklogRow({ rule: 'Branch Protection', line: 11 }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT040')) ok('AUDIT040: duplicate backlog rule');
  else bad('AUDIT040 dup', JSON.stringify(problems));
}

// 15. AUDIT041: backlog missing a Warning/Alarm row that the checklist has.
{
  const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', {})];
  const backlog: BacklogRow[] = [];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT041' && /Branch Protection/.test(p.message))) {
    ok('AUDIT041: backlog missing expected row');
  } else {
    bad('AUDIT041 missing', JSON.stringify(problems));
  }
}

// 16. AUDIT042: backlog row has wrong Level.
{
  const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', { minLevel: 'L1' })];
  const backlog: BacklogRow[] = [makeBacklogRow({ rule: 'Branch Protection', blocksLevel: 'L2' })];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT042' && /Level/.test(p.message))) {
    ok('AUDIT042: backlog Level mismatch');
  } else {
    bad('AUDIT042 level', JSON.stringify(problems));
  }
}

// 17. AUDIT042: backlog row has wrong Priority.
{
  const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', {})];
  const backlog: BacklogRow[] = [makeBacklogRow({ rule: 'Branch Protection', priority: '1' })];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT042' && /Priority/.test(p.message))) {
    ok('AUDIT042: backlog Priority mismatch');
  } else {
    bad('AUDIT042 priority', JSON.stringify(problems));
  }
}

// 18. AUDIT043: backlog row has wrong Scope.
{
  const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', { scope: 'MUST' })];
  const backlog: BacklogRow[] = [makeBacklogRow({ rule: 'Branch Protection', scope: 'SHOULD' })];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT043' && /Scope/.test(p.message))) {
    ok('AUDIT043: backlog Scope mismatch');
  } else {
    bad('AUDIT043 scope', JSON.stringify(problems));
  }
}

// 19. AUDIT044: backlog row has wrong Current status.
{
  const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', { status: '⚠️ Warning' })];
  const backlog: BacklogRow[] = [
    makeBacklogRow({ rule: 'Branch Protection', currentStatus: '🚨 Alarm' }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT044' && /Current status/.test(p.message))) {
    ok('AUDIT044: backlog Current status mismatch');
  } else {
    bad('AUDIT044 status', JSON.stringify(problems));
  }
}

// 20. AUDIT045: backlog has a row whose checklist rule is not Warning/Alarm.
{
  const rules: ChecklistRow[] = [
    makeChecklistRow('Some Fulfilled Rule', { status: '✅ Fulfilled' }),
  ];
  const backlog: BacklogRow[] = [
    makeBacklogRow({ rule: 'Phantom Rule', currentStatus: '⚠️ Warning' }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT045' && /Phantom Rule/.test(p.message))) {
    ok('AUDIT045: backlog row without matching Warning/Alarm checklist rule');
  } else {
    bad('AUDIT045 phantom', JSON.stringify(problems));
  }
}

// 21. AUDIT046: backlog rows out of sort order (Level descending).
{
  const rules: ChecklistRow[] = [
    makeChecklistRow('A Rule', { minLevel: 'L1' }),
    makeChecklistRow('B Rule', { minLevel: 'L2' }),
  ];
  // Place L2 before L1 to provoke the sort failure.
  const backlog: BacklogRow[] = [
    makeBacklogRow({ rule: 'B Rule', blocksLevel: 'L2', priority: '3' }),
    makeBacklogRow({ rule: 'A Rule', blocksLevel: 'L1', priority: '3', line: 11 }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT046')) ok('AUDIT046: backlog Level out of order');
  else bad('AUDIT046 sort-level', JSON.stringify(problems));
}

// 22. AUDIT046: same Level, Priority out of order.
{
  const rules: ChecklistRow[] = [
    makeChecklistRow('A Rule', { status: '🚨 Alarm', minLevel: 'L1', scope: 'MUST' }),
    makeChecklistRow('B Rule', { status: '⚠️ Warning', minLevel: 'L1', scope: 'MUST' }),
  ];
  // A is Alarm priority 1, B is Warning priority 3. Place B first to provoke.
  const backlog: BacklogRow[] = [
    makeBacklogRow({ rule: 'B Rule', priority: '3', currentStatus: '⚠️ Warning' }),
    makeBacklogRow({ rule: 'A Rule', priority: '1', currentStatus: '🚨 Alarm', line: 11 }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT046' && /Priority/.test(p.message))) {
    ok('AUDIT046: same-Level Priority out of order');
  } else {
    bad('AUDIT046 sort-priority', JSON.stringify(problems));
  }
}

// 23. checkBacklog templateMode short-circuit returns without checking.
{
  const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', {})];
  const backlog: BacklogRow[] = []; // would normally trigger AUDIT041
  const ctx = makeContext([]);
  ctx.templateMode = true;
  const { fail, problems } = collect();
  checkBacklog(backlog, rules, ctx, fail);
  if (problems.length === 0) ok('checkBacklog: templateMode skips drift checks');
  else bad('templateMode short-circuit', JSON.stringify(problems));
}

// ----- validator-summary: checkSummary cumulative + conformance_level ---

function makeSummaryRow(level: string, partial: Partial<SummaryRow> = {}): SummaryRow {
  return {
    line: 100 + Number(level || '0'),
    level,
    levelCell: `Level ${level}`,
    status: '✅ Yes',
    dateReached: '2026-01-01',
    notes: '',
    ...partial,
  };
}

function makeFrontmatter(level: string): Frontmatter {
  return {
    values: new Map([['conformance_level', level]]),
    lines: new Map([['conformance_level', 5]]),
  };
}

function makeRules(withL0 = true): ChecklistRow[] {
  return withL0 ? [makeChecklistRow('L0 Rule', { minLevel: 'L0', status: '✅ Fulfilled' })] : [];
}

// 24. AUDIT020: summary missing a level row.
{
  const summary = [
    makeSummaryRow('1', { status: '✅ Yes' }),
    makeSummaryRow('2', { status: '❌ No' }),
    // 3 and 4 missing
  ];
  const fm = makeFrontmatter('1');
  const ctx = makeContext([]);
  ctx.lenient = true; // skip the strict-level-closure check
  const { fail, problems } = collect();
  checkSummary(summary, fm, makeRules(false), ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT020' && /Level 3/.test(p.message))) {
    ok('AUDIT020: summary missing a level row');
  } else {
    bad('AUDIT020', JSON.stringify(problems));
  }
}

// 25. AUDIT021: invalid status value.
{
  const summary = [
    makeSummaryRow('0', { status: '✅ Yes' }),
    makeSummaryRow('1', { status: '✅ Yes' }),
    makeSummaryRow('2', { status: 'maybe' as 'Yes' as unknown as SummaryRow['status'] }),
    makeSummaryRow('3', { status: '❌ No' }),
    makeSummaryRow('4', { status: '❌ No' }),
  ];
  const fm = makeFrontmatter('1');
  const ctx = makeContext([]);
  ctx.lenient = true;
  const { fail, problems } = collect();
  checkSummary(summary, fm, makeRules(true), ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT021' && /maybe/.test(p.message))) {
    ok('AUDIT021: invalid summary status');
  } else {
    bad('AUDIT021', JSON.stringify(problems));
  }
}

// 26. AUDIT022: cumulative-level violation (Level 2 yes but Level 1 no).
{
  const summary = [
    makeSummaryRow('0', { status: '✅ Yes' }),
    makeSummaryRow('1', { status: '❌ No' }),
    makeSummaryRow('2', { status: '✅ Yes' }), // not cumulative
    makeSummaryRow('3', { status: '❌ No' }),
    makeSummaryRow('4', { status: '❌ No' }),
  ];
  const fm = makeFrontmatter('2');
  const ctx = makeContext([]);
  ctx.lenient = true;
  const { fail, problems } = collect();
  checkSummary(summary, fm, makeRules(true), ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT022' && /cumulative/.test(p.message))) {
    ok('AUDIT022: cumulative-level violation surfaced');
  } else {
    bad('AUDIT022', JSON.stringify(problems));
  }
}

// 27. AUDIT023: no row is Yes but conformance_level is not "none".
{
  const summary = [
    makeSummaryRow('0', { status: '❌ No' }),
    makeSummaryRow('1', { status: '❌ No' }),
    makeSummaryRow('2', { status: '❌ No' }),
    makeSummaryRow('3', { status: '❌ No' }),
    makeSummaryRow('4', { status: '❌ No' }),
  ];
  const fm = makeFrontmatter('1'); // claims L1 with no Yes rows
  const ctx = makeContext([]);
  ctx.lenient = true;
  const { fail, problems } = collect();
  checkSummary(summary, fm, makeRules(true), ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT023')) ok('AUDIT023: conformance_level vs none');
  else bad('AUDIT023', JSON.stringify(problems));
}

// 28. AUDIT024: conformance_level disagrees with the highest Yes row.
{
  const summary = [
    makeSummaryRow('0', { status: '✅ Yes' }),
    makeSummaryRow('1', { status: '✅ Yes' }),
    makeSummaryRow('2', { status: '❌ No' }),
    makeSummaryRow('3', { status: '❌ No' }),
    makeSummaryRow('4', { status: '❌ No' }),
  ];
  const fm = makeFrontmatter('3'); // claims L3 but only L1 reached
  const ctx = makeContext([]);
  ctx.lenient = true;
  const { fail, problems } = collect();
  checkSummary(summary, fm, makeRules(true), ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT024' && /highest/.test(p.message))) {
    ok('AUDIT024: conformance_level disagrees with highest Yes');
  } else {
    bad('AUDIT024', JSON.stringify(problems));
  }
}

// 29. checkSummary templateMode short-circuit.
{
  const summary: SummaryRow[] = [];
  const fm = makeFrontmatter('1');
  const ctx = makeContext([]);
  ctx.templateMode = true;
  const { fail, problems } = collect();
  checkSummary(summary, fm, makeRules(true), ctx, fail);
  if (problems.length === 0) ok('checkSummary: templateMode short-circuit');
  else bad('checkSummary templateMode', JSON.stringify(problems));
}

// ----- validator-evidence-linkage ---------------------------------------

// 30. AUDIT039: Branch Protection Fulfilled without citing EVIDENCE.json.
{
  const rules: ChecklistRow[] = [
    makeChecklistRow('Branch Protection', {
      status: '✅ Fulfilled',
      comment: 'looks fine',
    }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkDerivedEvidenceArtifactCitations(rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT039' && /Branch Protection/.test(p.message))) {
    ok('AUDIT039: derived row missing EVIDENCE.json citation');
  } else {
    bad('AUDIT039', JSON.stringify(problems));
  }
}

// 31. AUDIT039: passes when comment cites EVIDENCE.json.
{
  const rules: ChecklistRow[] = [
    makeChecklistRow('Branch Protection', {
      status: '✅ Fulfilled',
      comment: 'see `AI-CONTRIBUTOR-EVIDENCE.json`',
    }),
  ];
  const ctx = makeContext([]);
  const { fail, problems } = collect();
  checkDerivedEvidenceArtifactCitations(rules, ctx, fail);
  if (problems.length === 0)
    ok('checkDerivedEvidenceArtifactCitations: no error when citation present');
  else bad('AUDIT039 false positive', JSON.stringify(problems));
}

// 32. AUDIT060: collector-derived checklist row exists but EVIDENCE.json
//     is missing.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-evlink-'));
  try {
    const ctx = makeContext([]);
    ctx.evidencePath = path.join(tmp, 'EVIDENCE.json'); // does not exist
    const AUTO_STAMP_PREFIX =
      'Mechanical (collector-derived) from `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`';
    const rules: ChecklistRow[] = [
      makeChecklistRow('Branch Protection', {
        status: '✅ Fulfilled',
        comment: AUTO_STAMP_PREFIX + ' — fine',
      }),
    ];
    const { fail, problems } = collect();
    checkCollectorDerivedRowsMatchEvidence(rules, ctx, fail);
    if (
      problems.some((p) => p.code === 'AUDIT060' && /EVIDENCE\.json is missing/.test(p.message))
    ) {
      ok('AUDIT060: missing EVIDENCE.json with mechanical row present');
    } else {
      bad('AUDIT060 missing', JSON.stringify(problems));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 33. AUDIT060: malformed EVIDENCE.json.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-evlink-bad-'));
  try {
    const evidence = path.join(tmp, 'EVIDENCE.json');
    fs.writeFileSync(evidence, '{ this is not json');
    const ctx = makeContext([]);
    ctx.evidencePath = evidence;
    const rules: ChecklistRow[] = [makeChecklistRow('Branch Protection', {})];
    const { fail, problems } = collect();
    checkCollectorDerivedRowsMatchEvidence(rules, ctx, fail);
    if (problems.some((p) => p.code === 'AUDIT060')) ok('AUDIT060: malformed EVIDENCE.json');
    else bad('AUDIT060 malformed', JSON.stringify(problems));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 34. checkDerivedEvidenceArtifactCitations templateMode short-circuit.
{
  const ctx = makeContext([]);
  ctx.templateMode = true;
  const rules: ChecklistRow[] = [
    makeChecklistRow('Branch Protection', { status: '✅ Fulfilled', comment: 'no citation' }),
  ];
  const { fail, problems } = collect();
  checkDerivedEvidenceArtifactCitations(rules, ctx, fail);
  if (problems.length === 0)
    ok('checkDerivedEvidenceArtifactCitations: templateMode short-circuit');
  else bad('templateMode short-circuit (linkage)', JSON.stringify(problems));
}

// 35. checkProfileEvidence: missing profile path, no profile rows -> no error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-profev-'));
  try {
    const ctx = makeContext([]);
    ctx.evidencePath = path.join(tmp, 'EVIDENCE.json');
    fs.writeFileSync(
      ctx.evidencePath,
      JSON.stringify({ profile: { present: false, answers: [] }, rules: {} }),
    );
    const rules: ChecklistRow[] = [];
    const { fail, problems } = collect();
    checkProfileEvidence(rules, ctx, fail);
    if (problems.length === 0) ok('checkProfileEvidence: no profile + no rules -> no error');
    else bad('checkProfileEvidence empty', JSON.stringify(problems));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 36. AUDIT038: token disclosure audit-log row must precede `gh api` rows.
{
  const ctx = makeContext([]);
  const audit: AuditLogRow[] = [
    {
      line: 5,
      command: 'gh api repos/foo/bar',
      outputExcerpt: '',
      rulesEvidenced: [],
      normativeIds: [],
    },
    {
      line: 10,
      command: 'gh api user --jq .login',
      outputExcerpt: 'auditor',
      rulesEvidenced: [],
      normativeIds: [],
    },
  ];
  const { fail, problems } = collect();
  checkTokenDisclosure(audit, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT038')) {
    ok('AUDIT038: token disclosure ordering enforced');
  } else {
    bad('AUDIT038', JSON.stringify(problems));
  }
}

if (failed > 0) {
  console.error(`${failed} validator unit test(s) failed`);
  process.exit(1);
}
console.log('All validator unit tests passed');

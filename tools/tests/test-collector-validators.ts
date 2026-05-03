#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Unit tests for github-api-schemas.ts validators and validator-audit-log
// helpers. Drives each exported function with synthetic inputs to cover
// the malformed/valid branches that fixture-based tests don't reach.

import {
  validateBranchProtection,
  validateDependabotAlertsList,
  validateEnvironmentsList,
  validateRepoMetadata,
  validateRulesetSummary,
} from '../../skills/ai-contributor-audit/scripts/internal/github-api-schemas.ts';
import {
  checkAuditLog,
  isPlaceholderAuditRow,
  parseAuditLog,
} from '../../skills/ai-contributor-audit/scripts/internal/validator-audit-log.ts';
import type {
  AuditLogRow,
  ProblemReporter,
  ValidatorContext,
} from '../../skills/ai-contributor-audit/scripts/internal/validator-types.ts';
import type { ChecklistRow } from '../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function bad(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

// ----- validateRulesetSummary -------------------------------------------

{
  const r = validateRulesetSummary([{ type: 'pull_request' }]);
  if (r.ok) ok('validateRulesetSummary: minimal valid array');
  else bad('rulesetSummary valid', r.reason);
}
{
  const r = validateRulesetSummary({} as unknown);
  if (!r.ok && /expected array/.test(r.reason)) ok('validateRulesetSummary: non-array rejected');
  else bad('rulesetSummary non-array', JSON.stringify(r));
}
{
  const r = validateRulesetSummary(['not-object'] as unknown);
  if (!r.ok && /expected object/.test(r.reason))
    ok('validateRulesetSummary: non-object element rejected');
  else bad('rulesetSummary non-object', JSON.stringify(r));
}
{
  const r = validateRulesetSummary([{ notType: 'x' }] as unknown);
  if (!r.ok && /missing string field "type"/.test(r.reason)) {
    ok('validateRulesetSummary: missing type rejected');
  } else bad('rulesetSummary missing type', JSON.stringify(r));
}
{
  const r = validateRulesetSummary([{ type: 't', parameters: 'not-object' }] as unknown);
  if (!r.ok && /parameters/.test(r.reason))
    ok('validateRulesetSummary: non-object parameters rejected');
  else bad('rulesetSummary parameters', JSON.stringify(r));
}

// ----- validateBranchProtection -----------------------------------------

{
  if (validateBranchProtection({}).ok) ok('validateBranchProtection: empty object accepted');
  else bad('branchProtection empty');
}
{
  const r = validateBranchProtection('string' as unknown);
  if (!r.ok) ok('validateBranchProtection: non-object rejected');
  else bad('branchProtection non-object', JSON.stringify(r));
}
{
  const r = validateBranchProtection({ required_status_checks: 'string' } as unknown);
  if (!r.ok && /required_status_checks/.test(r.reason)) {
    ok('validateBranchProtection: bad required_status_checks rejected');
  } else bad('branchProtection bad checks', JSON.stringify(r));
}
{
  const r = validateBranchProtection({
    required_pull_request_reviews: 'string',
  } as unknown);
  if (!r.ok && /required_pull_request_reviews/.test(r.reason)) {
    ok('validateBranchProtection: bad required_pull_request_reviews rejected');
  } else bad('branchProtection bad reviews', JSON.stringify(r));
}

// ----- validateRepoMetadata ---------------------------------------------

{
  if (validateRepoMetadata({}).ok) ok('validateRepoMetadata: empty object accepted');
  else bad('repoMetadata empty');
}
{
  const r = validateRepoMetadata([] as unknown);
  if (!r.ok) ok('validateRepoMetadata: non-object rejected');
  else bad('repoMetadata non-object', JSON.stringify(r));
}
{
  const r = validateRepoMetadata({ security_and_analysis: 'x' } as unknown);
  if (!r.ok && /security_and_analysis/.test(r.reason)) {
    ok('validateRepoMetadata: bad security_and_analysis rejected');
  } else bad('repoMetadata bad sec', JSON.stringify(r));
}

// ----- validateDependabotAlertsList -------------------------------------

{
  if (validateDependabotAlertsList([]).ok) ok('validateDependabotAlertsList: empty array accepted');
  else bad('dependabot empty');
}
{
  const r = validateDependabotAlertsList({} as unknown);
  if (!r.ok && /expected array/.test(r.reason))
    ok('validateDependabotAlertsList: non-array rejected');
  else bad('dependabot non-array', JSON.stringify(r));
}

// ----- validateEnvironmentsList -----------------------------------------

{
  if (validateEnvironmentsList({ environments: [] }).ok) {
    ok('validateEnvironmentsList: minimal valid object accepted');
  } else bad('environments minimal');
}
{
  const r = validateEnvironmentsList([] as unknown);
  if (!r.ok) ok('validateEnvironmentsList: array rejected');
  else bad('environments array', JSON.stringify(r));
}
{
  const r = validateEnvironmentsList({ environments: 'string' } as unknown);
  if (!r.ok && /environments.*field must be array/.test(r.reason)) {
    ok('validateEnvironmentsList: non-array environments field rejected');
  } else bad('environments bad inner', JSON.stringify(r));
}
{
  const r = validateEnvironmentsList({ environments: ['not-obj'] } as unknown);
  if (!r.ok && /expected object/.test(r.reason)) {
    ok('validateEnvironmentsList: non-object element rejected');
  } else bad('environments bad element', JSON.stringify(r));
}
{
  const r = validateEnvironmentsList({
    environments: [{ protection_rules: 'string' }],
  } as unknown);
  if (!r.ok && /protection_rules/.test(r.reason)) {
    ok('validateEnvironmentsList: non-array protection_rules rejected');
  } else bad('environments bad protection', JSON.stringify(r));
}

// ----- validator-audit-log helpers --------------------------------------

{
  // Audit log columns are: Spec IDs | Rules evidenced | Command | Output excerpt.
  const lines = [
    '## What to record',
    '',
    '| Spec IDs | Rules evidenced | Command | Output excerpt |',
    '| -------- | --------------- | ------- | -------------- |',
    '| `AIC-default-branch-protected` | `Branch Protection` | `git log --oneline` | abc123 init |',
    '| `AIC-multiple-test-layers` | `Test Layers` | `pnpm test` | 5 passed |',
    '',
  ];
  const rows = parseAuditLog(lines);
  const real = rows.filter((r) => r.command !== 'Command' && !r.command.startsWith('-'));
  if (real.length === 2 && real[0].command === '`git log --oneline`') {
    ok('parseAuditLog: parses two-row table');
  } else {
    bad('parseAuditLog rows', JSON.stringify(rows));
  }
}

{
  const rows = parseAuditLog([
    '## What to record',
    '',
    '| Spec IDs | Rules evidenced | Command | Output excerpt |',
    '| -------- | --------------- | ------- | -------------- |',
  ]);
  // Header row may or may not be filtered out depending on parser; only data
  // rows have a backticked command. Confirm no data rows are returned.
  const real = rows.filter((r) => /`/.test(r.command));
  if (real.length === 0) ok('parseAuditLog: empty body returns no data rows');
  else bad('parseAuditLog empty body', JSON.stringify(rows));
}

{
  const rows = parseAuditLog(['# Title', 'no audit-log section here']);
  if (Array.isArray(rows) && rows.length === 0) ok('parseAuditLog: missing section returns empty');
  else bad('parseAuditLog missing section', JSON.stringify(rows));
}

{
  const placeholder = {
    line: 1,
    command: '<command>',
    outputExcerpt: '<excerpt>',
    rulesEvidenced: ['Rule A'],
    normativeIds: [],
  };
  if (isPlaceholderAuditRow(placeholder)) ok('isPlaceholderAuditRow: placeholder detected');
  else bad('isPlaceholderAuditRow placeholder');

  const real = {
    line: 1,
    command: 'git log',
    outputExcerpt: 'abc',
    rulesEvidenced: ['Branch Protection'],
    normativeIds: ['AIC-x'],
  };
  if (!isPlaceholderAuditRow(real)) ok('isPlaceholderAuditRow: real row not flagged');
  else bad('isPlaceholderAuditRow real');
}

// AUDIT033: rules-evidenced cell names a checklist rule that does not exist.
{
  const row: AuditLogRow = {
    line: 5,
    command: '`pnpm test`',
    outputExcerpt: 'passed',
    rulesEvidenced: ['Phantom Rule'],
    normativeIds: ['AIC-x'],
  };
  const rules: ChecklistRow[] = [
    {
      line: 1,
      rule: 'Branch Protection',
      scope: 'MUST',
      pillar: 4,
      minLevel: 'L1',
      requirement: '',
      automationMarker: '-',
      status: '✅ Fulfilled',
      comment: '`evidence`',
      ids: [],
    },
  ];
  const ctx: ValidatorContext = {
    checklistPath: '/tmp/CHECKLIST.md',
    auditPath: '/tmp/AUDIT-LOG.md',
    evidencePath: '/tmp/EVIDENCE.json',
    summaryPath: '/tmp/SUMMARY.md',
    templateMode: false,
    lenient: false,
    checklistLines: [],
    auditLines: ['', '', '', '', '| `AIC-x` | `Phantom Rule` | `pnpm test` | passed |'],
    summaryLines: [],
  };
  const problems: Array<{ code: string }> = [];
  const fail: ProblemReporter = (code, _f, _l, _m) => {
    problems.push({ code });
  };
  checkAuditLog([row], rules, ctx, fail);
  if (problems.some((p) => p.code === 'AUDIT033')) ok('AUDIT033: phantom rule name in audit log');
  else bad('AUDIT033', JSON.stringify(problems));
}

if (failed > 0) {
  console.error(`${failed} collector/validator unit test(s) failed`);
  process.exit(1);
}
console.log('All collector/validator unit tests passed');

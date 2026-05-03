#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Unit tests for skills/ai-contributor-audit/scripts/audit-summary.ts.
// The script is a one-shot reader for AI-CONTRIBUTOR-EVIDENCE.json; these
// tests cover help, missing-file, invalid-JSON, and the happy path with
// a synthetic evidence fixture exercising every counter and listing
// branch (decisive, judgment-required, errors, blank).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSummary } from '../../skills/ai-contributor-audit/scripts/audit-summary.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function fail(label: string, detail: string): void {
  console.error(`FAIL ${label}: ${detail}`);
  failed++;
}

// 1. --help short-circuits with usage on stdout, exit 0.
{
  const r = runSummary(['--help']);
  if (r.exitCode === 0 && /Usage: audit-summary/.test(r.stdout)) {
    ok('--help prints usage and exits 0');
  } else {
    fail('--help', `exit=${r.exitCode} stdout=${r.stdout}`);
  }
}

// 2. Missing evidence path -> exit 1 with a helpful stderr line.
{
  const r = runSummary([path.join(os.tmpdir(), 'audit-summary-nope.json')]);
  if (r.exitCode === 1 && /evidence file not found/.test(r.stderr)) {
    ok('missing evidence file -> exit 1 with helpful message');
  } else {
    fail('missing file', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}

// 3. Invalid JSON -> exit 1 with a helpful stderr line.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-summary-bad-'));
  try {
    const file = path.join(tmp, 'EVIDENCE.json');
    fs.writeFileSync(file, '{ this is not json');
    const r = runSummary([file]);
    if (r.exitCode === 1 && /not valid JSON/.test(r.stderr)) {
      ok('invalid JSON -> exit 1 with parser error');
    } else {
      fail('invalid JSON', `exit=${r.exitCode} stderr=${r.stderr}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 4. Happy path: synthetic evidence with one of each status, plus
//    judgment-required, plus blank, plus an error. Assert every section
//    of the report appears with the right counts.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-summary-happy-'));
  try {
    const file = path.join(tmp, 'EVIDENCE.json');
    const evidence = {
      $schema_version: '1',
      audit_collect_version: '0.1.0',
      spec_version: '0.1',
      spec_source: 'https://github.com/example/spec/tree/abc',
      target: {
        audited_commit: '1234567abcdef',
        mode: 'sha-pinned',
        host: { owner: 'example', repo: 'demo' },
      },
      github_api: { token_tier: 'audit_read_only', active_login: 'auditor' },
      profile: {
        path: '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md',
        present: true,
        answers: [{}, {}],
      },
      rules: {
        'rule-fulfilled': {
          spec_rule_name: 'Rule Fulfilled',
          derived_status: 'Fulfilled',
          derivation_reason: 'all required signals present',
          judgment_required: false,
          aic_ids: ['AIC-rule-fulfilled'],
        },
        'rule-warning': {
          spec_rule_name: 'Rule Warning',
          derived_status: 'Warning',
          derivation_reason: 'partial coverage',
          judgment_required: false,
          aic_ids: ['AIC-rule-warning'],
        },
        'rule-alarm': {
          spec_rule_name: 'Rule Alarm',
          derived_status: 'Alarm',
          derivation_reason: 'configured to continue-on-error',
          judgment_required: false,
          aic_ids: ['AIC-rule-alarm'],
        },
        'rule-not-relevant': {
          spec_rule_name: 'Rule NotRelevant',
          derived_status: 'Not relevant',
          derivation_reason: 'applicability trigger absent',
          judgment_required: false,
          aic_ids: ['AIC-rule-not-relevant'],
        },
        'rule-judgment': {
          spec_rule_name: 'Rule Judgment',
          derived_status: null,
          derivation_reason: 'host API unavailable',
          judgment_required: true,
          applicability: { verdict: 'unknown' },
          aic_ids: ['AIC-rule-judgment'],
        },
        'rule-judgment-empty-reason': {
          spec_rule_name: 'Rule Judgment Empty Reason',
          derived_status: null,
          derivation_reason: '',
          judgment_required: true,
          applicability: { verdict: 'applicable' },
          aic_ids: ['AIC-rule-judgment-empty'],
        },
        'rule-blank': {
          spec_rule_name: 'Rule Blank',
          derived_status: '',
          derivation_reason: 'no decisive signals',
          judgment_required: false,
          aic_ids: ['AIC-rule-blank'],
        },
      },
      errors: [{ stage: 'rule:rule-blank', detail: 'collector skipped due to missing tool' }],
    };
    fs.writeFileSync(file, JSON.stringify(evidence, null, 2));
    const r = runSummary([file]);
    const out = r.stdout;
    const checks: Array<[string, RegExp]> = [
      ['header line', /audit-summary v\d+\.\d+\.\d+/],
      ['spec_version printed', /spec_version\s+0\.1/],
      ['audited_commit printed', /audited_commit\s+1234567abcdef/],
      ['host printed', /host\s+example\/demo/],
      ['profile present count', /profile\s+present \(2 answers\)/],
      [
        'counts line',
        /Counts \(7 collector rules\): Fulfilled=1 Warning=1 Alarm=1 NotRelevant=1 judgment_required=2 blank=1/,
      ],
      ['decisive section header', /Collector decisive \(4\):/],
      ['decisive lists fulfilled', /rule-fulfilled\s+Fulfilled/],
      ['judgment section header', /Collector judgment-required \(2\):/],
      ['judgment shows reason', /rule-judgment\s+host API unavailable/],
      [
        'judgment falls back to applicability',
        /rule-judgment-empty-reason\s+applicability=applicable/,
      ],
      ['errors section', /Collector errors \(1\):/],
      ['errors detail line', /rule:rule-blank: collector skipped due to missing tool/],
      ['needs-status pointer', /\[audit-stamp\] needs-status advisory/],
    ];
    let allOk = r.exitCode === 0;
    for (const [label, re] of checks) {
      if (!re.test(out)) {
        allOk = false;
        fail(`happy path: ${label}`, `pattern ${re} not in stdout`);
      }
    }
    if (allOk)
      ok('happy path covers metadata, counts, decisive, judgment, errors, advisory pointer');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 5. Minimal evidence (no rules, no errors): counts line still emitted, no decisive/judgment sections.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-summary-minimal-'));
  try {
    const file = path.join(tmp, 'EVIDENCE.json');
    fs.writeFileSync(file, JSON.stringify({ rules: {} }));
    const r = runSummary([file]);
    if (
      r.exitCode === 0 &&
      /Counts \(0 collector rules\)/.test(r.stdout) &&
      !/Collector decisive/.test(r.stdout)
    ) {
      ok('minimal evidence: zero counts line, no decisive/judgment sections');
    } else {
      fail('minimal evidence', `exit=${r.exitCode}\nstdout=${r.stdout}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 6. Too many positionals -> exit 2 with usage.
{
  const r = runSummary(['a.json', 'b.json']);
  if (r.exitCode === 2 && /Usage: audit-summary/.test(r.stderr)) {
    ok('too many positionals -> exit 2 with usage');
  } else {
    fail('too many positionals', `exit=${r.exitCode} stderr=${r.stderr}`);
  }
}

if (failed > 0) {
  console.error(`${failed} audit-summary test(s) failed`);
  process.exit(1);
}
console.log('All audit-summary tests passed');

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Smoke test for audit-stamp.ts. Copies the `valid` audit-validate fixture
// into a tmp dir, drops a stub AI-CONTRIBUTOR-EVIDENCE.json beside it, runs
// the stamper twice, and asserts:
//   1. Run 1 succeeds (exit 0).
//   2. Run 2 produces the same file bytes as run 1 (idempotent).
//   3. The stamped audit log carries assessment_started_at from evidence.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStamper } from '../../skills/ai-contributor-audit/scripts/audit-stamp.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, '..', 'test-fixtures', 'audit-validate', 'valid');

function copyFile(src: string, dst: string): void {
  fs.copyFileSync(src, dst);
}

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

let failed = 0;

const help = runStamper(['--help']);
if (help.exitCode !== 0) {
  failed++;
  console.error('FAIL --help exit code', help.exitCode);
} else if (!help.stdout.includes('Usage: audit-stamp.ts')) {
  failed++;
  console.error('FAIL --help did not print usage');
} else {
  console.log('OK   --help prints usage');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-stamp-'));
try {
  const checklist = path.join(tmp, 'AI-CONTRIBUTOR-CHECKLIST.md');
  const auditLog = path.join(tmp, 'AI-CONTRIBUTOR-AUDIT-LOG.md');
  const summary = path.join(tmp, 'AI-CONTRIBUTOR-AUDIT.md');
  const evidence = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');

  copyFile(path.join(FIXTURE, 'AI-CONTRIBUTOR-CHECKLIST.md'), checklist);
  copyFile(path.join(FIXTURE, 'AI-CONTRIBUTOR-AUDIT-LOG.md'), auditLog);
  copyFile(path.resolve(HERE, '..', '..', 'AI-CONTRIBUTOR-AUDIT.md'), summary);

  // Stub evidence: a known started_at and one decisive rule whose
  // aic_ids will be present in the fixture's checklist (or harmlessly
  // ignored if not). The stamper must succeed regardless.
  const startedAt = '2025-01-15T10:00:00Z';
  fs.writeFileSync(
    evidence,
    JSON.stringify(
      {
        assessment_started_at: startedAt,
        rules: {
          'lockfile-integrity': {
            judgment_required: false,
            derived_status: 'Fulfilled',
            derivation_reason: 'Lockfile present and CI verifies it.',
            aic_ids: ['AIC-lockfile-integrity-hashes'],
          },
        },
      },
      null,
      2,
    ),
  );

  // Run 1
  const r1 = runStamper([checklist, auditLog, '--summary', summary]);
  if (r1.exitCode !== 0) {
    failed++;
    console.error('FAIL run 1 exit code', r1.exitCode);
    console.error('  stdout:', r1.stdout);
    console.error('  stderr:', r1.stderr);
  } else {
    console.log('OK   run 1 exit 0');
  }

  const checklistAfter1 = read(checklist);
  const auditAfter1 = read(auditLog);

  // Assertion: the audit log frontmatter now contains the started_at we
  // dropped into evidence.
  if (!auditAfter1.includes(`assessment_started_at: ${startedAt}`)) {
    failed++;
    console.error(
      'FAIL stamped audit log does not contain assessment_started_at from evidence JSON',
    );
  } else {
    console.log('OK   audit log carries evidence-sourced assessment_started_at');
  }

  // Run 2 — must be byte-identical to the run-1 output.
  const r2 = runStamper([checklist, auditLog, '--summary', summary]);
  if (r2.exitCode !== 0) {
    failed++;
    console.error('FAIL run 2 exit code', r2.exitCode);
    console.error('  stderr:', r2.stderr);
  }
  const checklistAfter2 = read(checklist);
  const auditAfter2 = read(auditLog);
  if (checklistAfter2 !== checklistAfter1) {
    const diff = diffIgnoringTimestampTriplet(checklistAfter1, checklistAfter2);
    if (diff !== null) {
      failed++;
      console.error('FAIL second run mutated the checklist beyond the timestamp triplet:');
      console.error(diff);
    } else {
      console.log('OK   checklist is idempotent (timestamp triplet refreshed as designed)');
    }
  } else {
    console.log('OK   checklist is idempotent across two runs');
  }
  if (auditAfter2 !== auditAfter1) {
    // assessment_completed_at and assessment_duration are recomputed each run,
    // so they may differ legitimately. Diff only the lines outside the
    // frontmatter timestamp triplet.
    const diff = diffIgnoringTimestampTriplet(auditAfter1, auditAfter2);
    if (diff !== null) {
      failed++;
      console.error('FAIL second run mutated the audit log beyond the timestamp triplet:');
      console.error(diff);
    } else {
      console.log('OK   audit log is idempotent (timestamp triplet refreshed as designed)');
    }
  } else {
    console.log('OK   audit log byte-identical across two runs');
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Second smoke run — exercise the stamp passes against the live
// repo's checklist + audit-log templates with a synthetic evidence JSON
// crafted to hit collector rows, verification gaps, and frontmatter stamps.

{
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-stamp-passes-'));
  try {
    const REPO = path.resolve(HERE, '..', '..');
    const checklist = path.join(tmp2, 'AI-CONTRIBUTOR-CHECKLIST.md');
    const auditLog = path.join(tmp2, 'AI-CONTRIBUTOR-AUDIT-LOG.md');
    const summary = path.join(tmp2, 'AI-CONTRIBUTOR-AUDIT.md');
    const evidence = path.join(tmp2, 'AI-CONTRIBUTOR-EVIDENCE.json');

    copyFile(path.join(REPO, '.ai-contributor-audit', 'AI-CONTRIBUTOR-CHECKLIST.md'), checklist);
    copyFile(path.join(REPO, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-LOG.md'), auditLog);
    copyFile(path.join(REPO, 'AI-CONTRIBUTOR-AUDIT.md'), summary);

    // Hand-craft an evidence JSON with one decisive rule that has commands
    // (Pass 1), one verification-gap rule (Pass 2), and mechanical
    // frontmatter sources for Pass 3.
    fs.writeFileSync(
      evidence,
      JSON.stringify(
        {
          spec_source: null,
          assessment_started_at: '2025-02-01T09:00:00Z',
          target: {
            audited_commit: 'deadbeef',
          },
          github_api: {
            active_login: 'audit-bot',
            token_tier: 'audit_read_only',
            scopes_observed: ['read:org', 'public_repo', 'security_events'],
            auth_status_excerpt:
              'gh api user login=audit-bot\nToken scopes: read:org, public_repo, security_events',
          },
          rules: {
            'ci-gates': {
              spec_rule_name: 'CI Gates',
              applicability: { verdict: 'applicable', trigger_evidence: 'default branch: main' },
              commands: [
                {
                  cmd: 'gh api repos/example/repo/rules/branches/main',
                  cwd: '.',
                  exit_code: 0,
                  stdout_excerpt: 'required_status_checks: Unit Tests',
                },
              ],
              derived_status: 'Fulfilled',
              derivation_reason: '1 required status check: Unit Tests',
              judgment_required: false,
              aic_ids: [
                'AIC-ci-guardrail-suite',
                'AIC-ci-pinned-toolchain',
                'AIC-protected-branch-status-checks',
              ],
            },
            'env-template': {
              spec_rule_name: 'Env Template',
              applicability: { verdict: 'applicable', trigger_evidence: 'test profile precedence' },
              commands: [],
              derived_status: 'Alarm',
              derivation_reason: 'Machine evidence proves env template applies and is missing.',
              judgment_required: false,
              aic_ids: ['AIC-env-example-placeholders'],
            },
            'lockfile-integrity': {
              spec_rule_name: 'Lockfile Integrity',
              applicability: {
                verdict: 'applicable',
                trigger_evidence: 'lockfiles found: package-lock.json',
              },
              commands: [
                {
                  cmd: 'npm ci --dry-run',
                  cwd: '.',
                  exit_code: 0,
                  stdout_excerpt: 'up to date in 0s',
                },
                {
                  cmd: 'cat package-lock.json | head',
                  cwd: '.',
                  exit_code: 0,
                  stdout_excerpt: '{\n  "lockfileVersion": 3',
                },
              ],
              derived_status: 'Fulfilled',
              derivation_reason: 'Lockfile pinned and CI verifies it.',
              judgment_required: false,
              aic_ids: ['AIC-lockfile-integrity-hashes'],
            },
            'branch-protection': {
              spec_rule_name: 'Branch Protection',
              applicability: { verdict: 'applicable', trigger_evidence: 'default branch: main' },
              commands: [],
              derived_status: null,
              derivation_reason: 'no host API access; recorded as Verification gap',
              judgment_required: true,
              aic_ids: ['AIC-branch-protection'],
            },
          },
          profile: {
            path: '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md',
            present: true,
            default_policy: 'owner_profile',
            answers: [
              {
                question_id: 'env-required',
                question: 'Apply environment-variable template checks?',
                answer: 'no',
                owner_evidence: 'Owner says no env vars, but machine evidence wins.',
                evidence_kind: 'owner_attestation',
                evidence_use: 'applicability',
                affected_aic_ids: ['AIC-env-example-placeholders'],
                source_line: 10,
              },
              {
                question_id: 'persistence-layer',
                question: 'Apply database schema and persistence-layer checks?',
                answer: 'no',
                owner_evidence: 'No database schema or persistence layer.',
                evidence_kind: 'owner_attestation',
                evidence_use: 'applicability',
                affected_aic_ids: ['AIC-data-integrity-constraints'],
                source_line: 13,
              },
            ],
            warnings: [],
            errors: [],
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(tmp2, 'AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json'),
      JSON.stringify(
        {
          $schema_version: '1',
          spec_source:
            'https://github.com/ai-contributors/ai-contributor-spec/tree/0123456789abcdef0123456789abcdef01234567',
        },
        null,
        2,
      ),
    );
    const stampArgs = [
      checklist,
      auditLog,
      '--summary',
      summary,
      '--auditor',
      'Test Bot',
      '--runner-agent',
      'claude-code',
      '--runner-model',
      'claude-opus-4-7',
    ];

    const checklistBeforeDiff = read(checklist);
    const auditBeforeDiff = read(auditLog);
    const dryRun = runStamper([...stampArgs, '--diff']);
    if (dryRun.exitCode !== 0) {
      failed++;
      console.error('FAIL --diff exit code', dryRun.exitCode);
      console.error('  stderr:', dryRun.stderr);
    } else if (!dryRun.stdout.includes('AI-CONTRIBUTOR-CHECKLIST.md')) {
      failed++;
      console.error('FAIL --diff did not print a checklist diff');
      console.error(dryRun.stdout);
    } else if (read(checklist) !== checklistBeforeDiff || read(auditLog) !== auditBeforeDiff) {
      failed++;
      console.error('FAIL --diff mutated input files');
    } else {
      console.log('OK   --diff prints changes without mutating files');
    }

    const r1 = runStamper(stampArgs);
    if (r1.exitCode !== 0) {
      failed++;
      console.error('FAIL passes run 1', r1.stderr);
    } else {
      console.log('OK   passes run 1 exit 0');
    }

    const auditAfter1 = read(auditLog);
    const checklistAfter1 = read(checklist);
    const summaryAfter1 = read(summary);

    // Pass 1 — at least one stamped collector row. Note: the surrounding
    // prose mentions the BEGIN/END marker names inside backticks, so match
    // the markers anchored to the start of a line.
    const collectorBlock = auditAfter1.match(
      /^<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->([\s\S]*?)^<!-- END:STAMPED-COLLECTOR-ROWS -->/m,
    );
    if (
      !collectorBlock ||
      !/\| `AIC-lockfile-integrity-hashes` \| `Lockfile Integrity` \|/.test(collectorBlock[1])
    ) {
      failed++;
      console.error('FAIL Pass 1: no stamped collector row found');
      console.error(collectorBlock?.[1] ?? '(no marker block)');
    } else {
      const cnt = (collectorBlock[1].match(/^\|/gm) || []).length;
      console.log(`OK   Pass 1 stamped ${cnt} collector row(s)`);
    }
    const collectLine = collectorBlock?.[1].indexOf('audit-collect.ts') ?? -1;
    const authLine = collectorBlock?.[1].indexOf('`gh api user --jq .login`') ?? -1;
    const hostedLine =
      collectorBlock?.[1].indexOf('`gh api repos/example/repo/rules/branches/main`') ?? -1;
    if (
      collectLine === -1 ||
      authLine === -1 ||
      hostedLine === -1 ||
      collectLine > authLine ||
      authLine > hostedLine
    ) {
      failed++;
      console.error('FAIL Pass 1: collector/auth/hosted evidence rows were not ordered correctly');
      console.error(collectorBlock?.[1] ?? '(no marker block)');
    } else {
      console.log('OK   Pass 1 orders collector, GitHub auth, then hosted API evidence');
    }
    if (
      !/\| `MUST`\s+\| `Lockfile Integrity`\s+\| x\s+\| ✅ Fulfilled\s+\| Mechanical \(collector-derived\) from `\.ai-contributor-audit\/AI-CONTRIBUTOR-EVIDENCE\.json`/.test(
        checklistAfter1,
      )
    ) {
      failed++;
      console.error('FAIL Pass 1: collector-derived checklist row did not get A=x');
    } else {
      console.log('OK   Pass 1 marked collector-derived checklist row as A=x');
    }
    if (
      !/\| `MUST when applicable`\s+\| `Env Template`\s+\| x\s+\| 🚨 Alarm\s+\| Mechanical \(collector-derived\) from `\.ai-contributor-audit\/AI-CONTRIBUTOR-EVIDENCE\.json`/.test(
        checklistAfter1,
      )
    ) {
      failed++;
      console.error('FAIL Pass 1: decisive collector evidence did not outrank owner profile no');
    } else {
      console.log('OK   Pass 1 keeps profile decisions below decisive collector evidence');
    }
    if (
      !/\| `MUST when applicable`\s+\| `Data Integrity Constraints`\s+\| x\s+\| ➖ Not relevant\s+\| Owner profile: `\.ai-contributor-audit\/AI-CONTRIBUTOR-AUDIT-PROFILE\.md` answers "no" to "Apply database schema and persistence-layer checks\?", so this check is not applicable\. Profile evidence: "No database schema or persistence layer\."/.test(
        checklistAfter1,
      )
    ) {
      failed++;
      console.error(
        'FAIL Pass 1: profile no did not stamp Data Integrity Constraints as Not relevant',
      );
    } else {
      console.log('OK   Pass 1 stamps profile-driven Not relevant rows');
    }
    if (
      !summaryAfter1.includes('[`AI-CONTRIBUTOR-CHECKLIST.md`](AI-CONTRIBUTOR-CHECKLIST.md)') ||
      !summaryAfter1.includes('[`AI-CONTRIBUTOR-AUDIT-LOG.md`](AI-CONTRIBUTOR-AUDIT-LOG.md)') ||
      !summaryAfter1.includes('[`AI-CONTRIBUTOR-EVIDENCE.json`](AI-CONTRIBUTOR-EVIDENCE.json)') ||
      !summaryAfter1.includes(
        '[`AI-CONTRIBUTOR-AUDIT-PROFILE.md`](AI-CONTRIBUTOR-AUDIT-PROFILE.md)',
      )
    ) {
      failed++;
      console.error('FAIL Pass 1: root summary does not link every audit artifact');
    } else {
      console.log('OK   Pass 1 links checklist, log, evidence, and profile artifacts');
    }

    // Pass 2 — verification gap row for branch protection.
    const gapsBlock = checklistAfter1.match(
      /<!-- BEGIN:STAMPED-VERIFICATION-GAPS -->([\s\S]*?)<!-- END:STAMPED-VERIFICATION-GAPS -->/,
    );
    if (
      !gapsBlock ||
      !/Branch Protection/.test(gapsBlock[1]) ||
      !/Verification gap/.test(gapsBlock[1])
    ) {
      failed++;
      console.error('FAIL Pass 2: no verification-gap row');
      console.error(gapsBlock?.[1] ?? '(no marker block)');
    } else {
      const cnt = (gapsBlock[1].match(/^\|/gm) || []).length;
      console.log(`OK   Pass 2 stamped ${cnt} verification-gap row(s)`);
    }

    // Pass 3 — mechanical frontmatter stamping + cross-file equality.
    const fmAudit = auditAfter1;
    const fmChecklist = checklistAfter1;
    const checks: [string, string][] = [
      [
        'spec_source',
        'https://github.com/ai-contributors/ai-contributor-spec/tree/0123456789abcdef0123456789abcdef01234567',
      ],
      ['audited_commit', 'deadbeef'],
      ['auditor', 'Test Bot'],
      ['runner_agent', 'claude-code'],
      ['runner_model', 'claude-opus-4-7'],
    ];
    let propagated = 0;
    for (const [key, val] of checks) {
      // Match `key: value` at start of line, allowing trailing inline comment.
      const escapedVal = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${key}:\\s+${escapedVal}(?:\\s|$)`, 'm');
      if (re.test(fmAudit) && re.test(fmChecklist)) propagated++;
      else {
        failed++;
        console.error(`FAIL Pass 3: frontmatter pair missing ${key}=${val}`);
      }
    }
    if (propagated === checks.length) console.log(`OK   Pass 3 propagated ${propagated} field(s)`);

    const noisyFrontmatter = [
      ...frontmatterCommentLines(fmChecklist),
      ...frontmatterCommentLines(fmAudit),
    ];
    if (noisyFrontmatter.length) {
      failed++;
      console.error('FAIL Pass 3: populated frontmatter retained template comments');
      console.error(noisyFrontmatter.join('\n'));
    } else {
      console.log('OK   Pass 3 stripped populated frontmatter comments');
    }

    // Idempotency.
    const r2 = runStamper(stampArgs);
    if (r2.exitCode !== 0) {
      failed++;
      console.error('FAIL passes run 2', r2.stderr);
    }
    const auditAfter2 = read(auditLog);
    const checklistAfter2 = read(checklist);
    const checklistDiff = diffIgnoringTimestampTriplet(checklistAfter1, checklistAfter2);
    if (checklistDiff !== null) {
      failed++;
      console.error('FAIL Pass 2 not idempotent (checklist drifted):', checklistDiff);
    } else {
      console.log('OK   passes idempotent (checklist)');
    }
    const diff = diffIgnoringTimestampTriplet(auditAfter1, auditAfter2);
    if (diff !== null) {
      failed++;
      console.error('FAIL Pass 1/3 not idempotent (audit log drifted):', diff);
    } else {
      console.log('OK   passes idempotent (audit log)');
    }

    const handEdited = read(auditLog).replace('up to date in 0s', 'manually edited excerpt');
    fs.writeFileSync(auditLog, handEdited);
    const r3 = runStamper(stampArgs);
    if (r3.exitCode !== 1 || !/checksum mismatch/.test(r3.stderr)) {
      failed++;
      console.error('FAIL stamped-block checksum did not catch hand edit');
      console.error('  exit:', r3.exitCode);
      console.error('  stderr:', r3.stderr);
    } else {
      console.log('OK   stamped-block checksum catches hand edits');
    }
  } finally {
    fs.rmSync(tmp2, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-stamp smoke check(s) failed`);
  process.exit(1);
}
console.log('All audit-stamp smoke checks passed');

function diffIgnoringTimestampTriplet(a: string, b: string): string | null {
  const stripTriplet = (s: string) =>
    s
      .replace(/^assessment_completed_at:.*$/m, 'assessment_completed_at: <stamped>')
      .replace(/^assessment_duration:.*$/m, 'assessment_duration: <stamped>')
      .replace(/^assessment_started_at:.*$/m, 'assessment_started_at: <stamped>');
  const sa = stripTriplet(a);
  const sb = stripTriplet(b);
  if (sa === sb) return null;
  // Return a short hint of where they diverge.
  const aLines = sa.split('\n');
  const bLines = sb.split('\n');
  for (let i = 0; i < Math.max(aLines.length, bLines.length); i++) {
    if (aLines[i] !== bLines[i]) {
      return `  line ${i + 1}:\n    a: ${JSON.stringify(aLines[i] ?? '<EOF>')}\n    b: ${JSON.stringify(bLines[i] ?? '<EOF>')}`;
    }
  }
  return '  (whole-file diff)';
}

function frontmatterCommentLines(s: string): string[] {
  const keys = new Set([
    'spec_source',
    'assessment_started_at',
    'assessment_completed_at',
    'assessment_duration',
    'audited_commit',
    'auditor',
    'validator_version',
    'collector_version',
    'runner_agent',
    'runner_model',
    'conformance_level',
  ]);
  const lines = s.split(/\r?\n/);
  const out: string[] = [];
  if (lines[0] !== '---') return out;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') break;
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/);
    if (!m || !keys.has(m[1])) continue;
    const value = m[2].split('#')[0]?.trim() ?? '';
    if (value !== '' && /#/.test(m[2])) out.push(lines[i]);
  }
  return out;
}

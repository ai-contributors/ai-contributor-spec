#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Imports audit-validate.ts directly and asserts the expected outcome
// against every fixture. Each invalid fixture asserts at least one expected
// AUDIT* code so failures stay stable as the validator evolves.

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { runValidator } from '../../skills/ai-contributor-audit/scripts/audit-validate.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, '..', 'test-fixtures', 'audit-validate');

interface Case {
  fixture: string;
  expectExit: 0 | 1;
  expectCodes?: string[];
  flags?: string[];
}

const CASES: Case[] = [
  { fixture: 'valid', expectExit: 0 },
  {
    fixture: 'frontmatter-mismatch',
    expectExit: 1,
    expectCodes: ['AUDIT005'],
  },
  {
    fixture: 'bad-duration',
    expectExit: 1,
    expectCodes: ['AUDIT009'],
  },
  {
    fixture: 'bad-backlog',
    expectExit: 1,
    expectCodes: ['AUDIT041'],
  },
  {
    fixture: 'bad-summary-level',
    expectExit: 1,
    expectCodes: ['AUDIT023'],
  },
  {
    fixture: 'missing-comment',
    expectExit: 1,
    expectCodes: ['AUDIT016'],
  },
  {
    fixture: 'placeholder-leftover',
    expectExit: 1,
    expectCodes: ['AUDIT052'],
  },
  {
    fixture: 'missing-audit-log-command',
    expectExit: 1,
    expectCodes: ['AUDIT036'],
  },
  {
    fixture: 'not-relevant-without-reason',
    expectExit: 1,
    expectCodes: ['AUDIT035'],
  },
  {
    fixture: 'fulfilled-without-evidence',
    expectExit: 1,
    expectCodes: ['AUDIT034'],
  },
  {
    fixture: 'warning-without-evidence',
    expectExit: 1,
    expectCodes: ['AUDIT034'],
  },
  {
    fixture: 'strict-level-violation',
    expectExit: 1,
    expectCodes: ['AUDIT026'],
  },
  {
    fixture: 'missing-token-disclosure',
    expectExit: 1,
    expectCodes: ['AUDIT038'],
  },
  {
    fixture: 'derived-fulfilled-without-evidence-artifact',
    expectExit: 1,
    expectCodes: ['AUDIT039'],
  },
  {
    fixture: 'mutable-spec-source',
    expectExit: 1,
    expectCodes: ['AUDIT007'],
  },
  {
    fixture: 'validator-version-mismatch',
    expectExit: 1,
    expectCodes: ['AUDIT018'],
  },
  {
    fixture: 'overstated-conformance',
    expectExit: 1,
    expectCodes: ['AUDIT026'],
  },
  {
    fixture: 'template-leftover',
    expectExit: 1,
    expectCodes: ['AUDIT053'],
  },
  {
    fixture: 'not-relevant-without-citation',
    expectExit: 1,
    expectCodes: ['AUDIT019'],
  },
];

let failed = 0;
for (const c of CASES) {
  const dir = path.join(FIX, c.fixture);
  // The validator is read-only by design (stamping moved to audit-stamp.ts),
  // so fixture runs cannot mutate the curated `assessment_*` timestamps —
  // no flag is needed to keep the working tree clean.
  const args = [
    path.join(dir, 'AI-CONTRIBUTOR-CHECKLIST.md'),
    path.join(dir, 'AI-CONTRIBUTOR-AUDIT-LOG.md'),
    '--summary',
    path.join(dir, 'AI-CONTRIBUTOR-CHECKLIST.md'),
    ...(c.flags ?? []),
  ];
  const result = runValidator(args);
  const ok = result.exitCode === c.expectExit;
  const codesOk = (c.expectCodes ?? []).every((code) => result.stderr.includes(code));
  if (!ok || !codesOk) {
    failed++;
    console.error(`FAIL ${c.fixture}`);
    console.error(`  expected exit=${c.expectExit}, got ${result.exitCode}`);
    if (c.expectCodes) {
      const missing = c.expectCodes.filter((code) => !result.stderr.includes(code));
      if (missing.length) console.error(`  missing codes: ${missing.join(', ')}`);
    }
    console.error('  --- stderr ---');
    console.error(result.stderr);
    console.error('  --- stdout ---');
    console.error(result.stdout);
  } else {
    console.log(`OK   ${c.fixture}`);
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-validate-manual-before-stamped-'));
  try {
    const src = path.join(FIX, 'valid');
    const checklist = path.join(tmp, 'AI-CONTRIBUTOR-CHECKLIST.md');
    const auditLog = path.join(tmp, 'AI-CONTRIBUTOR-AUDIT-LOG.md');
    fs.copyFileSync(path.join(src, 'AI-CONTRIBUTOR-CHECKLIST.md'), checklist);
    let log = fs.readFileSync(path.join(src, 'AI-CONTRIBUTOR-AUDIT-LOG.md'), 'utf8');
    log = log.replace(
      '|  | `<preflight>` | `npx tsx skills/ai-contributor-audit/scripts/audit-collect.ts . --commit abc1234` | `[audit-collect] wrote AI-CONTRIBUTOR-EVIDENCE.json — 13 rules; Fulfilled=2 Warning=2 Alarm=0 judgment_required=0 token_tier=audit_read_only` |',
      [
        '|  | `<preflight>` | `printf scope` | `scope inventory` |',
        '<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->',
        '|  | `<preflight>` | `npx tsx skills/ai-contributor-audit/scripts/audit-collect.ts . --commit abc1234` | `[audit-collect] wrote AI-CONTRIBUTOR-EVIDENCE.json — 13 rules; Fulfilled=2 Warning=2 Alarm=0 judgment_required=0 token_tier=audit_read_only` |',
        '<!-- END:STAMPED-COLLECTOR-ROWS -->',
      ].join('\n'),
    );
    fs.writeFileSync(auditLog, log);
    const result = runValidator([checklist, auditLog, '--summary', checklist]);
    if (
      result.exitCode !== 1 ||
      !result.stderr.includes('AUDIT030') ||
      !result.stderr.includes('Manual evidence rows must be below')
    ) {
      failed++;
      console.error('FAIL manual-row-before-stamped-block');
      console.error('  --- stderr ---');
      console.error(result.stderr);
    } else {
      console.log('OK   manual-row-before-stamped-block');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} fixture(s) failed`);
  process.exit(1);
}
console.log(`All ${CASES.length} fixtures passed`);

// ---------------------------------------------------------------------------
// Profile evidence fixtures. These are generated from the valid fixture so the
// profile-specific checks can vary only AI-CONTRIBUTOR-EVIDENCE.json and one
// modern checklist row.

interface ProfileCase {
  name: string;
  answer: string;
  affectedIds: string[];
  rowStatus: string;
  rowComment: string;
  rowMarker?: string;
  expectExit: 0 | 1;
  expectCodes?: string[];
}

const profileCases: ProfileCase[] = [
  {
    name: 'profile-yes',
    answer: 'yes',
    affectedIds: ['AIC-data-integrity-constraints'],
    rowStatus: '✅ Fulfilled',
    rowComment: 'README.md:1 — persistence controls reviewed.',
    expectExit: 0,
  },
  {
    name: 'profile-no',
    answer: 'no',
    affectedIds: ['AIC-data-integrity-constraints'],
    rowMarker: 'x',
    rowStatus: '➖ Not relevant',
    rowComment:
      'Owner profile: `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` answers "no" to "Apply database schema and persistence-layer checks?", so this check is not applicable. Profile evidence: "No database schema or persistence layer."',
    expectExit: 0,
  },
  {
    name: 'profile-blank',
    answer: '',
    affectedIds: ['AIC-data-integrity-constraints'],
    rowStatus: '✅ Fulfilled',
    rowComment: 'README.md:1 — persistence controls reviewed.',
    expectExit: 0,
  },
  {
    name: 'profile-invalid-answer',
    answer: 'maybe',
    affectedIds: ['AIC-data-integrity-constraints'],
    rowStatus: '✅ Fulfilled',
    rowComment: 'README.md:1 — persistence controls reviewed.',
    expectExit: 1,
    expectCodes: ['AUDIT063'],
  },
  {
    name: 'profile-unknown-affected-check',
    answer: 'yes',
    affectedIds: ['AIC-does-not-exist'],
    rowStatus: '✅ Fulfilled',
    rowComment: 'README.md:1 — persistence controls reviewed.',
    expectExit: 1,
    expectCodes: ['AUDIT063'],
  },
];

for (const c of profileCases) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `${c.name}-`));
  try {
    const checklist = path.join(tmp, 'AI-CONTRIBUTOR-CHECKLIST.md');
    const auditLog = path.join(tmp, 'AI-CONTRIBUTOR-AUDIT-LOG.md');
    fs.copyFileSync(path.join(FIX, 'valid', 'AI-CONTRIBUTOR-CHECKLIST.md'), checklist);
    fs.copyFileSync(path.join(FIX, 'valid', 'AI-CONTRIBUTOR-AUDIT-LOG.md'), auditLog);
    fs.appendFileSync(
      checklist,
      [
        '',
        '## Level 1 — Profile Fixture',
        '',
        '| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |',
        '|-------|------|---|--------|---------|-------------|--------|-----|',
        `| \`MUST when applicable\` | \`Data Integrity Constraints\` | ${c.rowMarker ?? '-'} | ${c.rowStatus} | ${c.rowComment} | **Triggered when:** the repository owns a database schema. **Requirement:** constraints exist. | 2 | \`AIC-data-integrity-constraints\` |`,
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json'),
      JSON.stringify(
        {
          assessment_started_at: '2026-04-25T10:00:00+02:00',
          profile: {
            path: '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md',
            present: true,
            default_policy: 'owner_profile',
            answers: [
              {
                question_id: 'persistence-layer',
                question: 'Apply database schema and persistence-layer checks?',
                answer: c.answer,
                owner_evidence: 'No database schema or persistence layer.',
                evidence_kind: 'owner_attestation',
                evidence_use: 'applicability',
                affected_aic_ids: c.affectedIds,
                source_line: 6,
              },
            ],
            warnings: [],
            errors: c.answer === 'maybe' ? ['line 6: invalid answer "maybe"'] : [],
          },
          rules: {},
        },
        null,
        2,
      ),
    );
    const result = runValidator([checklist, auditLog, '--summary', checklist]);
    const ok = result.exitCode === c.expectExit;
    const codesOk = (c.expectCodes ?? []).every((code) => result.stderr.includes(code));
    if (!ok || !codesOk) {
      failed++;
      console.error(`FAIL ${c.name}`);
      console.error(`  expected exit=${c.expectExit}, got ${result.exitCode}`);
      if (c.expectCodes) {
        const missing = c.expectCodes.filter((code) => !result.stderr.includes(code));
        if (missing.length) console.error(`  missing codes: ${missing.join(', ')}`);
      }
      console.error('  --- stderr ---');
      console.error(result.stderr);
      console.error('  --- stdout ---');
      console.error(result.stdout);
    } else {
      console.log(`OK   ${c.name}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} fixture(s) failed`);
  process.exit(1);
}
console.log(`All ${profileCases.length} profile fixtures passed`);

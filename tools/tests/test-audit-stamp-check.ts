#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Tests for audit-stamp.ts CLI surface added in the recent batch:
//   - --check (clean/dirty exit codes, mutual exclusion with --diff)
//   - [audit-stamp] needs-evidence advisory (Warning/Alarm without citation)
//   - [audit-stamp] needs-status advisory (non-optional row with empty Status)
// The happy-path stamper run is covered by test-audit-stamp.ts.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStamper } from '../../skills/ai-contributor-audit/scripts/audit-stamp.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, '..', 'test-fixtures', 'audit-validate', 'valid');

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function fail(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

function makeFixture(): {
  checklist: string;
  auditLog: string;
  summary: string;
  evidence: string;
  cleanup: () => void;
} {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-stamp-check-test-'));
  const checklist = path.join(tmp, 'AI-CONTRIBUTOR-CHECKLIST.md');
  const auditLog = path.join(tmp, 'AI-CONTRIBUTOR-AUDIT-LOG.md');
  const summary = path.join(tmp, 'AI-CONTRIBUTOR-AUDIT.md');
  const evidence = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
  fs.copyFileSync(path.join(FIXTURE, 'AI-CONTRIBUTOR-CHECKLIST.md'), checklist);
  fs.copyFileSync(path.join(FIXTURE, 'AI-CONTRIBUTOR-AUDIT-LOG.md'), auditLog);
  fs.copyFileSync(path.resolve(HERE, '..', '..', 'AI-CONTRIBUTOR-AUDIT.md'), summary);
  fs.writeFileSync(
    evidence,
    JSON.stringify(
      {
        assessment_started_at: '2025-01-15T10:00:00Z',
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
  return {
    checklist,
    auditLog,
    summary,
    evidence,
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

// --- 1. --diff and --check are mutually exclusive ----------------------

{
  const f = makeFixture();
  try {
    const r = runStamper([f.checklist, f.auditLog, '--summary', f.summary, '--diff', '--check']);
    if (r.exitCode === 2 && r.stderr.includes('mutually exclusive')) {
      ok('--diff and --check rejected together (exit 2)');
    } else {
      fail('--diff --check mutual exclusion', `exit=${r.exitCode} stderr=${r.stderr}`);
    }
  } finally {
    f.cleanup();
  }
}

// --- 2. --check on freshly-fixed artifacts: stamp once, re-run --check
//        should report no changes (exit 0) thanks to timestamp normalization.

{
  const f = makeFixture();
  try {
    const stamp = runStamper([f.checklist, f.auditLog, '--summary', f.summary]);
    if (stamp.exitCode !== 0) {
      fail('initial stamp', stamp.stderr);
    }

    // Wait briefly to guarantee that wall-clock-derived completed_at would
    // change if the comparison were not normalized. 1 second is enough
    // because the duration formatter rounds to seconds.
    const start = Date.now();
    while (Date.now() - start < 1100) {
      // busy-wait keeps the test deterministic
    }

    const check = runStamper([f.checklist, f.auditLog, '--summary', f.summary, '--check']);
    if (check.exitCode === 0 && /audit-stamp --check: no changes/.test(check.stdout)) {
      ok('--check on already-stamped artifacts: exit 0, no-changes line');
    } else {
      fail(
        '--check clean',
        `exit=${check.exitCode}\nstdout=${check.stdout}\nstderr=${check.stderr}`,
      );
    }
  } finally {
    f.cleanup();
  }
}

// --- 3. --check after a hand-edit: exit 3 with the file listed.

{
  const f = makeFixture();
  try {
    const stamp = runStamper([f.checklist, f.auditLog, '--summary', f.summary]);
    if (stamp.exitCode !== 0) fail('initial stamp', stamp.stderr);

    // Mutate a stamped value the stamper would re-derive (conformance_level
    // is one of the cells the stamper owns; setting it to a bogus value
    // should make --check report drift on the checklist).
    const original = fs.readFileSync(f.checklist, 'utf8');
    fs.writeFileSync(
      f.checklist,
      original.replace(/conformance_level: [0-9a-z]+/, 'conformance_level: 9'),
    );

    const check = runStamper([f.checklist, f.auditLog, '--summary', f.summary, '--check']);
    if (
      check.exitCode === 3 &&
      /audit-stamp --check:.*would be rewritten/.test(check.stdout) &&
      check.stdout.includes(f.checklist)
    ) {
      ok('--check after hand-edit: exit 3, lists the dirty file');
    } else {
      fail(
        '--check dirty',
        `exit=${check.exitCode}\nstdout=${check.stdout}\nstderr=${check.stderr}`,
      );
    }
  } finally {
    f.cleanup();
  }
}

// --- 4. needs-evidence advisory: rewrite a Warning row's Comment to text
//        without any backticked file/path/command citation, then stamp;
//        stderr should carry the [audit-stamp] needs-evidence header.

{
  const f = makeFixture();
  try {
    // Mutate the `Mock Mode` Warning row's Comment cell from one with a
    // backticked file:line citation to plain prose with no citation.
    const text = fs.readFileSync(f.checklist, 'utf8');
    const next = text.replace(
      /(\| `SHOULD` \| `Mock Mode` \| [^|]+ \| ⚠️ Warning \| )[^|]+( \| The project offers a safe local mode)/,
      '$1this row has no backticked citation in its Comment$2',
    );
    if (next === text) {
      fail('needs-evidence advisory', 'fixture row did not match expected shape');
    } else {
      fs.writeFileSync(f.checklist, next);
      const r = runStamper([f.checklist, f.auditLog, '--summary', f.summary]);
      if (
        r.exitCode === 0 &&
        /\[audit-stamp\] needs-evidence/.test(r.stderr) &&
        /Mock Mode/.test(r.stderr)
      ) {
        ok('needs-evidence advisory fires for Warning row without backticked citation');
      } else {
        fail('needs-evidence advisory', `exit=${r.exitCode}\nstderr=${r.stderr}`);
      }
    }
  } finally {
    f.cleanup();
  }
}

// --- 4b. --diff exit 1 path: malformed evidence JSON makes runStampPasses
//         return an error; --diff returns exit 1 with the error on stderr.

{
  const f = makeFixture();
  try {
    fs.writeFileSync(f.evidence, '{ this is not valid JSON');
    const r = runStamper([f.checklist, f.auditLog, '--summary', f.summary, '--diff']);
    if (r.exitCode === 1 && /evidence/i.test(r.stderr)) {
      ok('--diff with malformed evidence -> exit 1 with helpful stderr');
    } else {
      fail('--diff malformed evidence', `exit=${r.exitCode}\nstderr=${r.stderr}`);
    }
  } finally {
    f.cleanup();
  }
}

// --- 4c. --check exit 1 path: same malformed-evidence trap.

{
  const f = makeFixture();
  try {
    fs.writeFileSync(f.evidence, '{ this is not valid JSON');
    const r = runStamper([f.checklist, f.auditLog, '--summary', f.summary, '--check']);
    if (r.exitCode === 1 && /evidence/i.test(r.stderr)) {
      ok('--check with malformed evidence -> exit 1 with helpful stderr');
    } else {
      fail('--check malformed evidence', `exit=${r.exitCode}\nstderr=${r.stderr}`);
    }
  } finally {
    f.cleanup();
  }
}

// --- 4d. unknown flag -> exit 2 with helpful stderr.

{
  const f = makeFixture();
  try {
    const r = runStamper([f.checklist, f.auditLog, '--mystery']);
    if (r.exitCode === 2 && /unknown flag/.test(r.stderr)) {
      ok('unknown flag -> exit 2');
    } else {
      fail('unknown flag', `exit=${r.exitCode}\nstderr=${r.stderr}`);
    }
  } finally {
    f.cleanup();
  }
}

// --- 4e. wrong number of positionals -> exit 2 with usage.

{
  const r = runStamper(['only-one']);
  if (r.exitCode === 2 && /Usage: audit-stamp/.test(r.stderr)) {
    ok('one positional -> exit 2 with usage');
  } else {
    fail('positionals count', `exit=${r.exitCode}\nstderr=${r.stderr}`);
  }
}

// --- 4g. --check when the summary path does not exist yet: stamper
//        creates the comparison baseline as empty, exits 3 (drift).

{
  const f = makeFixture();
  try {
    // Stamp populates summary, then we delete it to exercise the
    // `summaryExisted ? copy : write('')` branch in --check.
    runStamper([f.checklist, f.auditLog, '--summary', f.summary]);
    fs.unlinkSync(f.summary);
    const r = runStamper([f.checklist, f.auditLog, '--summary', f.summary, '--check']);
    if (r.exitCode === 3 && /would be rewritten/.test(r.stdout)) {
      ok('--check with absent summary baseline -> exit 3, drift reported');
    } else {
      fail('--check absent summary', `exit=${r.exitCode}\nstdout=${r.stdout}`);
    }
  } finally {
    f.cleanup();
  }
}

// --- 4h. --diff when the summary path does not exist yet: stamper still
//        reports the diff cleanly, exit 0.

{
  const f = makeFixture();
  try {
    runStamper([f.checklist, f.auditLog, '--summary', f.summary]);
    fs.unlinkSync(f.summary);
    const r = runStamper([f.checklist, f.auditLog, '--summary', f.summary, '--diff']);
    if (r.exitCode === 0) {
      ok('--diff with absent summary baseline -> exit 0');
    } else {
      fail('--diff absent summary', `exit=${r.exitCode}\nstderr=${r.stderr}`);
    }
  } finally {
    f.cleanup();
  }
}

// --- 4f. missing input file -> exit 1 with cannot-read message.

{
  const r = runStamper(['/tmp/does-not-exist.md', '/tmp/also-not.md']);
  if (r.exitCode === 1 && /cannot read|does not exist/.test(r.stderr)) {
    ok('missing input file -> exit 1');
  } else {
    fail('missing input', `exit=${r.exitCode}\nstderr=${r.stderr}`);
  }
}

// --- 5. needs-status advisory: stamp the fresh fixture; the valid fixture
//        has many non-optional rows still blank, so the advisory should fire.

{
  const f = makeFixture();
  try {
    const r = runStamper([f.checklist, f.auditLog, '--summary', f.summary]);
    if (r.exitCode !== 0) fail('stamp for needs-status', r.stderr);
    if (/\[audit-stamp\] needs-status:/.test(r.stderr)) {
      ok('needs-status advisory fires when non-optional rows have empty Status');
    } else {
      // The "valid" fixture may already have all rows filled. In that case
      // we manually clear one Status cell and re-run.
      const text = fs.readFileSync(f.checklist, 'utf8');
      const next = text.replace(/✅ Fulfilled/, '');
      if (next !== text) {
        fs.writeFileSync(f.checklist, next);
        const r2 = runStamper([f.checklist, f.auditLog, '--summary', f.summary]);
        if (/\[audit-stamp\] needs-status:/.test(r2.stderr)) {
          ok('needs-status advisory fires after blanking a row Status');
        } else {
          fail('needs-status advisory', `stderr=${r2.stderr}`);
        }
      } else {
        fail('needs-status advisory', 'fixture had no Fulfilled rows to clear');
      }
    }
  } finally {
    f.cleanup();
  }
}

if (failed > 0) {
  console.error(`${failed} audit-stamp --check / advisory test(s) failed`);
  process.exit(1);
}
console.log('All audit-stamp --check / advisory tests passed');

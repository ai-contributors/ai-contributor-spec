#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for bootstrap.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  run,
  initRepo,
  runCollect,
  type GhaTestEvidence,
  REPO_ROOT,
} from './audit-collect-test-utils.ts';

let failed = 0;

// bootstrap-smoke: default run does NOT invoke the package; rule is auditor-owned.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-bootstrap-default-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'evid.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'fixture', scripts: { build: 'echo build' } }),
    );
    fs.writeFileSync(path.join(target, 'package-lock.json'), '{"lockfileVersion":3}\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'b'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      bootstrap_smoke?: { enabled: boolean; ran: boolean; steps: unknown[] };
    };
    const r = ev.rules ?? {};
    if (ev.bootstrap_smoke?.enabled !== false || ev.bootstrap_smoke?.ran !== false) {
      failed++;
      console.error(
        `FAIL default run invoked bootstrap-smoke: ${JSON.stringify(ev.bootstrap_smoke)}`,
      );
    } else if (ev.bootstrap_smoke?.steps?.length !== 0) {
      failed++;
      console.error(
        `FAIL default run captured bootstrap steps: ${JSON.stringify(ev.bootstrap_smoke?.steps)}`,
      );
    } else if (
      r['clean-clone-bootstrap']?.derived_status !== null ||
      r['clean-clone-bootstrap']?.judgment_required !== true
    ) {
      failed++;
      console.error(
        `FAIL default run did not leave clean-clone-bootstrap auditor-owned: ${JSON.stringify(r['clean-clone-bootstrap'])}`,
      );
    } else if (
      !r['clean-clone-bootstrap']?.derivation_reason?.includes('--enable-bootstrap-smoke')
    ) {
      failed++;
      console.error(
        `FAIL clean-clone-bootstrap reason did not document the opt-in flag: ${r['clean-clone-bootstrap']?.derivation_reason}`,
      );
    } else {
      console.log(
        'OK   default audit run does not invoke bootstrap-smoke; rule remains auditor-owned with documented reason',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// bootstrap-smoke opt-in: trivial install + build → Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-bootstrap-opt-in-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'evid.json');
    initRepo(target);
    fs.mkdirSync(fakeBin);
    // No-op npm shim: handles `--version`, `ci`, and `run build` with exit 0.
    fs.writeFileSync(
      path.join(fakeBin, 'npm'),
      `#!/usr/bin/env bash
case "$*" in
  "--version") echo "10.0.0" ;;
  "ci --ignore-scripts") echo "installed (shim)" ;;
  "run build") echo "built (shim)" ;;
  *) echo "unhandled: $*" >&2; exit 0 ;;
esac
`,
      { mode: 0o755 },
    );
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'fixture', scripts: { build: 'echo build' } }),
    );
    fs.writeFileSync(path.join(target, 'package-lock.json'), '{"lockfileVersion":3}\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'b'],
      target,
    );
    const env = { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` };
    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
        '--enable-bootstrap-smoke',
      ],
      REPO_ROOT,
      env,
    );
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      bootstrap_smoke?: {
        enabled: boolean;
        ran: boolean;
        steps: Array<{ label: string; exit_code: number | null }>;
      };
    };
    const r = ev.rules ?? {};
    if (ev.bootstrap_smoke?.enabled !== true || ev.bootstrap_smoke?.ran !== true) {
      failed++;
      console.error(
        `FAIL opt-in did not run bootstrap-smoke: ${JSON.stringify(ev.bootstrap_smoke)}`,
      );
    } else if (ev.bootstrap_smoke?.steps?.length !== 2) {
      failed++;
      console.error(
        `FAIL bootstrap-smoke did not capture install + build steps: ${JSON.stringify(ev.bootstrap_smoke?.steps)}`,
      );
    } else if (r['clean-clone-bootstrap']?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL opt-in clean install + build not Fulfilled: ${JSON.stringify(r['clean-clone-bootstrap'])}`,
      );
    } else {
      console.log(
        'OK   --enable-bootstrap-smoke runs install + build in a clean clone; clean-clone-bootstrap Fulfilled',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// bootstrap-smoke opt-in: failing install → Alarm.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-bootstrap-fail-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'evid.json');
    initRepo(target);
    fs.mkdirSync(fakeBin);
    fs.writeFileSync(
      path.join(fakeBin, 'npm'),
      `#!/usr/bin/env bash
case "$*" in
  "--version") echo "10.0.0" ;;
  "ci --ignore-scripts") echo "broken" >&2; exit 7 ;;
  *) echo "unhandled: $*" >&2; exit 0 ;;
esac
`,
      { mode: 0o755 },
    );
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'fixture', scripts: { build: 'echo build' } }),
    );
    fs.writeFileSync(path.join(target, 'package-lock.json'), '{"lockfileVersion":3}\n');
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'b'],
      target,
    );
    const env = { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` };
    const r = spawnSync(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
        '--enable-bootstrap-smoke',
      ],
      { cwd: REPO_ROOT, env, encoding: 'utf8' },
    );
    if (r.status === 0) {
      // Collector treats per-rule failures as exit 3 (partial) but rule-level
      // Alarms don't change exit code; tolerate either.
    }
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      bootstrap_smoke?: { steps: Array<{ exit_code: number | null }> };
    };
    const rr = ev.rules ?? {};
    if (rr['clean-clone-bootstrap']?.derived_status !== 'Alarm') {
      failed++;
      console.error(
        `FAIL failing install did not Alarm: ${JSON.stringify(rr['clean-clone-bootstrap'])}`,
      );
    } else if (ev.bootstrap_smoke?.steps?.[0]?.exit_code !== 7) {
      failed++;
      console.error(
        `FAIL bootstrap-smoke did not record failing exit code: ${JSON.stringify(ev.bootstrap_smoke?.steps)}`,
      );
    } else {
      console.log('OK   failing install in clean-clone bootstrap → Alarm with captured exit code');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-collect test(s) failed`);
  process.exit(1);
}
console.log('All audit-collect tests passed');

if (failed > 0) {
  console.error(`${failed} audit-collect test(s) failed`);
  process.exit(1);
}
console.log('All audit-collect tests passed');

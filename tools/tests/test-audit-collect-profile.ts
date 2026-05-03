#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for profile.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  run,
  runStatus,
  commandDir,
  initRepo,
  writeProfile,
  REPO_ROOT,
} from './audit-collect-test-utils.ts';

let failed = 0;

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-profile-missing-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);

    const noPnpmEnv = {
      ...process.env,
      PATH: [
        path.join(REPO_ROOT, 'tools', 'node_modules', '.bin'),
        path.dirname(process.execPath),
        commandDir('git'),
      ].join(path.delimiter),
    };
    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
      noPnpmEnv,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      profile?: {
        present?: boolean;
        default_policy?: string;
        answers?: Array<{ answer?: string; evidence_kind?: string }>;
      };
      preflight?: {
        executor?: {
          package?: string;
          version?: string;
          pin?: string;
          pin_kind?: string;
          invocation?: string;
          node_version?: string;
          entrypoint?: string;
        };
      };
    };
    const answers = evidence.profile?.answers ?? [];
    if (evidence.profile?.present !== false) {
      failed++;
      console.error('FAIL missing profile was not recorded as absent');
    } else if (evidence.profile?.default_policy !== 'all_checks_on_when_missing') {
      failed++;
      console.error('FAIL missing profile did not record all-checks-on default policy');
    } else if (
      answers.length === 0 ||
      answers.some((a) => a.answer !== 'yes' || a.evidence_kind !== 'collector_default')
    ) {
      failed++;
      console.error('FAIL missing profile did not emit collector-default yes answers');
    } else {
      console.log('OK   missing profile defaults all profile-controlled checks on');
    }
    const executor = evidence.preflight?.executor;
    if (
      executor?.package !== 'tsx' ||
      executor.version !== '4.21.0' ||
      executor.pin !== 'tsx@4.21.0' ||
      executor.pin_kind !== 'npm-exact-version' ||
      executor.invocation !== 'npx --yes tsx@4.21.0' ||
      !executor.node_version?.startsWith('v') ||
      executor.entrypoint !== 'audit-collect.ts'
    ) {
      failed++;
      console.error(`FAIL executor metadata not recorded as expected: ${JSON.stringify(executor)}`);
    } else {
      console.log('OK   executor metadata records pinned tsx package');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-profile-valid-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeProfile(target, 'no');

    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      profile?: {
        present?: boolean;
        answers?: Array<{ question_id?: string; answer?: string; affected_aic_ids?: string[] }>;
        errors?: string[];
      };
    };
    const first = evidence.profile?.answers?.find((a) => a.question_id === 'env-required');
    if (
      !evidence.profile?.present ||
      first?.answer !== 'no' ||
      first.affected_aic_ids?.[0] !== 'AIC-env-example-placeholders'
    ) {
      failed++;
      console.error('FAIL profile answers were not recorded in evidence JSON');
    } else if ((evidence.profile.errors ?? []).length > 0) {
      failed++;
      console.error('FAIL valid profile produced profile errors');
    } else {
      console.log('OK   profile answers are recorded in evidence JSON');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-profile-empty-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeProfile(target, '');

    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      profile?: {
        present?: boolean;
        default_policy?: string;
        answers?: Array<{ answer?: string; evidence_kind?: string }>;
        warnings?: string[];
      };
    };
    const answers = evidence.profile?.answers ?? [];
    if (evidence.profile?.present !== true) {
      failed++;
      console.error('FAIL empty profile was not recorded as present');
    } else if (evidence.profile?.default_policy !== 'all_checks_on_when_empty') {
      failed++;
      console.error('FAIL empty profile did not record all-checks-on default policy');
    } else if (
      answers.length === 0 ||
      answers.some((a) => a.answer !== 'yes' || a.evidence_kind !== 'collector_default')
    ) {
      failed++;
      console.error('FAIL empty profile did not emit collector-default yes answers');
    } else if (!evidence.profile.warnings?.some((w) => w.includes('no explicit yes/no answers'))) {
      failed++;
      console.error('FAIL empty profile did not warn about missing explicit answers');
    } else {
      console.log('OK   empty profile defaults all profile-controlled checks on');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-profile-invalid-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeProfile(target, 'maybe');

    const r = runStatus(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      profile?: { errors?: string[] };
      errors?: Array<{ stage?: string; detail?: string }>;
    };
    if (r.status !== 3) {
      failed++;
      console.error(`FAIL invalid profile answer exited ${r.status}, expected 3`);
    } else if (!evidence.profile?.errors?.some((e) => e.includes('invalid answer "maybe"'))) {
      failed++;
      console.error('FAIL invalid profile answer was not recorded under profile.errors');
    } else if (!evidence.errors?.some((e) => e.stage === 'profile')) {
      failed++;
      console.error('FAIL invalid profile answer was not recorded under collector errors');
    } else {
      console.log('OK   invalid profile answers produce collector errors');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-profile-bad-id-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    writeProfile(target, 'yes', '`Env Template` - `AIC-does-not-exist`');

    const r = runStatus(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      profile?: { errors?: string[]; warnings?: string[] };
    };
    if (r.status !== 3) {
      failed++;
      console.error(`FAIL unknown affected AIC ID exited ${r.status}, expected 3`);
    } else if (!evidence.profile?.errors?.some((e) => e.includes('AIC-does-not-exist'))) {
      failed++;
      console.error('FAIL unknown affected AIC ID was not recorded under profile.errors');
    } else {
      console.log('OK   profile affected IDs are validated');
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

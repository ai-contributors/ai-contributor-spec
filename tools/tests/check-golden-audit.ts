#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// check-golden-audit.ts — runs audit-collect.ts against the synthetic
// repo at examples/golden-audit/synthetic-repo/ and asserts that each
// rule's derived_status matches the curated expectation in
// examples/golden-audit/expected/derived-statuses.json.
//
// Why this exists: the comparability claim of this spec — "two agents
// auditing the same repo at the same spec_source SHA produce the same
// row statuses" — is testable only if the underlying collector is
// deterministic on a known input. This harness pins that determinism
// at the unit-test level: a synthetic repo with hand-curated expected
// statuses. Drift here is the canary that audit comparability has
// regressed.
//
// Mechanics:
//  1. Copy the synthetic repo into a fresh temp dir.
//  2. `git init` + commit so audit-collect.ts can resolve HEAD.
//  3. Run audit-collect.ts in --working-tree --no-network mode.
//  4. Read .ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json and compare rule.derived_status
//     against the expected set, then assert the golden profile was collected.
//
// Exits 0 on full match, 1 on any mismatch, 2 on harness error.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROFILE_QUESTIONS } from '../../skills/ai-contributor-audit/scripts/internal/collector-profile.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SYNTHETIC = path.join(REPO_ROOT, 'examples', 'golden-audit', 'synthetic-repo');
const EXPECTED = path.join(
  REPO_ROOT,
  'examples',
  'golden-audit',
  'expected',
  'derived-statuses.json',
);
const COLLECTOR = path.join(
  REPO_ROOT,
  'skills',
  'ai-contributor-audit',
  'scripts',
  'audit-collect.ts',
);

if (!fs.existsSync(SYNTHETIC)) die(`synthetic repo not found: ${SYNTHETIC}`);
if (!fs.existsSync(EXPECTED)) die(`expected file not found: ${EXPECTED}`);
if (!fs.existsSync(COLLECTOR)) die(`collector not found: ${COLLECTOR}`);

const expectedRaw = JSON.parse(fs.readFileSync(EXPECTED, 'utf8')) as {
  expected: Record<string, string | null>;
};
const expected = expectedRaw.expected;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-audit-'));
let exitCode = 0;
try {
  copyDir(SYNTHETIC, tmp);
  gitInitCommit(tmp);
  const evidence = runCollector(tmp);
  const statusesExit = compare(evidence, expected);
  const profileExit = compareProfile(evidence);
  exitCode = statusesExit === 0 && profileExit === 0 ? 0 : 1;
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[golden-audit] harness error: ${message}`);
  exitCode = 2;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(exitCode);

function copyDir(src: string, dst: string): void {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      // Preserve executable bit (the husky hook script).
      try {
        const mode = fs.statSync(s).mode;
        if (mode & 0o111) fs.chmodSync(d, mode);
      } catch {
        /* non-fatal */
      }
    }
  }
}

function gitInitCommit(dir: string): void {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'golden-audit',
    GIT_AUTHOR_EMAIL: 'golden@example.invalid',
    GIT_COMMITTER_NAME: 'golden-audit',
    GIT_COMMITTER_EMAIL: 'golden@example.invalid',
  };
  for (const args of [
    ['init', '-q', '-b', 'main'],
    ['add', '-A'],
    ['commit', '-q', '-m', 'synthetic'],
  ]) {
    const r = spawnSync('git', args, { cwd: dir, env, encoding: 'utf8' });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
    }
  }
}

interface RuleEvidence {
  derived_status: string | null;
}
interface ProfileAnswer {
  question_id: string;
  answer: string;
  evidence_kind: string;
  evidence_use: string;
  affected_aic_ids: string[];
}
interface ProfileEvidence {
  present: boolean;
  default_policy: string;
  answers: ProfileAnswer[];
  warnings: string[];
  errors: string[];
}
interface Evidence {
  rules: Record<string, RuleEvidence>;
  profile?: ProfileEvidence;
}

function runCollector(targetDir: string): Evidence {
  const r = spawnSync(
    'npx',
    ['--yes', 'tsx@4.21.0', COLLECTOR, targetDir, '--working-tree', '--no-network'],
    { encoding: 'utf8' },
  );
  if (r.status !== 0 && r.status !== 3) {
    // 0 = clean run, 3 = partial collection (some rules errored). Either is OK
    // for golden-audit because we assert per-rule expectations, not exit code.
    throw new Error(`audit-collect.ts exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  }
  const evidencePath = path.join(
    targetDir,
    '.ai-contributor-audit',
    'AI-CONTRIBUTOR-EVIDENCE.json',
  );
  if (!fs.existsSync(evidencePath)) {
    throw new Error(`audit-collect.ts produced no evidence file at ${evidencePath}`);
  }
  return JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as Evidence;
}

function compare(evidence: Evidence, expected: Record<string, string | null>): 0 | 1 {
  const mismatches: string[] = [];
  for (const [ruleId, expectedStatus] of Object.entries(expected)) {
    const actual = evidence.rules?.[ruleId]?.derived_status ?? null;
    if (actual !== expectedStatus) {
      mismatches.push(`  ${ruleId}: expected ${fmt(expectedStatus)}, got ${fmt(actual)}`);
    }
  }
  if (mismatches.length === 0) {
    const n = Object.keys(expected).length;
    console.log(`OK — golden audit: ${n} rule(s) match expected derived_status`);
    return 0;
  }
  console.error(`golden audit mismatches (${mismatches.length}):`);
  for (const m of mismatches) console.error(m);
  console.error(
    '\nIf the change is intentional, update examples/golden-audit/expected/derived-statuses.json with the new expectation and a one-line note about why.',
  );
  return 1;
}

function compareProfile(evidence: Evidence): 0 | 1 {
  const mismatches: string[] = [];
  const profile = evidence.profile;
  if (!profile) {
    mismatches.push('  profile: missing from evidence');
  } else {
    if (profile.present !== true) {
      mismatches.push(`  profile.present: expected true, got ${String(profile.present)}`);
    }
    if (profile.default_policy !== 'owner_profile') {
      mismatches.push(
        `  profile.default_policy: expected "owner_profile", got ${fmt(String(profile.default_policy))}`,
      );
    }
    if (profile.errors?.length) {
      mismatches.push(`  profile.errors: expected none, got ${profile.errors.join('; ')}`);
    }
    if (profile.warnings?.length) {
      mismatches.push(`  profile.warnings: expected none, got ${profile.warnings.join('; ')}`);
    }
    if (profile.answers?.length !== PROFILE_QUESTIONS.length) {
      mismatches.push(
        `  profile.answers: expected ${PROFILE_QUESTIONS.length}, got ${profile.answers?.length ?? 0}`,
      );
    }
    const byId = new Map((profile.answers ?? []).map((answer) => [answer.question_id, answer]));
    for (const [questionId, expectedAnswer] of [
      ['env-required', 'yes'],
      ['ui-a11y', 'no'],
      ['runtime-critical', 'no'],
      ['host-push-protection', 'no'],
      ['regulated-ai-data', 'no'],
    ] as const) {
      const actual = byId.get(questionId);
      if (!actual) {
        mismatches.push(`  profile.answers: missing ${questionId}`);
        continue;
      }
      if (actual.answer !== expectedAnswer) {
        mismatches.push(
          `  profile.answers.${questionId}: expected ${fmt(expectedAnswer)}, got ${fmt(actual.answer)}`,
        );
      }
      if (actual.evidence_kind !== 'owner_attestation') {
        mismatches.push(
          `  profile.answers.${questionId}.evidence_kind: expected "owner_attestation", got ${fmt(actual.evidence_kind)}`,
        );
      }
      if (actual.evidence_use !== 'applicability') {
        mismatches.push(
          `  profile.answers.${questionId}.evidence_use: expected "applicability", got ${fmt(actual.evidence_use)}`,
        );
      }
      if (actual.affected_aic_ids.length === 0) {
        mismatches.push(
          `  profile.answers.${questionId}.affected_aic_ids: expected non-empty list`,
        );
      }
    }
  }

  if (mismatches.length === 0) {
    console.log('OK — golden audit profile: owner profile collected without warnings or errors');
    return 0;
  }
  console.error(`golden audit profile mismatches (${mismatches.length}):`);
  for (const m of mismatches) console.error(m);
  return 1;
}

function fmt(v: string | null): string {
  return v === null ? 'null' : `"${v}"`;
}

function die(msg: string): never {
  console.error(`[golden-audit] ${msg}`);
  process.exit(2);
}

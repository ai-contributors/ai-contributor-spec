#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Read-only validator for AI Contributor audit profiles. This intentionally
// does not run the audit collector; it only checks that the profile matches
// the canonical applicability-question template.

import fs from 'node:fs';
import path from 'node:path';

// Bumped whenever the validator's checks or output format change. The skill
// runbook captures this on its first stdout line so the Prompt Audit Trail
// (AIC-prompt-audit-trail) records which validator produced a profile.
const SKILL_VERSION = '0.1.0';

const HERE = path.dirname(path.resolve(process.argv[1] ?? 'profile-validate.ts'));
const DEFAULT_TEMPLATE = path.resolve(
  HERE,
  '..',
  '..',
  'ai-contributor-audit',
  'references',
  'audit-profile-template.md',
);
const PROFILE_REL = path.join('.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');

// Emit the skill version banner before any other output so callers can
// capture it from a single stdout line for the Prompt Audit Trail. Even
// `--help` and CLI-error paths see the banner; failures still produce useful
// provenance.
console.log(`ai-contributor-audit-profile profile-validate skill version: ${SKILL_VERSION}`);

const args = process.argv.slice(2);
let target = '.';
let template = DEFAULT_TEMPLATE;
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === '--template') {
    const value = args[++i];
    if (!value) usage('missing value for --template');
    template = path.resolve(value);
  } else if (arg === '-h' || arg === '--help') {
    usage(null, 0);
  } else if (arg.startsWith('--')) {
    usage(`unknown flag: ${arg}`);
  } else {
    target = arg;
  }
}

function usage(error: string | null, code = 2): never {
  if (error) console.error(`profile-validate: ${error}`);
  console.error('Usage: profile-validate.ts [target-repo-path] [--template <path>]');
  process.exit(code);
}

interface ProfileRow {
  line: number;
  area: string;
  question: string;
  answer: string;
  evidence: string;
  affected: string;
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode) {
      cells.push(current.trim().replace(/\\\|/g, '|'));
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim().replace(/\\\|/g, '|'));
  if (cells[0] === '') cells.shift();
  if (cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function readRows(filePath: string): ProfileRow[] {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows: ProfileRow[] = [];
  for (const [idx, line] of text.split(/\r?\n/).entries()) {
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+/.test(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 5 || cells[0] === 'Area') continue;
    rows.push({
      line: idx + 1,
      area: cells[0] ?? '',
      question: cells[1] ?? '',
      answer: cells[2] ?? '',
      evidence: cells[3] ?? '',
      affected: cells[4] ?? '',
    });
  }
  return rows;
}

const targetRoot = path.resolve(target);
const profilePath = path.join(targetRoot, PROFILE_REL);
const problems: string[] = [];
const warnings: string[] = [];

if (!fs.existsSync(template)) problems.push(`canonical template not found: ${template}`);
if (!fs.existsSync(profilePath)) problems.push(`profile not found: ${profilePath}`);

let canonical: ProfileRow[] = [];
let profile: ProfileRow[] = [];
if (problems.length === 0) {
  canonical = readRows(template);
  profile = readRows(profilePath);
  if (canonical.length === 0)
    problems.push(`canonical template has no applicability rows: ${template}`);
  if (profile.length === 0) problems.push(`profile has no applicability rows: ${profilePath}`);
}

if (problems.length === 0) {
  const canonicalQuestions = canonical.map((r) => r.question);
  const profileQuestions = profile.map((r) => r.question);
  const canonicalSet = new Set(canonicalQuestions);
  const profileSet = new Set(profileQuestions);

  for (const question of canonicalQuestions) {
    if (!profileSet.has(question)) problems.push(`missing canonical question: ${question}`);
  }
  for (const row of profile) {
    if (!canonicalSet.has(row.question))
      problems.push(`unsupported profile question at line ${row.line}: ${row.question}`);
  }
  if (profileQuestions.length !== canonicalQuestions.length) {
    problems.push(
      `profile question count ${profileQuestions.length} does not match canonical count ${canonicalQuestions.length}`,
    );
  }
  for (let i = 0; i < Math.min(profile.length, canonical.length); i++) {
    if (profile[i]!.question !== canonical[i]!.question) {
      problems.push(
        `question order mismatch at profile row ${i + 1}: expected "${canonical[i]!.question}", got "${profile[i]!.question}"`,
      );
    }
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const datePrefix = /\bOwner (?:re)?confirmed (\d{4}-\d{2}-\d{2})\b/;
  for (const row of profile) {
    const answer = row.answer.trim().toLowerCase();
    if (!['', 'yes', 'no'].includes(answer)) {
      problems.push(
        `invalid answer at line ${row.line}: "${row.answer}" (expected yes, no, or blank)`,
      );
    }
    if ((answer === 'yes' || answer === 'no') && row.evidence.trim() === '') {
      warnings.push(`line ${row.line}: answer "${answer}" has no evidence/rationale`);
    }
    if (row.affected.trim() === '') {
      problems.push(`line ${row.line}: affected checks cell is blank`);
    }
    const dateMatch = row.evidence.match(datePrefix);
    if (dateMatch) {
      const raw = dateMatch[1]!;
      const parsed = new Date(`${raw}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
        problems.push(
          `line ${row.line}: "Owner (re)confirmed" date "${raw}" is not a valid ISO 8601 date`,
        );
      } else if (parsed.getTime() > today.getTime()) {
        problems.push(`line ${row.line}: "Owner (re)confirmed" date "${raw}" is in the future`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Problems (${problems.length}):`);
  for (const problem of problems) console.error(` - ${problem}`);
  if (warnings.length > 0) {
    console.error(`Warnings (${warnings.length}):`);
    for (const warning of warnings) console.error(` - ${warning}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.error(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.error(` - ${warning}`);
}
console.log(`OK — profile has ${profile.length} canonical applicability rows`);

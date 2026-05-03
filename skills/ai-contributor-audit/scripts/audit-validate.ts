#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-validate.ts — adopter-facing structural validator for
// AI-CONTRIBUTOR-CHECKLIST.md and AI-CONTRIBUTOR-AUDIT-LOG.md.
//
// Proves the audit output is structurally consistent, reproducible enough
// to review, and mechanically tied to evidence in the current audit log.
// It does NOT decide whether evidence is semantically sufficient and does
// NOT call GitHub APIs or rerun evidence commands.
//
// This file is read-only. Stamping derivable values (timestamps,
// validator/collector versions, collector-derived row A + Status + Comment,
// conformance summary, conformance_level, root backlog) is the job of the
// companion `audit-stamp.ts`. Run audit-stamp.ts before this validator.
//
// The audit skill bootstraps this script and its sibling audit-markdown.ts
// from the pinned `spec_source` ref and runs it via `npx --yes tsx@4.21.0`
// when the target repository has not vendored the audit runtime. Keep
// imports limited to node:* builtins and shipped sibling modules.
//
// Usage:
//   tsx audit-validate.ts <checklist.md> <audit-log.md>
//                         [--template] [--lenient]
//
// Closure check is on by default; --lenient opts out and is surfaced in
// the OK message so downstream consumers can filter lenient audits.
//
// Exit codes:
//   0  valid
//   1  validation failures
//   2  CLI / parser error
//
// Error codes (stable so agents can fix output deterministically):
//   AUDIT001..009  CLI / parser / frontmatter
//   AUDIT010..017  checklist rows
//   AUDIT018       validator_version mismatch
//   AUDIT019       Not Relevant comment has reason cue but no backtick citation
//   AUDIT020..029  summary / conformance
//   AUDIT030..039  audit log / evidence linkage / token disclosure
//   AUDIT040..049  backlog
//   AUDIT050..059  placeholders / template leftovers
//   AUDIT060..069  evidence-artifact / profile consistency

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  VALID_RULE_STATUSES,
  parseChecklistRules,
  parseSummary,
  type ChecklistRow,
} from './internal/audit-markdown.ts';
import {
  checkAuditLog,
  isPlaceholderAuditRow,
  parseAuditLog,
} from './internal/validator-audit-log.ts';
import { checkBacklog, parseBacklog } from './internal/validator-backlog.ts';
import {
  checkAutomationMarkerHeader,
  checkCollectorDerivedRowsMatchEvidence,
  checkDerivedEvidenceArtifactCitations,
  checkEvidenceLinkage,
  checkProfileEvidence,
  checkTokenDisclosure,
} from './internal/validator-evidence-linkage.ts';
import { checkFrontmatter } from './internal/validator-frontmatter.ts';
import {
  checkRootSectionCopies,
  checkSummary,
  checkSummaryTableFormatting,
} from './internal/validator-summary.ts';
import type { AuditLogRow, Problem, ValidatorContext } from './internal/validator-types.ts';

// Bumped whenever validator behaviour or the required frontmatter shape
// changes. Recorded in audit frontmatter as `validator_version` so two
// audits of the same repo can be compared knowing which validator they
// were run against.
export const VALIDATOR_VERSION = '0.1.0';

// Mirror of the `COLLECTOR_VERSION` constant exported by audit-collect.ts.
// Kept in this file so audit-run.ts can read the version without executing
// imports. When bumping audit-collect.ts's COLLECTOR_VERSION, bump this
// constant in lockstep.
export const COLLECTOR_VERSION = '0.1.0';

// --------------------------------------------------------------------------
// State (set by runValidator before any check runs; reset between calls so
// the module is safe to import and invoke programmatically from tests).

let CHECKLIST_PATH = '';
let AUDIT_PATH = '';
let EVIDENCE_PATH = '';
let SUMMARY_PATH = '';
let TEMPLATE_MODE = false;
let LENIENT = false;
let CHECKLIST_LINES: string[] = [];
let AUDIT_LINES: string[] = [];
let SUMMARY_LINES: string[] = [];
let stderrBuf: string[] = [];
let stdoutBuf: string[] = [];

// --------------------------------------------------------------------------
// Validator run context

let problems: Problem[] = [];
function fail(code: string, file: string, line: number | undefined, message: string): void {
  problems.push({ code, file, line, message });
}

// --------------------------------------------------------------------------
// File loading

function readLinesOrNull(path: string): string[] | null {
  try {
    return fs.readFileSync(path, 'utf8').split(/\r?\n/);
  } catch (e) {
    stderrBuf.push(`AUDIT001 cannot read ${path}: ${(e as Error).message}`);
    return null;
  }
}

function defaultSummaryPath(checklistPath: string): string {
  const full = path.resolve(checklistPath);
  const dir = path.dirname(full);
  if (path.basename(dir) === '.ai-contributor-audit') {
    return path.join(path.dirname(dir), 'AI-CONTRIBUTOR-AUDIT.md');
  }
  return path.join(dir, 'AI-CONTRIBUTOR-AUDIT.md');
}

// --------------------------------------------------------------------------
// Check 2: Checklist row completeness

function checkChecklistRows(rows: ChecklistRow[]): void {
  if (rows.length === 0) {
    fail(
      'AUDIT010',
      CHECKLIST_PATH,
      undefined,
      'no checklist rows parsed — section headings or table shape may be wrong',
    );
    return;
  }
  for (const r of rows) {
    if (r.rule === '') {
      fail('AUDIT011', CHECKLIST_PATH, r.line, 'rule name is empty');
    }
    if (!Number.isInteger(r.pillar) || r.pillar < 1 || r.pillar > 7) {
      fail(
        'AUDIT012',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": Pillar must be 1..7, got "${r.pillar}"`,
      );
    }
    const validLevels =
      r.scope === 'MAY' ? new Set(['—']) : new Set(['L0', 'L1', 'L2', 'L3', 'L4']);
    if (!validLevels.has(r.minLevel)) {
      fail(
        'AUDIT013',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": level "${r.minLevel}" invalid for scope ${r.scope}`,
      );
    }
    if (!VALID_RULE_STATUSES.includes(r.status)) {
      fail(
        'AUDIT014',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": Status "${r.status}" is not one of ${VALID_RULE_STATUSES.filter((s) => s !== '').join(', ')}`,
      );
    }

    if (TEMPLATE_MODE) continue;

    if (r.scope !== 'MAY' && r.status === '') {
      fail(
        'AUDIT015',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": Status is blank — every ${r.scope} row must have a status in a completed audit`,
      );
    }
    if (r.status !== '' && r.comment === '') {
      fail(
        'AUDIT016',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": Status "${r.status}" has no Comment evidence`,
      );
    }
    if (r.scope === 'MUST' && r.status === '➖ Not relevant') {
      fail(
        'AUDIT017',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": MUST rows cannot be "➖ Not relevant"`,
      );
    }
  }
}

// Check 8: Placeholder detection

function checkPlaceholders(rules: ChecklistRow[], audit: AuditLogRow[]): void {
  if (TEMPLATE_MODE) return;

  for (const r of rules) {
    if (/Rule [A-C]\b/.test(r.comment)) {
      fail(
        'AUDIT050',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": Comment contains placeholder text ("Rule A/B/C")`,
      );
    }
    if (r.comment.includes('<excerpt>') || r.comment.includes('<command>')) {
      fail(
        'AUDIT051',
        CHECKLIST_PATH,
        r.line,
        `row "${r.rule}": Comment contains template placeholder ("<command>" or "<excerpt>")`,
      );
    }
  }
  for (const r of audit) {
    if (isPlaceholderAuditRow(r)) {
      fail(
        'AUDIT052',
        AUDIT_PATH,
        r.line,
        'audit log still contains template placeholder row (`<command>`, `Rule A`, etc.)',
      );
    }
  }
  for (let i = 0; i < CHECKLIST_LINES.length; i++) {
    const line = CHECKLIST_LINES[i];
    if (/<!--\s*(BEGIN|END):TEMPLATE-ONLY\b/.test(line)) {
      fail(
        'AUDIT053',
        CHECKLIST_PATH,
        i + 1,
        'TEMPLATE-ONLY block marker is still present; delete the wrapped section before committing the filled checklist',
      );
    }
    const fillMatch = line.match(/<FILL_[A-Z_]+>/);
    if (fillMatch) {
      fail(
        'AUDIT054',
        CHECKLIST_PATH,
        i + 1,
        `placeholder token ${fillMatch[0]} is still present; replace it with the audited value`,
      );
    }
  }
}

// --------------------------------------------------------------------------
// Programmatic entry point

export interface ValidatorResult {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
}

export function runValidator(argv: string[]): ValidatorResult {
  problems = [];
  stderrBuf = [];
  stdoutBuf = [];
  CHECKLIST_PATH = '';
  AUDIT_PATH = '';
  SUMMARY_PATH = '';
  CHECKLIST_LINES = [];
  AUDIT_LINES = [];
  SUMMARY_LINES = [];

  const FLAGS = new Set<string>();
  const POSITIONAL: string[] = [];
  let summaryOverride: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--summary') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--summary requires a path argument');
        return finish(2);
      }
      summaryOverride = v;
      i++;
    } else if (a.startsWith('--')) {
      FLAGS.add(a);
    } else {
      POSITIONAL.push(a);
    }
  }

  if (POSITIONAL.length !== 2) {
    stderrBuf.push(
      'Usage: audit-validate.ts <checklist.md> <audit-log.md> [--summary <path>] [--template] [--lenient]',
    );
    return finish(2);
  }

  CHECKLIST_PATH = POSITIONAL[0];
  AUDIT_PATH = POSITIONAL[1];
  EVIDENCE_PATH = path.join(path.dirname(path.resolve(AUDIT_PATH)), 'AI-CONTRIBUTOR-EVIDENCE.json');
  SUMMARY_PATH = summaryOverride ?? defaultSummaryPath(CHECKLIST_PATH);
  TEMPLATE_MODE = FLAGS.has('--template');
  LENIENT = FLAGS.has('--lenient');

  const cl = readLinesOrNull(CHECKLIST_PATH);
  if (cl === null) return finish(2);
  const al = readLinesOrNull(AUDIT_PATH);
  if (al === null) return finish(2);
  const sl = readLinesOrNull(SUMMARY_PATH);
  if (sl === null) return finish(2);
  CHECKLIST_LINES = cl;
  AUDIT_LINES = al;
  SUMMARY_LINES = sl;
  const context: ValidatorContext = {
    checklistPath: CHECKLIST_PATH,
    auditPath: AUDIT_PATH,
    evidencePath: EVIDENCE_PATH,
    summaryPath: SUMMARY_PATH,
    templateMode: TEMPLATE_MODE,
    lenient: LENIENT,
    checklistLines: CHECKLIST_LINES,
    auditLines: AUDIT_LINES,
    summaryLines: SUMMARY_LINES,
  };

  const { checklist: checklistFm } = checkFrontmatter(context, fail, {
    validatorVersion: VALIDATOR_VERSION,
  });
  checkAutomationMarkerHeader(context, fail);
  const rules = parseChecklistRules(context.checklistLines);
  const auditAll = parseAuditLog(context.auditLines);
  const summary = parseSummary(context.checklistLines);
  const backlog = parseBacklog(context.summaryLines);

  checkChecklistRows(rules);
  const auditReal = checkAuditLog(auditAll, rules, context, fail);
  checkSummaryTableFormatting(summary, context, fail);
  checkSummary(summary, checklistFm, rules, context, fail);
  checkRootSectionCopies(context, fail);
  checkBacklog(backlog, rules, context, fail);
  checkPlaceholders(rules, auditAll);
  checkEvidenceLinkage(rules, auditReal, context, fail, (message) => {
    stderrBuf.push(message);
  });
  checkDerivedEvidenceArtifactCitations(rules, context, fail);
  checkCollectorDerivedRowsMatchEvidence(rules, context, fail);
  checkProfileEvidence(rules, context, fail);
  checkTokenDisclosure(auditReal, context, fail);

  if (problems.length === 0) {
    stdoutBuf.push(
      `OK — ${rules.length} checklist rows, ${auditReal.length} audit rows${TEMPLATE_MODE ? ' (template mode)' : ''}${LENIENT ? ' (lenient — closure check skipped)' : ''}`,
    );
    return finish(0);
  }

  problems.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return (a.line ?? 0) - (b.line ?? 0);
  });

  stderrBuf.push(`Problems (${problems.length}):`);
  for (const p of problems) {
    const where = p.line ? `${p.file}:${p.line}` : p.file;
    stderrBuf.push(` ${p.code} ${where}: ${p.message}`);
  }
  return finish(1);
}

function finish(exitCode: 0 | 1 | 2): ValidatorResult {
  return {
    exitCode,
    stdout: stdoutBuf.join('\n'),
    stderr: stderrBuf.join('\n'),
  };
}

// CLI shim is below function declarations so direct imports can call
// runValidator() without executing the command.

const invokedAsScript =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  const result = runValidator(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr + '\n');
  process.exit(result.exitCode);
}

// SPDX-License-Identifier: Apache-2.0
//
// Evidence linkage, generated evidence, and token disclosure validation.

import fs from 'node:fs';
import {
  AUTO_STAMP_PREFIX,
  decisiveRulesByAic,
  expectedCollectorStamp,
  expectedProfileStamp,
  parseProfileEvidence,
  profileNoAnswersByAic,
} from './audit-evidence.ts';
import {
  commentHasDirectEvidence,
  hasApplicabilityReason,
  isSeparatorRow,
  looksLikeCommand,
  splitRow,
  stripBackticks,
  type ChecklistRow,
} from './audit-markdown.ts';
import { isPreflightRow, isStampedCollectorRow } from './validator-audit-log.ts';
import type { AuditLogRow, ProblemReporter, ValidatorContext } from './validator-types.ts';

const DERIVED_RULES_REQUIRING_EVIDENCE_ARTIFACT = new Set([
  'Branch Protection',
  'Lockfile Integrity',
]);

export function checkEvidenceLinkage(
  rules: ChecklistRow[],
  audit: AuditLogRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
  warn: (message: string) => void,
): void {
  if (context.templateMode) return;

  const auditCommandList = audit.map((r) => normalizeCommand(r.command));
  const auditCommands = new Set(auditCommandList);

  for (const r of rules) {
    if (r.status === '') continue;

    const cmdInComment = extractFirstCommandLikeToken(r.comment);
    const directEvidence = commentHasDirectEvidence(r.comment);

    if (r.status === '✅ Fulfilled' || r.status === '⚠️ Warning' || r.status === '🚨 Alarm') {
      if (!cmdInComment && !directEvidence) {
        fail(
          'AUDIT034',
          context.checklistPath,
          r.line,
          `row "${r.rule}" is "${r.status}" but Comment has no evidence citation (need a backticked command, file:line, file § Heading, or backticked path)`,
        );
        continue;
      }
    }

    if (r.status === '➖ Not relevant') {
      if (!hasApplicabilityReason(r.comment)) {
        fail(
          'AUDIT035',
          context.checklistPath,
          r.line,
          `row "${r.rule}" is "➖ Not relevant" but Comment has no applicability reason or evidence citation`,
        );
      } else if (!hasBacktickCitation(r.comment)) {
        fail(
          'AUDIT019',
          context.checklistPath,
          r.line,
          `row "${r.rule}" is "➖ Not relevant" with a reason cue but no backtick-quoted citation — wrap the path/file:line/command/section in backticks so the claim is independently verifiable`,
        );
      }
    }

    if (cmdInComment && !directEvidence) {
      if (!auditCommands.has(normalizeCommand(cmdInComment))) {
        const closest = closestCommandHint(cmdInComment, auditCommandList);
        fail(
          'AUDIT036',
          context.checklistPath,
          r.line,
          `row "${r.rule}": Comment cites command \`${cmdInComment}\` but no audit-log row has that command${closest}`,
        );
      }
    }
  }

  const allCommentCmds = new Set<string>();
  for (const r of rules) {
    const c = extractFirstCommandLikeToken(r.comment);
    if (c) allCommentCmds.add(normalizeCommand(c));
  }
  for (const a of audit) {
    if (a.command === '') continue;
    if (isPreflightRow(a, context.auditLines) || isStampedCollectorRow(a, context.auditLines)) {
      continue;
    }
    if (!allCommentCmds.has(normalizeCommand(a.command))) {
      warn(
        `AUDIT037 ${context.auditPath}:${a.line}: warning — command \`${a.command}\` is not cited by any checklist Comment (if this is setup, use \`<preflight>\`; otherwise cite the exact command in the checklist Comment)`,
      );
    }
  }
}

export function checkDerivedEvidenceArtifactCitations(
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  if (context.templateMode) return;

  for (const r of rules) {
    if (r.status !== '✅ Fulfilled') continue;
    if (!DERIVED_RULES_REQUIRING_EVIDENCE_ARTIFACT.has(r.rule)) continue;
    if (/\bAI-CONTRIBUTOR-EVIDENCE\.json\b/.test(r.comment)) continue;
    fail(
      'AUDIT039',
      context.checklistPath,
      r.line,
      `row "${r.rule}" is derived by audit-collect and "✅ Fulfilled" but Comment does not cite AI-CONTRIBUTOR-EVIDENCE.json`,
    );
  }
}

export function checkCollectorDerivedRowsMatchEvidence(
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  if (context.templateMode) return;

  let raw: string;
  try {
    raw = fs.readFileSync(context.evidencePath, 'utf8');
  } catch {
    const mechanical = rules.find((r) => r.comment.startsWith(AUTO_STAMP_PREFIX));
    if (mechanical) {
      fail(
        'AUDIT060',
        context.evidencePath,
        undefined,
        'collector-derived checklist rows are present but AI-CONTRIBUTOR-EVIDENCE.json is missing; run audit-collect.ts and audit-stamp.ts',
      );
    }
    return;
  }

  let evidence: { rules?: Record<string, unknown> };
  try {
    evidence = JSON.parse(raw);
  } catch (e) {
    fail(
      'AUDIT060',
      context.evidencePath,
      undefined,
      `AI-CONTRIBUTOR-EVIDENCE.json is not valid JSON (${(e as Error).message})`,
    );
    return;
  }

  const decisiveByAic = decisiveRulesByAic(evidence.rules);
  if (decisiveByAic.size === 0) return;

  for (const row of rules) {
    const expected = expectedCollectorStamp(row.ids, decisiveByAic);
    if (!expected) continue;
    if (row.automationMarker !== 'x') {
      fail(
        'AUDIT061',
        context.checklistPath,
        row.line,
        `row "${row.rule}" is collector-derived but A marker is "${row.automationMarker || '(blank)'}", expected "x"; run audit-stamp.ts instead of editing the row directly`,
      );
    }
    if (row.status !== expected.status) {
      fail(
        'AUDIT061',
        context.checklistPath,
        row.line,
        `row "${row.rule}" Status is "${row.status}" but current AI-CONTRIBUTOR-EVIDENCE.json stamps "${expected.status}"; run audit-stamp.ts instead of editing the row directly`,
      );
    }
    if (row.comment !== expected.comment) {
      fail(
        'AUDIT061',
        context.checklistPath,
        row.line,
        `row "${row.rule}" Comment does not match current AI-CONTRIBUTOR-EVIDENCE.json; run audit-stamp.ts instead of editing the row directly`,
      );
    }
  }
}

export function checkProfileEvidence(
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  if (context.templateMode) return;

  const ownerProfileRows = rules.filter((r) => r.comment.startsWith('Owner profile:'));
  let raw: string;
  try {
    raw = fs.readFileSync(context.evidencePath, 'utf8');
  } catch {
    if (ownerProfileRows.length > 0) {
      fail(
        'AUDIT063',
        context.evidencePath,
        undefined,
        'owner-profile-derived checklist rows are present but AI-CONTRIBUTOR-EVIDENCE.json is missing; run audit-collect.ts and audit-stamp.ts',
      );
    }
    return;
  }

  let evidence: { profile?: unknown; rules?: Record<string, unknown> };
  try {
    evidence = JSON.parse(raw);
  } catch {
    // AUDIT060 reports malformed evidence JSON in the collector-derived pass.
    return;
  }

  const profile = parseProfileEvidence(evidence.profile);
  if (!profile) {
    if (ownerProfileRows.length > 0) {
      fail(
        'AUDIT063',
        context.evidencePath,
        undefined,
        'owner-profile-derived checklist rows are present but evidence JSON has no profile block; run audit-collect.ts and audit-stamp.ts',
      );
    }
    return;
  }

  for (const error of profile.errors) {
    fail(
      'AUDIT063',
      context.evidencePath,
      undefined,
      `profile error recorded by collector: ${error}`,
    );
  }

  const checklistAicIds = new Set(rules.flatMap((r) => r.ids));
  for (const answer of profile.answers) {
    if (answer.answer !== 'yes' && answer.answer !== 'no' && answer.answer !== '') {
      fail(
        'AUDIT063',
        context.evidencePath,
        undefined,
        `profile answer for "${answer.question || answer.questionId}" is invalid: "${answer.answer}"`,
      );
    }
    for (const id of answer.affectedAicIds) {
      if (!checklistAicIds.has(id)) {
        fail(
          'AUDIT063',
          context.evidencePath,
          undefined,
          `profile answer for "${answer.question || answer.questionId}" references affected AIC ID ${id}, but that ID is not present in the checklist`,
        );
      }
    }
  }

  const decisiveByAic = decisiveRulesByAic(evidence.rules);
  const profileNoByAic = profileNoAnswersByAic(profile.answers);

  for (const row of rules) {
    const expected = expectedProfileStamp(row, decisiveByAic, profileNoByAic);
    const hasOwnerProfilePrefix = row.comment.startsWith('Owner profile:');

    if (hasOwnerProfilePrefix && row.scope === 'MUST') {
      fail(
        'AUDIT063',
        context.checklistPath,
        row.line,
        `row "${row.rule}" is an unconditional MUST and cannot be owner-profile-stamped as Not relevant`,
      );
      continue;
    }

    if (expected) {
      if (row.automationMarker !== 'x') {
        fail(
          'AUDIT063',
          context.checklistPath,
          row.line,
          `row "${row.rule}" is owner-profile-derived but A marker is "${row.automationMarker || '(blank)'}", expected "x"; run audit-stamp.ts`,
        );
      }
      if (row.status !== '➖ Not relevant') {
        fail(
          'AUDIT063',
          context.checklistPath,
          row.line,
          `row "${row.rule}" is owner-profile-derived but Status is "${row.status}", expected "➖ Not relevant"; run audit-stamp.ts`,
        );
      }
      if (row.comment !== expected.comment) {
        fail(
          'AUDIT063',
          context.checklistPath,
          row.line,
          `row "${row.rule}" owner-profile Comment does not match current AI-CONTRIBUTOR-EVIDENCE.json; run audit-stamp.ts`,
        );
      }
    } else if (hasOwnerProfilePrefix) {
      fail(
        'AUDIT063',
        context.checklistPath,
        row.line,
        `row "${row.rule}" has an Owner profile Comment but current AI-CONTRIBUTOR-EVIDENCE.json does not support a profile-driven Not relevant stamp`,
      );
    }
  }
}

export function checkAutomationMarkerHeader(
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  for (let i = 0; i < context.checklistLines.length; i++) {
    if (!context.checklistLines[i].startsWith('|')) continue;
    if (isSeparatorRow(context.checklistLines[i])) continue;
    const cells = splitRow(context.checklistLines[i]);
    if (cells[0] !== 'Scope') continue;
    if (cells[2] === 'M') {
      fail(
        'AUDIT062',
        context.checklistPath,
        i + 1,
        'modern checklist tables must use the `A` automated-marker column, not `M`',
      );
    }
  }
}

export function checkTokenDisclosure(
  audit: AuditLogRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  if (context.templateMode) return;
  let firstApiRow: AuditLogRow | null = null;
  let authDisclosureRow: AuditLogRow | null = null;
  for (const r of audit) {
    const cmd = unwrapCommandPrefix(stripBackticks(r.command).trim());
    if (
      /^gh\s+auth\s+status\b/.test(cmd) ||
      /^gh\s+auth\b/.test(cmd) ||
      /^gh\s+api\s+user\b/.test(cmd)
    ) {
      if (authDisclosureRow === null || r.line < authDisclosureRow.line) {
        authDisclosureRow = r;
      }
      continue;
    }
    if (/^(env\s+)?gh\s+(api|repo|secret|run|workflow|release|ruleset)\b/.test(cmd)) {
      if (firstApiRow === null || r.line < firstApiRow.line) {
        firstApiRow = r;
      }
    }
  }
  if (firstApiRow === null) return;
  if (authDisclosureRow === null) {
    fail(
      'AUDIT038',
      context.auditPath,
      firstApiRow.line,
      'audit log uses `gh api` (or other API-hitting `gh` subcommand) but has no preceding `gh api user` or `gh auth status` row disclosing the active GitHub identity',
    );
    return;
  }
  if (authDisclosureRow.line > firstApiRow.line) {
    fail(
      'AUDIT038',
      context.auditPath,
      authDisclosureRow.line,
      `GitHub identity disclosure row is at line ${authDisclosureRow.line} but the first \`gh api\` evidence row is at line ${firstApiRow.line} — disclosure must precede usage`,
    );
  }
}

// Returns the first backticked token in `s` that looks command-shaped.
function extractFirstCommandLikeToken(s: string): string | null {
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const tok = m[1].trim();
    if (looksLikeCommand(tok)) return tok;
  }
  return null;
}

function normalizeCommand(s: string): string {
  let t = s.trim();
  if (t.startsWith('`') && t.endsWith('`') && t.length >= 2) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\s+/g, ' ');
}

function closestCommandHint(expectedCommand: string, availableCommands: string[]): string {
  const expected = normalizeCommand(expectedCommand);
  const expectedHead = commandHead(expected);
  let best: { command: string; score: number } | null = null;
  for (const command of availableCommands) {
    if (command === '' || command === expected) continue;
    const headScore = commandHead(command) === expectedHead ? 25 : 0;
    const score = commonPrefixLength(expected, command) + headScore;
    if (best === null || score > best.score) best = { command, score };
  }
  if (!best || best.score < 12) return '';
  return `; closest audit-log command is \`${best.command}\``;
}

function commandHead(command: string): string {
  return command.split(/\s+/).slice(0, 3).join(' ');
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function hasBacktickCitation(comment: string): boolean {
  const re = /`([^`]{3,})`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(comment))) {
    const tok = m[1];
    if (/[/.:\s$]/.test(tok) || /^[a-z]+ +[a-z]/i.test(tok)) return true;
    if (tok.length >= 6) return true;
  }
  return false;
}

function unwrapCommandPrefix(cmd: string): string {
  return cmd
    .replace(/^timeout\s+\S+\s+/, '')
    .replace(/^env\s+(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)+/, '');
}

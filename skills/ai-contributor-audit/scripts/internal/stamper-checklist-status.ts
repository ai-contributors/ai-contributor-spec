// SPDX-License-Identifier: Apache-2.0
//
// Checklist Status projection for audit-stamp.ts.

import fs from 'node:fs';
import {
  STATUS_EMOJI,
  decisiveRulesByAic,
  expectedCollectorStamp,
  ownerProfileComment,
  parseProfileEvidence,
  profileNoAnswersByAic,
  profileNoMatchForRow,
} from './audit-evidence.ts';
import {
  extractBacktickTokens,
  isSeparatorRow,
  modernChecklistLayout,
  splitRow,
  stripBackticks,
} from './audit-markdown.ts';

const DERIVED_RULES_REQUIRING_EVIDENCE_ARTIFACT = new Set([
  'Branch Protection',
  'Lockfile Integrity',
]);
const EVIDENCE_ARTIFACT_CITATION = '(see `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`)';

export function stampDerivedRuleStatuses(paths: {
  checklistPath: string;
  evidencePath: string;
}): string | null {
  let evidenceRaw: string;
  try {
    evidenceRaw = fs.readFileSync(paths.evidencePath, 'utf8');
  } catch {
    return (
      `Cannot stamp collector-derived rows: evidence JSON at ${paths.evidencePath} is missing. ` +
      `Run audit-collect.ts before audit-stamp.ts.`
    );
  }
  let evidence: { github_api?: unknown; profile?: unknown; rules?: Record<string, unknown> };
  try {
    evidence = JSON.parse(evidenceRaw);
  } catch (e) {
    return (
      `Cannot stamp collector-derived rows: evidence JSON at ${paths.evidencePath} ` +
      `is not valid JSON (${(e as Error).message}). Re-run audit-collect.ts.`
    );
  }
  const rulesObj = evidence.rules;
  if (!rulesObj || typeof rulesObj !== 'object') {
    // No rules object — nothing to stamp; not an error.
    return null;
  }

  const decisiveByAic = decisiveRulesByAic(rulesObj);
  const profile = parseProfileEvidence(evidence.profile);
  const profileNoByAic = profile ? profileNoAnswersByAic(profile.answers) : new Map();
  if (decisiveByAic.size === 0 && profileNoByAic.size === 0) return null;

  const original = fs.readFileSync(paths.checklistPath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);

  let sectionLevel: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const levelMatch = line.match(/^## Level (\d)\s+—/);
    if (levelMatch) {
      sectionLevel = `L${levelMatch[1]}`;
      continue;
    }
    if (/^## Optional\s*$/.test(line)) {
      sectionLevel = '—';
      continue;
    }
    if (/^## /.test(line)) {
      sectionLevel = null;
      continue;
    }

    if (!sectionLevel) continue;
    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;

    const cells = splitRow(line);
    if (cells[0] === 'Scope' && cells[2] === 'M') {
      return 'Cannot stamp checklist: modern checklist tables must use the `A` automated-marker column, not `M`.';
    }
    const layout = modernChecklistLayout(cells);
    if (!layout) continue;
    if (cells[0] === 'Scope') continue;
    const scope = stripBackticks(cells[0]);
    if (!['MUST', 'MUST when applicable', 'SHOULD', 'MAY'].includes(scope)) continue;

    const aicIds = extractBacktickTokens(cells[layout.idsIndex]);
    const expected = expectedCollectorStamp(aicIds, decisiveByAic);
    if (!expected) {
      const profileMatch = profileNoMatchForRow(aicIds, profileNoByAic);
      if (!profileMatch) continue;
      if (scope === 'MUST') continue;
      const comment = ownerProfileComment(profileMatch);
      lines[i] = rewriteRowMechanicalStatusComment(
        line,
        layout.hasMechanicalColumn,
        STATUS_EMOJI['Not relevant'],
        comment,
      );
      continue;
    }

    lines[i] = rewriteRowMechanicalStatusComment(
      line,
      layout.hasMechanicalColumn,
      expected.status,
      expected.comment,
    );
  }

  const out = lines.join(eol);
  if (out === original) return null;
  fs.writeFileSync(paths.checklistPath, out);
  return null;
}

// Appends the EVIDENCE.json citation to Fulfilled rows in the artifact-required
// set when the auditor-edited Comment is missing it. Does not touch rows that
// already cite the artifact (including those just stamped by
// stampDerivedRuleStatuses, since AUTO_STAMP_PREFIX includes the path).
export function ensureDerivedEvidenceArtifactCitations(paths: {
  checklistPath: string;
}): string | null {
  const original = fs.readFileSync(paths.checklistPath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);

  let sectionLevel: string | null = null;
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const levelMatch = line.match(/^## Level (\d)\s+—/);
    if (levelMatch) {
      sectionLevel = `L${levelMatch[1]}`;
      continue;
    }
    if (/^## Optional\s*$/.test(line)) {
      sectionLevel = '—';
      continue;
    }
    if (/^## /.test(line)) {
      sectionLevel = null;
      continue;
    }
    if (!sectionLevel) continue;
    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;

    const cells = splitRow(line);
    const layout = modernChecklistLayout(cells);
    if (!layout) continue;
    if (cells[0] === 'Scope') continue;

    const ruleName = stripBackticks(cells[1] ?? '');
    if (!DERIVED_RULES_REQUIRING_EVIDENCE_ARTIFACT.has(ruleName)) continue;

    const statusCell = cells[layout.statusIndex] ?? '';
    if (!/✅\s*Fulfilled/.test(statusCell)) continue;

    const commentCell = cells[layout.commentIndex] ?? '';
    if (/\bAI-CONTRIBUTOR-EVIDENCE\.json\b/.test(commentCell)) continue;

    const trimmed = commentCell.trim();
    const newComment =
      trimmed.length === 0
        ? EVIDENCE_ARTIFACT_CITATION
        : `${trimmed.replace(/[.;]\s*$/, '')}. ${EVIDENCE_ARTIFACT_CITATION}`;

    lines[i] = rewriteRowCommentOnly(line, layout.commentIndex, newComment);
    changed = true;
  }

  if (!changed) return null;
  fs.writeFileSync(paths.checklistPath, lines.join(eol));
  return null;
}

function rewriteRowCommentOnly(line: string, commentIndex: number, newComment: string): string {
  const pipes: number[] = [];
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '`') {
      inCode = !inCode;
      continue;
    }
    if (c === '\\' && i + 1 < line.length && line[i + 1] === '|') {
      i++;
      continue;
    }
    if (c === '|' && !inCode) pipes.push(i);
  }
  // commentIndex is the cell index (0-based, between pipe[commentIndex] and pipe[commentIndex+1]).
  if (pipes.length < commentIndex + 2) return line;
  const start = pipes[commentIndex] + 1;
  const end = pipes[commentIndex + 1];
  const before = line.slice(0, start);
  const after = line.slice(end);
  return `${before} ${newComment} ${after}`;
}

// Rewrites the automated marker, Status, and Comment cells of a modern-shape
// rule row while preserving every other character (including spacing)
// verbatim. Cell boundaries use the same code-span / escape rules as
// `splitRow`.
function rewriteRowMechanicalStatusComment(
  line: string,
  hasMechanicalColumn: boolean,
  status: string,
  comment: string,
): string {
  const pipes: number[] = [];
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '`') {
      inCode = !inCode;
      continue;
    }
    if (c === '\\' && i + 1 < line.length && line[i + 1] === '|') {
      i++;
      continue;
    }
    if (c === '|' && !inCode) {
      pipes.push(i);
    }
  }
  if (pipes.length < 8) return line;
  const before = line.slice(0, pipes[2] + 1);
  if (hasMechanicalColumn) {
    if (pipes.length < 9) return line;
    const after = line.slice(pipes[5]);
    return `${before} x | ${status} | ${comment} ${after}`;
  }
  const after = line.slice(pipes[4]);
  return `${before} ${status} | ${comment} ${after}`;
}

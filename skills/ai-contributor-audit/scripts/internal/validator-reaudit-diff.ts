// SPDX-License-Identifier: Apache-2.0
//
// Re-audit diff check for audit-validate.ts: when the previous committed
// checklist is supplied via --previous, auditor-owned rows whose Status
// changed since that audit must carry a change rationale citing
// current-run evidence. Mechanically stamped rows (collector-derived or
// owner-profile stamps) are exempt — their provenance already explains
// the change. Error codes AUDIT070..072.

import fs from 'node:fs';
import {
  decisiveRulesByAic,
  expectedCollectorStamp,
  expectedProfileStamp,
  parseProfileEvidence,
  profileNoAnswersByAic,
  type ProfileAnswerEvidence,
} from './audit-evidence.ts';
import { parseChecklistRules, type ChecklistRow } from './audit-markdown.ts';
import type { ProblemReporter } from './validator-types.ts';

// Exemption must come from validated mechanical provenance in the current
// run's evidence JSON — never from Comment text. A hand-written Comment
// that imitates a collector or owner-profile stamp on a judgment row would
// otherwise dodge AUDIT070, because AUDIT061 only pins rows that decisive
// collector evidence actually covers. Missing or malformed evidence JSON
// exempts nothing (AUDIT060 already flags that state when stamped rows
// exist).
export function buildMechanicalExemption(evidencePath: string): (row: ChecklistRow) => boolean {
  let evidence: { rules?: Record<string, unknown>; profile?: unknown };
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch {
    return () => false;
  }
  const decisiveByAic = decisiveRulesByAic(evidence.rules ?? {});
  const profile = parseProfileEvidence(evidence.profile);
  const profileNoByAic = profile
    ? profileNoAnswersByAic(profile.answers)
    : new Map<string, ProfileAnswerEvidence[]>();
  return (row) =>
    expectedCollectorStamp(row.ids, decisiveByAic) !== null ||
    expectedProfileStamp(row, decisiveByAic, profileNoByAic) !== null;
}

export function changeRationaleFragment(prevStatus: string, currStatus: string): string {
  return `Changed from ${prevStatus} to ${currStatus} because `;
}

// The statuses may optionally be backticked — issue #9's example writes
// `Changed from `✅ Fulfilled` to `⚠️ Warning` because …`.
export function changeRationalePattern(prevStatus: string, currStatus: string): RegExp {
  return new RegExp(
    `Changed from \`?${escapeRegExp(prevStatus)}\`? to \`?${escapeRegExp(currStatus)}\`? because `,
  );
}

export function checkReauditDiff(
  current: ChecklistRow[],
  previousLines: string[],
  previousPath: string,
  checklistPath: string,
  isExempt: (row: ChecklistRow) => boolean,
  fail: ProblemReporter,
): void {
  const previous = parseChecklistRules(previousLines);
  if (previous.length === 0) {
    fail(
      'AUDIT072',
      previousPath,
      undefined,
      'previous checklist parsed no rule rows — --previous must point at the previously committed AI-CONTRIBUTOR-CHECKLIST.md',
    );
    return;
  }

  const prevByKey = new Map<string, ChecklistRow[]>();
  for (const r of previous) {
    const list = prevByKey.get(rowKey(r));
    if (list) list.push(r);
    else prevByKey.set(rowKey(r), [r]);
  }

  for (const row of current) {
    const candidates = prevByKey.get(rowKey(row));
    if (!candidates) continue; // row not present in the previous audit
    const prev = candidates.find((c) => c.ids.join(',') === row.ids.join(',')) ?? candidates[0];
    if (prev.status === '') continue; // unfinished previous audit row
    if (row.status === '') continue; // blank current status is AUDIT015's job
    if (row.status === prev.status) continue;
    if (isExempt(row)) continue;

    const match = changeRationalePattern(prev.status, row.status).exec(row.comment);
    if (!match) {
      fail(
        'AUDIT070',
        checklistPath,
        row.line,
        `row "${row.rule}": status changed from "${prev.status}" to "${row.status}" since the previous committed audit; ` +
          `Comment must include "${changeRationaleFragment(prev.status, row.status)}<reason citing current-run evidence>"`,
      );
      continue;
    }
    // The citation check must ignore the matched fragment itself: with
    // backticked statuses the fragment contains backtick tokens that are
    // not evidence citations.
    const remainder =
      row.comment.slice(0, match.index) + row.comment.slice(match.index + match[0].length);
    if (!/`[^`]+`/.test(remainder)) {
      fail(
        'AUDIT071',
        checklistPath,
        row.line,
        `row "${row.rule}": change rationale must cite current-run evidence in backticks`,
      );
    }
  }
}

// Rows are joined by scope + rule name (the rendered row identity); when
// duplicate names exist, prefer the candidate with the identical AIC ID set.
function rowKey(r: ChecklistRow): string {
  return `${r.scope}|${r.rule}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// SPDX-License-Identifier: Apache-2.0
//
// Re-audit diff check for audit-validate.ts: when the previous committed
// checklist is supplied via --previous, auditor-owned rows whose Status
// changed since that audit must carry a change rationale citing
// current-run evidence. Mechanically stamped rows (collector-derived or
// owner-profile stamps) are exempt — their provenance already explains
// the change. Error codes AUDIT070..072.

import { AUTO_STAMP_PREFIX } from './audit-evidence.ts';
import { parseChecklistRules, type ChecklistRow } from './audit-markdown.ts';
import type { ProblemReporter } from './validator-types.ts';

// Leading token of comments written by ownerProfileComment() in
// audit-evidence.ts.
const OWNER_PROFILE_STAMP_PREFIX = 'Owner profile: ';

export function isMechanicallyStamped(comment: string): boolean {
  return comment.startsWith(AUTO_STAMP_PREFIX) || comment.startsWith(OWNER_PROFILE_STAMP_PREFIX);
}

export function changeRationaleFragment(prevStatus: string, currStatus: string): string {
  return `Changed from ${prevStatus} to ${currStatus} because `;
}

export function checkReauditDiff(
  current: ChecklistRow[],
  previousLines: string[],
  previousPath: string,
  checklistPath: string,
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
    if (isMechanicallyStamped(row.comment)) continue;

    const fragment = changeRationaleFragment(prev.status, row.status);
    if (!row.comment.includes(fragment)) {
      fail(
        'AUDIT070',
        checklistPath,
        row.line,
        `row "${row.rule}": status changed from "${prev.status}" to "${row.status}" since the previous committed audit; ` +
          `Comment must include "${fragment}<reason citing current-run evidence>"`,
      );
      continue;
    }
    if (!/`[^`]+`/.test(row.comment)) {
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

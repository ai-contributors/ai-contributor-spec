// SPDX-License-Identifier: Apache-2.0
//
// Evidence derivation helpers shared by the stamper and validator.

import type { ChecklistRow, RuleStatus } from './audit-markdown.ts';

export type DerivedStatus = 'Fulfilled' | 'Warning' | 'Alarm' | 'Not relevant';

export const STATUS_EMOJI: Record<DerivedStatus, RuleStatus> = {
  Fulfilled: '✅ Fulfilled',
  Warning: '⚠️ Warning',
  Alarm: '🚨 Alarm',
  'Not relevant': '➖ Not relevant',
};

export const STATUS_SEVERITY: Record<DerivedStatus, number> = {
  Alarm: 3,
  Warning: 2,
  Fulfilled: 1,
  'Not relevant': 0,
};

export const AUTO_STAMP_PREFIX =
  'Mechanical (collector-derived) from `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`';

export interface DerivedRule {
  evidenceKey: string;
  status: DerivedStatus;
  reason: string;
}

export interface ProfileAnswerEvidence {
  questionId: string;
  question: string;
  answer: 'yes' | 'no' | '';
  ownerEvidence: string;
  affectedAicIds: string[];
  evidenceUse: string;
}

export interface ParsedProfileEvidence {
  answers: ProfileAnswerEvidence[];
  errors: string[];
}

export function decisiveRulesByAic(
  rulesObj: Record<string, unknown> | undefined,
): Map<string, DerivedRule[]> {
  const decisiveByAic = new Map<string, DerivedRule[]>();
  if (!rulesObj || typeof rulesObj !== 'object') return decisiveByAic;

  for (const [evidenceKey, raw] of Object.entries(rulesObj)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as {
      derived_status?: unknown;
      derivation_reason?: unknown;
      judgment_required?: unknown;
      aic_ids?: unknown;
    };
    if (r.judgment_required !== false) continue;
    const status = r.derived_status;
    if (
      status !== 'Fulfilled' &&
      status !== 'Warning' &&
      status !== 'Alarm' &&
      status !== 'Not relevant'
    ) {
      continue;
    }
    const aicIds = Array.isArray(r.aic_ids)
      ? r.aic_ids.filter((x): x is string => typeof x === 'string')
      : [];
    if (aicIds.length === 0) continue;
    const dr: DerivedRule = {
      evidenceKey,
      status,
      reason: typeof r.derivation_reason === 'string' ? r.derivation_reason : '',
    };
    for (const id of aicIds) {
      const list = decisiveByAic.get(id);
      if (list) list.push(dr);
      else decisiveByAic.set(id, [dr]);
    }
  }
  return decisiveByAic;
}

export function expectedCollectorStamp(
  aicIds: string[],
  decisiveByAic: Map<string, DerivedRule[]>,
): { status: RuleStatus; comment: string } | null {
  const matched: DerivedRule[] = [];
  const seenKeys = new Set<string>();
  const coveredIds = new Set<string>();
  for (const id of aicIds) {
    const drs = decisiveByAic.get(id);
    if (!drs) continue;
    coveredIds.add(id);
    for (const dr of drs) {
      if (seenKeys.has(dr.evidenceKey)) continue;
      seenKeys.add(dr.evidenceKey);
      matched.push(dr);
    }
  }
  if (matched.length === 0) return null;
  if (coveredIds.size !== aicIds.length) return null;

  matched.sort((a, b) => a.evidenceKey.localeCompare(b.evidenceKey));

  let chosen: DerivedStatus = matched[0].status;
  for (const m of matched) {
    if (STATUS_SEVERITY[m.status] > STATUS_SEVERITY[chosen]) chosen = m.status;
  }
  const allAgree = matched.every((m) => m.status === chosen);

  let comment: string;
  if (matched.length === 1) {
    const m = matched[0];
    comment = `${AUTO_STAMP_PREFIX} (rule: ${m.evidenceKey}). ${m.reason}`;
  } else if (allAgree) {
    const joined = matched.map((m) => m.reason).join('; ');
    const keys = matched.map((m) => m.evidenceKey).join(', ');
    comment = `${AUTO_STAMP_PREFIX} (rules: ${keys}). ${joined}`;
  } else {
    const parts = matched.map((m) => `${m.evidenceKey}: ${m.reason}`);
    comment = `${AUTO_STAMP_PREFIX}. ${parts.join('; ')}`;
  }

  return { status: STATUS_EMOJI[chosen], comment };
}

export function hasAnyCollectorStampEvidence(
  aicIds: string[],
  decisiveByAic: Map<string, DerivedRule[]>,
): boolean {
  return aicIds.some((id) => (decisiveByAic.get(id)?.length ?? 0) > 0);
}

export function parseProfileEvidence(rawProfile: unknown): ParsedProfileEvidence | null {
  if (!rawProfile || typeof rawProfile !== 'object') return null;
  const raw = rawProfile as { answers?: unknown; errors?: unknown };
  const answers: ProfileAnswerEvidence[] = [];
  if (Array.isArray(raw.answers)) {
    for (const item of raw.answers) {
      if (!item || typeof item !== 'object') continue;
      const answer = item as {
        question_id?: unknown;
        question?: unknown;
        answer?: unknown;
        owner_evidence?: unknown;
        affected_aic_ids?: unknown;
        evidence_use?: unknown;
      };
      const affectedAicIds = Array.isArray(answer.affected_aic_ids)
        ? answer.affected_aic_ids.filter((x): x is string => typeof x === 'string')
        : [];
      answers.push({
        questionId: typeof answer.question_id === 'string' ? answer.question_id : '',
        question: typeof answer.question === 'string' ? answer.question : '',
        answer: (typeof answer.answer === 'string'
          ? answer.answer
          : '') as ProfileAnswerEvidence['answer'],
        ownerEvidence: typeof answer.owner_evidence === 'string' ? answer.owner_evidence : '',
        affectedAicIds,
        evidenceUse: typeof answer.evidence_use === 'string' ? answer.evidence_use : '',
      });
    }
  }
  const errors = Array.isArray(raw.errors)
    ? raw.errors.filter((x): x is string => typeof x === 'string')
    : [];
  return { answers, errors };
}

export function profileNoAnswersByAic(
  answers: ProfileAnswerEvidence[],
): Map<string, ProfileAnswerEvidence[]> {
  const out = new Map<string, ProfileAnswerEvidence[]>();
  for (const answer of answers) {
    if (answer.answer !== 'no') continue;
    if (answer.evidenceUse && answer.evidenceUse !== 'applicability') continue;
    if (!answer.question && !answer.questionId) continue;
    for (const id of answer.affectedAicIds) {
      const existing = out.get(id);
      if (existing) existing.push(answer);
      else out.set(id, [answer]);
    }
  }
  return out;
}

export function expectedProfileStamp(
  row: Pick<ChecklistRow, 'scope' | 'ids'>,
  decisiveByAic: Map<string, DerivedRule[]>,
  profileNoByAic: Map<string, ProfileAnswerEvidence[]>,
): { comment: string } | null {
  if (row.scope === 'MUST') return null;
  if (hasAnyCollectorStampEvidence(row.ids, decisiveByAic)) return null;
  const answer = profileNoMatchForRow(row.ids, profileNoByAic);
  if (!answer) return null;
  return { comment: ownerProfileComment(answer) };
}

export function profileNoMatchForRow(
  aicIds: string[],
  profileNoByAic: Map<string, ProfileAnswerEvidence[]>,
): ProfileAnswerEvidence | null {
  for (const id of aicIds) {
    const answers = profileNoByAic.get(id);
    if (!answers?.length) continue;
    return answers.slice().sort((a, b) => a.questionId.localeCompare(b.questionId))[0];
  }
  return null;
}

export function ownerProfileComment(answer: ProfileAnswerEvidence): string {
  const evidence = answer.ownerEvidence.trim();
  const evidenceSuffix = evidence
    ? ` Profile evidence: "${escapeProfileTableCell(evidence)}"${/[.!?]$/.test(evidence) ? '' : '.'}`
    : ' Profile evidence: none provided.';
  return (
    `Owner profile: \`.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md\` ` +
    `answers "no" to "${escapeProfileTableCell(answer.question || answer.questionId)}", so this check is not applicable.` +
    evidenceSuffix
  );
}

function escapeProfileTableCell(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, ' ').replace(/\|/g, '\\|');
}

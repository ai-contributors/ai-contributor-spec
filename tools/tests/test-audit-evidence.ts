#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  AUTO_STAMP_PREFIX,
  decisiveRulesByAic,
  expectedCollectorStamp,
  expectedProfileStamp,
  parseProfileEvidence,
  profileNoAnswersByAic,
} from '../../skills/ai-contributor-audit/scripts/internal/audit-evidence.ts';
import type { ChecklistRow } from '../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';

let failed = 0;

function assert(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`OK   ${name}`);
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
  if (detail) console.error(detail);
}

const decisive = decisiveRulesByAic({
  warning: {
    judgment_required: false,
    derived_status: 'Warning',
    derivation_reason: 'Partial hosted evidence.',
    aic_ids: ['AIC-one', 'AIC-two'],
  },
  alarm: {
    judgment_required: false,
    derived_status: 'Alarm',
    derivation_reason: 'Required evidence missing.',
    aic_ids: ['AIC-two'],
  },
  manual: {
    judgment_required: true,
    derived_status: 'Fulfilled',
    derivation_reason: 'Should not be decisive.',
    aic_ids: ['AIC-two'],
  },
  malformed: {
    judgment_required: false,
    derived_status: 'Unknown',
    derivation_reason: 'Should be ignored.',
    aic_ids: ['AIC-two'],
  },
});

assert('decisive rules indexed by AIC ID', decisive.get('AIC-two')?.length === 2);

const single = expectedCollectorStamp(['AIC-one'], decisive);
assert('single collector stamp uses rule form', single?.status === '⚠️ Warning');
assert(
  'single collector stamp cites evidence artifact',
  single?.comment === `${AUTO_STAMP_PREFIX} (rule: warning). Partial hosted evidence.`,
  single?.comment,
);

const mixed = expectedCollectorStamp(['AIC-two'], decisive);
assert('mixed collector stamp chooses most severe status', mixed?.status === '🚨 Alarm');
assert(
  'mixed collector stamp lists keyed reasons',
  mixed?.comment ===
    `${AUTO_STAMP_PREFIX}. alarm: Required evidence missing.; warning: Partial hosted evidence.`,
  mixed?.comment,
);

const coveredMultiId = expectedCollectorStamp(['AIC-one', 'AIC-two'], decisive);
assert(
  'collector stamp covers multi-ID rows when every ID has evidence',
  coveredMultiId?.status === '🚨 Alarm',
);

const partialMultiId = expectedCollectorStamp(['AIC-one', 'AIC-missing'], decisive);
assert(
  'collector stamp skips partial multi-ID row coverage',
  partialMultiId === null,
  partialMultiId?.comment,
);

const profile = parseProfileEvidence({
  answers: [
    {
      question_id: 'persistence-layer',
      question: 'Does the repository use persistence?',
      answer: 'no',
      owner_evidence: 'No database schema | migrations.',
      evidence_use: 'applicability',
      affected_aic_ids: ['AIC-three'],
    },
    {
      question_id: 'semantic-only',
      question: 'Semantic evidence only',
      answer: 'no',
      owner_evidence: 'Not applicability evidence.',
      evidence_use: 'semantic',
      affected_aic_ids: ['AIC-four'],
    },
  ],
  errors: ['profile warning'],
});
assert('profile parser preserves recorded errors', profile?.errors[0] === 'profile warning');

const profileNoByAic = profile ? profileNoAnswersByAic(profile.answers) : new Map();
assert('profile no answers indexed by applicability AIC ID', profileNoByAic.has('AIC-three'));
assert('profile no answers ignore non-applicability evidence', !profileNoByAic.has('AIC-four'));

const profileRow = {
  scope: 'MUST when applicable',
  ids: ['AIC-three'],
} as ChecklistRow;
const profileStamp = expectedProfileStamp(profileRow, decisive, profileNoByAic);
assert(
  'profile stamp emits owner-profile comment',
  profileStamp?.comment.startsWith('Owner profile:') === true,
);
assert(
  'profile stamp escapes profile evidence pipes',
  profileStamp?.comment.includes('No database schema \\| migrations.') === true,
);

const mustRow = {
  scope: 'MUST',
  ids: ['AIC-three'],
} as ChecklistRow;
assert(
  'profile stamp never applies to unconditional MUST',
  expectedProfileStamp(mustRow, decisive, profileNoByAic) === null,
);

const collectorWinsRow = {
  scope: 'MUST when applicable',
  ids: ['AIC-two', 'AIC-three'],
} as ChecklistRow;
assert(
  'collector evidence blocks profile stamp even with partial row coverage',
  expectedProfileStamp(collectorWinsRow, decisive, profileNoByAic) === null,
);

if (failed > 0) {
  console.error(`${failed} audit-evidence assertion(s) failed`);
  process.exit(1);
}

console.log('All audit-evidence assertions passed');

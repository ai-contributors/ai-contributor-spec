#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Stamper for skills/ai-contributor-audit/references/audit-profile-template.md.
// The canonical applicability table is derived from PROFILE_QUESTIONS in
// skills/ai-contributor-audit/scripts/internal/collector-profile.ts.
// See AI-CONTRIBUTOR-AUDIT-MODEL.md "When to stamp, when to validate."

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROFILE_QUESTIONS } from '../../skills/ai-contributor-audit/scripts/internal/collector-profile.ts';
import { stampGeneratedBlock } from './shared/stamp-generated-block.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'skills',
  'ai-contributor-audit',
  'references',
  'audit-profile-template.md',
);

function renderApplicabilityTable(): string {
  const header =
    '| Area | Question | Answer | Evidence / rationale | Affected checks (rule and IDs) |';
  const separator =
    '| ---- | -------- | ------ | -------------------- | ------------------------------ |';
  const rows = PROFILE_QUESTIONS.map(
    (q) => `| ${q.area} | ${q.question} |  |  | ${q.affectedRender} |`,
  );
  return [header, separator, ...rows].join('\n');
}

function main(): void {
  let content = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  content = stampGeneratedBlock(content, 'applicability-questions', renderApplicabilityTable());
  if (process.argv.includes('--check')) {
    const current = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    if (content !== current) {
      console.error(
        `audit-profile-template.md is stale. Run 'npm --prefix tools run generate:audit-profile-template' locally and commit the result.`,
      );
      process.exit(1);
    }
    console.log('OK — audit-profile-template.md generated block is current');
    return;
  }
  fs.writeFileSync(TEMPLATE_PATH, content);
  console.log(
    `OK — regenerated applicability-questions block in audit-profile-template.md from ${PROFILE_QUESTIONS.length} profile questions`,
  );
}

main();

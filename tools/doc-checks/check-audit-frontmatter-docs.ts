#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Keeps shipped audit frontmatter fields aligned across templates and the
// canonical ownership docs. This catches partial prose updates when a
// frontmatter field is added, renamed, or removed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const allFrontmatterFields = [
  'spec_version',
  'spec_source',
  'assessment_started_at',
  'assessment_completed_at',
  'assessment_duration',
  'audited_commit',
  'auditor',
  'validator_version',
  'collector_version',
  'runner_agent',
  'runner_model',
  'conformance_level',
] as const;

const synchronizedFields = allFrontmatterFields.filter((field) => field !== 'spec_version');

type Field = (typeof allFrontmatterFields)[number];

interface MentionCheck {
  path: string;
  label: string;
  marker: string;
  fields: readonly Field[];
}

const mentionChecks: MentionCheck[] = [
  {
    path: 'AI-CONTRIBUTOR-AUDIT-MODEL.md',
    label: 'canonical ownership table',
    marker: 'The frontmatter fields are owned as follows:',
    fields: allFrontmatterFields,
  },
  {
    path: '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md',
    label: 'checklist preamble frontmatter list',
    marker: '> - **Frontmatter**',
    fields: allFrontmatterFields,
  },
  {
    path: '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md',
    label: 'audit-log synchronized frontmatter list',
    marker: '> Keep this file next to the checklist.',
    fields: synchronizedFields,
  },
  {
    // CONTRIBUTING.md defers to the canonical ownership table instead of
    // restating the field list; only the pointer itself is required.
    path: 'CONTRIBUTING.md',
    label: 'contributing ownership pointer',
    marker: 'AI-CONTRIBUTOR-AUDIT-MODEL.md#artifact-and-field-ownership',
    fields: [],
  },
];

const templatePaths = [
  '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md',
  '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md',
];

const errors: string[] = [];

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function extractFrontmatterKeys(rel: string): string[] {
  const lines = read(rel).split(/\r?\n/);
  if (lines[0] !== '---') {
    errors.push(`${rel}: missing opening frontmatter marker`);
    return [];
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    errors.push(`${rel}: missing closing frontmatter marker`);
    return [];
  }
  return lines
    .slice(1, end)
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*):/)?.[1])
    .filter((field): field is string => typeof field === 'string');
}

function requireFields(rel: string, label: string, text: string, fields: readonly Field[]): void {
  for (const field of fields) {
    if (!text.includes(field)) errors.push(`${rel}: ${label} omits \`${field}\``);
  }
}

for (const rel of templatePaths) {
  const got = extractFrontmatterKeys(rel);
  const expected = [...allFrontmatterFields];
  if (got.join('\n') !== expected.join('\n')) {
    errors.push(
      `${rel}: frontmatter keys differ from canonical order\n` +
        `  expected: ${expected.join(', ')}\n` +
        `  got:      ${got.join(', ')}`,
    );
  }
}

for (const check of mentionChecks) {
  const text = read(check.path);
  const idx = text.indexOf(check.marker);
  if (idx === -1) {
    errors.push(`${check.path}: missing marker for ${check.label}: ${check.marker}`);
    continue;
  }
  const excerpt = text.slice(idx, idx + 1600);
  requireFields(check.path, check.label, excerpt, check.fields);
}

if (errors.length > 0) {
  console.error('check-audit-frontmatter-docs: audit frontmatter docs drifted:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `OK   ${allFrontmatterFields.length} audit frontmatter field(s) aligned across templates and docs`,
);

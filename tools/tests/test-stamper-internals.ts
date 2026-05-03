#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Direct unit tests for stamper-frontmatter and stamper-audit-summary
// helpers. Drives each exported helper with synthetic fixture files to
// reach the branch paths the existing fixture-driven test-audit-stamp.ts
// doesn't exercise.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeAuditLogMarkerProse,
  stampAuditTimestamps,
  stampCrossFileEquality,
  stripPopulatedFrontmatterComments,
} from '../../skills/ai-contributor-audit/scripts/internal/stamper-frontmatter.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function bad(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

// stripPopulatedFrontmatterComments: leaves file unchanged when no
// frontmatter present.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-strip-'));
  try {
    const f = path.join(tmp, 'no-frontmatter.md');
    fs.writeFileSync(f, '# title\n\nbody\n');
    const before = fs.readFileSync(f, 'utf8');
    const err = stripPopulatedFrontmatterComments(f);
    if (err === null && fs.readFileSync(f, 'utf8') === before) {
      ok('stripPopulatedFrontmatterComments: no frontmatter -> no-op');
    } else {
      bad('strip no-fm', `err=${err}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stripPopulatedFrontmatterComments: unclosed frontmatter -> no-op.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-strip-unclosed-'));
  try {
    const f = path.join(tmp, 'unclosed.md');
    fs.writeFileSync(f, '---\nspec_version: "0.1"\n# no closing\n');
    const before = fs.readFileSync(f, 'utf8');
    const err = stripPopulatedFrontmatterComments(f);
    if (err === null && fs.readFileSync(f, 'utf8') === before) {
      ok('stripPopulatedFrontmatterComments: unclosed frontmatter -> no-op');
    } else {
      bad('strip unclosed');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stripPopulatedFrontmatterComments: removes inline comments from populated
// fields like spec_version when they have a value.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-strip-clean-'));
  try {
    const f = path.join(tmp, 'with-comment.md');
    fs.writeFileSync(
      f,
      '---\nspec_version: "0.1"   # legacy comment to strip\nauditor: "Test"   # owner-edit hint\n---\n\nbody\n',
    );
    const err = stripPopulatedFrontmatterComments(f);
    const after = fs.readFileSync(f, 'utf8');
    if (err === null && !/# legacy comment/.test(after) && /spec_version: "0\.1"/.test(after)) {
      ok('stripPopulatedFrontmatterComments: strips inline comment from populated key');
    } else {
      bad('strip clean', `after=\n${after}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// normalizeAuditLogMarkerProse: file without markers -> no-op.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-marker-'));
  try {
    const f = path.join(tmp, 'audit-log.md');
    fs.writeFileSync(f, '---\nspec_version: "0.1"\n---\n\n# Audit Log\n\nno markers here\n');
    const before = fs.readFileSync(f, 'utf8');
    const err = normalizeAuditLogMarkerProse(f);
    if (err === null && fs.readFileSync(f, 'utf8') === before) {
      ok('normalizeAuditLogMarkerProse: file without markers -> no-op');
    } else {
      bad('marker no-op');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampAuditTimestamps: malformed evidence JSON -> error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-ts-bad-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const al = path.join(tmp, 'AL.md');
    const ev = path.join(tmp, 'EV.json');
    fs.writeFileSync(cl, '---\nspec_version: "0.1"\n---\n');
    fs.writeFileSync(al, '---\nspec_version: "0.1"\n---\n');
    fs.writeFileSync(ev, '{ this is not valid json');
    const err = stampAuditTimestamps({ checklistPath: cl, auditPath: al, evidencePath: ev });
    if (typeof err === 'string' && /not valid JSON/i.test(err)) {
      ok('stampAuditTimestamps: malformed evidence JSON -> error');
    } else {
      bad('stampAuditTimestamps malformed', String(err));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampAuditTimestamps: missing assessment_started_at -> error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-ts-no-start-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const al = path.join(tmp, 'AL.md');
    const ev = path.join(tmp, 'EV.json');
    fs.writeFileSync(cl, '---\nspec_version: "0.1"\n---\n');
    fs.writeFileSync(al, '---\nspec_version: "0.1"\n---\n');
    fs.writeFileSync(ev, JSON.stringify({ rules: {} }));
    const err = stampAuditTimestamps({ checklistPath: cl, auditPath: al, evidencePath: ev });
    if (typeof err === 'string' && /assessment_started_at/i.test(err)) {
      ok('stampAuditTimestamps: missing assessment_started_at -> error');
    } else {
      bad('stampAuditTimestamps no start', String(err));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampAuditTimestamps: unparseable assessment_started_at -> error.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-ts-bad-iso-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const al = path.join(tmp, 'AL.md');
    const ev = path.join(tmp, 'EV.json');
    fs.writeFileSync(cl, '---\nspec_version: "0.1"\n---\n');
    fs.writeFileSync(al, '---\nspec_version: "0.1"\n---\n');
    fs.writeFileSync(ev, JSON.stringify({ assessment_started_at: 'not-an-iso-time' }));
    const err = stampAuditTimestamps({ checklistPath: cl, auditPath: al, evidencePath: ev });
    if (typeof err === 'string' && /assessment_started_at/i.test(err)) {
      ok('stampAuditTimestamps: unparseable assessment_started_at -> error');
    } else {
      bad('stampAuditTimestamps unparseable', String(err));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// stampCrossFileEquality: file with malformed frontmatter -> graceful return.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stamper-cross-'));
  try {
    const cl = path.join(tmp, 'CL.md');
    const al = path.join(tmp, 'AL.md');
    fs.writeFileSync(cl, 'no frontmatter\n');
    fs.writeFileSync(al, 'also none\n');
    const err = stampCrossFileEquality({ checklistPath: cl, auditPath: al });
    if (err === null) ok('stampCrossFileEquality: missing frontmatter -> no-op');
    else bad('stampCrossFileEquality missing fm', err);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} stamper-internals test(s) failed`);
  process.exit(1);
}
console.log('All stamper-internals tests passed');

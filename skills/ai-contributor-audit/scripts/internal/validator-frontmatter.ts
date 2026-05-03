// SPDX-License-Identifier: Apache-2.0
//
// Frontmatter integrity validation for audit-validate.ts.

import { formatDuration, stripInlineComment } from './audit-markdown.ts';
import type { Frontmatter, ProblemReporter, ValidatorContext } from './validator-types.ts';

const VALID_CONFORMANCE_LEVELS = ['none', '0', '1', '2', '3', '4'];

export function checkFrontmatter(
  context: ValidatorContext,
  fail: ProblemReporter,
  versions: { validatorVersion: string },
): {
  checklist: Frontmatter;
  audit: Frontmatter;
} {
  const checklist = parseFrontmatter(context.checklistLines, context.checklistPath, fail);
  const audit = parseFrontmatter(context.auditLines, context.auditPath, fail);

  const sharedKeys = [
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
  ];

  {
    const cv = checklist.values.get('conformance_level');
    const av = audit.values.get('conformance_level');
    if (cv !== undefined && av !== undefined && cv !== av) {
      fail(
        'AUDIT005',
        context.checklistPath,
        checklist.lines.get('conformance_level'),
        `frontmatter "conformance_level" differs between files: checklist="${cv}" audit-log="${av}"`,
      );
    }
  }

  for (const key of sharedKeys) {
    const cv = checklist.values.get(key);
    const av = audit.values.get(key);
    if (cv === undefined) {
      fail(
        'AUDIT004',
        context.checklistPath,
        undefined,
        `frontmatter is missing required key "${key}"`,
      );
    }
    if (av === undefined) {
      fail(
        'AUDIT004',
        context.auditPath,
        undefined,
        `frontmatter is missing required key "${key}"`,
      );
    }
    if (cv !== undefined && av !== undefined && cv !== av) {
      fail(
        'AUDIT005',
        context.checklistPath,
        checklist.lines.get(key),
        `frontmatter "${key}" differs between files: checklist="${cv}" audit-log="${av}"`,
      );
    }
  }

  if (!checklist.values.has('conformance_level')) {
    fail(
      'AUDIT004',
      context.checklistPath,
      undefined,
      'checklist frontmatter is missing required key "conformance_level"',
    );
  }

  if (context.templateMode) return { checklist, audit };

  const v = (k: string) => checklist.values.get(k) ?? '';
  const ln = (k: string) => checklist.lines.get(k);

  if (v('spec_version') === '') {
    fail('AUDIT006', context.checklistPath, ln('spec_version'), 'spec_version is empty');
  }
  const specSource = v('spec_source');
  if (specSource === '') {
    fail('AUDIT006', context.checklistPath, ln('spec_source'), 'spec_source is empty');
  } else if (!isImmutableSpecSource(specSource)) {
    fail(
      'AUDIT007',
      context.checklistPath,
      ln('spec_source'),
      `spec_source must pin a 40-char commit SHA, a vN.N spec release tag, or a vN.N.N patch tag, got "${specSource}"`,
    );
  }
  if (v('audited_commit') === '') {
    fail('AUDIT006', context.checklistPath, ln('audited_commit'), 'audited_commit is empty');
  }
  if (v('auditor') === '') {
    fail('AUDIT006', context.checklistPath, ln('auditor'), 'auditor is empty');
  }

  if (v('validator_version') === '') {
    fail('AUDIT006', context.checklistPath, ln('validator_version'), 'validator_version is empty');
  } else if (v('validator_version') !== versions.validatorVersion) {
    fail(
      'AUDIT018',
      context.checklistPath,
      ln('validator_version'),
      `validator_version "${v('validator_version')}" does not match this validator (${versions.validatorVersion}) — re-run validation with the matching version`,
    );
  }
  if (v('collector_version') === '') {
    fail('AUDIT006', context.checklistPath, ln('collector_version'), 'collector_version is empty');
  }
  if (v('runner_agent') === '') {
    fail('AUDIT006', context.checklistPath, ln('runner_agent'), 'runner_agent is empty');
  }
  if (v('runner_model') === '') {
    fail('AUDIT006', context.checklistPath, ln('runner_model'), 'runner_model is empty');
  }

  const startedRaw = v('assessment_started_at');
  const completedRaw = v('assessment_completed_at');
  const durationRaw = v('assessment_duration');
  const started = parseIso(startedRaw);
  const completed = parseIso(completedRaw);

  if (startedRaw === '' || started === null) {
    fail(
      'AUDIT008',
      context.checklistPath,
      ln('assessment_started_at'),
      `assessment_started_at is not a valid ISO 8601 date-time with seconds: "${startedRaw}"`,
    );
  }
  if (completedRaw === '' || completed === null) {
    fail(
      'AUDIT008',
      context.checklistPath,
      ln('assessment_completed_at'),
      `assessment_completed_at is not a valid ISO 8601 date-time with seconds: "${completedRaw}"`,
    );
  }
  if (started !== null && completed !== null && completed < started) {
    fail(
      'AUDIT008',
      context.checklistPath,
      ln('assessment_completed_at'),
      'assessment_completed_at is before assessment_started_at',
    );
  }

  if (!/^\d{2}:\d{2}:\d{2}$/.test(durationRaw)) {
    fail(
      'AUDIT009',
      context.checklistPath,
      ln('assessment_duration'),
      `assessment_duration must match HH:MM:SS, got "${durationRaw}"`,
    );
  } else if (started !== null && completed !== null) {
    const expectedSec = Math.floor((completed - started) / 1000);
    const [h, m, s] = durationRaw.split(':').map(Number);
    const declaredSec = h * 3600 + m * 60 + s;
    if (declaredSec !== expectedSec) {
      fail(
        'AUDIT009',
        context.checklistPath,
        ln('assessment_duration'),
        `assessment_duration ${durationRaw} does not match timestamp delta (${formatDuration(expectedSec)})`,
      );
    }
  }

  const cl = checklist.values.get('conformance_level') ?? '';
  if (!VALID_CONFORMANCE_LEVELS.includes(cl)) {
    fail(
      'AUDIT006',
      context.checklistPath,
      ln('conformance_level'),
      `conformance_level must be one of ${VALID_CONFORMANCE_LEVELS.join(', ')}, got "${cl}"`,
    );
  }

  return { checklist, audit };
}

function parseFrontmatter(lines: string[], file: string, fail: ProblemReporter): Frontmatter {
  const values = new Map<string, string>();
  const lineMap = new Map<string, number>();

  if (lines[0] !== '---') {
    fail('AUDIT002', file, 1, 'frontmatter is missing — first line must be "---"');
    return { values, lines: lineMap };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    fail('AUDIT002', file, 1, 'frontmatter is not closed — missing trailing "---"');
    return { values, lines: lineMap };
  }
  for (let i = 1; i < end; i++) {
    const raw = lines[i];
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const m = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) {
      fail('AUDIT003', file, i + 1, `frontmatter line cannot be parsed as "key: value"`);
      continue;
    }
    const key = m[1];
    let value = m[2];
    value = stripInlineComment(value).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
    lineMap.set(key, i + 1);
  }
  return { values, lines: lineMap };
}

// Accepts only spec_source URLs that pin an immutable ref.
function isImmutableSpecSource(s: string): boolean {
  const m = s.match(/github(?:usercontent)?\.com\/[^/]+\/[^/]+\/(?:tree|blob)?\/?([^/]+)/);
  if (!m) return false;
  const ref = m[1];
  if (/^[0-9a-f]{40}$/.test(ref)) return true;
  if (/^v\d+\.\d+(?:\.\d+)?$/.test(ref)) return true;
  return false;
}

function parseIso(s: string): number | null {
  if (s === '') return null;
  if (!/T\d{2}:\d{2}:\d{2}/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

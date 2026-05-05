// SPDX-License-Identifier: Apache-2.0
//
// Rendered conformance summary validation for audit-validate.ts.

import {
  VALID_SUMMARY_STATUSES,
  findSection,
  hasApplicabilityReason,
  isSeparatorRow,
  minLevelLE,
  renderSummaryTableRows,
  type ChecklistRow,
  type SummaryRow,
} from './audit-markdown.ts';
import type { Frontmatter, ProblemReporter, ValidatorContext } from './validator-types.ts';

export function checkSummary(
  summary: SummaryRow[],
  fm: Frontmatter,
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  if (context.templateMode) return;
  const expectedLevels = ['0', '1', '2', '3', '4'];
  for (const lvl of expectedLevels) {
    if (!summary.some((s) => s.level === lvl)) {
      fail(
        'AUDIT020',
        context.checklistPath,
        undefined,
        `Conformance level summary is missing a row for Level ${lvl}`,
      );
    }
  }
  for (const row of summary) {
    if (!VALID_SUMMARY_STATUSES.includes(row.status)) {
      fail(
        'AUDIT021',
        context.checklistPath,
        row.line,
        `Level ${row.level}: Status "${row.status}" is not one of ${VALID_SUMMARY_STATUSES.filter((s) => s !== '').join(', ')}`,
      );
    }
  }
  for (let i = 1; i < expectedLevels.length; i++) {
    const cur = summary.find((s) => s.level === expectedLevels[i]);
    const prev = summary.find((s) => s.level === expectedLevels[i - 1]);
    if (cur?.status === '✅ Yes' && prev?.status !== '✅ Yes') {
      fail(
        'AUDIT022',
        context.checklistPath,
        cur.line,
        `Level ${cur.level} is "✅ Yes" but Level ${prev?.level ?? i - 1} is not — levels are cumulative`,
      );
    }
  }

  const cl = fm.values.get('conformance_level') ?? '';
  let highestYes = -1;
  for (const lvl of expectedLevels) {
    const row = summary.find((s) => s.level === lvl);
    if (row?.status === '✅ Yes') highestYes = Math.max(highestYes, Number(lvl));
  }
  const expectedCl = highestYes < 0 ? 'none' : highestYes === 0 ? '0' : String(highestYes);
  if (cl !== expectedCl) {
    fail(
      highestYes < 0 ? 'AUDIT023' : 'AUDIT024',
      context.checklistPath,
      fm.lines.get('conformance_level'),
      highestYes < 0
        ? `conformance_level is "${cl}" but no summary row is "✅ Yes" — must be "none"`
        : `conformance_level is "${cl}" but highest "✅ Yes" summary row is Level ${highestYes === 0 ? '0 (Baseline Hygiene)' : highestYes}`,
    );
  }

  if (!context.lenient) {
    checkStrictLevelClosure(summary, rules, context, fail);
  }
}

export function checkSummaryTableFormatting(
  summary: SummaryRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  if (summary.length === 0) return;
  const range = findSection(context.checklistLines, /^##\s+Conformance level summary\s*$/);
  if (!range) return;

  let headerIdx = -1;
  for (let i = range.start + 1; i < range.end; i++) {
    if (
      /^\|\s*Level\b/.test(context.checklistLines[i]) &&
      /Status/.test(context.checklistLines[i])
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return;

  let bodyEnd = headerIdx + 2;
  while (
    bodyEnd < range.end &&
    context.checklistLines[bodyEnd].startsWith('|') &&
    !isSeparatorRow(context.checklistLines[bodyEnd])
  ) {
    bodyEnd++;
  }

  const actual = context.checklistLines.slice(headerIdx, bodyEnd).join('\n');
  const expected = renderSummaryTableRows(summary).join('\n');
  if (actual !== expected) {
    fail(
      'AUDIT028',
      context.checklistPath,
      headerIdx + 1,
      'Conformance level summary table must use canonical Prettier-compatible Markdown formatting; run audit-stamp.ts',
    );
  }
}

export function checkRootSectionCopies(context: ValidatorContext, fail: ProblemReporter): void {
  for (const [label, heading] of [
    ['Conformance level summary', /^##\s+Conformance level summary\s*$/],
    ['Backlog — what to address first', /^##\s+Backlog\s+—\s+what to address first/],
  ] as const) {
    const checklistSection = sectionText(context.checklistLines, heading);
    const rootSection = sectionText(context.summaryLines, heading);
    if (checklistSection === null) {
      fail('AUDIT027', context.checklistPath, undefined, `${label} section is missing`);
      continue;
    }
    if (rootSection === null) {
      fail('AUDIT027', context.summaryPath, undefined, `${label} section is missing`);
      continue;
    }
    const expectedRootText = expectedRootSectionText(checklistSection.text);
    if (expectedRootText !== rootSection.text) {
      fail(
        'AUDIT027',
        context.summaryPath,
        rootSection.line,
        `${label} section must match the checklist section exactly; run audit-stamp.ts`,
      );
    }
  }
}

function expectedRootSectionText(text: string): string {
  // The root audit is copied from the checklist, but links are interpreted from
  // a different directory. Mirror audit-stamp.ts so a correctly stamped root
  // summary does not fail byte-for-byte validation on relative README links.
  return text.replace(
    /\]\(\.\.\/README\.md#display-your-level\)/g,
    '](README.md#display-your-level)',
  );
}

function sectionText(lines: string[], heading: RegExp): { line: number; text: string } | null {
  const range = findSection(lines, heading);
  if (!range) return null;
  let end = range.end;
  while (end > range.start && lines[end - 1].trim() === '') end--;
  return { line: range.start + 1, text: lines.slice(range.start, end).join('\n') };
}

function checkStrictLevelClosure(
  summary: SummaryRow[],
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  const cumulative = (cap: string) => (r: ChecklistRow) =>
    (r.scope === 'MUST' || r.scope === 'MUST when applicable') && minLevelLE(r.minLevel, cap);
  const closureByLevel: Record<string, (r: ChecklistRow) => boolean> = {
    '0': cumulative('L0'),
    '1': cumulative('L1'),
    '2': cumulative('L2'),
    '3': cumulative('L3'),
    '4': (r) => cumulative('L4')(r) || r.scope === 'SHOULD',
  };

  for (const row of summary) {
    if (row.status !== '✅ Yes') continue;
    const isApplicable = closureByLevel[row.level];
    if (!isApplicable) continue;
    for (const r of rules) {
      if (!isApplicable(r)) continue;
      if (r.status === '➖ Not relevant') {
        if (!hasApplicabilityReason(r.comment)) {
          fail(
            'AUDIT025',
            context.checklistPath,
            r.line,
            `Level ${row.level} is "✅ Yes" but row "${r.rule}" is "➖ Not relevant" without a documented applicability reason`,
          );
        }
        continue;
      }
      if (r.status === '🚨 Alarm' || r.status === '⚠️ Warning') {
        fail(
          'AUDIT026',
          context.checklistPath,
          r.line,
          `Level ${row.level} is "✅ Yes" but row "${r.rule}" is "${r.status}"`,
        );
      }
      if (r.status === '') {
        fail(
          'AUDIT026',
          context.checklistPath,
          r.line,
          `Level ${row.level} is "✅ Yes" but row "${r.rule}" has no Status`,
        );
      }
    }
  }
}

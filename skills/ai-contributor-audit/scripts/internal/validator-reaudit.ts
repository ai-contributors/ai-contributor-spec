// SPDX-License-Identifier: Apache-2.0
//
// Re-audit status drift validation for audit-validate.ts.

import childProcess from 'node:child_process';
import path from 'node:path';
import { parseChecklistRules, type ChecklistRow, type RuleStatus } from './audit-markdown.ts';
import type { ProblemReporter, ValidatorContext } from './validator-types.ts';

const RATIONALE_CUE = /\b(because|due to|since|after|based on|current evidence)\b/i;
const CHANGE_CUE = /\b(changed|change|swung|moved|updated|regressed|resolved|improved)\b/i;

export function checkReauditStatusRationales(
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
  previousRows = loadPreviousChecklistRows(context),
): void {
  if (context.templateMode || previousRows === null) return;

  const previousByKey = new Map<string, ChecklistRow>();
  for (const row of previousRows) {
    previousByKey.set(rowKey(row), row);
  }

  for (const current of rules) {
    if (current.status === '') continue;
    if (isMechanicallyOwned(current)) continue;

    const previous = previousByKey.get(rowKey(current));
    if (!previous || previous.status === '' || previous.status === current.status) continue;
    if (isMechanicallyOwned(previous)) continue;

    if (hasStatusChangeRationale(current.comment, previous.status, current.status)) continue;

    fail(
      'AUDIT070',
      context.checklistPath,
      current.line,
      `row "${current.rule}" changed from "${previous.status}" to "${current.status}" but the Comment lacks a re-audit change rationale; add a short current-run rationale such as "Changed from \`${previous.status}\` to \`${current.status}\` because ..."`,
    );
  }
}

function loadPreviousChecklistRows(context: ValidatorContext): ChecklistRow[] | null {
  const checklistPath = path.resolve(context.checklistPath);
  const checklistDir = path.dirname(checklistPath);
  const root = git(checklistDir, ['rev-parse', '--show-toplevel']);
  if (root.status !== 0) return null;

  const rootPath = root.stdout.trim();
  if (rootPath === '') return null;

  const relPath = path.relative(rootPath, checklistPath).split(path.sep).join('/');
  if (relPath === '' || relPath.startsWith('..')) return null;

  const previous = git(rootPath, ['show', `HEAD:${relPath}`]);
  if (previous.status !== 0) return null;

  return parseChecklistRules(previous.stdout.split(/\r?\n/));
}

function git(
  cwd: string,
  args: string[],
): {
  status: number;
  stdout: string;
} {
  const result = childProcess.spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
  };
}

function rowKey(row: ChecklistRow): string {
  if (row.ids.length > 0) return `ids:${[...row.ids].sort().join('\0')}`;
  return `row:${row.minLevel}:${row.scope}:${row.rule}`;
}

function isMechanicallyOwned(row: ChecklistRow): boolean {
  return (
    row.automationMarker === 'x' ||
    row.comment.startsWith('Mechanical (collector-derived) from') ||
    row.comment.startsWith('Owner profile:')
  );
}

function hasStatusChangeRationale(
  comment: string,
  previousStatus: RuleStatus,
  currentStatus: RuleStatus,
): boolean {
  return (
    CHANGE_CUE.test(comment) &&
    RATIONALE_CUE.test(comment) &&
    mentionsStatus(comment, previousStatus) &&
    mentionsStatus(comment, currentStatus)
  );
}

function mentionsStatus(comment: string, status: RuleStatus): boolean {
  const label = status.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  return (
    comment.includes(status) ||
    (label !== '' && new RegExp(`\\b${escapeRegex(label)}\\b`).test(comment))
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// SPDX-License-Identifier: Apache-2.0
//
// Audit log structure validation for audit-validate.ts.

import {
  extractBacktickTokens,
  isSeparatorRow,
  splitRow,
  stripBackticks,
  type ChecklistRow,
} from './audit-markdown.ts';
import type { AuditLogRow, ProblemReporter, ValidatorContext } from './validator-types.ts';

const PLACEHOLDERS = new Set([
  '<command>',
  '<excerpt>',
  '`<command>`',
  '`<excerpt>`',
  'Rule A',
  'Rule B',
  'Rule C',
  '`Rule A`',
  '`Rule B`',
  '`Rule C`',
  'AIC-id-1',
  'AIC-id-2',
  'AIC-id-3',
  '`AIC-id-1`',
  '`AIC-id-2`',
  '`AIC-id-3`',
]);

const PREFLIGHT_TOKENS = new Set(['<preflight>', '<setup>', '—', '-']);
const COLLECTOR_ROWS_BEGIN = '<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->';
const COLLECTOR_ROWS_END = '<!-- END:STAMPED-COLLECTOR-ROWS -->';

export function parseAuditLog(lines: string[]): AuditLogRow[] {
  const out: AuditLogRow[] = [];
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+What to record/.test(lines[i])) {
      start = i;
      break;
    }
  }
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 3) continue;
    if (cells[0] === 'Spec IDs') continue;
    const idsCell = cells[0];
    const rulesCell = cells[1];
    const command = cells[2];
    const outputExcerpt = cells.length >= 4 ? cells[3] : '';
    const rulesEvidenced = extractBacktickTokens(rulesCell);
    const normativeIds = extractBacktickTokens(idsCell);
    out.push({
      line: i + 1,
      command,
      outputExcerpt,
      rulesEvidenced,
      normativeIds,
    });
  }
  return out;
}

export function isPlaceholderAuditRow(row: AuditLogRow): boolean {
  if (PLACEHOLDERS.has(row.command)) return true;
  if (row.rulesEvidenced.some((r) => PLACEHOLDERS.has(r) || /^Rule [A-Z]$/.test(r))) {
    return true;
  }
  return false;
}

export function checkAuditLog(
  rows: AuditLogRow[],
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): AuditLogRow[] {
  const realRows = rows.filter((r) => !isPlaceholderAuditRow(r));
  if (context.templateMode) return realRows;

  if (realRows.length === 0) {
    const text = context.auditLines.join('\n');
    if (!/No commands executed/i.test(text)) {
      fail(
        'AUDIT030',
        context.auditPath,
        undefined,
        'audit log has no real command rows and no "No commands executed" note',
      );
    }
  } else if (!isAuditCollectRow(realRows[0])) {
    const collectorMarkers = stampedCollectorMarkerLines(context.auditLines);
    const markerHint =
      collectorMarkers !== null && realRows[0].line < collectorMarkers.begin
        ? ` Manual evidence rows must be below ${COLLECTOR_ROWS_END}; move this row below line ${collectorMarkers.end}.`
        : '';
    fail(
      'AUDIT030',
      context.auditPath,
      realRows[0].line,
      'first audit-log evidence row must be the `audit-collect` invocation and `[audit-collect] wrote …` summary.' +
        markerHint,
    );
  }
  for (const r of realRows) {
    if (r.command === '') {
      fail('AUDIT031', context.auditPath, r.line, 'audit-log row has empty Command');
    }
    if (r.outputExcerpt === '') {
      fail('AUDIT031', context.auditPath, r.line, 'audit-log row has empty Output excerpt');
    }
    if (r.rulesEvidenced.length === 0 && !isPreflightRow(r, context.auditLines)) {
      fail(
        'AUDIT032',
        context.auditPath,
        r.line,
        'audit-log row has empty Rules (use `<preflight>` for setup rows that do not map to a rule)',
      );
    }
  }

  const ruleNames = new Set(rules.map((r) => r.rule));
  for (const r of realRows) {
    if (isPreflightRow(r, context.auditLines)) continue;
    for (const name of r.rulesEvidenced) {
      const cleaned = name.trim();
      if (cleaned === '') continue;
      if (PREFLIGHT_TOKENS.has(cleaned)) continue;
      if (!ruleNames.has(cleaned)) {
        fail(
          'AUDIT033',
          context.auditPath,
          r.line,
          `Rules names "${cleaned}" — no checklist rule by that name (use \`<preflight>\` for setup rows)`,
        );
      }
    }
  }
  return realRows;
}

export function isPreflightRow(row: AuditLogRow, auditLines: string[]): boolean {
  if (row.rulesEvidenced.length === 0) {
    const raw = auditLines[row.line - 1] ?? '';
    const cells = splitRow(raw);
    const cell = (cells[1] ?? '').trim();
    if (PREFLIGHT_TOKENS.has(cell) || PREFLIGHT_TOKENS.has(stripBackticks(cell))) {
      return true;
    }
    return false;
  }
  return row.rulesEvidenced.every((n) => PREFLIGHT_TOKENS.has(n.trim()));
}

export function isStampedCollectorRow(row: AuditLogRow, auditLines: string[]): boolean {
  const markers = stampedCollectorMarkerLines(auditLines);
  return markers !== null && row.line > markers.begin && row.line < markers.end;
}

function stampedCollectorMarkerLines(auditLines: string[]): { begin: number; end: number } | null {
  let begin = -1;
  let end = -1;
  for (let i = 0; i < auditLines.length; i++) {
    const line = auditLines[i]?.trim();
    if (line === COLLECTOR_ROWS_BEGIN) begin = i + 1;
    if (line === COLLECTOR_ROWS_END) {
      end = i + 1;
      break;
    }
  }
  return begin !== -1 && end !== -1 ? { begin, end } : null;
}

function isAuditCollectRow(row: AuditLogRow): boolean {
  const cmd = normalizeCommand(row.command);
  return /\baudit-collect\.ts\b/.test(cmd) && /\[audit-collect\]\s+wrote\b/.test(row.outputExcerpt);
}

function normalizeCommand(s: string): string {
  let t = s.trim();
  if (t.startsWith('`') && t.endsWith('`') && t.length >= 2) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\s+/g, ' ');
}

// SPDX-License-Identifier: Apache-2.0
//
// Importable Audit Markdown helpers for repository-local checks.
//
// audit-stamp.ts and audit-validate.ts currently duplicate a compatible helper
// block because mirrored skill scripts must remain self-contained with only
// node:* imports. Keep behaviour here aligned with that block when changing
// checklist, summary, or evidence-comment parsing.

import fs from 'node:fs';

export type Scope = 'MUST' | 'MUST when applicable' | 'SHOULD' | 'MAY';
export type RuleStatus = '✅ Fulfilled' | '⚠️ Warning' | '🚨 Alarm' | '➖ Not relevant' | '';
export type SummaryStatus = '✅ Yes' | '❌ No' | '⚠️ Partial' | '';

export const VALID_RULE_STATUSES: RuleStatus[] = [
  '✅ Fulfilled',
  '⚠️ Warning',
  '🚨 Alarm',
  '➖ Not relevant',
  '',
];
export const VALID_SUMMARY_STATUSES: SummaryStatus[] = ['✅ Yes', '❌ No', '⚠️ Partial', ''];

export interface ChecklistRow {
  line: number;
  rule: string;
  scope: Scope;
  pillar: number;
  minLevel: string;
  requirement: string;
  automationMarker: string;
  status: RuleStatus;
  comment: string;
  ids: string[];
}

export interface SummaryRow {
  line: number;
  level: string;
  levelCell: string;
  status: SummaryStatus;
  dateReached: string;
  notes: string;
}

export function renderSummaryTableRows(rows: SummaryRow[]): string[] {
  return renderMarkdownTable(
    ['Level', 'Status', 'Date reached', 'Notes'],
    rows.map((r) => [r.levelCell, r.status, r.dateReached, r.notes]),
  );
}

export function renderMarkdownTable(header: string[], rows: string[][]): string[] {
  const table = [header, ...rows];
  const widths = table[0].map((_, col) =>
    Math.max(3, ...table.map((row) => markdownCellWidth(row[col] ?? ''))),
  );
  const formatRow = (row: string[]) =>
    `| ${row.map((cell, col) => padMarkdownCell(cell, widths[col])).join(' | ')} |`;
  return [
    formatRow(header),
    `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`,
    ...rows.map(formatRow),
  ];
}

export function renderLooseTableRow(cells: string[]): string {
  return `|${cells.map((cell) => (cell === '' ? ' ' : ` ${cell} `)).join('|')}|`;
}

export function normalizeMarkdownTablesInFile(filePath: string): string | null {
  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  const out: string[] = [];
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('|') && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].startsWith('|')) {
        if (!isSeparatorRow(lines[j])) rows.push(splitRow(lines[j]));
        j++;
      }
      const rendered = renderMarkdownTable(header, rows);
      out.push(...rendered);
      if (rendered.join('\n') !== lines.slice(i, j).join('\n')) changed = true;
      i = j - 1;
      continue;
    }
    out.push(line);
  }

  if (!changed) return null;
  fs.writeFileSync(filePath, out.join(eol));
  return null;
}

export function padMarkdownCell(cell: string, width: number): string {
  return cell + ' '.repeat(Math.max(0, width - markdownCellWidth(cell)));
}

export function markdownCellWidth(s: string): number {
  let width = 0;
  for (const ch of Array.from(s.normalize('NFC'))) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0xfe0f || (code >= 0x300 && code <= 0x36f)) continue;
    width += isWideCodePoint(code) ? 2 : 1;
  }
  return width;
}

export function isWideCodePoint(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    code === 0x2329 ||
    code === 0x232a ||
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f000 && code <= 0x1faff) ||
    (code >= 0x2600 && code <= 0x27bf)
  );
}

export function stripInlineComment(s: string): string {
  let out = '';
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '#' && !inDouble && !inSingle) {
      return out;
    }
    out += c;
  }
  return out;
}

export function splitRow(line: string): string[] {
  if (!line.startsWith('|')) return [];
  const trimmed = line.replace(/\|\s*$/, '').replace(/^\|/, '');
  const cells: string[] = [];
  let buf = '';
  let inCode = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === '`') {
      inCode = !inCode;
      buf += c;
      continue;
    }
    if (c === '\\' && i + 1 < trimmed.length && trimmed[i + 1] === '|') {
      buf += '|';
      i++;
      continue;
    }
    if (c === '|' && !inCode) {
      cells.push(buf.trim());
      buf = '';
      continue;
    }
    buf += c;
  }
  cells.push(buf.trim());
  return cells;
}

export function isSeparatorRow(line: string): boolean {
  return /^\|\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
}

export function findSection(
  lines: string[],
  headingPattern: RegExp,
): { start: number; end: number } | null {
  for (let i = 0; i < lines.length; i++) {
    if (headingPattern.test(lines[i])) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^##\s/.test(lines[j])) {
          end = j;
          break;
        }
      }
      return { start: i, end };
    }
  }
  return null;
}

export function stripBackticks(s: string): string {
  return s.replace(/^`/, '').replace(/`$/, '').trim();
}

export function extractBacktickTokens(cell: string): string[] {
  const out: string[] = [];
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cell))) out.push(m[1]);
  return out;
}

export function modernChecklistLayout(cells: string[]): {
  hasMechanicalColumn: boolean;
  statusIndex: number;
  commentIndex: number;
  requirementIndex: number;
  pillarIndex: number;
  idsIndex: number;
} | null {
  if (cells.length >= 8 && (cells[2] === 'A' || Number.isFinite(Number(cells[6])))) {
    return {
      hasMechanicalColumn: true,
      statusIndex: 3,
      commentIndex: 4,
      requirementIndex: 5,
      pillarIndex: 6,
      idsIndex: 7,
    };
  }
  if (cells.length >= 7) {
    return {
      hasMechanicalColumn: false,
      statusIndex: 2,
      commentIndex: 3,
      requirementIndex: 4,
      pillarIndex: 5,
      idsIndex: 6,
    };
  }
  return null;
}

export function parseChecklistRules(lines: string[]): ChecklistRow[] {
  const out: ChecklistRow[] = [];
  let legacyScope: Scope | null = null;
  let sectionLevel: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const levelMatch = line.match(/^## Level (\d)\s+—/);
    if (levelMatch) {
      sectionLevel = `L${levelMatch[1]}`;
      legacyScope = null;
      continue;
    }
    if (/^## Optional\s*$/.test(line)) {
      sectionLevel = '—';
      legacyScope = null;
      continue;
    }
    if (/^## `MUST`\s*$/.test(line)) {
      legacyScope = 'MUST';
      sectionLevel = null;
    } else if (/^## `MUST when applicable`\s*$/.test(line)) {
      legacyScope = 'MUST when applicable';
      sectionLevel = null;
    } else if (/^## `SHOULD`\s*$/.test(line)) {
      legacyScope = 'SHOULD';
      sectionLevel = null;
    } else if (/^## `MAY`\s*$/.test(line)) {
      legacyScope = 'MAY';
      sectionLevel = null;
    } else if (/^## /.test(line)) {
      legacyScope = null;
      sectionLevel = null;
    }

    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);

    const layout = modernChecklistLayout(cells);
    if (sectionLevel && layout) {
      if (cells[0] === 'Scope') continue;
      const scope = stripBackticks(cells[0]) as Scope;
      if (!['MUST', 'MUST when applicable', 'SHOULD', 'MAY'].includes(scope)) continue;
      const row = makeRow(
        i + 1,
        cells[1],
        scope,
        cells[layout.pillarIndex],
        sectionLevel,
        cells[layout.requirementIndex],
        layout.hasMechanicalColumn ? cells[2] : '',
        cells[layout.statusIndex],
        cells[layout.commentIndex],
        extractBacktickTokens(cells[layout.idsIndex]),
      );
      if (row) out.push(row);
      continue;
    }

    if (!legacyScope) continue;
    if (cells.length < 6) continue;
    if (cells[0] === 'Rule') continue;
    const row = makeRow(
      i + 1,
      cells[0],
      legacyScope,
      cells[1],
      cells[2],
      cells[3],
      '',
      cells[4],
      cells[5],
      [],
    );
    if (row) out.push(row);
  }
  return out;
}

export function makeRow(
  line: number,
  ruleCell: string,
  scope: Scope,
  pillarCell: string,
  minLevel: string,
  requirement: string,
  automationMarker: string,
  statusCell: string,
  comment: string,
  ids: string[],
): ChecklistRow | null {
  const ruleMatch = ruleCell.match(/^`([^`]+)`$/);
  if (!ruleMatch) return null;
  const pillar = Number(pillarCell);
  if (!Number.isFinite(pillar)) return null;
  return {
    line,
    rule: ruleMatch[1],
    scope,
    pillar,
    minLevel,
    requirement,
    automationMarker,
    status: statusCell as RuleStatus,
    comment,
    ids,
  };
}

export function parseSummary(lines: string[]): SummaryRow[] {
  const range = findSection(lines, /^##\s+Conformance level summary\s*$/);
  if (!range) return [];
  const out: SummaryRow[] = [];
  for (let i = range.start + 1; i < range.end; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 4) continue;
    if (cells[0] === 'Level') continue;
    const m = cells[0].match(/Level\s+(\d)/);
    if (!m) continue;
    out.push({
      line: i + 1,
      level: m[1],
      levelCell: cells[0],
      status: cells[1] as SummaryStatus,
      dateReached: cells[2],
      notes: cells[3],
    });
  }
  return out;
}

export function formatDuration(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : '';
  totalSec = Math.abs(totalSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return (
    sign +
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  );
}

export const LEVEL_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4'];

export function minLevelLE(a: string, b: string): boolean {
  const ai = LEVEL_ORDER.indexOf(a);
  const bi = LEVEL_ORDER.indexOf(b);
  return ai >= 0 && bi >= 0 && ai <= bi;
}

const SHELL_VERBS = new Set([
  'cat',
  'ls',
  'grep',
  'rg',
  'fd',
  'find',
  'awk',
  'sed',
  'cut',
  'sort',
  'uniq',
  'wc',
  'head',
  'tail',
  'tr',
  'xargs',
  'echo',
  'test',
  'pwd',
  'env',
  'git',
  'gh',
  'curl',
  'wget',
  'jq',
  'yq',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'node',
  'tsx',
  'tsc',
  'deno',
  'bun',
  'python',
  'python3',
  'pip',
  'pipx',
  'uv',
  'poetry',
  'pytest',
  'docker',
  'kubectl',
  'helm',
  'terraform',
  'aws',
  'gcloud',
  'az',
  'make',
  'cargo',
  'go',
  'mvn',
  'gradle',
  'bash',
  'sh',
  'zsh',
]);

export function looksLikeCommand(tok: string): boolean {
  if (tok === '') return false;
  if (/^\S+:\d+$/.test(tok)) return false;
  if (!/\s/.test(tok)) {
    const head = tok.split(/[\s/]/)[0];
    if (SHELL_VERBS.has(head)) return true;
    return false;
  }
  const head = tok.split(/\s+/)[0];
  if (SHELL_VERBS.has(head)) return true;
  const segments = tok.split(/[|;&]+/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed === '') continue;
    const parts = trimmed.split(/\s+/);
    let i = 0;
    while (i < parts.length && /^[A-Z_][A-Z0-9_]*=/.test(parts[i])) i++;
    if (i < parts.length && SHELL_VERBS.has(parts[i])) return true;
  }
  return false;
}

export function commentHasDirectEvidence(comment: string): boolean {
  if (comment === '') return false;
  if (/\b\S+\.[A-Za-z0-9]+:\d+\b/.test(comment)) return true;
  if (/\b\S+\.[A-Za-z0-9]+\s+§\s+\S/.test(comment)) return true;
  if (/(^|[\s(])§\s+\S/.test(comment)) return true;
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(comment))) {
    const tok = m[1].trim();
    if (looksLikeCommand(tok)) continue;
    if (/^[A-Za-z0-9._\-/]+$/.test(tok) && (tok.includes('/') || /\.[A-Za-z0-9]+$/.test(tok))) {
      return true;
    }
  }
  return false;
}

export function hasApplicabilityReason(comment: string): boolean {
  if (comment === '') return false;
  const cues = [
    'not relevant',
    'not applicable',
    'does not apply',
    'trigger does not hold',
    'trigger does not apply',
    'no ui',
    'no frontend',
    'frontend-only',
    'frontend only',
    'no backend',
    'no public release',
    'no agents',
    'no regulated data',
    'no persistence',
    'no auth boundary',
    'no authorization',
    'no database',
    'no mcp',
    'no shared skills',
    'public data only',
    'public data',
    'not used',
    'n/a',
  ];
  const lower = comment.toLowerCase();
  if (cues.some((c) => lower.includes(c))) return true;
  if (/^\s*(no|not|same)\b/i.test(comment)) return true;
  if (commentHasDirectEvidence(comment)) return true;
  if (/`[^`]+`/.test(comment)) return true;
  return false;
}

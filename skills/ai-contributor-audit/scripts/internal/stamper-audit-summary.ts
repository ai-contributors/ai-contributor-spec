// SPDX-License-Identifier: Apache-2.0
//
// Audit summary projection for audit-stamp.ts.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  LEVEL_ORDER,
  findSection,
  hasApplicabilityReason,
  isSeparatorRow,
  minLevelLE,
  parseChecklistRules,
  parseSummary,
  renderMarkdownTable,
  renderSummaryTableRows,
  splitRow,
  stripBackticks,
  stripInlineComment,
  type ChecklistRow,
  type SummaryRow,
  type SummaryStatus,
} from './audit-markdown.ts';

type ExpectedBacklogRow = {
  priority: number;
  blocksLevel: string;
  rule: string;
  scope: string;
  status: string;
};

interface ActionCells {
  nextAction: string;
  owner: string;
  targetDate: string;
}

export function stampBacklog(paths: { checklistPath: string; summaryPath: string }): string | null {
  const original = fs.readFileSync(paths.checklistPath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  const existingRange = findSection(lines, /^##\s+Backlog\s+—\s+what to address first/);
  const priorLines =
    existingRange || !fs.existsSync(paths.summaryPath)
      ? lines
      : fs.readFileSync(paths.summaryPath, 'utf8').split(/\r?\n/);
  const newSection = renderBacklogSection(priorLines, parseChecklistRules(lines));

  let updated: string[];
  if (existingRange) {
    updated = [
      ...lines.slice(0, existingRange.start),
      ...newSection,
      '',
      ...lines.slice(existingRange.end),
    ];
  } else {
    return `Cannot stamp backlog: section "## Backlog — what to address first" not found in ${paths.checklistPath}.`;
  }

  const out = updated.join(eol);
  if (out === original) return null;
  fs.writeFileSync(paths.checklistPath, out);
  return null;
}

export function stampSummary(paths: { checklistPath: string }): string | null {
  const original = fs.readFileSync(paths.checklistPath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);

  const range = findSection(lines, /^##\s+Conformance level summary\s*$/);
  if (!range) {
    return (
      `Cannot stamp conformance summary: section "## Conformance level summary" ` +
      `not found in ${paths.checklistPath}.`
    );
  }

  let headerIdx = -1;
  for (let i = range.start + 1; i < range.end; i++) {
    if (/^\|\s*Level\b/.test(lines[i]) && /Status/.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return (
      `Cannot stamp conformance summary: header row "| Level | Status | …" not ` +
      `found in ${paths.checklistPath}.`
    );
  }
  const sepIdx = headerIdx + 1;
  if (sepIdx >= range.end || !isSeparatorRow(lines[sepIdx])) {
    return (
      `Cannot stamp conformance summary: separator row not found after the ` +
      `header in ${paths.checklistPath}.`
    );
  }
  const bodyStart = sepIdx + 1;
  let bodyEnd = bodyStart;
  while (bodyEnd < range.end && lines[bodyEnd].startsWith('|') && !isSeparatorRow(lines[bodyEnd])) {
    bodyEnd++;
  }

  const rules = parseChecklistRules(lines);
  const cumulative = (cap: string) => (r: ChecklistRow) =>
    (r.scope === 'MUST' || r.scope === 'MUST when applicable') && minLevelLE(r.minLevel, cap);
  const closureByLevel: Record<string, (r: ChecklistRow) => boolean> = {
    '0': cumulative('L0'),
    '1': cumulative('L1'),
    '2': cumulative('L2'),
    '3': cumulative('L3'),
    '4': (r) => cumulative('L4')(r) || r.scope === 'SHOULD',
  };

  function computeStatus(level: string): SummaryStatus {
    const isApplicable = closureByLevel[level];
    if (!isApplicable) return '';
    let anyAlarm = false;
    let anyOpen = false;
    for (const r of rules) {
      if (!isApplicable(r)) continue;
      if (r.status === '🚨 Alarm') anyAlarm = true;
      else if (r.status === '⚠️ Warning' || r.status === '') anyOpen = true;
      else if (r.status === '➖ Not relevant') {
        if (!hasApplicabilityReason(r.comment)) anyOpen = true;
      }
    }
    if (anyAlarm) return '❌ No';
    if (anyOpen) return '⚠️ Partial';
    return '✅ Yes';
  }

  const summaryRows: SummaryRow[] = [];
  for (let i = bodyStart; i < bodyEnd; i++) {
    const line = lines[i];
    const cells = splitRow(line);
    if (cells.length < 4) continue;
    const levelCell = cells[0];
    const m = levelCell.match(/Level\s+(\d)/);
    if (!m) continue;
    const level = m[1];
    const newStatus = computeStatus(level);
    const priorDate = cells[2];
    const notes = cells[3];
    let dateReached = priorDate;
    if (newStatus !== '✅ Yes') {
      dateReached = '';
    }
    summaryRows.push({
      line: i + 1,
      level,
      levelCell,
      status: newStatus,
      dateReached,
      notes,
    });
  }

  const before = lines.slice(0, headerIdx);
  const after = lines.slice(bodyEnd);
  const updated = [...before, ...renderSummaryTableRows(summaryRows), ...after];
  const out = updated.join(eol);
  if (out === original) return null;
  fs.writeFileSync(paths.checklistPath, out);
  return null;
}

export function stampConformanceLevel(paths: {
  checklistPath: string;
  auditPath: string;
}): string | null {
  const checklistRaw = fs.readFileSync(paths.checklistPath, 'utf8');
  const checklistLines = checklistRaw.split(/\r?\n/);
  const summary = parseSummary(checklistLines);
  let highest = -1;
  for (const row of summary) {
    if (row.status !== '✅ Yes') continue;
    const n = Number(row.level);
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  const value = highest < 0 ? 'none' : String(highest);
  const err1 = writeFrontmatterKey(paths.checklistPath, 'conformance_level', value);
  if (err1) return err1;
  const err2 = writeFrontmatterKey(paths.auditPath, 'conformance_level', value);
  if (err2) return err2;
  return null;
}

export function stampRootAuditSummary(paths: {
  checklistPath: string;
  auditPath: string;
  evidencePath: string;
  summaryPath: string;
  originalAuditDir: string;
}): string | null {
  const checklistRaw = fs.readFileSync(paths.checklistPath, 'utf8');
  const lines = checklistRaw.split(/\r?\n/);
  const summarySectionRaw = sectionCopy(
    lines,
    /^##\s+Conformance level summary\s*$/,
    `Cannot stamp root audit summary: section "## Conformance level summary" not found in ${paths.checklistPath}.`,
  );
  if (typeof summarySectionRaw === 'string') return summarySectionRaw;
  const summarySection = rewriteRootAuditSummaryLinks(summarySectionRaw);
  const backlogSection = sectionCopy(
    lines,
    /^##\s+Backlog\s+—\s+what to address first/,
    `Cannot stamp root audit summary: section "## Backlog — what to address first" not found in ${paths.checklistPath}.`,
  );
  if (typeof backlogSection === 'string') return backlogSection;

  const summaryDir = path.dirname(path.resolve(paths.summaryPath));
  const rel = (p: string) => normalizeMarkdownPath(path.relative(summaryDir, path.resolve(p)));
  const checklistRel = rel(paths.checklistPath);
  const auditLogRel = rel(paths.auditPath);
  const evidenceRel = rel(paths.evidencePath);
  const profileRel = rel(path.join(paths.originalAuditDir, 'AI-CONTRIBUTOR-AUDIT-PROFILE.md'));

  const profileState = profileWorktreeState(paths.originalAuditDir);
  const profileNote =
    profileState === 'tracked-deleted'
      ? [
          `> **Boundary note:** owner profile (\`${profileRel}\`) is a tracked deletion at stamp time. The audit ran without any owner applicability input — readers should treat profile-controlled checks accordingly. To restore prior owner answers, run \`git restore -- ${profileRel}\` and re-run the audit.`,
          '',
        ]
      : profileState
        ? [
            `> **Boundary note:** owner profile (\`${profileRel}\`) has ${profileState} changes at stamp time. The audited commit boundary does not include them; commit the profile and re-run the audit before publishing an external conformance claim.`,
            '',
          ]
        : [];

  const outLines = [
    '# AI Contributor Audit',
    '',
    'Full audit artifacts live in `.ai-contributor-audit/`:',
    '',
    `- [\`${checklistRel}\`](${encodeMarkdownPath(checklistRel)})`,
    `- [\`${auditLogRel}\`](${encodeMarkdownPath(auditLogRel)})`,
    `- [\`${evidenceRel}\`](${encodeMarkdownPath(evidenceRel)})`,
    `- [\`${profileRel}\`](${encodeMarkdownPath(profileRel)})`,
    '',
    ...profileNote,
    ...renderDisplayBadgeSection(frontmatterValue(lines, 'conformance_level') ?? 'none'),
    '',
    ...summarySection,
    '',
    ...backlogSection,
    '',
  ];

  const out = outLines.join('\n');
  fs.mkdirSync(path.dirname(paths.summaryPath), { recursive: true });
  const current = fs.existsSync(paths.summaryPath)
    ? fs.readFileSync(paths.summaryPath, 'utf8')
    : '';
  if (current === out) return null;
  fs.writeFileSync(paths.summaryPath, out);
  return null;
}

// Returns 'uncommitted', 'untracked', 'tracked-deleted', or null. The stamper
// uses this to surface profile state in the root summary so a reader of the
// committed audit can see at a glance whether the audited commit boundary
// excludes uncommitted profile edits, or whether the audit ran without any
// owner profile because the owner deliberately removed it.
function profileWorktreeState(
  originalAuditDir: string,
): 'uncommitted' | 'untracked' | 'tracked-deleted' | null {
  const repoRoot = path.dirname(path.resolve(originalAuditDir));
  const profileAbs = path.join(originalAuditDir, 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
  const profileRel = path.relative(repoRoot, profileAbs);
  const r = spawnSync('git', ['-C', repoRoot, 'status', '--porcelain=v1', '--', profileRel], {
    encoding: 'utf8',
  });
  if (r.status !== 0) return null;
  const line = (r.stdout ?? '')
    .toString()
    .split('\n')
    .find((l) => l.trim().length > 0);
  if (!fs.existsSync(profileAbs)) {
    if (line && /^[ MARC?]?D/.test(line)) return 'tracked-deleted';
    return null;
  }
  if (!line) return null;
  const code = line.slice(0, 2);
  if (code === '??') return 'untracked';
  if (code.trim().length > 0) return 'uncommitted';
  return null;
}

function expectedBacklogRows(rules: ChecklistRow[]): ExpectedBacklogRow[] {
  const expected: ExpectedBacklogRow[] = [];
  for (const r of rules) {
    if (r.scope === 'MAY') continue;
    if (r.status !== '🚨 Alarm' && r.status !== '⚠️ Warning') continue;
    let priority: number;
    if (r.scope === 'MUST' && r.status === '🚨 Alarm') priority = 1;
    else if (r.scope === 'MUST when applicable' && r.status === '🚨 Alarm') priority = 2;
    else if (r.scope === 'MUST' && r.status === '⚠️ Warning') priority = 3;
    else if (r.scope === 'MUST when applicable' && r.status === '⚠️ Warning') priority = 4;
    else if (r.scope === 'SHOULD') priority = 5;
    else continue;
    const blocksLevel = r.scope === 'SHOULD' ? 'L4' : r.minLevel;
    if (!LEVEL_ORDER.includes(blocksLevel)) continue;
    expected.push({ priority, blocksLevel, rule: r.rule, scope: r.scope, status: r.status });
  }
  expected.sort((a, b) => {
    const al = LEVEL_ORDER.indexOf(a.blocksLevel);
    const bl = LEVEL_ORDER.indexOf(b.blocksLevel);
    if (al !== bl) return al - bl;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.rule.toLowerCase().localeCompare(b.rule.toLowerCase());
  });
  return expected;
}

function renderBacklogSection(priorLines: string[], rules: ChecklistRow[]): string[] {
  const backlogRange = findSection(priorLines, /^##\s+Backlog\s+—\s+what to address first/);
  const prior = backlogRange
    ? collectActionCells(
        priorLines,
        backlogRange.start,
        backlogRange.end,
        backlogRuleCellIndex(priorLines, backlogRange.start, backlogRange.end),
      )
    : new Map<string, ActionCells>();
  const expected = expectedBacklogRows(rules);
  const rows: string[][] = [];
  if (expected.length === 0) {
    rows.push(['', '', '', '', '', '', '', '']);
  } else {
    for (const e of expected) {
      const p = prior.get(e.rule);
      const nextAction = p?.nextAction ?? '';
      const owner = p?.owner ?? '';
      const targetDate = p?.targetDate ?? '';
      rows.push([
        String(e.priority),
        e.blocksLevel,
        `\`${e.rule}\``,
        e.scope,
        e.status,
        nextAction,
        owner,
        targetDate,
      ]);
    }
  }
  const table = renderMarkdownTable(
    ['Priority', 'Level', 'Rule', 'Scope', 'Current status', 'Next action', 'Owner', 'Target date'],
    rows,
  );

  return [
    '## Backlog — what to address first',
    '',
    '> `Priority`, `Level`, `Rule`, `Scope`, and `Current status` are stamped automatically by `audit-stamp.ts` from the full checklist. Edit only `Next action`, `Owner`, and `Target date`.',
    '',
    'Populate this table from **every** checklist row where **Status** is `Alarm` or `Warning`. Do not drop rows for brevity. This keeps audits reproducible.',
    '',
    '**Priority tiers** (the `Priority` column is the tier number, **not** a sequential unique rank — ties are expected and correct):',
    '',
    '1. `MUST` at `Alarm` — repository fails on an unconditional requirement.',
    '2. `MUST when applicable` at `Alarm` — the requirement applies to the repository and is unmet.',
    '3. `MUST` at `Warning` — partial coverage or drift risk on an unconditional requirement.',
    '4. `MUST when applicable` at `Warning`.',
    '5. `SHOULD` at `Alarm` / `Warning` — each unmet `SHOULD` needs a documented reason in its Comment to count toward Level 4.',
    '',
    '**Ordering rules** (deterministic so two auditors produce the same row order):',
    '',
    '- Primary: ascending by `Level` (`L0`, then `L1`, through `L4`).',
    '- Secondary: ascending by `Priority` (tier 1 first, tier 5 last).',
    '- Tertiary: alphabetical by **Rule** name (case-insensitive).',
    '- `MAY` rows are **not** listed here even if at `Alarm` / `Warning`; `MAY` is optional and tracked only in the full checklist.',
    '',
    '**Cell conventions:**',
    '',
    '- `Priority` — severity tier, not a unique rank.',
    '- `Level` — conformance level this row affects in the step-by-step backlog.',
    '- `Scope` — one of `MUST`, `MUST when applicable`, `SHOULD`. No parentheticals.',
    '- `Current status` — the emoji-prefixed status from the full checklist (`🚨 Alarm` or `⚠️ Warning`).',
    '- `Next action` — the concrete remediation; reuse wording from the checklist Comment when appropriate.',
    '- `Owner` — handle or team (e.g. `@org/team`); leave blank if unknown.',
    '- `Target date` — ISO date (`YYYY-MM-DD`) or blank if unknown. Do **not** write `TBD`, `n/a`, or similar filler.',
    '',
    ...table,
    '',
    'Once a rule reaches `Fulfilled` or `Not relevant` in the checklist, it disappears from this backlog on the next stamp run.',
  ];
}

function backlogRuleCellIndex(lines: string[], sectionStart: number, sectionEnd: number): number {
  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells[0] !== 'Priority') continue;
    return cells[1] === 'Level' || cells[1] === 'Blocks level' ? 2 : 1;
  }
  return 2;
}

function collectActionCells(
  lines: string[],
  sectionStart: number,
  sectionEnd: number,
  ruleCellIndex: number,
): Map<string, ActionCells> {
  const out = new Map<string, ActionCells>();
  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 7) continue;
    if (cells[ruleCellIndex] === 'Rule') continue;
    const rule = stripBackticks(cells[ruleCellIndex]);
    if (rule === '') continue;
    if (!out.has(rule)) {
      const actionStart = ruleCellIndex + 3;
      out.set(rule, {
        nextAction: cells[actionStart] ?? '',
        owner: cells[actionStart + 1] ?? '',
        targetDate: cells[actionStart + 2] ?? '',
      });
    }
  }
  return out;
}

function writeFrontmatterKey(filePath: string, key: string, value: string): string | null {
  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/);
    if (!m) continue;
    if (m[1] !== key) continue;
    lines[i] = `${key}: ${value}`;
    break;
  }
  const out = lines.join(eol);
  if (out === original) return null;
  fs.writeFileSync(filePath, out);
  return null;
}

function sectionCopy(lines: string[], heading: RegExp, error: string): string[] | string {
  const range = findSection(lines, heading);
  if (!range) return error;
  return trimBlankEdges(lines.slice(range.start, range.end));
}

function rewriteRootAuditSummaryLinks(lines: string[]): string[] {
  return lines.map((line) =>
    line.replace(/\]\(\.\.\/README\.md#display-your-level\)/g, '](README.md#display-your-level)'),
  );
}

function frontmatterValue(lines: string[], key: string): string | null {
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return null;
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/);
    if (!m || m[1] !== key) continue;
    const v = stripInlineComment(m[2]).trim();
    return v === '' ? null : v;
  }
  return null;
}

function renderDisplayBadgeSection(level: string): string[] {
  const badge = badgeMarkdown(level);
  return [
    '## Display your level badge',
    '',
    '> Stamped automatically by `audit-stamp.ts` from `conformance_level`.',
    '',
    badge ?? 'No badge is displayed for `conformance_level: none` or `conformance_level: 0`.',
  ];
}

function badgeMarkdown(level: string): string | null {
  const target = './AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels';
  if (level === '1') {
    return `[![AI Contributor: Level 1 Hardened](https://img.shields.io/badge/AI%20Contributor-Level%201%20Hardened-blue)](${target})`;
  }
  if (level === '2') {
    return `[![AI Contributor: Level 2 AI Assisted](https://img.shields.io/badge/AI%20Contributor-Level%202%20AI%20Assisted-green)](${target})`;
  }
  if (level === '3') {
    return `[![AI Contributor: Level 3 AI Authored](https://img.shields.io/badge/AI%20Contributor-Level%203%20AI%20Authored-brightgreen)](${target})`;
  }
  if (level === '4') {
    return `[![AI Contributor: Level 4 AI Autonomous](https://img.shields.io/badge/AI%20Contributor-Level%204%20AI%20Autonomous-blueviolet)](${target})`;
  }
  return null;
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end);
}

function normalizeMarkdownPath(p: string): string {
  const normalized = p.split(path.sep).join('/');
  return normalized === '' ? '.' : normalized;
}

function encodeMarkdownPath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/');
}

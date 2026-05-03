// SPDX-License-Identifier: Apache-2.0
//
// Stamped evidence blocks for audit-stamp.ts.

import fs from 'node:fs';
import path from 'node:path';
import {
  extractBacktickTokens,
  modernChecklistLayout,
  parseChecklistRules,
  renderLooseTableRow,
  splitRow,
  type ChecklistRow,
} from './audit-markdown.ts';
import { renderStampedBlock, validateStampedBlockLines } from './stamped-block.ts';

const COLLECTOR_ROWS_BEGIN = '<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->';
const COLLECTOR_ROWS_END = '<!-- END:STAMPED-COLLECTOR-ROWS -->';
const VGAPS_BEGIN = '<!-- BEGIN:STAMPED-VERIFICATION-GAPS -->';
const VGAPS_END = '<!-- END:STAMPED-VERIFICATION-GAPS -->';

interface EvidenceBlockPaths {
  auditPath: string;
  checklistPath: string;
  evidencePath: string;
}

interface StampedRow {
  evidenceKey: string;
  aicIds: string[];
  ruleName: string;
  cmd: string;
  excerpt: string;
}

export function stampAuditLogCollectorRows(
  paths: Pick<EvidenceBlockPaths, 'auditPath' | 'evidencePath'>,
): string | null {
  let evidenceRaw: string;
  try {
    evidenceRaw = fs.readFileSync(paths.evidencePath, 'utf8');
  } catch {
    // No evidence — nothing to stamp; not an error (mirrors the other
    // collector-driven stamps).
    return null;
  }
  let evidence: {
    github_api?: unknown;
    preflight?: unknown;
    target?: unknown;
    rules?: Record<string, unknown>;
  };
  try {
    evidence = JSON.parse(evidenceRaw);
  } catch {
    return null; // already surfaced by stampDerivedRuleStatuses
  }
  const rulesObj = evidence.rules;
  if (!rulesObj || typeof rulesObj !== 'object') return null;

  const collectorRows: StampedRow[] = collectorPreflightRows(evidence, paths.evidencePath);
  const authRows: StampedRow[] = authDisclosureRows(evidence.github_api);
  const rows: StampedRow[] = [];
  for (const [evidenceKey, raw] of Object.entries(rulesObj)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as {
      derived_status?: unknown;
      judgment_required?: unknown;
      aic_ids?: unknown;
      commands?: unknown;
      spec_rule_name?: unknown;
    };
    if (r.judgment_required !== false) continue;
    if (
      r.derived_status !== 'Fulfilled' &&
      r.derived_status !== 'Warning' &&
      r.derived_status !== 'Alarm' &&
      r.derived_status !== 'Not relevant'
    ) {
      continue;
    }
    const aicIds = Array.isArray(r.aic_ids)
      ? r.aic_ids.filter((x): x is string => typeof x === 'string')
      : [];
    if (aicIds.length === 0) continue;
    const ruleName = typeof r.spec_rule_name === 'string' ? r.spec_rule_name : evidenceKey;
    const cmds = Array.isArray(r.commands) ? r.commands : [];
    if (cmds.length === 0) continue; // inventory-only — skip per design
    for (const c of cmds) {
      if (!c || typeof c !== 'object') continue;
      const cc = c as { cmd?: unknown; stdout_excerpt?: unknown };
      const cmd = typeof cc.cmd === 'string' ? cc.cmd : '';
      if (cmd === '') continue;
      const excerpt = typeof cc.stdout_excerpt === 'string' ? cc.stdout_excerpt : '';
      rows.push({ evidenceKey, aicIds, ruleName, cmd, excerpt });
    }
  }

  rows.sort((a, b) => {
    if (a.evidenceKey !== b.evidenceKey) return a.evidenceKey.localeCompare(b.evidenceKey);
    return a.cmd.localeCompare(b.cmd);
  });
  const renderedSourceRows = [...collectorRows, ...authRows, ...rows];

  const original = fs.readFileSync(paths.auditPath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);

  const markerRange = findMarkerRange(lines, COLLECTOR_ROWS_BEGIN, COLLECTOR_ROWS_END);
  if (!markerRange) return null;
  const blockErr = validateStampedBlockBeforeRewrite(
    lines,
    markerRange.beginIdx,
    markerRange.endIdx,
    'STAMPED-COLLECTOR-ROWS',
  );
  if (blockErr) return blockErr;

  const renderedRows: string[] = renderedSourceRows.map((r) => {
    const ids = r.aicIds.map((id) => `\`${id}\``).join(', ');
    const ruleCell = `\`${r.ruleName}\``;
    const cmdCell = `\`${escapeCellInline(r.cmd)}\``;
    const excerptCell = `\`${escapeCellInline(truncateExcerpt(r.excerpt))}\``;
    return renderLooseTableRow([ids, ruleCell, cmdCell, excerptCell]);
  });

  const before = lines.slice(0, markerRange.beginIdx + 1);
  const after = lines.slice(markerRange.endIdx);
  const updated = [...before, ...renderStampedBlock(renderedRows), ...after];
  const out = updated.join(eol);
  if (out === original) return null;
  fs.writeFileSync(paths.auditPath, out);
  return null;
}

export function stampVerificationGaps(
  paths: Pick<EvidenceBlockPaths, 'checklistPath' | 'evidencePath'>,
): string | null {
  let evidenceRaw: string;
  try {
    evidenceRaw = fs.readFileSync(paths.evidencePath, 'utf8');
  } catch {
    return null;
  }
  let evidence: { rules?: Record<string, unknown> };
  try {
    evidence = JSON.parse(evidenceRaw);
  } catch {
    return null;
  }
  const rulesObj = evidence.rules;
  if (!rulesObj || typeof rulesObj !== 'object') return null;

  const original = fs.readFileSync(paths.checklistPath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);

  const markerRange = findMarkerRange(lines, VGAPS_BEGIN, VGAPS_END);
  if (!markerRange) return null;
  const blockErr = validateStampedBlockBeforeRewrite(
    lines,
    markerRange.beginIdx,
    markerRange.endIdx,
    'STAMPED-VERIFICATION-GAPS',
  );
  if (blockErr) return blockErr;

  // Build a quick lookup: AIC ID → checklist row (rule name + current Status).
  const checklistRows = parseChecklistRules(lines);
  const rowByAic = new Map<string, ChecklistRow>();
  for (const r of checklistRows) {
    // Re-derive AIC IDs from the row line in source: parseChecklistRules does
    // not retain the IDs cell, so re-scan the row text directly.
    const raw = lines[r.line - 1];
    const rawCells = splitRow(raw);
    const layout = modernChecklistLayout(rawCells);
    const ids = layout ? extractBacktickTokens(rawCells[layout.idsIndex] ?? '') : [];
    for (const id of ids) {
      if (!rowByAic.has(id)) rowByAic.set(id, r);
    }
  }

  interface GapRow {
    aicId: string;
    rule: string;
    status: string;
    triggerEvidence: string;
    derivationReason: string;
    evidenceKey: string;
  }
  const out: GapRow[] = [];
  for (const [evidenceKey, raw] of Object.entries(rulesObj)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as {
      derivation_reason?: unknown;
      judgment_required?: unknown;
      aic_ids?: unknown;
      applicability?: unknown;
      spec_rule_name?: unknown;
    };
    if (r.judgment_required !== true) continue;
    const reason = typeof r.derivation_reason === 'string' ? r.derivation_reason : '';
    if (!reason.includes('Verification gap')) continue;
    const aicIds = Array.isArray(r.aic_ids)
      ? r.aic_ids.filter((x): x is string => typeof x === 'string')
      : [];
    if (aicIds.length === 0) continue;
    let trigger = '';
    if (r.applicability && typeof r.applicability === 'object') {
      const ap = r.applicability as { trigger_evidence?: unknown };
      if (typeof ap.trigger_evidence === 'string') trigger = ap.trigger_evidence;
    }
    for (const aicId of aicIds) {
      const row = rowByAic.get(aicId);
      const ruleName =
        row?.rule ?? (typeof r.spec_rule_name === 'string' ? r.spec_rule_name : evidenceKey);
      const status = row?.status ?? '';
      out.push({
        aicId,
        rule: ruleName,
        status,
        triggerEvidence: trigger,
        derivationReason: reason,
        evidenceKey,
      });
    }
  }

  out.sort((a, b) => a.aicId.localeCompare(b.aicId));

  const renderedRows: string[] = out.map((g) => {
    const what = `Auto-stamped from AI-CONTRIBUTOR-EVIDENCE.json — collector applicability: ${g.triggerEvidence}`;
    const owner = `Re-run the collector with host API access (gh auth login + appropriate scopes) and resolve ${g.evidenceKey}.`;
    return renderLooseTableRow([
      `\`${g.rule}\``,
      g.status,
      escapeTableCell(what),
      escapeTableCell(g.derivationReason),
      escapeTableCell(owner),
    ]);
  });

  const before = lines.slice(0, markerRange.beginIdx + 1);
  const after = lines.slice(markerRange.endIdx);
  const updated = [...before, ...renderStampedBlock(renderedRows), ...after];
  const outText = updated.join(eol);
  if (outText === original) return null;
  fs.writeFileSync(paths.checklistPath, outText);
  return null;
}

function collectorPreflightRows(
  evidence: {
    github_api?: unknown;
    preflight?: unknown;
    target?: unknown;
    rules?: Record<string, unknown>;
  },
  evidencePath: string,
): StampedRow[] {
  const preflight =
    evidence.preflight && typeof evidence.preflight === 'object'
      ? (evidence.preflight as {
          executor?: unknown;
        })
      : null;
  const executor =
    preflight?.executor && typeof preflight.executor === 'object'
      ? (preflight.executor as {
          invocation?: unknown;
          entrypoint?: unknown;
        })
      : null;
  const target =
    evidence.target && typeof evidence.target === 'object'
      ? (evidence.target as {
          path?: unknown;
          audited_commit?: unknown;
          mode?: unknown;
        })
      : null;
  const invocation =
    typeof executor?.invocation === 'string' && executor.invocation !== ''
      ? executor.invocation
      : 'npx --yes tsx@4.21.0';
  const entrypoint =
    typeof executor?.entrypoint === 'string' && executor.entrypoint !== ''
      ? executor.entrypoint
      : 'audit-collect.ts';
  const targetPath = typeof target?.path === 'string' && target.path !== '' ? target.path : '.';
  const cmdParts = [
    invocation,
    entrypoint.includes('audit-collect.ts') ? entrypoint : 'audit-collect.ts',
    shellQuote(targetPath),
    '--out',
    shellQuote(evidencePath),
  ];
  if (target?.mode === 'working-tree') cmdParts.push('--working-tree');
  else if (typeof target?.audited_commit === 'string' && target.audited_commit !== '') {
    cmdParts.push('--commit', shellQuote(target.audited_commit));
  }

  const rules = evidence.rules && typeof evidence.rules === 'object' ? evidence.rules : {};
  const statuses = Object.values(rules).map((raw) => {
    if (!raw || typeof raw !== 'object') return { status: null, judgmentRequired: false };
    const r = raw as { derived_status?: unknown; judgment_required?: unknown };
    return {
      status: typeof r.derived_status === 'string' ? r.derived_status : null,
      judgmentRequired: r.judgment_required === true,
    };
  });
  const count = (status: string) => statuses.filter((s) => s.status === status).length;
  const judgmentRequired = statuses.filter((s) => s.judgmentRequired).length;
  const commit =
    typeof target?.audited_commit === 'string' && target.audited_commit !== ''
      ? target.audited_commit
          .replace(/^working-tree:HEAD=/, '')
          .replace(/\+dirty$/, '')
          .slice(0, 8)
      : 'unknown';
  const mode = typeof target?.mode === 'string' ? target.mode : 'unknown';
  const tokenTier = githubTokenTier(evidence.github_api);
  return [
    {
      evidenceKey: 'audit-collect',
      aicIds: [],
      ruleName: '<preflight>',
      cmd: cmdParts.join(' '),
      excerpt:
        `[audit-collect] wrote ${displayEvidencePath(evidencePath)} — ${Object.keys(rules).length} rules; ` +
        `Fulfilled=${count('Fulfilled')} Warning=${count('Warning')} Alarm=${count('Alarm')} ` +
        `judgment_required=${judgmentRequired} commit=${commit} mode=${mode} token_tier=${tokenTier}`,
    },
  ];
}

function githubTokenTier(githubApi: unknown): string {
  if (!githubApi || typeof githubApi !== 'object') return 'unknown';
  const tier = (githubApi as { token_tier?: unknown }).token_tier;
  return typeof tier === 'string' && tier !== '' ? tier : 'unknown';
}

function displayEvidencePath(evidencePath: string): string {
  const rel = path.relative(process.cwd(), evidencePath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : evidencePath;
}

function authDisclosureRows(githubApi: unknown): StampedRow[] {
  if (!githubApi || typeof githubApi !== 'object') return [];
  const g = githubApi as {
    active_login?: unknown;
    auth_status_excerpt?: unknown;
    token_tier?: unknown;
    scopes_observed?: unknown;
  };
  const login = typeof g.active_login === 'string' && g.active_login !== '' ? g.active_login : null;
  const excerptParts: string[] = [];
  if (login) excerptParts.push(`login=${login}`);
  if (typeof g.token_tier === 'string') excerptParts.push(`token_tier=${g.token_tier}`);
  if (Array.isArray(g.scopes_observed) && g.scopes_observed.length > 0) {
    excerptParts.push(
      `scopes=${g.scopes_observed.filter((x): x is string => typeof x === 'string').join(',')}`,
    );
  }
  if (typeof g.auth_status_excerpt === 'string' && g.auth_status_excerpt !== '') {
    excerptParts.push(g.auth_status_excerpt);
  }
  if (excerptParts.length === 0) return [];
  return [
    {
      evidenceKey: 'github-auth',
      aicIds: [],
      ruleName: '<preflight>',
      cmd: 'gh api user --jq .login',
      excerpt: excerptParts.join('; '),
    },
  ];
}

function findMarkerRange(
  lines: string[],
  beginMarker: string,
  endMarker: string,
): { beginIdx: number; endIdx: number } | null {
  let beginIdx = -1;
  let endIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === beginMarker) beginIdx = i;
    else if (lines[i].trim() === endMarker) {
      endIdx = i;
      break;
    }
  }
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) return null;
  return { beginIdx, endIdx };
}

function validateStampedBlockBeforeRewrite(
  lines: string[],
  beginIdx: number,
  endIdx: number,
  label: string,
): string | null {
  const validation = validateStampedBlockLines(lines, beginIdx, endIdx);
  if (validation.ok) return null;
  if (validation.reason === 'missing-checksum') {
    return (
      `Cannot rewrite ${label}: stamped block has content but no checksum sentinel. ` +
      `Delete the content between the BEGIN/END markers or restore it before re-running audit-stamp.ts.`
    );
  }
  return (
    `Cannot rewrite ${label}: stamped block checksum mismatch. ` +
    `The block appears to have been edited by hand; restore it or delete the content between the BEGIN/END markers before re-running audit-stamp.ts.`
  );
}

function truncateExcerpt(s: string): string {
  if (s.length <= 120) return s;
  return s.slice(0, 119) + '…';
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./:=@+-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`;
}

// Make a string safe for a single markdown table cell that we wrap in
// backticks: collapse newlines into the literal characters `\n` and
// escape pipes so the cell stays a single column.
function escapeCellInline(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\\n').replace(/\|/g, '\\|');
}

// Plain-text cell escape for table cells that are NOT wrapped in backticks.
// Pipes must be escaped; newlines must be flattened so the cell stays one
// row.
function escapeTableCell(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, ' ').replace(/\|/g, '\\|');
}

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-summary.ts — read-only one-shot summary of an existing
// AI-CONTRIBUTOR-EVIDENCE.json. Prints counts, the list of collector-decisive
// rules, the list of collector-judgment-required rules with reasons, and
// metadata about the audited commit and target.
//
// Replaces the ad-hoc `node -e "const e=require('./.../EVIDENCE.json'); ..."`
// scripts agents otherwise write to inspect collector output. Pure stdout,
// no mutation, safe to run any time after audit-collect.ts.
//
// Usage:
//   tsx audit-summary.ts [<evidence.json>]
//
// Default path: ./.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json
//
// Exit codes:
//   0  printed summary
//   1  evidence file missing or unparseable
//   2  CLI / parser error

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const AUDIT_SUMMARY_VERSION = '0.1.0';

interface EvidenceLite {
  $schema_version?: string;
  audit_collect_version?: string;
  spec_version?: string | null;
  spec_source?: string | null;
  target?: {
    audited_commit?: string;
    mode?: string;
    host?: { owner?: string | null; repo?: string | null };
  };
  github_api?: { token_tier?: string; active_login?: string | null };
  profile?: { path?: string; present?: boolean; answers?: unknown[] };
  rules?: Record<
    string,
    {
      spec_rule_name?: string;
      derived_status?: string | null;
      derivation_reason?: string;
      judgment_required?: boolean;
      applicability?: { verdict?: string };
      aic_ids?: string[];
    }
  >;
  errors?: Array<{ stage: string; detail: string }>;
}

const USAGE = 'Usage: audit-summary.ts [<evidence.json>]';

export interface SummaryResult {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
}

export function runSummary(argv: string[]): SummaryResult {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { exitCode: 0, stdout: USAGE, stderr: '' };
  }
  const positional = argv.filter((a) => !a.startsWith('--'));
  if (positional.length > 1) return { exitCode: 2, stdout: '', stderr: USAGE };
  const evidencePath = path.resolve(
    positional[0] ?? path.join('.ai-contributor-audit', 'AI-CONTRIBUTOR-EVIDENCE.json'),
  );

  if (!fs.existsSync(evidencePath)) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `audit-summary: evidence file not found at ${evidencePath}. Run audit-collect.ts first (or pass the path).`,
    };
  }
  let raw: string;
  try {
    raw = fs.readFileSync(evidencePath, 'utf8');
  } catch (e) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `audit-summary: cannot read ${evidencePath}: ${(e as Error).message}`,
    };
  }
  let ev: EvidenceLite;
  try {
    ev = JSON.parse(raw);
  } catch (e) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `audit-summary: ${evidencePath} is not valid JSON: ${(e as Error).message}`,
    };
  }

  const out: string[] = [];
  out.push(
    `audit-summary v${AUDIT_SUMMARY_VERSION} — ${path.relative(process.cwd(), evidencePath) || evidencePath}`,
  );
  out.push('');
  out.push('Audit metadata:');
  out.push(`  spec_version          ${ev.spec_version ?? '—'}`);
  out.push(`  spec_source           ${ev.spec_source ?? '—'}`);
  out.push(`  audit_collect_version ${ev.audit_collect_version ?? '—'}`);
  out.push(`  audited_commit        ${ev.target?.audited_commit ?? '—'}`);
  out.push(`  mode                  ${ev.target?.mode ?? '—'}`);
  const owner = ev.target?.host?.owner ?? null;
  const repo = ev.target?.host?.repo ?? null;
  out.push(`  host                  ${owner && repo ? `${owner}/${repo}` : '—'}`);
  out.push(`  github_api login      ${ev.github_api?.active_login ?? '—'}`);
  out.push(`  github_api tier       ${ev.github_api?.token_tier ?? '—'}`);
  out.push(
    `  profile               ${
      ev.profile?.present
        ? `present (${(ev.profile?.answers ?? []).length} answers) at ${ev.profile?.path ?? '?'}`
        : 'absent'
    }`,
  );
  out.push('');

  const rules = ev.rules ?? {};
  const ids = Object.keys(rules).sort();
  let fulfilled = 0,
    warning = 0,
    alarm = 0,
    notRelevant = 0,
    judgment = 0,
    blank = 0;
  const decisive: Array<{ id: string; status: string }> = [];
  const judgmentRows: Array<{ id: string; reason: string; applicability: string }> = [];

  for (const id of ids) {
    const r = rules[id];
    if (r.judgment_required === true) {
      judgment++;
      judgmentRows.push({
        id,
        reason: r.derivation_reason?.trim() ?? '',
        applicability: r.applicability?.verdict ?? 'unknown',
      });
      continue;
    }
    // Collector JSON uses bare status names (Fulfilled / Warning / Alarm /
    // Not relevant); the icons are added later by audit-stamp when it writes
    // the checklist row.
    const status = (r.derived_status ?? '') as string;
    if (status === 'Fulfilled') fulfilled++;
    else if (status === 'Warning') warning++;
    else if (status === 'Alarm') alarm++;
    else if (status === 'Not relevant') notRelevant++;
    else if (status === '' || status === null) blank++;
    if (status !== '' && status !== null) decisive.push({ id, status });
  }

  out.push(
    `Counts (${ids.length} collector rules): Fulfilled=${fulfilled} Warning=${warning} Alarm=${alarm} NotRelevant=${notRelevant} judgment_required=${judgment}${
      blank > 0 ? ` blank=${blank}` : ''
    }`,
  );
  out.push('');

  if (decisive.length > 0) {
    out.push(`Collector decisive (${decisive.length}):`);
    for (const d of decisive) out.push(`  ${d.id.padEnd(36)} ${d.status}`);
    out.push('');
  }

  if (judgmentRows.length > 0) {
    out.push(`Collector judgment-required (${judgmentRows.length}):`);
    for (const j of judgmentRows) {
      const reason = j.reason || `applicability=${j.applicability}`;
      out.push(`  ${j.id.padEnd(36)} ${reason}`);
    }
    out.push('');
  }

  if (ev.errors && ev.errors.length > 0) {
    out.push(`Collector errors (${ev.errors.length}):`);
    for (const e of ev.errors) out.push(`  ${e.stage}: ${e.detail}`);
    out.push('');
  }

  out.push(
    'Auditor-owned rows (rules without collector coverage, or non-collector checklist rows): see [audit-stamp] needs-status advisory after the next stamp run.',
  );

  return { exitCode: 0, stdout: out.join('\n'), stderr: '' };
}

const invokedAsScript =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  const result = runSummary(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr + '\n');
  process.exit(result.exitCode);
}

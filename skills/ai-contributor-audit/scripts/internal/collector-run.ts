// SPDX-License-Identifier: Apache-2.0
//
// Run-loop helpers for audit-collect.

import fs from 'node:fs';
import path from 'node:path';
import type { CollectorRuleId } from './collector-registry.ts';
import type { Evidence, RuleEvidence } from './collector-types.ts';

export type CollectorRule = readonly [CollectorRuleId, () => RuleEvidence];

export interface CollectorCliOptions {
  target: string;
  out: string;
  commit: string | null;
  workingTree: boolean;
  noNetwork: boolean;
  authorshipWindow: number;
  bootstrapSmokeEnabled: boolean;
  bootstrapSmokeTimeoutMs: number;
}

export const COLLECTOR_USAGE =
  'Usage: audit-collect.ts <target-repo-path> [--commit <sha>] [--out <path>] [--working-tree] [--no-network] [--authorship-window <n>] [--enable-bootstrap-smoke] [--bootstrap-smoke-timeout-ms <n>]';

export function parseCollectorCliArgs(
  raw: string[],
  defaultAuditDir: string,
): CollectorCliOptions | { error: string } {
  const positional: string[] = [];
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]!;
    if (a.startsWith('--')) {
      const next = raw[i + 1];
      if (next && !next.startsWith('--')) {
        opts[a.slice(2)] = next;
        i++;
      } else {
        opts[a.slice(2)] = true;
      }
    } else {
      positional.push(a);
    }
  }

  if (positional.length !== 1) return { error: COLLECTOR_USAGE };

  const target = path.resolve(positional[0]!);
  const parsePositiveInt = (name: string, fallback: number): number => {
    const rawValue = opts[name];
    if (typeof rawValue !== 'string') return fallback;
    const n = parseInt(rawValue, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return {
    target,
    out: String(opts.out ?? path.join(target, defaultAuditDir, 'AI-CONTRIBUTOR-EVIDENCE.json')),
    commit: typeof opts.commit === 'string' ? opts.commit : null,
    workingTree: opts['working-tree'] === true,
    noNetwork: opts['no-network'] === true,
    authorshipWindow: parsePositiveInt('authorship-window', 200),
    bootstrapSmokeEnabled: opts['enable-bootstrap-smoke'] === true,
    bootstrapSmokeTimeoutMs: parsePositiveInt('bootstrap-smoke-timeout-ms', 600_000),
  };
}

export function runCollectorRules(
  ruleEntries: readonly CollectorRule[],
  recordError: (stage: string, detail: string) => void,
): Record<string, RuleEvidence> {
  const rules: Record<string, RuleEvidence> = {};
  for (const [id, fn] of ruleEntries) {
    try {
      rules[id] = fn();
      if (rules[id].errors?.length) {
        // Already captured in rule evidence; collection still proceeds.
      }
    } catch (e) {
      recordError(`rule:${id}`, (e as Error).message);
      rules[id] = {
        spec_rule_name: id,
        applicability: { verdict: 'unknown', trigger_evidence: 'collector error' },
        commands: [],
        derived_status: null,
        derivation_reason: `collector error: ${(e as Error).message}`,
        judgment_required: true,
        aic_ids: [],
      };
    }
  }
  return rules;
}

export function writeEvidence(out: string, evidence: Evidence): void {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n');
}

export function evidenceSummary(args: {
  out: string;
  rules: Record<string, RuleEvidence>;
  auditedCommit: string;
  mode: Evidence['target']['mode'];
  tokenTier: Evidence['github_api']['token_tier'];
}): string {
  const fulfilled = Object.values(args.rules).filter(
    (r) => r.derived_status === 'Fulfilled',
  ).length;
  const warning = Object.values(args.rules).filter((r) => r.derived_status === 'Warning').length;
  const alarm = Object.values(args.rules).filter((r) => r.derived_status === 'Alarm').length;
  const judge = Object.values(args.rules).filter((r) => r.judgment_required).length;
  return (
    `[audit-collect] wrote ${args.out} — ${Object.keys(args.rules).length} rules; ` +
    `Fulfilled=${fulfilled} Warning=${warning} Alarm=${alarm} judgment_required=${judge} ` +
    `commit=${args.auditedCommit.slice(0, 8)} mode=${args.mode} token_tier=${args.tokenTier}`
  );
}

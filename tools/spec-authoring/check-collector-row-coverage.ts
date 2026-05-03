#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Verifies that collector AIC-ID mappings cannot mechanically stamp a checklist
// row from partial evidence. A row is safe to stamp only when every visible
// AIC-* ID in that row has decisive collector evidence.

import fs from 'node:fs';
import {
  decisiveRulesByAic,
  expectedCollectorStamp,
} from '../../skills/ai-contributor-audit/scripts/internal/audit-evidence.ts';
import { parseChecklistRows } from './shared/checklist-parser.ts';

const CHECKLIST = '.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md';
const COLLECTOR = 'skills/ai-contributor-audit/scripts/internal/collector-registry.ts';

// Rows below intentionally remain auditor-owned until the collector can prove
// every visible ID in the row. If one stops being partial, remove it here.
const ALLOWED_PARTIAL_ROWS = new Map<string, string[]>([
  ['Pinned Toolchain', ['AIC-lockfile-committed']],
  ['CI Gates', ['AIC-ci-pinned-toolchain']],
  ['Branch Protection', ['AIC-required-checks-and-reviews', 'AIC-risky-change-ownership']],
  ['Workflow Security', ['AIC-short-lived-deploy-creds']],
  ['SBOM', ['AIC-release-dependency-identification']],
  [
    'Architecture Boundaries',
    [
      'AIC-layer-responsibilities-defined',
      'AIC-dependency-directions-explicit',
      'AIC-shared-layer-import-protection',
    ],
  ],
  ['AI Boundaries', ['AIC-ai-instruction-coverage', 'AIC-ai-instruction-boundaries']],
  ['Test Layers', ['AIC-critical-behavior-tested']],
]);

function main(): void {
  const rows = parseChecklistRows(fs.readFileSync(CHECKLIST, 'utf8'));
  const ruleMap = parseCollectorRuleMap(fs.readFileSync(COLLECTOR, 'utf8'));
  const mappedIds = new Set(Object.values(ruleMap).flat());
  const decisive = decisiveRulesByAic(fakeRules(ruleMap));
  const problems: string[] = [];
  const seenPartial = new Set<string>();

  for (const row of rows) {
    const covered = row.ids.filter((id) => mappedIds.has(id));
    if (covered.length === 0) continue;

    const stamp = expectedCollectorStamp(row.ids, decisive);
    const missing = row.ids.filter((id) => !mappedIds.has(id));
    if (missing.length === 0) {
      if (!stamp) {
        problems.push(`row "${row.rule}" has full collector ID coverage but would not stamp`);
      }
      continue;
    }

    const allowedMissing = ALLOWED_PARTIAL_ROWS.get(row.rule);
    seenPartial.add(row.rule);
    if (!allowedMissing) {
      problems.push(
        `row "${row.rule}" has partial collector coverage. Covered: ${covered.join(', ')}; missing: ${missing.join(', ')}. ` +
          `Either fully cover the row, split it, or add an explicit auditor-owned exception in this check.`,
      );
      continue;
    }

    if (allowedMissing.slice().sort().join('\n') !== missing.slice().sort().join('\n')) {
      problems.push(
        `row "${row.rule}" partial coverage changed. Expected missing: ${allowedMissing.join(', ')}; actual missing: ${missing.join(', ')}`,
      );
    }
    if (stamp) {
      problems.push(
        `row "${row.rule}" has partial collector coverage but would still stamp as "${stamp.status}"`,
      );
    }
  }

  for (const rule of ALLOWED_PARTIAL_ROWS.keys()) {
    if (!seenPartial.has(rule)) {
      problems.push(`stale partial-coverage exception for row "${rule}"`);
    }
  }

  if (problems.length) {
    console.error('Problems:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  console.log(
    `OK — collector mappings cannot stamp partial checklist rows ` +
      `(${ALLOWED_PARTIAL_ROWS.size} explicit auditor-owned partial row(s))`,
  );
}

function parseCollectorRuleMap(source: string): Record<string, string[]> {
  const block = source.match(
    /(?:export )?const RULE_AIC_IDS.*?= \{([\s\S]+?)\n\}(?: satisfies [\s\S]+?)?;/,
  );
  if (!block || !block[1]) {
    throw new Error(`Could not find RULE_AIC_IDS in ${COLLECTOR}`);
  }

  const out: Record<string, string[]> = {};
  for (const match of block[1]!.matchAll(/'([^']+)': \[([^\]]*)\]/g)) {
    const rule = match[1]!;
    const ids = [...match[2]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
    out[rule] = ids;
  }
  if (Object.keys(out).length === 0) {
    throw new Error(`RULE_AIC_IDS in ${COLLECTOR} parsed as empty`);
  }
  return out;
}

function fakeRules(ruleMap: Record<string, string[]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rule, ids] of Object.entries(ruleMap)) {
    out[rule] = {
      judgment_required: false,
      derived_status: 'Fulfilled',
      derivation_reason: `fake evidence for ${rule}`,
      aic_ids: ids,
    };
  }
  return out;
}

main();

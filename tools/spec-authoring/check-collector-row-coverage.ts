#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Verifies that collector AIC-ID mappings cannot mechanically stamp a checklist
// row from partial evidence. A row is safe to stamp only when every visible
// AIC-* ID in that row has decisive collector evidence.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  decisiveRulesByAic,
  expectedCollectorStamp,
} from '../../skills/ai-contributor-audit/scripts/internal/audit-evidence.ts';
import {
  collectorAicIdsFromCatalog,
  validateRuleCatalog,
  type RuleCatalog,
} from './generate-rule-catalog.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);

interface CollectorCoverageOptions {
  allowedPartialRows?: ReadonlyMap<string, readonly string[]>;
}

interface CollectorChecklistRow {
  rule: string;
  ids: string[];
}

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
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const catalogProblems = validateRuleCatalog(catalog);
  if (catalogProblems.length > 0) {
    console.error(`${CATALOG} is invalid:`);
    for (const problem of catalogProblems) console.error(`- ${problem}`);
    process.exit(1);
  }
  const problems = collectorRowCoverageProblemsFromCatalog(catalog);

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

export function collectorRowCoverageProblemsFromCatalog(
  catalog: RuleCatalog,
  options: CollectorCoverageOptions = {},
): string[] {
  const rows = collectorRowsFromCatalog(catalog);
  const ruleMap = collectorAicIdsFromCatalog(catalog);
  const mappedIds = new Set(Object.values(ruleMap).flat());
  const decisive = decisiveRulesByAic(fakeRules(ruleMap));
  const problems: string[] = [];
  const seenPartial = new Set<string>();
  const allowedPartialRows = options.allowedPartialRows ?? ALLOWED_PARTIAL_ROWS;

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

    const allowedMissing = allowedPartialRows.get(row.rule);
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

  for (const rule of allowedPartialRows.keys()) {
    if (!seenPartial.has(rule)) {
      problems.push(`stale partial-coverage exception for row "${rule}"`);
    }
  }

  return problems;
}

function collectorRowsFromCatalog(catalog: RuleCatalog): CollectorChecklistRow[] {
  const rows = new Map<string, CollectorChecklistRow>();
  for (const entry of catalog.rules) {
    const key = `${entry.level}\0${entry.checklist.rule}`;
    const row = rows.get(key) ?? { rule: entry.checklist.rule, ids: [] };
    row.ids.push(entry.id);
    rows.set(key, row);
  }
  return [...rows.values()];
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

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

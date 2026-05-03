#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Runner for audit-collect smoke-test shards. The shard filenames mirror the
// collector source modules they primarily exercise.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_ROOT = path.resolve(HERE, '..');

const shards = [
  'test-audit-collect-github-hosted.ts',
  'test-audit-collect-profile.ts',
  'test-audit-collect-policy-docs.ts',
  'test-audit-collect-github-hosted-rules.ts',
  'test-audit-collect-package-baseline.ts',
  'test-audit-collect-surface-inventory.ts',
  'test-audit-collect-github-actions.ts',
  'test-audit-collect-code-quality.ts',
  'test-audit-collect-secret-hygiene.ts',
  'test-audit-collect-ai-instructions.ts',
  'test-audit-collect-mcp.ts',
  'test-audit-collect-prompt.ts',
  'test-audit-collect-codeowners.ts',
  'test-audit-collect-tests.ts',
  'test-audit-collect-formatting.ts',
  'test-audit-collect-guardrail-doc.ts',
  'test-audit-collect-authorship.ts',
  'test-audit-collect-hosted-settings.ts',
  'test-audit-collect-bootstrap.ts',
] as const;

let failed = 0;
for (const shard of shards) {
  const shardPath = path.join(HERE, shard);
  const result = spawnSync('tsx', [shardPath], {
    cwd: TOOLS_ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    failed++;
    console.error(`FAIL ${shard} exited ${result.status}`);
  }
}

if (failed > 0) {
  console.error(`${failed} audit-collect shard(s) failed`);
  process.exit(1);
}
console.log('All audit-collect shards passed');

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Verifies generated audit blocks protected by STAMPED-BLOCK-SHA256
// sentinels. Empty template blocks are allowed. Non-empty generated blocks
// must carry a checksum written by audit-stamp.ts; if the checksum no longer
// matches, an auditor edited content that the next stamp run would overwrite.

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import {
  STAMPED_BLOCK_BEGIN_RE,
  STAMPED_BLOCK_END_RE,
  stampedBlockLabel,
  validateStampedBlockLines,
} from '../../skills/ai-contributor-audit/scripts/internal/stamped-block.ts';

const tracked = execSync("git ls-files '*.md'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const problems: string[] = [];
let blocks = 0;

for (const file of tracked) {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const begin = lines[i].trim();
    if (!STAMPED_BLOCK_BEGIN_RE.test(begin)) continue;
    blocks++;
    const label = stampedBlockLabel(begin);
    let endIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (STAMPED_BLOCK_END_RE.test(lines[j].trim())) {
        endIdx = j;
        break;
      }
    }
    if (endIdx === -1) {
      problems.push(`${file}:${i + 1}: ${label} has no matching END marker`);
      continue;
    }
    const validation = validateStampedBlockLines(lines, i, endIdx);
    if (validation.ok) {
      i = endIdx;
      continue;
    }
    if (validation.reason === 'missing-checksum') {
      problems.push(
        `${file}:${i + 2}: ${label} has content but no STAMPED-BLOCK-SHA256 sentinel; rerun audit-stamp.ts or clear the block`,
      );
      i = endIdx;
      continue;
    }
    problems.push(
      `${file}:${i + 2}: ${label} checksum mismatch; generated content appears to have been edited by hand`,
    );
    i = endIdx;
  }
}

console.log(`stamped blocks checked: ${blocks}`);
if (problems.length) {
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('OK — stamped blocks are empty templates or checksum-valid generated content');

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import {
  renderStampedBlock,
  stampedBlockChecksum,
  stampedBlockLabel,
  validateStampedBlockLines,
} from '../../skills/ai-contributor-audit/scripts/internal/stamped-block.ts';

let failed = 0;

function assert(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`OK   ${name}`);
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
  if (detail) console.error(detail);
}

const content = ['| A | B |', '| x | y |'];
const rendered = renderStampedBlock(content);

assert(
  'renderStampedBlock includes checksum sentinel',
  /^<!-- STAMPED-BLOCK-SHA256: [0-9a-f]{64} -->$/.test(rendered[0] ?? ''),
);
assert(
  'renderStampedBlock preserves content after spacer',
  rendered.slice(2, 4).join('\n') === content.join('\n'),
);
assert('renderStampedBlock returns empty for empty content', renderStampedBlock([]).length === 0);

const validLines = ['<!-- BEGIN:STAMPED-ROWS -->', ...rendered, '<!-- END:STAMPED-ROWS -->'];
const valid = validateStampedBlockLines(validLines, 0, validLines.length - 1);
assert('validateStampedBlockLines accepts rendered block', valid.ok && valid.empty === false);

const blankLines = ['<!-- BEGIN:STAMPED-ROWS -->', '', '  ', '<!-- END:STAMPED-ROWS -->'];
const blank = validateStampedBlockLines(blankLines, 0, blankLines.length - 1);
assert('validateStampedBlockLines accepts empty template block', blank.ok && blank.empty === true);

const missingChecksum = ['<!-- BEGIN:STAMPED-ROWS -->', '| edited |', '<!-- END:STAMPED-ROWS -->'];
const missing = validateStampedBlockLines(missingChecksum, 0, missingChecksum.length - 1);
assert(
  'validateStampedBlockLines rejects content without checksum',
  !missing.ok && missing.reason === 'missing-checksum',
);

const tampered = [...validLines];
tampered[3] = '| x | edited |';
const invalid = validateStampedBlockLines(tampered, 0, tampered.length - 1);
assert(
  'validateStampedBlockLines rejects checksum mismatch',
  !invalid.ok && invalid.reason === 'checksum-mismatch',
);

assert(
  'stampedBlockChecksum ignores no implicit blank padding',
  stampedBlockChecksum(content) === stampedBlockChecksum([...content]),
);
assert(
  'stampedBlockLabel parses begin marker label',
  stampedBlockLabel('<!-- BEGIN:STAMPED-ROWS -->') === 'STAMPED-ROWS',
);

if (failed > 0) {
  console.error(`${failed} stamped-block assertion(s) failed`);
  process.exit(1);
}

console.log('All stamped-block assertions passed');

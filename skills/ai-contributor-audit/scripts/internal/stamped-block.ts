#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { createHash } from 'node:crypto';

export const STAMPED_BLOCK_BEGIN_RE = /^<!-- BEGIN:STAMPED-[A-Z0-9-]+ -->$/;
export const STAMPED_BLOCK_END_RE = /^<!-- END:STAMPED-[A-Z0-9-]+ -->$/;
export const STAMPED_BLOCK_CHECKSUM_RE = /^<!-- STAMPED-BLOCK-SHA256: ([0-9a-f]{64}) -->$/;

const STAMPED_BLOCK_CHECKSUM_PREFIX = '<!-- STAMPED-BLOCK-SHA256:';

export type StampedBlockValidation =
  | { ok: true; empty: boolean }
  | { ok: false; reason: 'missing-checksum' | 'checksum-mismatch'; checksumLineOffset: number };

export function stampedBlockLabel(beginMarker: string): string {
  return beginMarker
    .trim()
    .replace(/^<!-- BEGIN:/, '')
    .replace(/ -->$/, '');
}

export function renderStampedBlock(contentLines: string[]): string[] {
  if (contentLines.length === 0) return [];
  return [stampedBlockChecksumLine(contentLines), '', ...contentLines, ''];
}

export function stampedBlockChecksumLine(contentLines: string[]): string {
  return `${STAMPED_BLOCK_CHECKSUM_PREFIX} ${stampedBlockChecksum(contentLines)} -->`;
}

export function stampedBlockChecksum(contentLines: string[]): string {
  return createHash('sha256').update(contentLines.join('\n'), 'utf8').digest('hex');
}

export function validateStampedBlockLines(
  lines: string[],
  beginIdx: number,
  endIdx: number,
): StampedBlockValidation {
  const block = lines.slice(beginIdx + 1, endIdx);
  if (block.length === 0 || block.every((line) => line.trim() === '')) {
    return { ok: true, empty: true };
  }
  const checksumMatch = block[0].trim().match(STAMPED_BLOCK_CHECKSUM_RE);
  if (!checksumMatch) {
    return { ok: false, reason: 'missing-checksum', checksumLineOffset: 1 };
  }
  const content = stripOuterBlankLines(block.slice(1));
  const actual = stampedBlockChecksum(content);
  if (actual !== checksumMatch[1]) {
    return { ok: false, reason: 'checksum-mismatch', checksumLineOffset: 1 };
  }
  return { ok: true, empty: false };
}

export function stripOuterBlankLines(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  return lines.slice(start, end);
}

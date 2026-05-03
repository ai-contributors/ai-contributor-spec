// SPDX-License-Identifier: Apache-2.0
//
// Mirrors GitHub's auto-generated heading-anchor slug rules:
//   - lowercase
//   - strip backtick code spans down to inner text
//   - strip raw HTML tags
//   - strip emoji (U+1F300..U+1FAFF)
//   - strip all chars except letters / digits / spaces / `_` / `-`
//   - replace whitespace runs with single hyphen
//   - duplicate headings get `-1`, `-2`, ... appended (caller passes a counts map)
//
// The `counts` parameter is the disambiguation state for the file currently
// being parsed. Each call increments the count for the produced base slug.

export function githubSlug(text: string, counts: Map<string, number>): string {
  const s = text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s/g, '-');
  const seen = counts.get(s) || 0;
  counts.set(s, seen + 1);
  return seen > 0 ? `${s}-${seen}` : s;
}

// SPDX-License-Identifier: Apache-2.0
//
// Replace the body inside a `<!-- BEGIN:GENERATED <id> -->` /
// `<!-- END:GENERATED <id> -->` marker pair with `body`.
//
// Used by generate-audit-profile-template. The marker convention is documented in
// AI-CONTRIBUTOR-AUDIT-MODEL.md "When to stamp, when to validate."
//
// Throws if the markers are not present so a regenerate run on a stripped
// file fails loudly instead of silently producing an unstamped file.

export function stampGeneratedBlock(content: string, id: string, body: string): string {
  const re = new RegExp(`(<!-- BEGIN:GENERATED ${id} -->)[\\s\\S]*?(<!-- END:GENERATED ${id} -->)`);
  if (!re.test(content)) {
    throw new Error(`Marker block not found: ${id}. Did you remove the BEGIN/END comments?`);
  }
  return content.replace(re, `$1\n${body}\n$2`);
}

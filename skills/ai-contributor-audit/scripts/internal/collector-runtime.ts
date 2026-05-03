#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';

const DEFAULT_EXCERPT_LINES = 5;
const REDACTED = '[REDACTED]';
// Match keys whose *suffix* is a known secret-bearing word, so genuine secret
// values (`temp_clone_token`, `access_token`, `api_secret`, `private_key`)
// redact while GitHub API metadata field names that *contain* the word
// (`secret_scanning`, `secret_scanning_push_protection`) are preserved.
const SENSITIVE_JSON_KEY_RE =
  /(?:^|[_-])(token|secret|password|credential|authorization|private[_-]?key)$/i;

export function excerpt(s: string, maxLines = DEFAULT_EXCERPT_LINES): string {
  const lines = s.replace(/\r\n/g, '\n').split('\n');
  const trimmed = lines.slice(0, maxLines).join('\n');
  return lines.length > maxLines ? `${trimmed}\n\u2026` : trimmed;
}

export function redactSensitiveText(s: string): string {
  return s.replace(
    /((?:"?[^"\n,{}:=]*(?:token|secret|password|credential|authorization|private[_-]?key)[^"\n,{}:=]*"?\s*[:=]\s*))("[^"]*"|[^,\n}]+)/gi,
    `$1"${REDACTED}"`,
  );
}

export function sanitizeForEvidence(value: unknown, key = ''): unknown {
  if (key && SENSITIVE_JSON_KEY_RE.test(key)) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => sanitizeForEvidence(item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      out[childKey] = sanitizeForEvidence(childValue, childKey);
    }
    return out;
  }
  return typeof value === 'string' ? redactSensitiveText(value) : value;
}

export function readJsoncOrNull(p: string): unknown {
  try {
    return JSON.parse(stripJsonc(fs.readFileSync(p, 'utf8')));
  } catch {
    return null;
  }
}

// Strip line comments, block comments, and trailing commas so JSON.parse
// can read tsconfig.json (which is JSONC by convention). Comment-stripping
// respects strings: `"foo // bar"` is unchanged.
export function stripJsonc(src: string): string {
  let out = '';
  let i = 0;
  let inStr = false;
  let strCh: string | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < src.length) {
        out += n;
        i += 2;
        continue;
      }
      if (c === strCh) {
        inStr = false;
        strCh = null;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strCh = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  // Strip trailing commas before ] or }.
  return out.replace(/,(\s*[\]}])/g, '$1');
}

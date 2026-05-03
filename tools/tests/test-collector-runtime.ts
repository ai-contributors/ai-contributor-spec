#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  excerpt,
  readJsoncOrNull,
  redactSensitiveText,
  sanitizeForEvidence,
  stripJsonc,
} from '../../skills/ai-contributor-audit/scripts/internal/collector-runtime.ts';

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

assert(
  'excerpt truncates after five lines',
  excerpt(['1', '2', '3', '4', '5', '6'].join('\n')) === '1\n2\n3\n4\n5\n\u2026',
);
assert('excerpt preserves short output', excerpt('one\ntwo') === 'one\ntwo');

const redacted = redactSensitiveText(
  'token=abc password: hunter2 authorization="Bearer xyz" private_key=key',
);
assert(
  'redactSensitiveText redacts secret-like assignments',
  !/abc|hunter2|Bearer xyz/.test(redacted),
  redacted,
);

const sanitized = sanitizeForEvidence({
  name: 'repo',
  temp_clone_token: 'SHOULD_NOT_LEAK',
  nested: {
    output: 'authorization: Bearer ALSO_SHOULD_NOT_LEAK',
    values: ['password=NOPE', 'safe'],
  },
}) as {
  temp_clone_token?: string;
  nested?: { output?: string; values?: string[] };
};
assert(
  'sanitizeForEvidence redacts sensitive object keys',
  sanitized.temp_clone_token === '[REDACTED]',
);
assert(
  'sanitizeForEvidence redacts sensitive string values recursively',
  sanitized.nested?.output?.includes('ALSO_SHOULD_NOT_LEAK') === false &&
    sanitized.nested?.values?.[0]?.includes('NOPE') === false,
);

const jsonc = stripJsonc(`{
  // line comment
  "url": "https://example.invalid/a//b",
  "nested": {
    "ok": true,
  },
  /* block comment */
}`);
assert(
  'stripJsonc keeps comment-like text inside strings',
  jsonc.includes('https://example.invalid/a//b'),
);
assert('stripJsonc removes line comments', !jsonc.includes('line comment'));
assert('stripJsonc removes block comments', !jsonc.includes('block comment'));
assert('stripJsonc removes trailing commas', JSON.parse(jsonc).nested.ok === true);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-runtime-jsonc-'));
try {
  const valid = path.join(tmp, 'tsconfig.json');
  const invalid = path.join(tmp, 'invalid.json');
  fs.writeFileSync(valid, '{ "compilerOptions": { "strict": true, }, }\n');
  fs.writeFileSync(invalid, '{ invalid json');
  assert(
    'readJsoncOrNull reads JSONC files',
    (readJsoncOrNull(valid) as { compilerOptions?: { strict?: boolean } } | null)?.compilerOptions
      ?.strict === true,
  );
  assert('readJsoncOrNull returns null for invalid files', readJsoncOrNull(invalid) === null);
  assert(
    'readJsoncOrNull returns null for missing files',
    readJsoncOrNull(path.join(tmp, 'missing.json')) === null,
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`${failed} collector-runtime assertion(s) failed`);
  process.exit(1);
}

console.log('All collector-runtime assertions passed');

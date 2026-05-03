#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BOOTSTRAP = path.join(REPO_ROOT, 'skills', 'ai-contributor-audit', 'scripts', 'bootstrap.ts');
const TSX = path.join(HERE, '..', 'node_modules', '.bin', 'tsx');

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

function manifestEntries(): string[] {
  const source = fs.readFileSync(BOOTSTRAP, 'utf8');
  const match = source.match(/const MANIFEST: readonly string\[] = \[([\s\S]*?)\];/);
  if (!match) throw new Error(`Cannot find MANIFEST array in ${BOOTSTRAP}`);
  const entries: string[] = [];
  const re = /'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(match[1]))) entries.push(m[1]);
  return entries;
}

const manifest = manifestEntries();
assert(
  'bootstrap manifest ships audit-markdown.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/audit-markdown.ts'),
);
assert(
  'bootstrap manifest ships collector-runtime.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-runtime.ts'),
);
assert(
  'bootstrap manifest ships collector-hosted-settings.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-hosted-settings.ts'),
);
assert(
  'bootstrap manifest ships collector-github-api.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-github-api.ts'),
);
assert(
  'bootstrap manifest ships collector-local-runtime.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-local-runtime.ts'),
);
assert(
  'bootstrap manifest ships collector-profile.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-profile.ts'),
);
assert(
  'bootstrap manifest ships collector-registry.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-registry.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-ai-instructions.ts',
  manifest.includes(
    'skills/ai-contributor-audit/scripts/internal/collector-rules-ai-instructions.ts',
  ),
);
assert(
  'bootstrap manifest ships collector-rules-authorship.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-authorship.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-bootstrap.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-bootstrap.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-codeowners.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-codeowners.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-code-quality.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-code-quality.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-formatting.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-formatting.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-guardrail-doc.ts',
  manifest.includes(
    'skills/ai-contributor-audit/scripts/internal/collector-rules-guardrail-doc.ts',
  ),
);
assert(
  'bootstrap manifest ships collector-rules-github-actions.ts',
  manifest.includes(
    'skills/ai-contributor-audit/scripts/internal/collector-rules-github-actions.ts',
  ),
);
assert(
  'bootstrap manifest ships collector-rules-github-hosted.ts',
  manifest.includes(
    'skills/ai-contributor-audit/scripts/internal/collector-rules-github-hosted.ts',
  ),
);
assert(
  'bootstrap manifest ships collector-rules-mcp.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-mcp.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-package-baseline.ts',
  manifest.includes(
    'skills/ai-contributor-audit/scripts/internal/collector-rules-package-baseline.ts',
  ),
);
assert(
  'bootstrap manifest ships collector-rules-policy-docs.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-policy-docs.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-prompt.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-prompt.ts'),
);
assert(
  'bootstrap manifest ships collector-rules-secret-hygiene.ts',
  manifest.includes(
    'skills/ai-contributor-audit/scripts/internal/collector-rules-secret-hygiene.ts',
  ),
);
assert(
  'bootstrap manifest ships collector-rules-tests.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-rules-tests.ts'),
);
assert(
  'bootstrap manifest ships collector-run.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-run.ts'),
);
assert(
  'bootstrap manifest ships collector-stack-scope.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-stack-scope.ts'),
);
assert(
  'bootstrap manifest ships collector-surface-inventory.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-surface-inventory.ts'),
);
assert(
  'bootstrap manifest ships collector-workflow-helpers.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-workflow-helpers.ts'),
);
assert(
  'bootstrap manifest ships collector-worktree.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-worktree.ts'),
);
assert(
  'bootstrap manifest ships stamped-block.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/stamped-block.ts'),
);
assert(
  'bootstrap manifest ships collector-types.ts',
  manifest.includes('skills/ai-contributor-audit/scripts/internal/collector-types.ts'),
);

const missing = manifest.filter((rel) => !fs.existsSync(path.join(REPO_ROOT, rel)));
assert('all manifest files exist locally', missing.length === 0, missing.join('\n'));

// Reverse check: every .ts file under skills/ai-contributor-audit/scripts/
// must be listed in the manifest. Catches drift when a new module is added
// to the modular runbook but the manifest is forgotten — without this the
// bootstrap silently ships an incomplete tree and isolated runs ERR_MODULE_NOT_FOUND.
const SCRIPTS_DIR = path.join(REPO_ROOT, 'skills', 'ai-contributor-audit', 'scripts');
function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(abs));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(path.relative(REPO_ROOT, abs).split(path.sep).join('/'));
    }
  }
  return out;
}
const onDisk = listTsFiles(SCRIPTS_DIR);
const manifestSet = new Set(manifest);
const unlisted = onDisk.filter((rel) => !manifestSet.has(rel));
assert(
  'every .ts file under skills/ai-contributor-audit/scripts/ is in bootstrap MANIFEST',
  unlisted.length === 0,
  unlisted.length ? `Add these to MANIFEST in bootstrap.ts:\n  ${unlisted.join('\n  ')}` : '',
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-contributor-bootstrap-smoke-'));
try {
  for (const rel of manifest) {
    const src = path.join(REPO_ROOT, rel);
    const dst = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }

  fs.writeFileSync(
    path.join(tmp, 'AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json'),
    JSON.stringify(
      {
        $schema_version: '1',
        bootstrap_version: 'test',
        spec_source:
          'https://github.com/ai-contributors/ai-contributor-spec/tree/0000000000000000000000000000000000000000',
        spec_ref: '0000000000000000000000000000000000000000',
        files: manifest,
      },
      null,
      2,
    ) + '\n',
  );

  const validateScript = path.join(
    tmp,
    'skills',
    'ai-contributor-audit',
    'scripts',
    'audit-validate.ts',
  );
  const checklist = path.join(tmp, '.ai-contributor-audit', 'AI-CONTRIBUTOR-CHECKLIST.md');
  const auditLog = path.join(tmp, '.ai-contributor-audit', 'AI-CONTRIBUTOR-AUDIT-LOG.md');
  const result = spawnSync(TSX, [validateScript, checklist, auditLog, '--template'], {
    cwd: tmp,
    encoding: 'utf8',
  });

  assert(
    'bootstrapped skill validator runs from isolated runbook directory',
    result.status === 0 && result.stdout.includes('OK —'),
    `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`${failed} skill-bootstrap assertion(s) failed`);
  process.exit(1);
}

console.log('All skill-bootstrap assertions passed');

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Subprocess test for bootstrap.ts main(): spins up a localhost http server
// that serves a fake manifest, runs `tsx bootstrap.ts <ref> --out=<dir>`
// with AIC_BOOTSTRAP_RAW_BASE pointed at the server, and asserts the
// runbook directory is materialized correctly. Covers main(), the URL
// construction loop, and the manifest writer.

import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'skills', 'ai-contributor-audit', 'scripts', 'bootstrap.ts');
const TSX = path.join(HERE, '..', 'node_modules', '.bin', 'tsx');

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function fail(label: string, detail = ''): void {
  console.error(`FAIL ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

interface SpawnResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function spawnAsync(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ status: code, stdout, stderr }));
  });
}

function startServer(handler: http.RequestListener): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, close: () => server.close() });
    });
    server.on('error', reject);
  });
}

// Happy path: server returns a small body for every manifest path; main()
// writes everything to outDir, then writes the manifest JSON, exits 0.
{
  let requests = 0;
  const { port, close } = await startServer((_req, res) => {
    requests++;
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain');
    res.end(`fake content\n`);
  });
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-main-ok-'));
    try {
      const result = await spawnAsync(TSX, [SCRIPT, 'v0.1.0', `--out=${tmp}`], {
        ...process.env,
        AIC_BOOTSTRAP_RAW_BASE: `http://127.0.0.1:${port}/ai-contributors/ai-contributor-spec`,
      });
      if (result.status === 0 && result.stdout.includes('bootstrap complete')) {
        ok('bootstrap.ts main(): happy path against localhost mock exits 0');
      } else {
        fail(
          'bootstrap main happy',
          `status=${result.status}\nstdout:\n${result.stdout.slice(0, 400)}\nstderr:\n${result.stderr.slice(0, 400)}`,
        );
      }
      const manifestPath = path.join(tmp, 'AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json');
      if (fs.existsSync(manifestPath)) {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (m.spec_ref === 'v0.1.0' && Array.isArray(m.files) && m.files.length > 10) {
          ok('bootstrap.ts wrote AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json with manifest data');
        } else {
          fail('manifest content', JSON.stringify(m).slice(0, 200));
        }
      } else {
        fail('manifest exists', `not at ${manifestPath}`);
      }
      if (requests > 20) {
        ok(`bootstrap.ts fetched all manifest entries (${requests} requests)`);
      } else {
        fail('request count', `only ${requests} requests`);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } finally {
    close();
  }
}

// Error path: invalid ref -> exit 2 with helpful stderr; no server hits.
{
  const result = spawnSync(TSX, [SCRIPT, 'main', '--out=/tmp/aic-bootstrap-bad-ref'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (result.status === 2 && /must be a 40-char commit SHA/.test(result.stderr)) {
    ok('bootstrap.ts main(): invalid ref rejected with exit 2');
  } else {
    fail(
      'bootstrap invalid ref',
      `status=${result.status}\nstderr:\n${result.stderr.slice(0, 200)}`,
    );
  }
}

// Error path: server returns 404 for some entry -> main() exits 2 with
// "error fetching ..." on stderr.
{
  const { port, close } = await startServer((_req, res) => {
    res.statusCode = 404;
    res.end('nope');
  });
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-main-404-'));
    try {
      const result = await spawnAsync(TSX, [SCRIPT, 'v0.1.0', `--out=${tmp}`], {
        ...process.env,
        AIC_BOOTSTRAP_RAW_BASE: `http://127.0.0.1:${port}/x/y`,
      });
      if (
        result.status === 2 &&
        /error fetching/.test(result.stderr) &&
        /HTTP 404/.test(result.stderr)
      ) {
        ok('bootstrap.ts main(): 404 from raw endpoint -> exit 2 with error fetching');
      } else {
        fail('bootstrap 404', `status=${result.status}\nstderr:\n${result.stderr.slice(0, 300)}`);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } finally {
    close();
  }
}

// Staleness advisory path: when the ref-check API can compare the pinned ref
// and reports it behind main, bootstrap warns but still materializes the runbook.
{
  const { port, close } = await startServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname.endsWith('/compare/main...v0.1.0')) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ status: 'behind', behind_by: 2 }));
      return;
    }
    if (url.pathname.endsWith('/git/matching-refs/tags/v')) {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify([]));
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain');
    res.end('fake content\n');
  });
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-main-stale-'));
    try {
      const result = await spawnAsync(TSX, [SCRIPT, 'v0.1.0', `--out=${tmp}`], {
        ...process.env,
        AIC_BOOTSTRAP_RAW_BASE: `http://127.0.0.1:${port}/raw`,
        AIC_BOOTSTRAP_REF_CHECK_API_BASE: `http://127.0.0.1:${port}/repos/ai-contributors/ai-contributor-spec`,
      });
      if (
        result.status === 0 &&
        /installed skill\/runbook ref is behind upstream main: v0\.1\.0/.test(result.stderr) &&
        /do not auto-update during an audit/.test(result.stderr)
      ) {
        ok('bootstrap.ts main(): behind-main staleness warning is non-fatal');
      } else {
        fail(
          'bootstrap behind-main warning',
          `status=${result.status}\nstderr:\n${result.stderr.slice(0, 500)}`,
        );
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } finally {
    close();
  }
}

// Staleness advisory errors are non-fatal: if the comparison API is
// unreachable, bootstrap continues from the pinned raw ref without warning.
{
  const { port, close } = await startServer((_req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain');
    res.end('fake content\n');
  });
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-main-stale-unreachable-'));
    try {
      const result = await spawnAsync(TSX, [SCRIPT, 'v0.1.0', `--out=${tmp}`], {
        ...process.env,
        AIC_BOOTSTRAP_RAW_BASE: `http://127.0.0.1:${port}/raw`,
        AIC_BOOTSTRAP_REF_CHECK_API_BASE:
          'http://127.0.0.1:1/repos/ai-contributors/ai-contributor-spec',
      });
      if (
        result.status === 0 &&
        /bootstrap complete/.test(result.stdout) &&
        !/warning:/.test(result.stderr)
      ) {
        ok('bootstrap.ts main(): unreachable staleness API is non-fatal');
      } else {
        fail(
          'bootstrap staleness unreachable',
          `status=${result.status}\nstdout:\n${result.stdout.slice(0, 300)}\nstderr:\n${result.stderr.slice(0, 300)}`,
        );
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } finally {
    close();
  }
}

// Explicit staleness skip avoids the advisory API even when it would have
// reported the pinned ref as stale.
{
  let apiRequests = 0;
  const { port, close } = await startServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname.includes('/compare/') || url.pathname.includes('/git/matching-refs/')) {
      apiRequests++;
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ status: 'behind', behind_by: 2 }));
      return;
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain');
    res.end('fake content\n');
  });
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-main-stale-skip-'));
    try {
      const result = await spawnAsync(
        TSX,
        [SCRIPT, 'v0.1.0', `--out=${tmp}`, '--skip-stale-check'],
        {
          ...process.env,
          AIC_BOOTSTRAP_RAW_BASE: `http://127.0.0.1:${port}/raw`,
          AIC_BOOTSTRAP_REF_CHECK_API_BASE: `http://127.0.0.1:${port}/repos/ai-contributors/ai-contributor-spec`,
        },
      );
      if (result.status === 0 && apiRequests === 0 && !/warning:/.test(result.stderr)) {
        ok('bootstrap.ts main(): --skip-stale-check avoids advisory API');
      } else {
        fail(
          'bootstrap staleness skip',
          `status=${result.status}; apiRequests=${apiRequests}; stderr:\n${result.stderr.slice(0, 300)}`,
        );
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } finally {
    close();
  }
}

// Error path: parser usage error (no ref) -> exit 2 with usage.
{
  const result = spawnSync(TSX, [SCRIPT], { encoding: 'utf8', timeout: 30_000 });
  if (result.status === 2 && /Usage: bootstrap\.ts/.test(result.stderr)) {
    ok('bootstrap.ts main(): no ref -> exit 2 with usage');
  } else {
    fail('bootstrap no ref', `status=${result.status}\nstderr:\n${result.stderr.slice(0, 200)}`);
  }
}

if (failed > 0) {
  console.error(`${failed} bootstrap-main test(s) failed`);
  process.exit(1);
}
console.log('All bootstrap-main tests passed');

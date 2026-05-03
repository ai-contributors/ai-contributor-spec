#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Unit tests for skills/ai-contributor-audit/scripts/bootstrap.ts.
// Covers parseArgs branches, isImmutableRef, and fetchText against a
// localhost http server (success / 404 / redirect / unreachable).

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  compareReleaseTags,
  fetchText,
  isImmutableRef,
  parseReleaseTag,
  parseArgs,
} from '../../skills/ai-contributor-audit/scripts/bootstrap.ts';

let failed = 0;
function ok(label: string): void {
  console.log(`OK   ${label}`);
}
function fail(label: string, detail: string): void {
  console.error(`FAIL ${label}: ${detail}`);
  failed++;
}

// 1. isImmutableRef accepts 40-char SHA, vN.N, vN.N.N; rejects everything else.
{
  const accepts = [
    'a'.repeat(40),
    '0123456789abcdef0123456789abcdef01234567',
    'v0.1',
    'v1.0',
    'v0.1.0',
    'v12.34.56',
  ];
  const rejects = [
    'main',
    'HEAD',
    'feature/foo',
    '0.1', // missing v
    'v0', // missing minor
    'va.b', // non-numeric
    '0123456789abcdef0123456789abcdef0123456', // 39 chars, too short
    '0123456789ABCDEF0123456789ABCDEF01234567', // uppercase rejected
    '',
  ];
  for (const r of accepts) {
    if (!isImmutableRef(r)) fail(`isImmutableRef accepts ${r}`, 'returned false');
  }
  for (const r of rejects) {
    if (isImmutableRef(r)) fail(`isImmutableRef rejects ${r}`, 'returned true');
  }
  ok('isImmutableRef accepts SHA + vN.N + vN.N.N; rejects branches and short refs');
}

// 2a. Release tag parsing/order treats compact minor tags as patch-zero releases.
{
  const v01 = parseReleaseTag('v0.1');
  const v011 = parseReleaseTag('v0.1.1');
  const v02 = parseReleaseTag('v0.2');
  const invalid = parseReleaseTag('release-0.2');
  if (!v01 || v01.patch !== 0 || !v011 || !v02 || invalid !== null) {
    fail('parseReleaseTag compact and patch tags', JSON.stringify({ v01, v011, v02, invalid }));
  } else if (!(compareReleaseTags(v01, v011) < 0 && compareReleaseTags(v02, v011) > 0)) {
    fail('compareReleaseTags semver order', JSON.stringify({ v01, v011, v02 }));
  } else {
    ok('parseReleaseTag/compareReleaseTags order vN.N and vN.N.N release tags');
  }
}

// 2. parseArgs success paths.
{
  const r1 = parseArgs(['v0.1']);
  if (typeof r1 !== 'object' || r1.ref !== 'v0.1') {
    fail('parseArgs v0.1 only -> default outDir', JSON.stringify(r1));
  } else if (!r1.outDir.includes('ai-contributor-audit-v0.1')) {
    fail('parseArgs v0.1 default outDir naming', r1.outDir);
  } else {
    ok('parseArgs single positional -> default outDir under tmpdir');
  }

  const r2 = parseArgs(['v0.1', '--out', '/tmp/foo']);
  if (typeof r2 !== 'object' || r2.ref !== 'v0.1' || r2.outDir !== '/tmp/foo') {
    fail('parseArgs --out <dir>', JSON.stringify(r2));
  } else {
    ok('parseArgs --out <dir> form');
  }

  const r3 = parseArgs(['v0.1', '--out=/tmp/foo']);
  if (typeof r3 !== 'object' || r3.outDir !== '/tmp/foo') {
    fail('parseArgs --out=<dir>', JSON.stringify(r3));
  } else {
    ok('parseArgs --out=<dir> form');
  }

  const r4 = parseArgs(['v0.1', '--skip-stale-check']);
  if (typeof r4 !== 'object' || r4.ref !== 'v0.1' || r4.skipStaleCheck !== true) {
    fail('parseArgs --skip-stale-check', JSON.stringify(r4));
  } else {
    ok('parseArgs --skip-stale-check disables advisory staleness probe');
  }
}

// 3. parseArgs error paths.
{
  // Empty args -> usage (returns '').
  const r1 = parseArgs([]);
  if (r1 !== '') fail('parseArgs [] -> empty usage signal', String(r1));
  else ok('parseArgs [] returns empty string (usage signal)');

  // Two positionals -> usage (returns '').
  const r2 = parseArgs(['v0.1', 'v0.2']);
  if (r2 !== '') fail('parseArgs two positionals -> usage', String(r2));
  else ok('parseArgs two positionals returns usage signal');

  // --out with no value (last arg) -> empty-value error explaining shell trap.
  const r3 = parseArgs(['v0.1', '--out']);
  if (typeof r3 !== 'string' || !/--out requires a directory/.test(r3)) {
    fail('parseArgs --out (no value)', String(r3));
  } else {
    ok('parseArgs --out with no value -> requires-a-directory error');
  }

  // --out= with empty value -> shell-trap explanation.
  const r4 = parseArgs(['v0.1', '--out=']);
  if (typeof r4 !== 'string' || !/empty value/.test(r4) || !/inline assignment/.test(r4)) {
    fail('parseArgs --out= empty value -> shell-trap message', String(r4));
  } else {
    ok('parseArgs --out= empty value -> explanatory shell-trap error');
  }

  // --out followed by another flag -> flag-shaped-value error.
  const r5 = parseArgs(['v0.1', '--out', '--something']);
  if (typeof r5 !== 'string' || !/flag-shaped value/.test(r5)) {
    fail('parseArgs --out --something -> flag-shaped error', String(r5));
  } else {
    ok('parseArgs --out followed by another flag -> flag-shaped-value error');
  }

  // Unknown flag -> unknown-flag error.
  const r6 = parseArgs(['v0.1', '--mystery']);
  if (typeof r6 !== 'string' || !/unknown flag --mystery/.test(r6)) {
    fail('parseArgs unknown flag', String(r6));
  } else {
    ok('parseArgs unknown flag rejected');
  }
}

// ----- fetchText against localhost ---------------------------------------

interface Handler {
  (req: http.IncomingMessage, res: http.ServerResponse): void;
}

function withServer(handler: Handler, run: (port: number) => Promise<void>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const server = http.createServer((req, res) => handler(req, res));
    server.listen(0, '127.0.0.1', async () => {
      const { port } = server.address() as AddressInfo;
      try {
        await run(port);
        resolve();
      } catch (e: unknown) {
        reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        server.close();
      }
    });
    server.on('error', reject);
  });
}

await withServer(
  (_req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain');
    res.end('hello world\n');
  },
  async (port) => {
    const text = await fetchText(`http://127.0.0.1:${port}/x.txt`);
    if (text === 'hello world\n') ok('fetchText: 200 OK returns body');
    else fail('fetchText 200', JSON.stringify(text));
  },
);

await withServer(
  (_req, res) => {
    res.statusCode = 404;
    res.end('not found');
  },
  async (port) => {
    try {
      await fetchText(`http://127.0.0.1:${port}/missing`);
      fail('fetchText 404', 'expected rejection');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (/HTTP 404/.test(message)) ok('fetchText: 404 rejects with HTTP 404');
      else fail('fetchText 404 message', message);
    }
  },
);

await withServer(
  (req, res) => {
    if (req.url === '/redirect-me') {
      res.statusCode = 302;
      res.setHeader('location', '/final');
      res.end();
      return;
    }
    if (req.url === '/final') {
      res.statusCode = 200;
      res.end('final body');
      return;
    }
    res.statusCode = 500;
    res.end();
  },
  async (port) => {
    const text = await fetchText(`http://127.0.0.1:${port}/redirect-me`);
    if (text === 'final body') ok('fetchText: follows one relative 302 redirect');
    else fail('fetchText redirect', JSON.stringify(text));
  },
);

await withServer(
  (req, res) => {
    if (req.url === '/redirect-once') {
      res.statusCode = 302;
      res.setHeader('location', `http://${req.headers.host}/redirect-twice`);
      res.end();
      return;
    }
    if (req.url === '/redirect-twice') {
      res.statusCode = 302;
      res.setHeader('location', `http://${req.headers.host}/final`);
      res.end();
      return;
    }
    res.statusCode = 200;
    res.end('final body');
  },
  async (port) => {
    try {
      await fetchText(`http://127.0.0.1:${port}/redirect-once`);
      fail('fetchText redirect limit', 'expected rejection');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (/exceeded redirect limit/.test(message)) ok('fetchText: rejects after redirect limit');
      else fail('fetchText redirect limit message', message);
    }
  },
);

// Unreachable host -> req.on('error') path.
{
  // Pick an invalid port that nothing listens on.
  try {
    await fetchText('http://127.0.0.1:1/never-listens');
    fail('fetchText unreachable', 'expected rejection');
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.length > 0) ok('fetchText: unreachable host rejects');
    else fail('fetchText unreachable message', String(e));
  }
}

if (failed > 0) {
  console.error(`${failed} bootstrap unit test(s) failed`);
  process.exit(1);
}
console.log('All bootstrap unit tests passed');

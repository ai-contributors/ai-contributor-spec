#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for mcp.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, runCollect, type GhaTestEvidence } from './audit-collect-test-utils.ts';

let failed = 0;

// mcp-inventory: $HOME root → Alarm; pinned + workspace-scoped → Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-mcp-bad-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, '.mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            fs: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem@latest', '$HOME'],
            },
          },
        },
        null,
        2,
      ),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'mcp'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      mcp_inventory?: { servers?: Array<{ roots?: string[]; version_pinned?: boolean }> };
    };
    const r = ev.rules ?? {};
    if (r['mcp-root-scoping']?.derived_status !== 'Alarm') {
      failed++;
      console.error(`FAIL $HOME root not Alarm: ${JSON.stringify(r['mcp-root-scoping'])}`);
    } else if (r['mcp-pinned-versions']?.derived_status !== 'Warning') {
      failed++;
      console.error(`FAIL @latest not Warning: ${JSON.stringify(r['mcp-pinned-versions'])}`);
    } else if (!ev.mcp_inventory?.servers?.[0]?.roots?.includes('$HOME')) {
      failed++;
      console.error(
        `FAIL mcp_inventory did not record $HOME root: ${JSON.stringify(ev.mcp_inventory)}`,
      );
    } else {
      console.log(
        'OK   MCP $HOME root Alarms; @latest version is Warning; mcp_inventory captures roots',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// mcp-inventory: pinned, workspace-scoped, read-only → all 3 Fulfilled.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-mcp-good-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, '.mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            fs: {
              command: 'npx',
              args: [
                '-y',
                '@modelcontextprotocol/server-filesystem@1.2.3',
                './workspace',
                '--read-only',
              ],
            },
          },
        },
        null,
        2,
      ),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'mcp'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    const ids = ['mcp-root-scoping', 'mcp-pinned-versions', 'mcp-read-only-default'];
    const wrong = ids.filter((id) => r[id]?.derived_status !== 'Fulfilled');
    if (wrong.length > 0) {
      failed++;
      console.error(
        `FAIL pinned/scoped/read-only MCP not all Fulfilled: ${wrong.map((id) => `${id}=${r[id]?.derived_status}`).join(', ')}`,
      );
    } else {
      console.log(
        'OK   pinned + workspace-scoped + --read-only MCP server is Fulfilled across all 3 rules',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// mcp-inventory: uvx-style "pkg==version" in args -> version pinned via ==.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-mcp-uvx-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, '.mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            tool: {
              command: 'uvx',
              args: ['some-mcp-tool==1.2.3', '--read-only', './workspace'],
            },
          },
        },
        null,
        2,
      ),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'mcp uvx'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    if (r['mcp-pinned-versions']?.derived_status === 'Fulfilled') {
      console.log('OK   uvx pkg==version recognized as pinned MCP version');
    } else {
      failed++;
      console.error(
        `FAIL uvx pkg==version not Fulfilled: ${JSON.stringify(r['mcp-pinned-versions'])}`,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// mcp-inventory: uvx-style pkg without ==version (unpinned) -> Warning.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-mcp-uvx-bare-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, '.mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            tool: { command: 'uvx', args: ['some-mcp-tool', './workspace', '--read-only'] },
          },
        },
        null,
        2,
      ),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'mcp uvx bare'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    if (ev.rules?.['mcp-pinned-versions']?.derived_status === 'Warning') {
      console.log('OK   uvx pkg without ==version -> Warning (unpinned branch)');
    } else {
      failed++;
      console.error(`FAIL uvx pkg unpinned: ${JSON.stringify(ev.rules?.['mcp-pinned-versions'])}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// mcp-inventory: explicit roots field (alternative to scanning args).
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-mcp-roots-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, '.mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            fs: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem@1.2.3'],
              roots: ['./workspace'],
            },
          },
        },
        null,
        2,
      ),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'mcp roots'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence & {
      mcp_inventory?: { servers?: Array<{ roots?: string[] }> };
    };
    if (ev.mcp_inventory?.servers?.[0]?.roots?.includes('./workspace')) {
      console.log('OK   explicit roots field captured by mcp_inventory');
    } else {
      failed++;
      console.error(`FAIL explicit roots: ${JSON.stringify(ev.mcp_inventory)}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// mcp-inventory: empty mcpServers map -> early-return branch (servers=[]).
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-mcp-empty-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(path.join(target, '.mcp.json'), JSON.stringify({ mcpServers: {} }));
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'mcp empty'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    const r = ev.rules ?? {};
    // Empty server list means every MCP rule should be Not relevant (no
    // servers to check). Either way, the collector must not throw.
    if (r['mcp-root-scoping'] && r['mcp-pinned-versions']) {
      console.log('OK   empty mcpServers handled without error');
    } else {
      failed++;
      console.error(`FAIL empty mcpServers: ${JSON.stringify(r['mcp-root-scoping'])}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-collect test(s) failed`);
  process.exit(1);
}
console.log('All audit-collect tests passed');

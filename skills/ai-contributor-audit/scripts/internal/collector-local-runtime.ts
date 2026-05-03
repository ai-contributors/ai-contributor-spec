// SPDX-License-Identifier: Apache-2.0
//
// Local command and tracked-file helpers for audit-collect.

import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { excerpt } from './collector-runtime.ts';
import type { CommandRun } from './collector-types.ts';

export interface CollectorLocalRuntime {
  run: (cmd: string, args: string[], cwd: string, timeoutMs?: number) => CommandRun;
  runQuiet: (cmd: string, args: string[], cwd: string) => string;
  detectTools: <T extends string>(toolNames: readonly T[], cwd: string) => Record<T, string | null>;
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
  lineNumberFor: (text: string, pattern: RegExp) => number | null;
  readSpecVersionFromChecklist: (root: string) => string | null;
}

export function createCollectorLocalRuntime(input: {
  defaultAuditDir: string;
  getWorkTreeRoot: () => string | null;
}): CollectorLocalRuntime {
  let trackedFilesCache: string[] | null = null;

  function run(cmd: string, args: string[], cwd: string, timeoutMs = 120_000): CommandRun {
    const display = `${cmd} ${args.map((a) => (a.includes(' ') ? `'${a}'` : a)).join(' ')}`.trim();
    const t0 = Date.now();
    let res: SpawnSyncReturns<Buffer>;
    try {
      res = spawnSync(cmd, args, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        env: process.env,
      });
    } catch (e) {
      return {
        cmd: display,
        cwd,
        exit_code: null,
        duration_ms: Date.now() - t0,
        stdout_excerpt: '',
        stderr_excerpt: `spawn error: ${(e as Error).message}`,
        kind: 'shell',
      };
    }
    return {
      cmd: display,
      cwd: relCwd(cwd),
      exit_code: res.status,
      duration_ms: Date.now() - t0,
      stdout_excerpt: excerpt(res.stdout?.toString() ?? ''),
      stderr_excerpt: res.error
        ? `spawn error: ${res.error.message}`
        : res.stderr?.toString()
          ? excerpt(res.stderr.toString())
          : undefined,
      kind: 'shell',
    };
  }

  function relCwd(cwd: string): string {
    const root = input.getWorkTreeRoot();
    if (root && cwd === root) return '<extracted>';
    if (root && cwd.startsWith(root + path.sep))
      return path.posix.join(
        '<extracted>',
        cwd
          .slice(root.length + 1)
          .split(path.sep)
          .join('/'),
      );
    return cwd;
  }

  function runQuiet(cmd: string, args: string[], cwd: string): string {
    try {
      return execFileSync(cmd, args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return '';
    }
  }

  function detectTools<T extends string>(
    toolNames: readonly T[],
    cwd: string,
  ): Record<T, string | null> {
    const tools = {} as Record<T, string | null>;
    for (const tool of toolNames) {
      const v = runQuiet(tool, ['--version'], cwd);
      tools[tool] = v ? v.split('\n')[0]! : null;
    }
    return tools;
  }

  function trackedFiles(): string[] {
    if (trackedFilesCache) return trackedFilesCache;
    const root = input.getWorkTreeRoot();
    if (!root) return [];
    const listed = runQuiet('git', ['-C', root, 'ls-files'], root);
    trackedFilesCache = listed
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return trackedFilesCache;
  }

  function readTrackedFile(rel: string): string | null {
    const root = input.getWorkTreeRoot();
    if (!root) return null;
    const normalized = rel.replace(/\\/g, '/');
    if (!trackedFiles().includes(normalized)) return null;
    try {
      return fs.readFileSync(path.join(root, normalized), 'utf8');
    } catch {
      return null;
    }
  }

  function lineNumberFor(text: string, pattern: RegExp): number | null {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i]!)) return i + 1;
    }
    return null;
  }

  function readSpecVersionFromChecklist(root: string): string | null {
    const checklistPath = path.join(root, input.defaultAuditDir, 'AI-CONTRIBUTOR-CHECKLIST.md');
    try {
      const text = fs.readFileSync(checklistPath, 'utf8');
      const m = text.match(/^spec_version:\s*["']?([^"'\s#]+)["']?/m);
      return m?.[1] ?? null;
    } catch {
      return null;
    }
  }

  return {
    run,
    runQuiet,
    detectTools,
    trackedFiles,
    readTrackedFile,
    lineNumberFor,
    readSpecVersionFromChecklist,
  };
}

// SPDX-License-Identifier: Apache-2.0
//
// Target commit resolution and temporary worktree lifecycle for audit-collect.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface CollectorWorktree {
  auditedCommit: string;
  originalStatus: string;
  workTreeRoot: string;
  extractedTo: string | null;
  linkNodeModulesCache: (relativeUnitPath: string) => void;
  nodeModulesCacheLinks: () => number;
  cleanup: () => void;
}

export function setupCollectorWorktree(input: {
  target: string;
  commitOpt: string | null;
  workingTreeMode: boolean;
  runQuiet: (cmd: string, args: string[], cwd: string) => string;
}): CollectorWorktree | { error: string } {
  if (!exists(input.target, '.git')) {
    return { error: `target is not a git repository: ${input.target}` };
  }

  const auditedCommit = input.commitOpt
    ? input.runQuiet(
        'git',
        ['-C', input.target, 'rev-parse', '--verify', `${input.commitOpt}^{commit}`],
        input.target,
      )
    : input.runQuiet('git', ['-C', input.target, 'rev-parse', 'HEAD'], input.target);
  if (!auditedCommit) {
    return { error: `failed to resolve audited_commit (input=${input.commitOpt ?? 'HEAD'})` };
  }

  const originalStatus = input.runQuiet(
    'git',
    ['-C', input.target, 'status', '--porcelain'],
    input.target,
  );
  let workTreeRoot: string;
  let extractedTo: string | null = null;
  let nodeModulesCacheLinks = 0;
  let rootLockfileCacheReusable = false;

  function linkNodeModulesCache(relativeUnitPath: string): void {
    if (!extractedTo || !rootLockfileCacheReusable) return;
    if (path.isAbsolute(relativeUnitPath) || relativeUnitPath.split(/[\\/]/).includes('..')) return;

    const source = path.join(input.target, relativeUnitPath, 'node_modules');
    const destination = path.join(workTreeRoot, relativeUnitPath, 'node_modules');
    if (!exists(source) || exists(destination)) return;

    try {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.symlinkSync(source, destination, 'dir');
      nodeModulesCacheLinks++;
    } catch {
      /* non-fatal */
    }
  }

  if (input.workingTreeMode) {
    workTreeRoot = input.target;
  } else {
    extractedTo = fs.mkdtempSync(
      path.join(os.tmpdir(), `audit-collect-${auditedCommit.slice(0, 8)}-`),
    );
    const wt = spawnSync(
      'git',
      ['-C', input.target, 'worktree', 'add', '--detach', extractedTo, auditedCommit],
      {
        encoding: 'utf8',
      },
    );
    if (wt.status !== 0) {
      return { error: `git worktree add failed: ${wt.stderr || wt.stdout}` };
    }
    workTreeRoot = extractedTo;

    // Best-effort: symlink node_modules from the original worktree if its
    // root lockfile is byte-identical with the extracted tree's lockfile.
    // Pure speedup; not a correctness signal.
    rootLockfileCacheReusable = sameFileBytes(
      path.join(input.target, 'pnpm-lock.yaml'),
      path.join(workTreeRoot, 'pnpm-lock.yaml'),
    );
    linkNodeModulesCache('.');
  }

  function cleanup(): void {
    if (extractedTo && !input.workingTreeMode) {
      spawnSync('git', ['-C', input.target, 'worktree', 'remove', '--force', extractedTo], {
        stdio: 'ignore',
      });
    }
  }

  return {
    auditedCommit,
    originalStatus,
    workTreeRoot,
    extractedTo,
    linkNodeModulesCache,
    nodeModulesCacheLinks: () => nodeModulesCacheLinks,
    cleanup,
  };
}

function exists(...parts: string[]): boolean {
  return fs.existsSync(path.join(...parts));
}

function sameFileBytes(a: string, b: string): boolean {
  return exists(a) && exists(b) && fs.readFileSync(a).equals(fs.readFileSync(b));
}

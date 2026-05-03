// SPDX-License-Identifier: Apache-2.0
//
// Stack detection and build-unit inventory for audit-collect.

import fs from 'node:fs';
import path from 'node:path';
import { readJsoncOrNull } from './collector-runtime.ts';
import type { Evidence } from './collector-types.ts';

export interface InventoryUnit {
  id: string;
  path: string;
  manifest: string;
}

export interface StackScope {
  detected: string[];
  stackEvidence: Evidence['stack']['evidence'];
  inventoryUnits: InventoryUnit[];
}

export function discoverStackScope(input: {
  workTreeRoot: string;
  runQuiet: (cmd: string, args: string[], cwd: string) => string;
}): StackScope {
  const stackEvidence: Evidence['stack']['evidence'] = [];
  const detected: string[] = [];
  const inventoryUnits: InventoryUnit[] = [];
  const rootPkg = readJsoncOrNull(path.join(input.workTreeRoot, 'package.json')) as {
    packageManager?: unknown;
    workspaces?: unknown;
  } | null;

  if (rootPkg) {
    detected.push('node');
    stackEvidence.push({ file: 'package.json' });
    if (rootPkg.packageManager) {
      stackEvidence.push({
        file: 'package.json',
        field: 'packageManager',
        value: String(rootPkg.packageManager),
      });
      if (String(rootPkg.packageManager).startsWith('pnpm@')) detected.push('pnpm');
      else if (String(rootPkg.packageManager).startsWith('npm@')) detected.push('npm');
      else if (String(rootPkg.packageManager).startsWith('yarn@')) detected.push('yarn');
    }
    if (
      Array.isArray(rootPkg.workspaces) ||
      (typeof rootPkg.workspaces === 'object' &&
        rootPkg.workspaces !== null &&
        'packages' in (rootPkg.workspaces as Record<string, unknown>))
    ) {
      detected.push('npm-workspace');
      stackEvidence.push({ file: 'package.json', field: 'workspaces' });
    }
  }
  if (exists(input.workTreeRoot, 'pnpm-workspace.yaml')) {
    detected.push('pnpm-workspace');
    stackEvidence.push({ file: 'pnpm-workspace.yaml' });
  }
  if (
    exists(input.workTreeRoot, 'tsconfig.json') ||
    exists(input.workTreeRoot, 'tsconfig.base.json')
  ) {
    detected.push('typescript');
    stackEvidence.push({
      file: exists(input.workTreeRoot, 'tsconfig.json') ? 'tsconfig.json' : 'tsconfig.base.json',
    });
  }

  if (rootPkg) {
    inventoryUnits.push({ id: 'root', path: '.', manifest: 'package.json' });
  }
  if (detected.includes('pnpm-workspace')) {
    discoverPnpmWorkspace(input.workTreeRoot, inventoryUnits);
  }
  discoverNestedManifests(input.workTreeRoot, input.runQuiet, inventoryUnits);

  return { detected, stackEvidence, inventoryUnits };
}

function exists(...parts: string[]): boolean {
  return fs.existsSync(path.join(...parts));
}

function discoverPnpmWorkspace(workTreeRoot: string, inventoryUnits: InventoryUnit[]): void {
  // Minimal pnpm-workspace.yaml parser: extract `packages:` glob list. Avoid YAML
  // dependency by parsing the simple shape pnpm uses.
  const yml = fs.readFileSync(path.join(workTreeRoot, 'pnpm-workspace.yaml'), 'utf8');
  const lines = yml.split('\n');
  let inPackages = false;
  const globs: string[] = [];
  for (const ln of lines) {
    if (/^packages\s*:/.test(ln)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const m = ln.match(/^\s*-\s*['"]?([^'"#\s]+)['"]?/);
      if (m) globs.push(m[1]!);
      else if (/^\S/.test(ln)) inPackages = false;
    }
  }
  for (const glob of globs) {
    // Only handle simple globs `apps/*`, `packages/*`, `services/*`, single dir.
    const m = glob.match(/^([^*]+)\/\*$/);
    if (m) {
      const dir = path.join(workTreeRoot, m[1]!);
      if (!fs.existsSync(dir)) continue;
      for (const sub of fs.readdirSync(dir)) {
        const subPath = path.join(dir, sub);
        const manifest = path.join(subPath, 'package.json');
        if (fs.statSync(subPath).isDirectory() && fs.existsSync(manifest)) {
          const rel = path.relative(workTreeRoot, subPath);
          inventoryUnits.push({ id: rel, path: rel, manifest: path.join(rel, 'package.json') });
        }
      }
    } else if (!glob.includes('*')) {
      const subPath = path.join(workTreeRoot, glob);
      const manifest = path.join(subPath, 'package.json');
      if (fs.existsSync(manifest)) {
        inventoryUnits.push({ id: glob, path: glob, manifest: path.join(glob, 'package.json') });
      }
    }
  }
}

function discoverNestedManifests(
  workTreeRoot: string,
  runQuiet: (cmd: string, args: string[], cwd: string) => string,
  inventoryUnits: InventoryUnit[],
): void {
  const tracked = runQuiet('git', ['-C', workTreeRoot, 'ls-files'], workTreeRoot);
  if (!tracked) return;
  const known = new Set(inventoryUnits.map((u) => u.manifest.replace(/\\/g, '/')));
  for (const rel of tracked.split('\n')) {
    const norm = rel.trim();
    if (!norm) continue;
    const base = path.basename(norm);
    if (!['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod'].includes(base)) continue;
    if (known.has(norm)) continue;
    const dir = path.dirname(norm) || '.';
    if (dir === '.') continue;
    inventoryUnits.push({ id: dir, path: dir, manifest: norm });
    known.add(norm);
  }
}

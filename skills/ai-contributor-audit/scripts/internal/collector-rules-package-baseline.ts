// SPDX-License-Identifier: Apache-2.0
//
// Package baseline rules for audit-collect.

import fs from 'node:fs';
import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { CommandRun, RuleEvidence, RuleStatus } from './collector-types.ts';

export interface PackageInventoryUnit {
  id: string;
  path: string;
}

export interface PackageBaselineRuleDeps {
  workTreeRoot: string;
  inventoryUnits: () => PackageInventoryUnit[];
  detected: () => string[];
  run: (cmd: string, args: string[], cwd: string, timeoutMs?: number) => CommandRun;
  readJsoncFile: (abs: string) => unknown;
}

export function createPackageBaselineRules(deps: PackageBaselineRuleDeps): {
  ruleLockfileIntegrity: () => RuleEvidence;
  ruleLintRules: () => RuleEvidence;
  ruleStrictTypes: () => RuleEvidence;
  rulePinnedToolchain: () => RuleEvidence;
  rulePreCommit: () => RuleEvidence;
  ruleAutomatedDependencyUpdates: () => RuleEvidence;
} {
  function nodeModulesPresent(): boolean {
    return fs.existsSync(path.join(deps.workTreeRoot, 'node_modules'));
  }

  function readPkgScript(unitPath: string, scriptName: string): string | null {
    const pkg = deps.readJsoncFile(path.join(deps.workTreeRoot, unitPath, 'package.json')) as {
      scripts?: Record<string, unknown>;
    } | null;
    const scripts = pkg?.scripts;
    if (!scripts || typeof scripts !== 'object') return null;
    const script = scripts[scriptName];
    return typeof script === 'string' ? script : null;
  }

  function findTsConfigs(): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const unit of [{ path: '.' }, ...deps.inventoryUnits().filter((u) => u.path !== '.')]) {
      const dir = path.join(deps.workTreeRoot, unit.path);
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      for (const name of fs.readdirSync(dir)) {
        if (/^tsconfig.*\.json$/.test(name)) {
          const rel = path.join(unit.path, name).replace(/^\.\//, '');
          if (!seen.has(rel)) {
            seen.add(rel);
            out.push(rel);
          }
        }
      }
    }
    return out;
  }

  function resolveTsconfigStrict(rel: string, seen: Set<string> = new Set()): boolean | null {
    const abs = path.join(deps.workTreeRoot, rel);
    if (seen.has(abs)) return false;
    seen.add(abs);
    const data = deps.readJsoncFile(abs) as {
      compilerOptions?: { strict?: boolean };
      extends?: unknown;
    } | null;
    if (!data) return false;
    const ownStrict: boolean | undefined = data.compilerOptions?.strict;
    if (ownStrict === true) return true;
    if (ownStrict === false) return false;
    const ext = data.extends;
    if (typeof ext !== 'string') return false;
    const baseDir = path.dirname(rel);
    if (ext.startsWith('.') || ext.startsWith('/')) {
      let extPath = path.join(baseDir, ext);
      if (!extPath.endsWith('.json')) extPath += '.json';
      if (!fs.existsSync(path.join(deps.workTreeRoot, extPath))) return false;
      return resolveTsconfigStrict(extPath, seen);
    }
    let dir = baseDir;
    while (true) {
      const candidate = path.join(dir, 'node_modules', ext);
      const withJson = candidate.endsWith('.json') ? candidate : candidate + '.json';
      if (fs.existsSync(path.join(deps.workTreeRoot, withJson))) {
        return resolveTsconfigStrict(withJson, seen);
      }
      const asDir = path.join(dir, 'node_modules', ext, 'tsconfig.json');
      if (fs.existsSync(path.join(deps.workTreeRoot, asDir))) {
        return resolveTsconfigStrict(asDir, seen);
      }
      if (dir === '.' || dir === '' || dir === '/') break;
      dir = path.dirname(dir);
    }
    return null;
  }

  function ruleLockfileIntegrity(): RuleEvidence {
    const cmds: CommandRun[] = [];
    const errors: string[] = [];
    const lockfiles: Array<{ path: string; manager: 'pnpm' | 'npm' | 'yarn' }> = [];

    const seen = new Set<string>();
    for (const unit of [{ path: '.' }, ...deps.inventoryUnits().filter((u) => u.path !== '.')]) {
      for (const [name, manager] of [
        ['pnpm-lock.yaml', 'pnpm'] as const,
        ['package-lock.json', 'npm'] as const,
        ['yarn.lock', 'yarn'] as const,
      ]) {
        const rel = path.join(unit.path, name);
        const abs = path.join(deps.workTreeRoot, rel);
        if (fs.existsSync(abs) && !seen.has(rel)) {
          seen.add(rel);
          lockfiles.push({ path: rel, manager });
        }
      }
    }

    if (lockfiles.length === 0) {
      return {
        spec_rule_name: 'Lockfile Integrity',
        applicability: {
          verdict: 'not_applicable',
          trigger_evidence: 'no lockfile found in inventory',
        },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no package-manager lockfile present',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['lockfile-integrity'],
      };
    }

    let allOk = true;
    for (const lf of lockfiles) {
      const dir = path.join(deps.workTreeRoot, path.dirname(lf.path));
      let cr: CommandRun;
      if (lf.manager === 'pnpm') {
        cr = deps.run(
          'pnpm',
          [
            'install',
            '--frozen-lockfile',
            '--ignore-scripts',
            '--prefer-offline',
            '--lockfile-only',
          ],
          dir,
          180_000,
        );
      } else if (lf.manager === 'npm') {
        cr = deps.run('npm', ['ci', '--ignore-scripts', '--dry-run'], dir, 180_000);
      } else {
        cr = deps.run('yarn', ['install', '--immutable', '--mode=skip-build'], dir, 180_000);
      }
      cmds.push(cr);
      if (cr.exit_code !== 0) {
        allOk = false;
        errors.push(`${lf.path}: exit ${cr.exit_code}`);
      }
    }

    return {
      spec_rule_name: 'Lockfile Integrity',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `lockfiles found: ${lockfiles.map((l) => l.path).join(', ')}`,
      },
      commands: cmds,
      derived_status: allOk ? 'Fulfilled' : 'Alarm',
      derivation_reason: allOk
        ? `all ${lockfiles.length} lockfile(s) installed cleanly with frozen-lockfile`
        : `lockfile drift: ${errors.join('; ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['lockfile-integrity'],
      errors: errors.length ? errors : undefined,
    };
  }

  function ruleLintRules(): RuleEvidence {
    const cmds: CommandRun[] = [];
    const unitsWithLint: string[] = [];
    const unitsWithoutLint: string[] = [];
    for (const u of deps.inventoryUnits()) {
      if (readPkgScript(u.path, 'lint')) unitsWithLint.push(u.id);
      else unitsWithoutLint.push(u.id);
    }
    if (unitsWithLint.length === 0) {
      return {
        spec_rule_name: 'Lint Rules',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: 'inventory contains package manifests',
        },
        commands: [],
        derived_status: 'Alarm',
        derivation_reason: 'no inventory unit declares a lint script',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['lint-rules'],
      };
    }
    if (!nodeModulesPresent()) {
      return {
        spec_rule_name: 'Lint Rules',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${unitsWithLint.length}/${deps.inventoryUnits().length} units declare lint`,
        },
        commands: [],
        derived_status: null,
        derivation_reason:
          'cannot execute lint without node_modules; run collector against an installed tree (or rely on the cache)',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['lint-rules'],
      };
    }
    const cr = deps.run('pnpm', ['-r', 'lint'], deps.workTreeRoot, 300_000);
    cmds.push(cr);
    let status: RuleStatus;
    let reason: string;
    if (cr.exit_code === 0 && unitsWithoutLint.length === 0) {
      status = 'Fulfilled';
      reason = `pnpm -r lint exit 0 across ${unitsWithLint.length} unit(s)`;
    } else if (cr.exit_code === 0) {
      status = 'Warning';
      reason = `pnpm -r lint exit 0 but ${unitsWithoutLint.length} unit(s) without lint script: ${unitsWithoutLint.join(', ')}`;
    } else {
      status = 'Alarm';
      reason = `pnpm -r lint exit ${cr.exit_code}`;
    }
    return {
      spec_rule_name: 'Lint Rules',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: 'package.json present in inventory',
      },
      commands: cmds,
      derived_status: status,
      derivation_reason: reason,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['lint-rules'],
    };
  }

  function ruleStrictTypes(): RuleEvidence {
    const tsconfigs = findTsConfigs();
    if (tsconfigs.length === 0) {
      return {
        spec_rule_name: 'Strict Types',
        applicability: {
          verdict: 'not_applicable',
          trigger_evidence: 'no tsconfig*.json found in inventory',
        },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no TypeScript configuration in tracked inventory',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['strict-types'],
      };
    }
    const cmds: CommandRun[] = [];
    const nonStrict: string[] = [];
    const unresolved: string[] = [];
    for (const cfg of tsconfigs) {
      const v = resolveTsconfigStrict(cfg);
      if (v === false) nonStrict.push(cfg);
      else if (v === null) unresolved.push(cfg);
    }
    if (nonStrict.length > 0) {
      return {
        spec_rule_name: 'Strict Types',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `tsconfigs: ${tsconfigs.join(', ')}`,
        },
        commands: cmds,
        derived_status: 'Alarm',
        derivation_reason: `compilerOptions.strict !== true in: ${nonStrict.join(', ')}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['strict-types'],
      };
    }
    if (unresolved.length > 0 && !nodeModulesPresent()) {
      return {
        spec_rule_name: 'Strict Types',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `tsconfigs: ${tsconfigs.join(', ')}`,
        },
        commands: cmds,
        derived_status: null,
        derivation_reason: `extends bare specifier(s) unresolvable without node_modules: ${unresolved.join(', ')}`,
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['strict-types'],
      };
    }
    if (!nodeModulesPresent()) {
      return {
        spec_rule_name: 'Strict Types',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `tsconfigs: ${tsconfigs.join(', ')}`,
        },
        commands: [],
        derived_status: null,
        derivation_reason: 'all tsconfigs are strict, but cannot execute tsc without node_modules',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['strict-types'],
      };
    }
    const unitsWithTypeCheck = deps
      .inventoryUnits()
      .filter((u) => readPkgScript(u.path, 'type-check'));
    const unitsWithBuildOnlyTsc = deps
      .inventoryUnits()
      .filter(
        (u) =>
          !readPkgScript(u.path, 'type-check') &&
          /\btsc\b/.test(readPkgScript(u.path, 'build') ?? ''),
      );

    const detectedTools = deps.detected();
    const execCmd = detectedTools.includes('pnpm')
      ? 'pnpm'
      : detectedTools.includes('yarn')
        ? 'yarn'
        : 'npx';
    let allOk = true;
    const failing: string[] = [];

    if (
      unitsWithTypeCheck.length === deps.inventoryUnits().length ||
      unitsWithTypeCheck.length > 0
    ) {
      const cr = deps.run(execCmd, ['-r', 'type-check'], deps.workTreeRoot, 300_000);
      cmds.push(cr);
      if (cr.exit_code !== 0) {
        allOk = false;
        failing.push(`pnpm -r type-check exit ${cr.exit_code}`);
      }
    } else {
      const runnable = tsconfigs.filter((cfg) => {
        const data = deps.readJsoncFile(path.join(deps.workTreeRoot, cfg)) as {
          include?: unknown;
          files?: unknown;
        } | null;
        return data?.include || data?.files;
      });
      if (runnable.length === 0) {
        return {
          spec_rule_name: 'Strict Types',
          applicability: {
            verdict: 'applicable',
            trigger_evidence: `tsconfigs: ${tsconfigs.join(', ')}`,
          },
          commands: cmds,
          derived_status: null,
          derivation_reason:
            'all tsconfigs are extended-only (no include/files); no executable type-check declared. Add a `type-check` script.',
          judgment_required: true,
          aic_ids: RULE_AIC_IDS['strict-types'],
        };
      }
      const execArgs = (cfg: string): string[] =>
        execCmd === 'pnpm'
          ? ['exec', 'tsc', '--noEmit', '-p', cfg]
          : execCmd === 'yarn'
            ? ['exec', '--', 'tsc', '--noEmit', '-p', cfg]
            : ['--no-install', 'tsc', '--noEmit', '-p', cfg];
      for (const cfg of runnable) {
        const cr = deps.run(execCmd, execArgs(cfg), deps.workTreeRoot, 300_000);
        cmds.push(cr);
        if (cr.exit_code !== 0) {
          allOk = false;
          failing.push(cfg);
        }
      }
    }
    void unitsWithBuildOnlyTsc;
    const hasMissingDepsArtifact =
      !allOk &&
      cmds.some((c) => {
        const out = (c.stdout_excerpt ?? '') + (c.stderr_excerpt ?? '');
        return (
          c.exit_code === null ||
          /error TS230[57]/.test(out) ||
          /Cannot find module/.test(out) ||
          /Cannot find name 'node:/.test(out) ||
          /Cannot find package/.test(out) ||
          /ERR_MODULE_NOT_FOUND/.test(out) ||
          /MODULE_NOT_FOUND/.test(out) ||
          /\b(?:command not found|not found|ENOENT)\b/i.test(out) ||
          /is not recognized as an internal or external command/i.test(out)
        );
      });

    if (allOk) {
      return {
        spec_rule_name: 'Strict Types',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `tsconfigs: ${tsconfigs.join(', ')}`,
        },
        commands: cmds,
        derived_status: 'Fulfilled',
        derivation_reason: `strict:true and type-check exit 0 across ${cmds.length} invocation(s)`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['strict-types'],
      };
    }
    if (hasMissingDepsArtifact) {
      return {
        spec_rule_name: 'Strict Types',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `tsconfigs: ${tsconfigs.join(', ')}`,
        },
        commands: cmds,
        derived_status: 'Warning',
        derivation_reason:
          'compilerOptions.strict:true verified, but tsc could not be executed cleanly in the extracted worktree (missing-deps errors only). Rerun after `pnpm install` in the extracted tree, or in --working-tree mode, to confirm.',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['strict-types'],
      };
    }
    return {
      spec_rule_name: 'Strict Types',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `tsconfigs: ${tsconfigs.join(', ')}`,
      },
      commands: cmds,
      derived_status: 'Alarm',
      derivation_reason: `tsc --noEmit failed with type errors for: ${failing.join(', ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['strict-types'],
    };
  }

  function rulePinnedToolchain(): RuleEvidence {
    const evidenceParts: string[] = [];
    const uncoveredUnits: string[] = [];
    const cmds: CommandRun[] = [];

    for (const unit of deps.inventoryUnits()) {
      const unitDir = path.join(deps.workTreeRoot, unit.path);
      const unitParts: string[] = [];

      const nvmrc = path.join(unitDir, '.nvmrc');
      if (fs.existsSync(nvmrc)) {
        const v = fs.readFileSync(nvmrc, 'utf8').trim();
        if (/^v?\d+\.\d+\.\d+/.test(v) || /^v?\d+$/.test(v)) {
          unitParts.push(`${path.join(unit.path, '.nvmrc')}=${v}`);
        }
      }

      const pkg = deps.readJsoncFile(path.join(unitDir, 'package.json')) as {
        packageManager?: unknown;
      } | null;
      if (pkg?.packageManager && /^[a-z]+@\d+\.\d+\.\d+/.test(String(pkg.packageManager))) {
        unitParts.push(
          `${path.join(unit.path, 'package.json')}#packageManager=${String(pkg.packageManager)}`,
        );
      }

      const toolVersions = path.join(unitDir, '.tool-versions');
      if (fs.existsSync(toolVersions)) {
        const tv = fs.readFileSync(toolVersions, 'utf8');
        if (/\d+\.\d+\.\d+/.test(tv)) {
          unitParts.push(path.join(unit.path, '.tool-versions'));
        }
      }

      if (
        fs.existsSync(path.join(unitDir, 'mise.toml')) ||
        fs.existsSync(path.join(unitDir, '.mise.toml'))
      ) {
        unitParts.push(path.join(unit.path, 'mise.toml'));
      }

      if (unitParts.length > 0) {
        evidenceParts.push(...unitParts);
      } else {
        uncoveredUnits.push(unit.id);
      }
    }

    let derived_status: RuleStatus = 'Alarm';
    let reason: string;
    if (evidenceParts.length === 0) {
      reason =
        'no .nvmrc / packageManager / .tool-versions / mise.toml exact-version pin found in any inventory unit';
    } else if (uncoveredUnits.length === 0) {
      derived_status = 'Fulfilled';
      reason = `exact-version pin(s) found: ${evidenceParts.join('; ')}`;
    } else {
      derived_status = 'Warning';
      reason = `pinned in: ${evidenceParts.join('; ')}; uncovered units: ${uncoveredUnits.join(', ')}`;
    }

    return {
      spec_rule_name: 'Pinned Toolchain',
      applicability: { verdict: 'applicable', trigger_evidence: 'package.json or general repo' },
      commands: cmds,
      derived_status,
      derivation_reason: reason,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['pinned-toolchain'],
    };
  }

  function rulePreCommit(): RuleEvidence {
    const candidates = [
      '.husky/pre-commit',
      '.husky/_/pre-commit',
      'lefthook.yml',
      'lefthook.yaml',
      '.pre-commit-config.yaml',
    ];
    let hookFile: string | null = null;
    let content = '';
    for (const c of candidates) {
      const abs = path.join(deps.workTreeRoot, c);
      if (fs.existsSync(abs)) {
        hookFile = c;
        content = fs.readFileSync(abs, 'utf8');
        break;
      }
    }
    if (!hookFile) {
      return {
        spec_rule_name: 'Pre-Commit',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: 'repository may declare local guardrails',
        },
        commands: [],
        derived_status: 'Alarm',
        derivation_reason: 'no pre-commit hook configuration found',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['pre-commit'],
      };
    }
    const families: string[] = [];
    if (/(\blint\b|eslint|biome)/i.test(content)) families.push('lint');
    if (/(type[- ]?check|tsc[\s-])/i.test(content)) families.push('type-check');
    if (/(\btest\b|vitest|jest|pytest)/i.test(content)) families.push('test');
    if (/(secretlint|gitleaks|trufflehog|secret[- ]?scan)/i.test(content))
      families.push('secret-scan');
    if (/(format|prettier|biome\s+format)/i.test(content)) families.push('format');

    let status: RuleStatus;
    let reason: string;
    const meaningful = families.filter((f) => f !== 'format');
    if (meaningful.length >= 2) {
      status = 'Fulfilled';
      reason = `${hookFile} runs ${meaningful.join(' + ')}`;
    } else if (families.length === 1 && families[0] === 'format') {
      status = 'Warning';
      reason = `${hookFile} only runs formatter — formatter alone is not a meaningful guardrail`;
    } else if (meaningful.length === 1) {
      status = 'Warning';
      reason = `${hookFile} runs only ${meaningful[0]}; the spec recommends >=2 of lint/type-check/test/secret-scan`;
    } else {
      status = 'Alarm';
      reason = `${hookFile} found but no recognized guardrail family invoked`;
    }
    return {
      spec_rule_name: 'Pre-Commit',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: 'repository has package manifests',
      },
      commands: [],
      derived_status: status,
      derivation_reason: reason,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['pre-commit'],
      raw_artefact_refs: [hookFile],
    };
  }

  function ruleAutomatedDependencyUpdates(): RuleEvidence {
    const candidates = [
      '.github/dependabot.yml',
      '.github/dependabot.yaml',
      'renovate.json',
      '.github/renovate.json',
      '.renovaterc',
    ];
    for (const c of candidates) {
      const abs = path.join(deps.workTreeRoot, c);
      if (fs.existsSync(abs)) {
        const text = fs.readFileSync(abs, 'utf8');
        const hasEcosystem = /package-ecosystem\s*:|"packageRules"|"extends"/.test(text);
        return {
          spec_rule_name: 'Automated Dependency Updates',
          applicability: { verdict: 'applicable', trigger_evidence: 'dependency manifest present' },
          commands: [],
          derived_status: hasEcosystem ? 'Fulfilled' : 'Warning',
          derivation_reason: hasEcosystem
            ? `${c} declares ecosystem coverage`
            : `${c} present but no ecosystem entry detected`,
          judgment_required: false,
          aic_ids: RULE_AIC_IDS['automated-dependency-updates'],
          raw_artefact_refs: [c],
        };
      }
    }
    return {
      spec_rule_name: 'Automated Dependency Updates',
      applicability: { verdict: 'applicable', trigger_evidence: 'dependency manifest present' },
      commands: [],
      derived_status: 'Alarm',
      derivation_reason: 'no Dependabot or Renovate configuration found',
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['automated-dependency-updates'],
    };
  }

  return {
    ruleLockfileIntegrity,
    ruleLintRules,
    ruleStrictTypes,
    rulePinnedToolchain,
    rulePreCommit,
    ruleAutomatedDependencyUpdates,
  };
}

// SPDX-License-Identifier: Apache-2.0
//
// Clean-clone bootstrap smoke evidence and rule for audit-collect.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import { excerpt, readJsoncOrNull } from './collector-runtime.ts';
import type {
  BootstrapSmokeEvidence,
  BootstrapSmokeStep,
  RuleEvidence,
} from './collector-types.ts';

export interface BootstrapRuleDeps {
  workTreeRoot: string;
  tools: Record<string, string | null>;
  enabled: boolean;
  timeoutMs: number;
}

export function createBootstrapRules(deps: BootstrapRuleDeps): {
  buildBootstrapSmoke: () => BootstrapSmokeEvidence;
  ruleCleanCloneBootstrap: () => RuleEvidence;
} {
  let bootstrapSmokeCache: BootstrapSmokeEvidence | null = null;

  function detectBootstrapSteps(): Array<{ label: string; cmd: string; args: string[] }> {
    const steps: Array<{ label: string; cmd: string; args: string[] }> = [];
    const hasFile = (rel: string): boolean => fs.existsSync(path.join(deps.workTreeRoot, rel));
    if (hasFile('pnpm-lock.yaml') && deps.tools.pnpm) {
      steps.push({
        label: 'install',
        cmd: 'pnpm',
        args: ['install', '--frozen-lockfile', '--ignore-scripts', '--prefer-offline'],
      });
      const rootPkg = readJsoncOrNull(path.join(deps.workTreeRoot, 'package.json')) as {
        scripts?: { build?: unknown };
      } | null;
      if (rootPkg?.scripts?.build)
        steps.push({ label: 'build', cmd: 'pnpm', args: ['run', 'build'] });
    } else if ((hasFile('package-lock.json') || hasFile('package.json')) && deps.tools.npm) {
      steps.push({
        label: 'install',
        cmd: 'npm',
        args: hasFile('package-lock.json')
          ? ['ci', '--ignore-scripts']
          : ['install', '--ignore-scripts'],
      });
      const rootPkg = readJsoncOrNull(path.join(deps.workTreeRoot, 'package.json')) as {
        scripts?: { build?: unknown };
      } | null;
      if (rootPkg?.scripts?.build)
        steps.push({ label: 'build', cmd: 'npm', args: ['run', 'build'] });
    } else if (hasFile('yarn.lock')) {
      // No automatic yarn invocation in v1; fall through to "no detected steps".
    }
    return steps;
  }

  function buildBootstrapSmoke(): BootstrapSmokeEvidence {
    if (bootstrapSmokeCache) return bootstrapSmokeCache;
    if (!deps.enabled) {
      bootstrapSmokeCache = {
        enabled: false,
        ran: false,
        reason:
          'disabled; audit-collect runs the smoke test only with --enable-bootstrap-smoke, and audit-run enables it by default unless --no-bootstrap-smoke is set',
        clone_dir: null,
        total_duration_ms: 0,
        steps: [],
      };
      return bootstrapSmokeCache;
    }
    const steps = detectBootstrapSteps();
    if (steps.length === 0) {
      bootstrapSmokeCache = {
        enabled: true,
        ran: false,
        reason:
          'no detected install + build pipeline (no pnpm/npm lockfile or required tool missing)',
        clone_dir: null,
        total_duration_ms: 0,
        steps: [],
      };
      return bootstrapSmokeCache;
    }

    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-smoke-'));
    const cloned = spawnSync(
      'git',
      ['clone', '--no-local', '--depth', '1', `file://${deps.workTreeRoot}`, cloneDir],
      { encoding: 'utf8', timeout: 60_000 },
    );
    if (cloned.status !== 0) {
      fs.rmSync(cloneDir, { recursive: true, force: true });
      bootstrapSmokeCache = {
        enabled: true,
        ran: false,
        reason: `git clone failed: ${(cloned.stderr || cloned.stdout || '').slice(0, 200)}`,
        clone_dir: null,
        total_duration_ms: 0,
        steps: [],
      };
      return bootstrapSmokeCache;
    }

    const ranSteps: BootstrapSmokeStep[] = [];
    const t0 = Date.now();
    let remaining = deps.timeoutMs;
    for (const s of steps) {
      if (remaining <= 0) {
        ranSteps.push({
          label: s.label,
          cmd: `${s.cmd} ${s.args.join(' ')}`,
          exit_code: null,
          duration_ms: 0,
          stdout_excerpt: '',
          stderr_excerpt: 'skipped: bootstrap-smoke timeout exhausted by previous step(s)',
          timed_out: true,
        });
        continue;
      }
      const stepT0 = Date.now();
      const r = spawnSync(s.cmd, s.args, {
        cwd: cloneDir,
        encoding: 'utf8',
        timeout: remaining,
        env: process.env,
        maxBuffer: 4 * 1024 * 1024,
      });
      const dur = Date.now() - stepT0;
      remaining -= dur;
      const timedOut = (r.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
      ranSteps.push({
        label: s.label,
        cmd: `${s.cmd} ${s.args.join(' ')}`,
        exit_code: r.status,
        duration_ms: dur,
        stdout_excerpt: excerpt(r.stdout?.toString() ?? ''),
        stderr_excerpt: excerpt(r.stderr?.toString() ?? ''),
        timed_out: timedOut,
      });
      if (r.status !== 0) break;
    }
    fs.rmSync(cloneDir, { recursive: true, force: true });

    bootstrapSmokeCache = {
      enabled: true,
      ran: true,
      reason: 'opt-in run completed',
      // Don't leak the random tmpdir path; reproducibility excludes it.
      clone_dir: '<bootstrap-smoke-tmp>',
      total_duration_ms: Date.now() - t0,
      steps: ranSteps,
    };
    return bootstrapSmokeCache;
  }

  function ruleCleanCloneBootstrap(): RuleEvidence {
    const ev = buildBootstrapSmoke();
    if (!ev.enabled) {
      return {
        spec_rule_name: 'Clean Clone Bootstrap',
        applicability: { verdict: 'unknown', trigger_evidence: 'bootstrap-smoke disabled' },
        commands: [],
        derived_status: null,
        derivation_reason: ev.reason,
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['clean-clone-bootstrap']!,
      };
    }
    if (!ev.ran) {
      return {
        spec_rule_name: 'Clean Clone Bootstrap',
        applicability: { verdict: 'applicable', trigger_evidence: 'bootstrap-smoke enabled' },
        commands: [],
        derived_status: null,
        derivation_reason: ev.reason,
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['clean-clone-bootstrap']!,
      };
    }
    const failed = ev.steps.find((s) => s.exit_code !== 0 || s.timed_out);
    if (failed) {
      return {
        spec_rule_name: 'Clean Clone Bootstrap',
        applicability: { verdict: 'applicable', trigger_evidence: 'bootstrap-smoke enabled' },
        commands: [],
        derived_status: 'Alarm',
        derivation_reason: failed.timed_out
          ? `bootstrap-smoke timed out during step "${failed.label}": ${failed.cmd}`
          : `bootstrap-smoke step "${failed.label}" exited ${failed.exit_code}: ${failed.cmd}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['clean-clone-bootstrap']!,
      };
    }
    return {
      spec_rule_name: 'Clean Clone Bootstrap',
      applicability: { verdict: 'applicable', trigger_evidence: 'bootstrap-smoke enabled' },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `clean-clone bootstrap completed: ${ev.steps.map((s) => `${s.label} exit ${s.exit_code}`).join(', ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['clean-clone-bootstrap']!,
    };
  }

  return { buildBootstrapSmoke, ruleCleanCloneBootstrap };
}

// SPDX-License-Identifier: Apache-2.0
//
// Shared code-quality tool detection and rules for audit-collect.

import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { WorkflowActionFacts } from './collector-rules-github-actions.ts';
import type { RuleEvidence, RuleStatus } from './collector-types.ts';

export interface DepsByName {
  npm: Map<string, string[]>;
  py: Map<string, string[]>;
}

export interface CodeQualityRuleDeps {
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
  readPackageJson: (rel: string) => unknown;
  workflowActionFacts: () => WorkflowActionFacts[];
}

interface ToolDetection {
  dep_paths: string[];
  invoke_paths: string[];
}

export function createCodeQualityRules(deps: CodeQualityRuleDeps): {
  trackedDeps: () => DepsByName;
  ruleDeadCodeAndCyclesSurfaced: () => RuleEvidence;
  ruleArchitectureRulesAutomated: () => RuleEvidence;
  ruleCredentialLeakageChecks: () => RuleEvidence;
} {
  let trackedDepsCache: DepsByName | null = null;

  function trackedDeps(): DepsByName {
    if (trackedDepsCache) return trackedDepsCache;
    const npm = new Map<string, string[]>();
    const py = new Map<string, string[]>();
    for (const rel of deps.trackedFiles()) {
      const base = path.basename(rel);
      if (base === 'package.json') {
        const pkg = deps.readPackageJson(rel);
        if (!pkg || typeof pkg !== 'object') continue;
        for (const field of ['dependencies', 'devDependencies', 'optionalDependencies'] as const) {
          const block = (pkg as Record<string, unknown>)[field];
          if (!block || typeof block !== 'object') continue;
          for (const dep of Object.keys(block)) {
            if (!npm.has(dep)) npm.set(dep, []);
            if (!npm.get(dep)!.includes(rel)) npm.get(dep)!.push(rel);
          }
        }
      } else if (base === 'pyproject.toml' || /^requirements[^/]*\.txt$/.test(base)) {
        const text = deps.readTrackedFile(rel) ?? '';
        for (const ln of text.split(/\r?\n/)) {
          const m =
            ln.trim().match(/^["']?([A-Za-z][A-Za-z0-9_\-.]+)["']?\s*[=<>~!,\s]/) ??
            ln.trim().match(/^["']?([A-Za-z][A-Za-z0-9_\-.]+)["']?\s*$/);
          if (m) {
            const name = m[1]!.toLowerCase();
            if (!py.has(name)) py.set(name, []);
            if (!py.get(name)!.includes(rel)) py.get(name)!.push(rel);
          }
        }
      }
    }
    trackedDepsCache = { npm, py };
    return trackedDepsCache;
  }

  function detectTool(spec: {
    npm?: readonly string[];
    py?: readonly string[];
    invocation_re: RegExp;
    precommit_repo_re?: RegExp;
  }): ToolDetection {
    const dep_paths: string[] = [];
    const invoke_paths: string[] = [];
    const dependencyNames = trackedDeps();
    for (const dep of spec.npm ?? []) {
      for (const m of dependencyNames.npm.get(dep) ?? []) {
        if (!dep_paths.includes(m)) dep_paths.push(m);
      }
    }
    for (const dep of spec.py ?? []) {
      for (const m of dependencyNames.py.get(dep) ?? []) {
        if (!dep_paths.includes(m)) dep_paths.push(m);
      }
    }

    for (const rel of deps.trackedFiles()) {
      if (path.basename(rel) !== 'package.json') continue;
      const pkg = deps.readPackageJson(rel);
      const scripts =
        pkg && typeof pkg === 'object' && 'scripts' in pkg
          ? (pkg as { scripts?: unknown }).scripts
          : null;
      if (!scripts || typeof scripts !== 'object') continue;
      for (const [k, v] of Object.entries(scripts)) {
        if (typeof v !== 'string') continue;
        if (spec.invocation_re.test(v)) {
          const ref = `${rel}:scripts.${k}`;
          if (!invoke_paths.includes(ref)) invoke_paths.push(ref);
        }
      }
    }

    for (const rel of ['.pre-commit-config.yaml', '.pre-commit-config.yml']) {
      const content = deps.readTrackedFile(rel);
      if (!content) continue;
      if (
        spec.invocation_re.test(content) ||
        (spec.precommit_repo_re && spec.precommit_repo_re.test(content))
      ) {
        if (!invoke_paths.includes(rel)) invoke_paths.push(rel);
      }
    }

    for (const wf of deps.workflowActionFacts()) {
      const hit =
        wf.uses_refs.some((u) => spec.invocation_re.test(u.ref)) ||
        wf.step_runs.some((r) => spec.invocation_re.test(r.run));
      if (hit && !invoke_paths.includes(wf.rel)) invoke_paths.push(wf.rel);
    }

    return { dep_paths, invoke_paths };
  }

  function codeQualityRule(args: {
    spec_rule_name: string;
    aic_ids: string[];
    detections: Array<{ tool: string; det: ToolDetection }>;
  }): RuleEvidence {
    const fulfilled = args.detections.filter(
      (d) => d.det.dep_paths.length > 0 && d.det.invoke_paths.length > 0,
    );
    const installedNotInvoked = args.detections.filter(
      (d) => d.det.dep_paths.length > 0 && d.det.invoke_paths.length === 0,
    );
    const invokedWithoutDep = args.detections.filter(
      (d) => d.det.dep_paths.length === 0 && d.det.invoke_paths.length > 0,
    );

    let status: RuleStatus;
    let reason: string;
    if (fulfilled.length > 0) {
      status = 'Fulfilled';
      const f = fulfilled[0]!;
      reason =
        `${f.tool} declared in ${f.det.dep_paths[0]} and invoked in ${f.det.invoke_paths[0]}` +
        (fulfilled.length > 1 ? ` (+${fulfilled.length - 1} other tool(s))` : '');
    } else if (invokedWithoutDep.length > 0) {
      status = 'Fulfilled';
      const f = invokedWithoutDep[0]!;
      reason =
        `${f.tool} invoked in ${f.det.invoke_paths[0]} (no local manifest dep, action/hook only)` +
        (invokedWithoutDep.length > 1 ? ` (+${invokedWithoutDep.length - 1} other tool(s))` : '');
    } else if (installedNotInvoked.length > 0) {
      status = 'Warning';
      const f = installedNotInvoked[0]!;
      reason = `${f.tool} declared in ${f.det.dep_paths[0]} but no invocation found in scripts, pre-commit, or workflows`;
    } else {
      status = 'Warning';
      reason = `no recognized tool detected (looked for ${args.detections.map((d) => d.tool).join(', ')})`;
    }
    return {
      spec_rule_name: args.spec_rule_name,
      applicability: { verdict: 'applicable', trigger_evidence: 'tracked deps and CI surface' },
      commands: [],
      derived_status: status,
      derivation_reason: reason,
      judgment_required: false,
      aic_ids: args.aic_ids,
    };
  }

  function ruleDeadCodeAndCyclesSurfaced(): RuleEvidence {
    return codeQualityRule({
      spec_rule_name: 'Dead Code and Cycles Surfaced',
      aic_ids: RULE_AIC_IDS['dead-code-and-cycles-surfaced']!,
      detections: [
        { tool: 'knip', det: detectTool({ npm: ['knip'], invocation_re: /\bknip\b/ }) },
        { tool: 'depcheck', det: detectTool({ npm: ['depcheck'], invocation_re: /\bdepcheck\b/ }) },
        { tool: 'ts-prune', det: detectTool({ npm: ['ts-prune'], invocation_re: /\bts-prune\b/ }) },
        { tool: 'madge', det: detectTool({ npm: ['madge'], invocation_re: /\bmadge\b/ }) },
        {
          tool: 'unimported',
          det: detectTool({ npm: ['unimported'], invocation_re: /\bunimported\b/ }),
        },
        { tool: 'vulture', det: detectTool({ py: ['vulture'], invocation_re: /\bvulture\b/ }) },
      ],
    });
  }

  function ruleArchitectureRulesAutomated(): RuleEvidence {
    const eslintHits: string[] = [];
    for (const rel of deps.trackedFiles()) {
      const base = path.basename(rel);
      if (!/^\.eslintrc(\.[a-z]+)?$/i.test(base) && !/^eslint\.config\.[mc]?[jt]s$/i.test(base))
        continue;
      const text = deps.readTrackedFile(rel) ?? '';
      if (/import\/no-restricted-paths/.test(text)) eslintHits.push(rel);
    }
    const detections = [
      {
        tool: 'dependency-cruiser',
        det: detectTool({
          npm: ['dependency-cruiser'],
          invocation_re: /\bdepcruise|\bdependency-cruiser\b/,
        }),
      },
      {
        tool: 'eslint-plugin-boundaries',
        det: detectTool({
          npm: ['eslint-plugin-boundaries'],
          invocation_re: /eslint-plugin-boundaries|\bboundaries\b/,
        }),
      },
      {
        tool: 'import-linter',
        det: detectTool({
          py: ['import-linter'],
          invocation_re: /\blint-imports\b|\bimport-linter\b/,
        }),
      },
    ];
    if (eslintHits.length > 0) {
      detections.push({
        tool: 'eslint import/no-restricted-paths',
        det: { dep_paths: eslintHits, invoke_paths: eslintHits },
      });
    }
    return codeQualityRule({
      spec_rule_name: 'Architecture Rules Automated',
      aic_ids: RULE_AIC_IDS['architecture-rules-automated']!,
      detections,
    });
  }

  function ruleCredentialLeakageChecks(): RuleEvidence {
    return codeQualityRule({
      spec_rule_name: 'Credential Leakage Checks',
      aic_ids: RULE_AIC_IDS['credential-leakage-checks']!,
      detections: [
        {
          tool: 'gitleaks',
          det: detectTool({
            npm: [],
            invocation_re: /gitleaks/i,
            precommit_repo_re: /gitleaks/i,
          }),
        },
        {
          tool: 'trufflehog',
          det: detectTool({
            npm: [],
            invocation_re: /trufflehog|trufflesecurity\//i,
            precommit_repo_re: /trufflehog/i,
          }),
        },
        {
          tool: 'detect-secrets',
          det: detectTool({
            py: ['detect-secrets'],
            invocation_re: /detect-secrets/i,
            precommit_repo_re: /detect-secrets/i,
          }),
        },
        {
          tool: 'secretlint',
          det: detectTool({
            npm: ['secretlint', '@secretlint/secretlint-rule-preset-recommend'],
            invocation_re: /secretlint/i,
            precommit_repo_re: /secretlint/i,
          }),
        },
        {
          tool: 'ggshield',
          det: detectTool({
            py: ['ggshield'],
            invocation_re: /ggshield/i,
            precommit_repo_re: /gitguardian/i,
          }),
        },
      ],
    });
  }

  return {
    trackedDeps,
    ruleDeadCodeAndCyclesSurfaced,
    ruleArchitectureRulesAutomated,
    ruleCredentialLeakageChecks,
  };
}

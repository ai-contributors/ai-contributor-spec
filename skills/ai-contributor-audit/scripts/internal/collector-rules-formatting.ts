// SPDX-License-Identifier: Apache-2.0
//
// Formatting automation rule for audit-collect.

import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { WorkflowActionFacts } from './collector-rules-github-actions.ts';
import type { RuleEvidence } from './collector-types.ts';

export interface FormattingRuleDeps {
  trackedFiles: () => string[];
  trackedDeps: () => {
    npm: ReadonlyMap<string, readonly string[]>;
    py: ReadonlyMap<string, readonly string[]>;
  };
  workflowActionFacts: () => WorkflowActionFacts[];
  readTrackedFile: (rel: string) => string | null;
  readPackageJson: (rel: string) => unknown;
}

const FORMATTER_NPM = ['prettier', '@biomejs/biome'];
const FORMATTER_PY = ['black', 'ruff', 'autopep8', 'yapf'];
const FORMATTER_INVOCATION_RE =
  /\b(prettier|biome|black|ruff(?:\s+format)?|gofmt|rustfmt|cargo\s+fmt)\b/i;

export function createFormattingRules(deps: FormattingRuleDeps): {
  ruleFormattingAutomated: () => RuleEvidence;
} {
  function ruleFormattingAutomated(): RuleEvidence {
    const tracked = deps.trackedFiles();
    const hasEditorconfig = tracked.includes('.editorconfig');
    const formatterConfigs: string[] = [];
    for (const rel of tracked) {
      const base = path.basename(rel);
      if (
        /^\.prettierrc(\.[a-z]+)?$/.test(base) ||
        base === 'prettier.config.js' ||
        base === 'prettier.config.cjs' ||
        base === 'prettier.config.mjs' ||
        base === 'biome.json' ||
        base === 'biome.jsonc' ||
        base === '.gofmt' ||
        base === 'rustfmt.toml' ||
        base === '.rustfmt.toml'
      ) {
        formatterConfigs.push(rel);
      }
      if (base === 'pyproject.toml') {
        const text = deps.readTrackedFile(rel) ?? '';
        if (/\[tool\.(black|ruff|autopep8|yapf)\b/.test(text)) formatterConfigs.push(rel);
      }
    }
    const dependencyNames = deps.trackedDeps();
    const hasFormatterDep =
      FORMATTER_NPM.some((d) => dependencyNames.npm.has(d)) ||
      FORMATTER_PY.some((d) => dependencyNames.py.has(d));

    const ciInvocations: string[] = [];
    for (const wf of deps.workflowActionFacts()) {
      const hit =
        wf.uses_refs.some((u) => FORMATTER_INVOCATION_RE.test(u.ref)) ||
        wf.step_runs.some((r) => FORMATTER_INVOCATION_RE.test(r.run));
      if (hit) ciInvocations.push(wf.rel);
    }
    const scriptInvocations: string[] = [];
    for (const rel of tracked) {
      if (path.basename(rel) !== 'package.json') continue;
      const pkg = deps.readPackageJson(rel);
      const scripts =
        pkg && typeof pkg === 'object' && 'scripts' in pkg
          ? (pkg as { scripts?: unknown }).scripts
          : null;
      if (!scripts || typeof scripts !== 'object') continue;
      for (const v of Object.values(scripts)) {
        if (typeof v === 'string' && FORMATTER_INVOCATION_RE.test(v)) {
          scriptInvocations.push(rel);
          break;
        }
      }
    }
    const precommitContent =
      deps.readTrackedFile('.pre-commit-config.yaml') ??
      deps.readTrackedFile('.pre-commit-config.yml') ??
      '';
    const precommitInvocation = FORMATTER_INVOCATION_RE.test(precommitContent);

    const configEvidence = [...formatterConfigs];
    if (hasEditorconfig) configEvidence.unshift('.editorconfig');
    const invokeEvidence: string[] = [];
    if (ciInvocations.length > 0) invokeEvidence.push(`CI: ${ciInvocations.join(', ')}`);
    if (scriptInvocations.length > 0)
      invokeEvidence.push(`scripts: ${scriptInvocations.join(', ')}`);
    if (precommitInvocation) invokeEvidence.push('pre-commit');

    if (configEvidence.length === 0 && !hasFormatterDep) {
      return {
        spec_rule_name: 'Formatting Automated',
        applicability: { verdict: 'applicable', trigger_evidence: 'tracked tree' },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: 'no .editorconfig / formatter config / formatter dep detected',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['formatting-automated']!,
      };
    }
    if (invokeEvidence.length === 0) {
      return {
        spec_rule_name: 'Formatting Automated',
        applicability: { verdict: 'applicable', trigger_evidence: 'tracked tree' },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `formatter config(s) present but no CI / script / pre-commit invocation: ${configEvidence.join(', ')}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['formatting-automated']!,
      };
    }
    return {
      spec_rule_name: 'Formatting Automated',
      applicability: { verdict: 'applicable', trigger_evidence: 'tracked tree' },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `config: ${configEvidence.join(', ')}; invoked via ${invokeEvidence.join('; ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['formatting-automated']!,
    };
  }

  return { ruleFormattingAutomated };
}

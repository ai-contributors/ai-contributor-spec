// SPDX-License-Identifier: Apache-2.0
//
// Test shape and coverage rules for audit-collect.

import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { RuleEvidence } from './collector-types.ts';

export interface TestRuleDeps {
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
}

interface TestRunnerSignal {
  rel: string;
  layer: 'unit' | 'integration' | 'e2e' | 'unknown';
  coverage_threshold: number | null;
}

const COVERAGE_KEY_RE = /(branches|lines|functions|statements)\s*[:=]\s*(\d+(?:\.\d+)?)/g;
const E2E_RUNNER_RES = [/playwright\.config\./i, /cypress\.config\./i];
const INTEGRATION_PATH_RES = [/(^|\/)integration[s]?\//i, /(^|\/)tests?\/integration\//i];
const UNIT_PATH_RES = [/(^|\/)tests?\/unit\//i, /\.spec\.[jt]sx?$/i, /\.test\.[jt]sx?$/i];

export function createTestRules(deps: TestRuleDeps): {
  ruleMultipleTestLayers: () => RuleEvidence;
  ruleCoverageAsMinimum: () => RuleEvidence;
} {
  function detectTestRunners(): TestRunnerSignal[] {
    const tracked = deps.trackedFiles();
    const out: TestRunnerSignal[] = [];
    for (const rel of tracked) {
      const base = path.basename(rel);
      const isJsRunner = /^(jest|vitest)\.config\.[mc]?[jt]sx?$/.test(base);
      const isE2e = E2E_RUNNER_RES.some((r) => r.test(base));
      const isPyproject = base === 'pyproject.toml';
      if (!isJsRunner && !isE2e && !isPyproject) continue;
      const text = deps.readTrackedFile(rel) ?? '';
      let layer: TestRunnerSignal['layer'] = 'unknown';
      let coverage_threshold: number | null = null;
      if (isE2e) layer = 'e2e';
      else if (isJsRunner) {
        if (
          /testEnvironment\s*[:=]\s*['"]node/.test(text) &&
          INTEGRATION_PATH_RES.some((r) => r.test(text))
        ) {
          layer = 'integration';
        } else {
          layer = 'unit';
        }
        let m: RegExpExecArray | null;
        const re = new RegExp(COVERAGE_KEY_RE.source, 'g');
        while ((m = re.exec(text))) {
          const v = parseFloat(m[2]!);
          if (coverage_threshold === null || v < coverage_threshold) coverage_threshold = v;
        }
      } else if (isPyproject) {
        if (/\[tool\.pytest\.ini_options\]|\[tool\.coverage[\s.]/.test(text)) {
          layer = 'unit';
          const m = text.match(/fail_under\s*=\s*(\d+(?:\.\d+)?)/);
          if (m) coverage_threshold = parseFloat(m[1]!);
        } else {
          continue;
        }
      }
      out.push({ rel, layer, coverage_threshold });
    }
    const dirHits = new Set<TestRunnerSignal['layer']>();
    for (const rel of tracked) {
      if (UNIT_PATH_RES.some((r) => r.test(rel))) dirHits.add('unit');
      if (INTEGRATION_PATH_RES.some((r) => r.test(rel))) dirHits.add('integration');
      if (/(^|\/)tests?\/e2e\//i.test(rel) || /(^|\/)e2e\//i.test(rel)) dirHits.add('e2e');
    }
    for (const layer of dirHits) {
      if (!out.some((o) => o.layer === layer))
        out.push({ rel: `<test-dir>:${layer}`, layer, coverage_threshold: null });
    }
    return out;
  }

  function ruleMultipleTestLayers(): RuleEvidence {
    const sigs = detectTestRunners();
    if (sigs.length === 0) {
      return {
        spec_rule_name: 'Multiple Test Layers',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: 'no test runner / config detected',
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          'no recognized test runner config (jest/vitest/playwright/cypress/pyproject pytest) and no test directory found',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['multiple-test-layers']!,
      };
    }
    const layers = new Set(sigs.map((s) => s.layer).filter((l) => l !== 'unknown'));
    return {
      spec_rule_name: 'Multiple Test Layers',
      applicability: { verdict: 'applicable', trigger_evidence: `${sigs.length} test signal(s)` },
      commands: [],
      derived_status: layers.size >= 2 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        layers.size >= 2
          ? `distinct test layers: ${[...layers].sort().join(', ')}`
          : `only one test layer detected: ${[...layers][0] ?? 'unknown'}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['multiple-test-layers']!,
    };
  }

  function ruleCoverageAsMinimum(): RuleEvidence {
    const sigs = detectTestRunners();
    const withThreshold = sigs.filter((s) => s.coverage_threshold !== null);
    if (withThreshold.length === 0) {
      return {
        spec_rule_name: 'Coverage as Minimum',
        applicability: { verdict: 'applicable', trigger_evidence: `${sigs.length} test config(s)` },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: 'no coverage threshold detected in test runner configs',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['coverage-as-minimum']!,
      };
    }
    const zero = withThreshold.filter((s) => (s.coverage_threshold ?? 0) === 0);
    if (zero.length > 0) {
      return {
        spec_rule_name: 'Coverage as Minimum',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${withThreshold.length} threshold(s)`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `coverage threshold present but set to 0 in: ${zero.map((s) => s.rel).join(', ')}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['coverage-as-minimum']!,
      };
    }
    return {
      spec_rule_name: 'Coverage as Minimum',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${withThreshold.length} threshold(s)`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `coverage threshold(s) > 0: ${withThreshold.map((s) => `${s.rel}=${s.coverage_threshold}`).join(', ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['coverage-as-minimum']!,
    };
  }

  return { ruleMultipleTestLayers, ruleCoverageAsMinimum };
}

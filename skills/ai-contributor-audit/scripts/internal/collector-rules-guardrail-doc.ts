// SPDX-License-Identifier: Apache-2.0
//
// Authoritative guardrail documentation rule for audit-collect.

import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { InstructionQualityHints, RuleEvidence } from './collector-types.ts';

export interface GuardrailDocRuleDeps {
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
  buildInstructionQualityHints: () => InstructionQualityHints;
}

// Recognized authoritative guardrail catalog filenames. Recommendation order:
// docs/guardrails.md (preferred for repos with a docs tree), GUARDRAILS.md at
// the repo root for everyone else. Repos that want a single combined file can
// put a clearly-named `## Guardrails` section in AGENTS.md; that case is
// covered by the InstructionQualityHints branch of this rule, not by the
// filename allowlist. Speculative variants (AI-CONTRIBUTOR-GUIDE.md,
// docs/ai-guardrails.md) were intentionally removed — fewer accepted paths
// keeps the recommended convention legible and avoids spec/tooling drift.
const GUARDRAIL_FILE_RES = [/^docs\/guardrails?\.md$/i, /^GUARDRAILS?\.md$/i];

export function createGuardrailDocRules(deps: GuardrailDocRuleDeps): {
  ruleAuthoritativeGuardrailDoc: () => RuleEvidence;
} {
  function ruleAuthoritativeGuardrailDoc(): RuleEvidence {
    const tracked = deps.trackedFiles();
    const candidates = tracked.filter((rel) => GUARDRAIL_FILE_RES.some((r) => r.test(rel)));
    if (candidates.length === 0) {
      return {
        spec_rule_name: 'Authoritative Guardrail Doc',
        applicability: { verdict: 'applicable', trigger_evidence: 'tracked tree' },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          'no recognized guardrail doc (docs/guardrails.md or GUARDRAILS.md) tracked',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['authoritative-guardrail-doc']!,
      };
    }
    const guide = candidates[0]!;
    const readme = deps.readTrackedFile('README.md') ?? '';
    const linkedFromReadme = readme.includes(guide) || readme.includes(path.basename(guide));
    const hints = deps.buildInstructionQualityHints();
    const canonicalText = hints.canonical_file
      ? (deps.readTrackedFile(hints.canonical_file) ?? '')
      : '';
    const linkedFromCanonical =
      canonicalText.includes(guide) || canonicalText.includes(path.basename(guide));

    if (linkedFromReadme || linkedFromCanonical) {
      const where = [
        linkedFromReadme ? 'README.md' : null,
        linkedFromCanonical ? hints.canonical_file : null,
      ]
        .filter(Boolean)
        .join(', ');
      return {
        spec_rule_name: 'Authoritative Guardrail Doc',
        applicability: { verdict: 'applicable', trigger_evidence: guide },
        commands: [],
        derived_status: 'Fulfilled',
        derivation_reason: `${guide} linked from ${where}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['authoritative-guardrail-doc']!,
      };
    }
    return {
      spec_rule_name: 'Authoritative Guardrail Doc',
      applicability: { verdict: 'applicable', trigger_evidence: guide },
      commands: [],
      derived_status: 'Warning',
      derivation_reason: `${guide} exists but is not linked from README.md or the canonical instruction file (${hints.canonical_file ?? 'absent'})`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['authoritative-guardrail-doc']!,
    };
  }

  return { ruleAuthoritativeGuardrailDoc };
}

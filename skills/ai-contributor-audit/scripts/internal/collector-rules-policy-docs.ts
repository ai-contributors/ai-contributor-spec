// SPDX-License-Identifier: Apache-2.0
//
// Policy documentation rules for audit-collect.

import { RULE_AIC_IDS } from './collector-registry.ts';
import type { RuleEvidence } from './collector-types.ts';

export interface PolicyDocsRuleDeps {
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
  lineNumberFor: (text: string, pattern: RegExp) => number | null;
}

export function createPolicyDocsRules(deps: PolicyDocsRuleDeps): {
  ruleSecurityPolicyDocumented: () => RuleEvidence;
  ruleThreatModelDocumented: () => RuleEvidence;
} {
  function ruleSecurityPolicyDocumented(): RuleEvidence {
    const candidates = [
      'SECURITY.md',
      '.github/SECURITY.md',
      'docs/SECURITY.md',
      'docs/security.md',
      'docs/security/policy.md',
    ];
    for (const rel of candidates) {
      const content = deps.readTrackedFile(rel);
      if (!content) continue;
      const hasPolicyTitle =
        /(^|\n)\s*#\s*security policy\b/i.test(content) ||
        /vulnerability disclosure|security reporting/i.test(content);
      const hasDisclosurePath =
        /vulnerabilit|disclos|report|security@|mailto:|github security advisory/i.test(content);
      if (!hasPolicyTitle || !hasDisclosurePath) continue;
      const line =
        deps.lineNumberFor(
          content,
          /vulnerabilit|disclos|report|security@|mailto:|github security advisory/i,
        ) ?? 1;
      return {
        spec_rule_name: 'Security Policy',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${rel} is tracked and documents a vulnerability disclosure/reporting path`,
        },
        commands: [],
        derived_status: 'Fulfilled',
        derivation_reason: `${rel}:${line} documents the vulnerability disclosure/reporting path`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['security-policy-documented'],
        raw_artefact_refs: [rel],
      };
    }

    return {
      spec_rule_name: 'Security Policy',
      applicability: {
        verdict: 'unknown',
        trigger_evidence:
          'no tracked SECURITY.md or equivalent disclosure policy was auto-detected',
      },
      commands: [],
      derived_status: null,
      derivation_reason:
        'no tracked SECURITY.md or equivalent disclosure policy was auto-detected; auditor must decide applicability and evidence',
      judgment_required: true,
      aic_ids: RULE_AIC_IDS['security-policy-documented'],
    };
  }

  function ruleThreatModelDocumented(): RuleEvidence {
    const candidates = deps.trackedFiles().filter((rel) => {
      const lower = rel.toLowerCase();
      return (
        lower.endsWith('.md') &&
        (lower.includes('threat-model') ||
          lower.includes('threat_model') ||
          lower.includes('threatmodel') ||
          lower === 'security.md' ||
          lower.endsWith('/security.md') ||
          lower.includes('/security/'))
      );
    });

    for (const rel of candidates) {
      const content = deps.readTrackedFile(rel);
      if (!content) continue;
      const isThreatModel =
        /(^|\n)\s*#\s*.*threat model\b/i.test(content) || /\bthreat model\b/i.test(content);
      const hasReviewDate =
        /\b(last reviewed|review date|reviewed)\b[\s\S]{0,80}\b20\d{2}-\d{2}-\d{2}\b/i.test(
          content,
        );
      const hasBoundaries =
        /\b(trust boundaries|trust boundary|security boundary|data flow|attack surface)\b/i.test(
          content,
        );
      const hasScenarios = /\b(threat scenario|threats?|mitigation|control|residual risk)\b/i.test(
        content,
      );
      if (!isThreatModel || !hasReviewDate || !hasBoundaries || !hasScenarios) continue;
      const line = deps.lineNumberFor(content, /\b(last reviewed|review date|reviewed)\b/i) ?? 1;
      return {
        spec_rule_name: 'Threat Model',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${rel} is tracked and contains a threat model with review-date evidence`,
        },
        commands: [],
        derived_status: 'Fulfilled',
        derivation_reason: `${rel}:${line} records a reviewed threat-model artifact with boundaries and threat/control coverage`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['threat-model-documented'],
        raw_artefact_refs: [rel],
      };
    }

    return {
      spec_rule_name: 'Threat Model',
      applicability: {
        verdict: 'unknown',
        trigger_evidence:
          'no tracked threat-model artifact with review date, boundaries, and threat/control coverage was auto-detected',
      },
      commands: [],
      derived_status: null,
      derivation_reason:
        'no tracked threat-model artifact with review date, boundaries, and threat/control coverage was auto-detected; auditor must decide applicability and evidence',
      judgment_required: true,
      aic_ids: RULE_AIC_IDS['threat-model-documented'],
    };
  }

  return { ruleSecurityPolicyDocumented, ruleThreatModelDocumented };
}

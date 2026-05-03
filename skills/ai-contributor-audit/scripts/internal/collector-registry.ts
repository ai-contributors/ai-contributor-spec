// SPDX-License-Identifier: Apache-2.0
//
// Canonical collector rule order and AIC mappings.

// AIC IDs each rule's `derived_status` determines (when `judgment_required:
// false`). Source of truth for the validator's row stamper. Verified against
// `AI-CONTRIBUTOR-SPECIFICATION.md` — every entry MUST exist there with the
// `AIC-` prefix. Multi-AIC entries indicate the same `derived_status` applies
// to every listed row; the validator stamps each matching row identically.
export const RULE_AIC_IDS = {
  'lockfile-integrity': ['AIC-lockfile-integrity-hashes', 'AIC-lockfile-enforced-in-ci'],
  'lint-rules': ['AIC-lint-correctness-rules'],
  'strict-types': ['AIC-strict-typing-enabled'],
  'pinned-toolchain': ['AIC-runtime-version-pinned', 'AIC-package-manager-pinned'],
  'pre-commit': ['AIC-precommit-meaningful-checks'],
  'automated-dependency-updates': ['AIC-automated-dep-updates'],
  'gate-enforcement': ['AIC-protected-branch-status-checks'],
  'branch-protection': ['AIC-default-branch-protected'],
  'ci-gates': ['AIC-ci-guardrail-suite'],
  'human-review-required': ['AIC-human-review-required'],
  'secret-scanning': ['AIC-secret-scanning-enabled'],
  'push-protection': ['AIC-push-protection-enabled'],
  'dependency-security': ['AIC-dependency-vuln-detection'],
  'dependency-review-visibility': ['AIC-dependency-review-visibility'],
  'sast-in-ci': ['AIC-sast-in-ci'],
  'security-policy-documented': ['AIC-vuln-disclosure-path'],
  'threat-model-documented': [
    'AIC-threat-model-required',
    'AIC-threat-model-artifact',
    'AIC-threat-model-review-date',
  ],
  'build-immutable-refs': ['AIC-build-immutable-refs'],
  'workflow-token-least-privilege': ['AIC-workflow-token-least-privilege'],
  'sbom-generation': ['AIC-sbom-generation'],
  'artifact-signing': ['AIC-artifact-signing'],
  'build-provenance-attestation': ['AIC-build-provenance-attestation'],
  'release-from-ci': ['AIC-release-from-ci'],
  'dead-code-and-cycles-surfaced': ['AIC-dead-code-and-cycles-surfaced'],
  'architecture-rules-automated': ['AIC-architecture-rules-automated'],
  'credential-leakage-checks': ['AIC-credential-leakage-checks'],
  'secret-vcs-exclude': ['AIC-secret-vcs-exclude'],
  'credential-handling-documented': ['AIC-credential-handling-documented'],
  'env-example-placeholders': ['AIC-env-example-placeholders'],
  'ai-instruction-authoritative': ['AIC-ai-instruction-authoritative'],
  'tool-specific-pointer-only': ['AIC-tool-specific-pointer-only'],
  'ai-forbidden-actions': ['AIC-ai-forbidden-actions'],
  'mcp-root-scoping': ['AIC-mcp-root-scoping'],
  'mcp-pinned-versions': ['AIC-mcp-pinned-versions'],
  'mcp-read-only-default': ['AIC-mcp-read-only-default'],
  'prompt-audit-trail': ['AIC-prompt-audit-trail'],
  'sensitive-path-ownership': ['AIC-sensitive-path-ownership'],
  'multiple-test-layers': ['AIC-multiple-test-layers'],
  'coverage-as-minimum': ['AIC-coverage-as-minimum'],
  'formatting-automated': ['AIC-formatting-automated'],
  'authoritative-guardrail-doc': ['AIC-authoritative-guardrail-doc'],
  'ai-authorship-traceability': ['AIC-ai-authorship-traceability'],
  'deploy-env-approvals': ['AIC-deploy-env-approvals'],
  'clean-clone-bootstrap': ['AIC-clean-clone-bootstrap'],
} satisfies Record<string, string[]>;

export const COLLECTOR_RULE_IDS = Object.keys(RULE_AIC_IDS) as Array<keyof typeof RULE_AIC_IDS>;
export type CollectorRuleId = (typeof COLLECTOR_RULE_IDS)[number];

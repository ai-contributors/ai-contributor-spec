# AI Contributor Audit Profile

Draft answers from repository evidence first, then ask the owner to confirm or correct them. Answer each applicability question with `yes`, `no`, or leave it blank for auditor or collector decision. Add evidence or rationale when the answer is not obvious.

For agent-assisted profile creation:

1. Inspect the repository lightly for manifests, source roots, UI files, workflows, release paths, AI instructions, MCP config, prompt/session archives, and policy docs.
2. Draft each answer with evidence and confidence.
3. Ask the owner to confirm or correct the draft. Low-confidence, sensitive-data, regulated-data, production-data, and owner-intent answers need explicit confirmation.
4. Write confirmed answers here. Leave uncertain answers blank and record what owner fact is missing.

Every applicability question is phrased in the same direction:

- `yes` enables the affected checks. They are applicable and still need normal evidence.
- `no` disables the affected checks when the checklist row allows `Not relevant`.
- Blank means no confirmed steering; the collector and auditor decide from repository evidence.

Profile answers steer applicability only. They are not waivers and do not make rows `Fulfilled` unless the row's evidence model explicitly accepts owner attestation or policy text.

## Applicability Questions

<!-- BEGIN:GENERATED applicability-questions -->
| Area | Question | Answer | Evidence / rationale | Affected checks (rule and IDs) |
| ---- | -------- | ------ | -------------------- | ------------------------------ |
| Technology shape | Apply environment-variable template checks? |  |  | `Env Template` - `AIC-env-example-placeholders` |
| Technology shape | Apply user-interface and accessibility checks? |  |  | `Accessibility` - `AIC-a11y-component-checks`, `AIC-a11y-review-testing`; `A11y Helpers` - `AIC-a11y-helpers`; `A11y Keyboard Focus` - `AIC-a11y-keyboard-focus`; `Additional A11y Gates` - `AIC-a11y-extra-gates`; `Performance Budget` - `AIC-performance-budgets`; `Performance Budgets Automated` - `AIC-budgets-automated` |
| Technology shape | Apply backend, proxy, worker, or critical-runtime checks? |  |  | `Reliability Targets` - `AIC-reliability-expectations`; `Error Budgets` - `AIC-reliability-consequences`; `Observability` - `AIC-observability-redaction`; `Failure Handling` - `AIC-failure-handling-explicit`, `AIC-retries-backoff-deliberate` |
| Technology shape | Apply database schema and persistence-layer checks? |  |  | `Data Integrity Constraints` - `AIC-data-integrity-constraints` |
| Hosting shape | Apply hosted push-time secret blocking checks? |  |  | `Push Protection` - `AIC-push-protection-enabled` |
| Hosting shape | Apply hosted deployment-environment required-reviewer checks? |  |  | `Deployment Protection Rules` - `AIC-deploy-env-approvals` |
| Use case | Apply build/release dependency identification and SBOM checks? |  |  | `SBOM` - `AIC-sbom-generation`, `AIC-release-dependency-identification` |
| Use case | Apply external-consumer supply-chain trust checks (provenance attestations, artifact signing, immutable build linkage)? |  |  | `Build Origin Records` - `AIC-build-provenance-attestation`, `AIC-build-immutable-refs`; `Artifact Signing` - `AIC-artifact-signing` |
| Use case | Apply CI/CD workflow and deployment-credential checks? |  |  | `Workflow Security` - `AIC-workflow-token-least-privilege`, `AIC-short-lived-deploy-creds`; `Deployment Protection` - `AIC-prod-deploy-protected`; `Deployment Protection Rules` - `AIC-deploy-env-approvals`; `Deployment Separation` - `AIC-deployment-separation`; `Release from CI` - `AIC-release-from-ci` |
| Collaboration shape | Apply external-contribution disclosure checks? |  |  | `AI Authorship Disclosure` - `AIC-ai-authorship-disclosure-policy` |
| AI shape | Apply external AI provider and model allowlist checks? |  |  | `AI Provider Allowlist` - `AIC-ai-provider-allowlist`; `AI Provider Data Gate` - `AIC-regulated-data-provider-gate`; `Provider Deprecation Procedure` - `AIC-provider-deprecation-procedure`; `No Routing Past EOL` - `AIC-no-routing-past-eol`; `Allowlist Rescope on Terms Change` - `AIC-allowlist-rescope-on-terms-change` |
| AI shape | Apply retained AI prompt, transcript, and tool-output checks? |  |  | `AI Context Retention` - `AIC-ai-context-retention`; `Prompt Audit Trail` - `AIC-prompt-audit-trail`; `AI Input Retention` - `AIC-ai-input-retention` |
| AI shape | Apply MCP server checks? |  |  | `MCP Root Scoping` - `AIC-mcp-root-scoping`; `MCP Read-Only Default` - `AIC-mcp-read-only-default`; `MCP Pinned Versions` - `AIC-mcp-pinned-versions`; `MCP Env Separation` - `AIC-mcp-env-separation`; `MCP Root Prompt` - `AIC-mcp-root-prompt`; `MCP Prompt Review` - `AIC-mcp-prompt-review`; `MCP Auditability` - `AIC-mcp-auditability` |
| AI shape | Apply autonomous-agent and scheduled-runner checks? |  |  | `Agent Escalation Triggers` - `AIC-agent-escalation-trigger-enforcement`; `Agent Kill Switch` - `AIC-agent-kill-switch`; `Agent Rollback Procedure` - `AIC-agent-rollback-procedure`; `Agent Behavior Monitoring` - `AIC-agent-behavior-monitoring`; `Agent Cost Ceiling` - `AIC-agent-cost-ceiling` |
| AI shape | Apply AI-introduced dependency checks? |  |  | `AI Dependency Verification` - `AIC-ai-dependency-verification`; `Strict New Dependency Policy` - `AIC-strict-new-dep-policy` |
| Data and risk shape | Apply regulated, secret, customer, or production-data AI workflow checks? |  |  | `AI Data Classification` - `AIC-ai-data-classification`; `AI Provider Data Gate` - `AIC-regulated-data-provider-gate`; `AI Prod Data Read-Only` - `AIC-ai-prod-data-readonly`; `Data Minimization Techniques` - `AIC-data-minimization-techniques` |
<!-- END:GENERATED applicability-questions -->

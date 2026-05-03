# AI Contributor Audit Profile

Fill the project dimensions first, then answer the applicability questions in that context. Answer each applicability question with `yes`, `no`, or leave it blank for auditor or collector decision. Add optional owner evidence when the answer is not obvious.

Every applicability question is phrased in the same direction:

- `yes` enables the affected checks. They are applicable and still need normal evidence.
- `no` disables the affected checks when the checklist row allows `Not relevant`.
- Blank means no owner steering; the collector and auditor decide from repository evidence.

Profile answers steer applicability only. They are not waivers and do not make rows `Fulfilled` unless the row's evidence model explicitly accepts owner attestation or policy text.

## Project Dimensions

| Dimension | Owner input |
| --------- | ----------- |
| Technology shape | Small TypeScript package fixture with no UI, service runtime, database, or deployment surface. |
| Use case | Synthetic golden-audit repository used to exercise deterministic collector output. |
| Collaboration shape | Repository fixture, not an externally contributed project. |
| Data and risk shape | No customer, production, regulated, or sensitive data modelled by the fixture. |
| AI shape | AI Contributor guardrail fixture with no external AI provider, retained prompt store, MCP server, or autonomous runner. |

## Applicability Questions

| Dimension | Question | Answer | Owner evidence / rationale | Affected checks (rule and IDs) |
| --------- | -------- | ------ | -------------------------- | ------------------------------ |
| Technology shape | Apply environment-variable template checks? | yes | Fixture includes `.env.example` and ignores local `.env` files. | `Env Template` - `AIC-env-example-placeholders` |
| Technology shape | Apply user-interface and accessibility checks? | no | Fixture has no UI routes, components, browser app, or accessibility surface. | `Accessibility` - `AIC-a11y-component-checks`, `AIC-a11y-review-testing`; `A11y Helpers` - `AIC-a11y-helpers`; `A11y Keyboard Focus` - `AIC-a11y-keyboard-focus`; `Additional A11y Gates` - `AIC-a11y-extra-gates`; `Performance Budget` - `AIC-performance-budgets`; `Performance Budgets Automated` - `AIC-budgets-automated` |
| Technology shape | Apply backend, proxy, worker, or critical-runtime checks? | no | Fixture has no backend service, proxy, worker, SLO, or production runtime. | `Reliability Targets` - `AIC-reliability-expectations`; `Error Budgets` - `AIC-reliability-consequences`; `Observability` - `AIC-observability-redaction`; `Failure Handling` - `AIC-failure-handling-explicit`, `AIC-retries-backoff-deliberate` |
| Technology shape | Apply database schema and persistence-layer checks? | no | Fixture has no persistence layer, migrations, schema, or data integrity model. | `Data Integrity Constraints` - `AIC-data-integrity-constraints` |
| Hosting shape | Apply hosted push-time secret blocking checks? | no | Fixture has no hosted repository configuration for push-time secret blocking. | `Push Protection` - `AIC-push-protection-enabled` |
| Hosting shape | Apply hosted deployment-environment required-reviewer checks? | no | Fixture has no GitHub deployment environment, hosted reviewer surface, or production deploy. | `Deployment Protection Rules` - `AIC-deploy-env-approvals` |
| Use case | Apply build/release dependency identification and SBOM checks? | no | Fixture has no release pipeline, packaging, or SBOM-emitting build. | `SBOM` - `AIC-sbom-generation`, `AIC-release-dependency-identification` |
| Use case | Apply external-consumer supply-chain trust checks (provenance attestations, artifact signing, immutable build linkage)? | no | Fixture has no externally consumed artifact, downstream verifier, or supply-chain trust requirement. | `Build Origin Records` - `AIC-build-provenance-attestation`, `AIC-build-immutable-refs`; `Artifact Signing` - `AIC-artifact-signing` |
| Use case | Apply CI/CD workflow and deployment-credential checks? | no | Fixture has no CI workflow, deployment environment, production credentials, or release workflow. | `Workflow Security` - `AIC-workflow-token-least-privilege`, `AIC-short-lived-deploy-creds`; `Deployment Protection` - `AIC-prod-deploy-protected`; `Deployment Protection Rules` - `AIC-deploy-env-approvals`; `Deployment Separation` - `AIC-deployment-separation`; `Release from CI` - `AIC-release-from-ci` |
| Collaboration shape | Apply external-contribution disclosure checks? | no | Fixture does not accept or model external contributions. | `AI Authorship Disclosure` - `AIC-ai-authorship-disclosure-policy` |
| AI shape | Apply external AI provider and model allowlist checks? | no | Fixture does not call or configure an external AI provider or model. | `AI Provider Allowlist` - `AIC-ai-provider-allowlist`; `AI Provider Data Gate` - `AIC-regulated-data-provider-gate`; `Provider Deprecation Procedure` - `AIC-provider-deprecation-procedure`; `No Routing Past EOL` - `AIC-no-routing-past-eol`; `Allowlist Rescope on Terms Change` - `AIC-allowlist-rescope-on-terms-change` |
| AI shape | Apply retained AI prompt, transcript, and tool-output checks? | no | Fixture has no retained AI prompt, transcript, or tool-output store. | `AI Context Retention` - `AIC-ai-context-retention`; `Prompt Audit Trail` - `AIC-prompt-audit-trail`; `AI Input Retention` - `AIC-ai-input-retention` |
| AI shape | Apply MCP server checks? | no | Fixture has no MCP server configuration or runtime. | `MCP Root Scoping` - `AIC-mcp-root-scoping`; `MCP Read-Only Default` - `AIC-mcp-read-only-default`; `MCP Pinned Versions` - `AIC-mcp-pinned-versions`; `MCP Env Separation` - `AIC-mcp-env-separation`; `MCP Root Prompt` - `AIC-mcp-root-prompt`; `MCP Prompt Review` - `AIC-mcp-prompt-review`; `MCP Auditability` - `AIC-mcp-auditability` |
| AI shape | Apply autonomous-agent and scheduled-runner checks? | no | Fixture has no autonomous agent, scheduled runner, or delegated execution loop. | `Agent Escalation Triggers` - `AIC-agent-escalation-trigger-enforcement`; `Agent Kill Switch` - `AIC-agent-kill-switch`; `Agent Rollback Procedure` - `AIC-agent-rollback-procedure`; `Agent Behavior Monitoring` - `AIC-agent-behavior-monitoring`; `Agent Cost Ceiling` - `AIC-agent-cost-ceiling` |
| AI shape | Apply AI-introduced dependency checks? | no | Fixture does not model AI workflows that introduce dependencies. | `AI Dependency Verification` - `AIC-ai-dependency-verification`; `Strict New Dependency Policy` - `AIC-strict-new-dep-policy` |
| Data and risk shape | Apply regulated, secret, customer, or production-data AI workflow checks? | no | Fixture has no regulated, secret, customer, or production-data AI workflow. | `AI Data Classification` - `AIC-ai-data-classification`; `AI Provider Data Gate` - `AIC-regulated-data-provider-gate`; `AI Prod Data Read-Only` - `AIC-ai-prod-data-readonly`; `Data Minimization Techniques` - `AIC-data-minimization-techniques` |

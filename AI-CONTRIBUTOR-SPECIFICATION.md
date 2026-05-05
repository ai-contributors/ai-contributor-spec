# AI Contributor Specification

> **Version:** 0.2 · **Owner:** _Set per adopting repository_ · **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · **Change history:** [`CHANGELOG.md`](CHANGELOG.md)
>
> Change history is maintained in the repository's version-control log. Adopters `MUST` satisfy the change-control requirements in §25 for their copy of this document.

This document defines a vendor-neutral specification for repositories where AI contributes to code you ship. Whether this makes a codebase "production-ready" is a judgment for the adopting team.

It also covers the engineering work around AI-assisted delivery: repository setup, policy, CI, verification, and approval controls.

It is written as a practical policy, not general advice.

## How to read this document

If you are new to the specification, read it in this order:

1. [Conformance levels](#conformance-levels), to choose the AI workflow you want to allow.
2. [Normative language](#normative-language), to understand `MUST`, `MUST when applicable`, `SHOULD`, and `MAY`.
3. [Definitions](#definitions), when a term such as "agent", "material action", or "untrusted source" appears.
4. The clauses for your target level, using [`AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) as the practical scoring view.

The checklist is easier to fill than this document is to read end to end. Use this document when a checklist row is unclear, when you need the exact rule ID, or when you are changing the policy.

## Scope and audience

This document is for engineering teams adopting AI-assisted development on working codebases. It is written for engineering leads, platform teams, harness engineers, security reviewers, and developers who work with AI agents. Running the spec against a repository gives contributors a quick picture of its current state.

**In scope:** how AI agents contribute to application and infrastructure source code that gets merged and shipped, and how the shared skills, MCP servers, and other tooling they invoke are governed.

**Adoption scale:** the unit of adoption is one repository. Solo, team, and multi-team repositories can all use the same specification and checklist. The differences are ownership, approval, and evidence: solo repositories name one human owner, team repositories name people or team aliases, and multi-team repositories SHOULD use path-level ownership and shared guardrail documentation.

Monorepos are included. Apply the root policy once. Then use path-scoped ownership, package-level instructions, and deterministic workspace build/test order inside the repository.

**Out of scope:** foundation-model training and evaluation, reinforcement-learning pipelines, consumer-facing agent safety, and regulatory compliance frameworks beyond the references in §§9 and 18. This document does not replace industry-specific regulations. Combine it with organization-specific compliance programs where required.

Adopt the document as-is or as a starting point for an organization-specific policy. Adopters are responsible for maintaining their own copy under the change-control requirements in §25.

## Normative language

- `MUST` means required for the baseline engineering hardening this specification defines.
- `MUST NOT` means prohibited without exception.
- `SHOULD` means strongly recommended unless there is a documented reason not to implement it.
- `MAY` means optional or context-dependent.
- `MUST when applicable` means required only if the trigger applies. Examples include a UI, public releases, cloud deployments, or security-sensitive data. Each row states its own trigger. Example: §12 (Accessibility) applies only if the repository ships a UI; a backend-only API repository does not have to satisfy it.

A bullet labelled `MUST` in this document `MAY` map to a `MUST when applicable` row in [`AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) when the bullet's sentence carries an embedded applicability clause. Examples: "Multi-package repositories `MUST`…" (§1 `AIC-deterministic-build-order`) and "Data integrity constraints `MUST` exist where the persistence layer supports them" (§7 `AIC-data-integrity-constraints`). The trigger is the bullet's own clause, the obligation is unchanged, and the row is treated as `MUST when applicable` by the validator's strict closure (`Not relevant` requires the trigger to be absent, with evidence). Bullets with no embedded trigger are mapped as `MUST`.

A repository should not claim reliable AI-assisted delivery against this specification unless all unconditional `MUST` items and all relevant `MUST when applicable` items are satisfied.

## Spec IDs

Every requirement bullet in this document carries a stable identifier of the form `AIC-<slug>` — for example `AIC-secret-vcs-exclude`. **`AIC`** means **AI Contributor**. The `<slug>` is `[a-z0-9][a-z0-9-]*` and is chosen to describe the rule.

The IDs connect this specification, [`AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md), and [`AI-CONTRIBUTOR-AUDIT-LOG.md`](.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md). They survive section renumbering and bullet reordering. When citing a rule, prefer the ID over the section number.

---

## Pillars

The 29 clauses are grouped into seven pillars. The grouping is only a reader's map; it does not add requirements. Conformance is always checked clause by clause.

| Pillar | Name | Clauses | Scope |
|---|---|---|---|
| 1 | 🏗️ Engineering Foundation | §1–4 | The reproducible environment, static correctness, architecture boundaries, and pre-commit / CI gates that make any change reviewable. |
| 2 | 🛡️ Security | §5–9 | Secrets handling, dependency and CI/CD security, authorization boundaries, and threat modeling. |
| 3 | 🎯 Quality & Reliability | §10–14 | Runtime validation, testing strategy, accessibility, failure handling and observability, and performance and reliability. |
| 4 | 🚀 Release | §15–16 | Supply-chain transparency, branch protection, and release governance. |
| 5 | 🤖 AI Agents | §17–20 | How AI agents, shared skills, MCP servers, and delegated agents are governed in the repository. |
| 6 | ⚠️ AI Risk | §21–22 | AI-specific risks (prompt injection, untrusted input, capability scoping, allowlists, cost ceilings) and data protection for AI workflows. |
| 7 | 🧭 Oversight | §23–29 | Human approval, guardrail evidence, policy ownership, AI licensing and attribution, AI credential lifecycle, model/provider changes, and AI incident response. |

---

## Definitions

Terms used throughout this document. Where this document references these terms, the definitions here govern. Terms used only within a single clause are defined inline at first use.

- **Agent** — an automated process that performs multi-step actions on behalf of a human, including LLM-driven coding assistants, orchestration loops, PR bots, and scheduled autonomous runners. A CLI tool that executes one fixed command without planning is not an agent.
- **Harness** — the code that wraps an LLM. The harness decides what context, tools, memory, retrieval, and orchestration the model operates with at each step, and how its outputs flow back into the surrounding system. This specification constrains how a harness is built, reviewed, operated, and audited. It does not prescribe a specific harness architecture.
- **Destructive action** — any action that cannot be reversed by reviewing a diff or reverting a commit. Examples include deleting branches or tags, force-pushing to shared branches, mutating production data, rotating or revoking credentials, dropping database objects, removing published releases, closing or deleting issues or pull requests, and sending outbound messages to external parties.
- **Security-sensitive action** — any change to authentication, authorization, trust boundaries, cryptographic material, CI credentials, workflow files, or dependency manifests.
- **Release-affecting action** — any action that can cause an artifact to be published, deployed, or distributed to consumers.
- **Material action** — an action whose effect is durable or externally visible. Examples: changes that land on a protected branch, modify deployed artifacts or infrastructure, alter credentials, permissions, or trust boundaries, publish or distribute artifacts, or send outbound communication to external parties. Transient actions that leave no durable or external trace — such as read-only exploration or scratch work in disposable sandboxes — are not material. Reading secrets, credentials, or regulated data is material if the contents leave the sandbox in an un-redacted form (for example by being written to a transcript sent to a third-party provider, pasted into a shared document, or emitted to logs that persist outside the sandbox); a read that is redacted per §13 and §22 before leaving the sandbox is not material.
- **Engineering guardrail** — a policy, CI check, permission boundary, review requirement, or automated verification step defined by this specification. Unless otherwise qualified, "guardrail" in this document means an engineering guardrail.
- **Untrusted source** — any content not authored by the repository's maintainers and not gated by repository review. Examples: external pull requests and their bodies, issue comments, fetched URLs, external API responses, search results, content pasted into prompts, tool outputs from third-party services, and any data labelled adversarial in §21.
- **Sensitive sink** — any destination where a write produces a destructive, security-sensitive, or release-affecting effect (per the definitions above). Examples: protected branches, deployment pipelines, credential stores, mutation endpoints on production data, and external messaging or publishing endpoints.
- **Equivalent** — where this document allows "or equivalent" alternatives, the alternative `MUST` meet three conditions. It `MUST` be documented in the repository. It `MUST` be enforceable by automation or review. It `MUST` preserve the outcome the named option is designed to achieve — for example, equivalent compile-time correctness, equivalent trust-boundary enforcement, equivalent auditability, or equivalent supply-chain integrity. Reviewers `MUST` reject an alternative that produces a weaker outcome — for example, a replacement type checker that catches a strict subset of the original's errors, a secret-scanning pattern set that matches fewer organization-specific formats, a review process that can be bypassed without trace, or a supply-chain control that drops integrity-hash verification.

---

## Quick conformance checklist

For a per-clause audit checklist covering every `MUST`, `MUST when applicable`, `SHOULD`, and `MAY` item in this document, see [`AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md). Conformance level definitions are in the [Conformance levels](#conformance-levels) section at the end of this document.

---

## Specification clauses

### Pillar 1 — 🏗️ Engineering Foundation

## 1. Reproducible environment

### `MUST`

- The runtime version `MUST` be pinned. <sup>`AIC-runtime-version-pinned`</sup>
- The package manager version `MUST` be pinned when the ecosystem allows it. <sup>`AIC-package-manager-pinned`</sup>
- The dependency lockfile `MUST` be committed to version control. <sup>`AIC-lockfile-committed`</sup>
- CI `MUST` reject changes that would invalidate the committed lockfile (for example via `--frozen-lockfile`, `npm ci`, `pip --require-hashes`, or equivalent). <sup>`AIC-lockfile-enforced-in-ci`</sup>
- Dependency lockfiles `MUST` include integrity hashes where the ecosystem supports them, and CI `MUST` fail when integrity verification fails. <sup>`AIC-lockfile-integrity-hashes`</sup>
- Multi-package repositories `MUST` have a deterministic build order. <sup>`AIC-deterministic-build-order`</sup>
- A clean clone `MUST` reach a working development state using documented steps. <sup>`AIC-clean-clone-bootstrap`</sup>

### `SHOULD`

- Browser, runtime, and platform targets `SHOULD` be explicit. <sup>`AIC-platform-targets-explicit`</sup>
- Heavy builds `SHOULD` document memory, CPU, or platform prerequisites. <sup>`AIC-heavy-build-prerequisites`</sup>

### `MAY`

- The repository `MAY` provide containerized or sandboxed development environments for stronger consistency. <sup>`AIC-containerized-dev-env`</sup>

---

---

## 2. Static correctness

### `MUST`

- Strict typing or equivalent compile-time checks `MUST` be enabled. <sup>`AIC-strict-typing-enabled`</sup>
- Linting `MUST` include correctness rules, not only style rules. <sup>`AIC-lint-correctness-rules`</sup>
- Formatting `MUST` be automated and enforced. <sup>`AIC-formatting-automated`</sup>
- Unused variables, dead code, import cycles, and unsafe dependency patterns `MUST` be surfaced automatically. <sup>`AIC-dead-code-and-cycles-surfaced`</sup>

### `SHOULD`

- The repository `SHOULD` ban unsafe escape hatches such as untyped `any` unless explicitly justified. <sup>`AIC-ban-unsafe-escape-hatches`</sup>
- It `SHOULD` enforce naming and export conventions where consistency materially improves maintenance. <sup>`AIC-naming-export-conventions`</sup>
- Ad-hoc debug statements (for example `console.log`, `print`, `dump`, language-equivalent debug emitters) `SHOULD` be flagged or blocked by lint, leaving structured logging from §13 as the only sanctioned output path. Agents and humans alike scatter debug emitters during exploration and forget to remove them; without a lint-time backstop, the residue ships. <sup>`AIC-debug-statement-lint`</sup>

### `MAY`

- The repository `MAY` add repository-specific lint rules for domain conventions. <sup>`AIC-domain-lint-rules`</sup>

---

---

## 3. Architecture boundaries

### `MUST`

- The repository `MUST` define module, package, or layer responsibilities. <sup>`AIC-layer-responsibilities-defined`</sup>
- Allowed dependency directions `MUST` be explicit. <sup>`AIC-dependency-directions-explicit`</sup>
- Sensitive or shared layers `MUST` be protected from importing implementation-specific or infrastructure-specific code when architectural separation depends on that boundary. <sup>`AIC-shared-layer-import-protection`</sup>
- Architectural rules that can be machine-enforced `MUST` be automated. <sup>`AIC-architecture-rules-automated`</sup>

### `SHOULD`

- The repository `SHOULD` use boundary tests or scans in addition to linter rules. <sup>`AIC-boundary-tests`</sup>
- It `SHOULD` include a review checklist for coupling risks that tooling cannot catch. <sup>`AIC-coupling-review-checklist`</sup>

### `MAY`

- The repository `MAY` model architecture constraints in dedicated analysis tools if the codebase is large enough to justify it. <sup>`AIC-architecture-analysis-tools`</sup>

---

---

## 4. Pre-commit and CI gates

### `MUST`

- Pre-commit hooks `MUST` run meaningful local checks. <sup>`AIC-precommit-meaningful-checks`</sup>
- CI `MUST` run the authoritative guardrail suite for protected branches. <sup>`AIC-ci-guardrail-suite`</sup>
- CI `MUST` use the pinned toolchain and locked dependency state. <sup>`AIC-ci-pinned-toolchain`</sup>
- Protected branches `MUST` require passing status checks before merge. <sup>`AIC-protected-branch-status-checks`</sup>

### `SHOULD`

- The local and CI quality bars `SHOULD` stay closely aligned. <sup>`AIC-local-ci-aligned`</sup>
- Expensive jobs `SHOULD` be separated intentionally rather than omitted silently. <sup>`AIC-expensive-jobs-explicit`</sup>
- The repository `SHOULD` expose a fast-iteration command path — for example scoped tests, changed-file lint, or per-package verify scripts — so intermediate work can be validated cheaply without running the full guardrail suite on every iteration. The full suite remains the authoritative gate; the fast path is for the iteration loop. <sup>`AIC-fast-iteration-path`</sup>

### `MAY`

- The repository `MAY` use adaptive or staged CI when the distinction between fast and slow checks is explicit and documented. <sup>`AIC-adaptive-staged-ci`</sup>

---

---

### Pillar 2 — 🛡️ Security

## 5. Secrets and credentials

### `MUST`

- Secret-bearing files `MUST` be excluded from version control. <sup>`AIC-secret-vcs-exclude`</sup>
- Automated secret scanning `MUST` be enabled. <sup>`AIC-secret-scanning-enabled`</sup>
- Credential handling `MUST` be documented for contributors and automation. <sup>`AIC-credential-handling-documented`</sup>

### `MUST when applicable`

- When the repository requires contributor-supplied or runtime environment variables, example environment files `MUST` contain placeholders only. <sup>`AIC-env-example-placeholders`</sup>
- Push protection `MUST` be enabled when supported and feasible for the repository's hosting platform. <sup>`AIC-push-protection-enabled`</sup>

### `SHOULD`

- The repository `SHOULD` define custom detection patterns for organization-specific secret formats. <sup>`AIC-custom-secret-patterns`</sup>
- It `SHOULD` provide a safe mock mode or local fallback path that avoids requiring live secrets for common development flows. <sup>`AIC-mock-mode-fallback`</sup>
- The repository `SHOULD` document how contributors and automation obtain development credentials, how those credentials are rotated, and what triggers a rotation (suspected leak, contributor offboarding, scheduled cadence). This is particularly important for AI agents, which cannot complete interactive credential-issuance flows and otherwise accumulate static, long-lived tokens. <sup>`AIC-credential-rotation-documented`</sup>

### `MAY`

- The repository `MAY` integrate secret rotation or secret lease validation into operational workflows. <sup>`AIC-secret-rotation-automation`</sup>

---

---

## 6. Security scanning and dependency security

### `MUST when applicable`

- Security-focused static analysis `MUST` run in CI for supported languages and platforms. <sup>`AIC-sast-in-ci`</sup>
- Dependency vulnerability detection `MUST` be enabled. <sup>`AIC-dependency-vuln-detection`</sup>
- Dependency changes in pull requests `MUST` be visible to reviewers through automation or policy. <sup>`AIC-dependency-review-visibility`</sup>

### `SHOULD`

- The repository `SHOULD` automate safe dependency update PRs. <sup>`AIC-automated-dep-updates`</sup>
- It `SHOULD` track and assign ownership for unresolved vulnerability alerts. <sup>`AIC-vuln-alert-ownership`</sup>
- It `SHOULD` automate license review if distribution or compliance requirements apply. <sup>`AIC-license-review-automation`</sup>

### `MAY`

- The repository `MAY` apply stricter policies to new dependencies than to existing ones. <sup>`AIC-strict-new-dep-policy`</sup>
- Internet-facing applications `MAY` run dynamic application security testing (DAST) against a deployed environment to surface vulnerabilities that static analysis misses. <sup>`AIC-dast-internet-facing`</sup>
- High-risk systems `MAY` undergo periodic penetration testing by an independent reviewer. <sup>`AIC-penetration-testing-periodic`</sup>

---

---

## 7. Authorization and trusted boundaries

### `MUST`

- Authorization `MUST` be enforced in a trusted layer such as the backend, API, or data layer. <sup>`AIC-authz-trusted-layer`</sup>
- Data integrity constraints `MUST` exist where the persistence layer supports them. <sup>`AIC-data-integrity-constraints`</sup>
- Privileged credentials `MUST NOT` be present in untrusted client code. <sup>`AIC-no-privileged-creds-in-client`</sup>
- Repositories `MUST` have checks or tests that detect dangerous credential or role leakage into the wrong layers. <sup>`AIC-credential-leakage-checks`</sup>

### `SHOULD`

- Security-sensitive write paths `SHOULD` have explicit ownership, auditability, and narrow interfaces. <sup>`AIC-sensitive-write-paths-owned`</sup>

### `MAY`

- The repository `MAY` add defense-in-depth client-side controls for UX, as long as they are not misrepresented as authoritative controls. <sup>`AIC-defense-in-depth-client`</sup>

---

---

## 8. CI/CD workflow hardening

### `MUST when applicable`

- Workflow tokens `MUST` use least privilege. <sup>`AIC-workflow-token-least-privilege`</sup>
- Deployment credentials `MUST` be short-lived where the platform supports it. <sup>`AIC-short-lived-deploy-creds`</sup>
- Production deployment paths `MUST` be protected from arbitrary execution and unauthorized triggering. <sup>`AIC-prod-deploy-protected`</sup>

### `SHOULD`

- The repository `SHOULD` use OIDC or equivalent identity federation instead of long-lived cloud secrets. <sup>`AIC-oidc-federation`</sup>
- It `SHOULD` protect deployment environments with approval rules or environment policies. <sup>`AIC-deploy-env-approvals`</sup>
- It `SHOULD` review workflow file changes with extra scrutiny. <sup>`AIC-workflow-change-review`</sup>
- Third-party GitHub Actions `SHOULD` be referenced by a tagged version or release ref (for example `pnpm/action-setup@v6`) rather than a floating branch ref like `@main` or `@master`. A floating ref ships whatever is on that branch into CI on the next run; pinning to a release tag bounds what can change between deliberate bumps. Stronger SHA pinning is the `MAY` below, justified by threat model. <sup>`AIC-action-version-pinned`</sup>

### `MAY`

- The repository `MAY` use reusable workflows or central workflow templates to reduce drift. <sup>`AIC-reusable-workflows`</sup>
- Repositories `MAY` SHA-pin third-party GitHub Actions when the threat model justifies it — production-deploy workflows, high-stakes tokens, or compliance regimes that require bit-exact reproducibility — paired with an automated bumper such as Renovate or Dependabot that keeps the pins current. Tag-pinning with an active bumper is the readable default; SHA-pinning without a bumper is worse than tag-pinning because pins go stale and stop receiving security patches. <sup>`AIC-third-party-action-pinning`</sup>

---

---

## 9. Threat modeling and security design review

### `MUST when applicable`

- Internet-facing, multi-tenant, regulated, or high-impact systems `MUST` undergo threat modeling or security design review. <sup>`AIC-threat-model-required`</sup>
- Threat modeling `MUST` produce a durable artifact identifying assets, trust boundaries, entry points, and likely attacker paths. A verbal agreement does not satisfy this requirement. <sup>`AIC-threat-model-artifact`</sup>
- Repositories subject to this requirement `MUST` record when the threat model was last reviewed. <sup>`AIC-threat-model-review-date`</sup>

### `SHOULD`

- Threat models `SHOULD` be revisited when authentication, deployment, storage, or trust boundaries change. <sup>`AIC-threat-model-revisit`</sup>

### `MAY`

- Lower-risk repositories `MAY` satisfy this requirement with lightweight design review rather than heavyweight formal exercises. <sup>`AIC-threat-model-lightweight`</sup>

---

---

### Pillar 3 — 🎯 Quality & Reliability

## 10. Runtime validation and invariants

### `MUST`

- External inputs, configuration, and machine-readable product metadata `MUST` be validated before use. <sup>`AIC-input-validation`</sup>
- Critical invariants `MUST` be documented in one authoritative place. <sup>`AIC-invariants-documented`</sup>
- Critical invariants `MUST` be executable through tests, assertions, or validators wherever practical. <sup>`AIC-invariants-executable`</sup>

### `SHOULD`

- Validation layers `SHOULD` separate structural validity from semantic validity. <sup>`AIC-structural-vs-semantic-validation`</sup>
- The repository `SHOULD` fail fast on invalid inputs and emit actionable diagnostics. <sup>`AIC-fail-fast-diagnostics`</sup>

### `MAY`

- The repository `MAY` downgrade suspicious but non-fatal states to warnings if the product can continue safely. <sup>`AIC-non-fatal-warning-downgrade`</sup>

---

---

## 11. Testing strategy

### `MUST`

- Critical business behavior `MUST` be covered by automated tests. <sup>`AIC-critical-behavior-tested`</sup>
- The repository `MUST` use multiple test layers rather than relying on a single style of testing. <sup>`AIC-multiple-test-layers`</sup>

### `MUST when applicable`

- Coverage thresholds `MUST` exist if the team uses coverage as a guardrail, and those thresholds `MUST` be treated as a minimum rather than a target. <sup>`AIC-coverage-as-minimum`</sup>

### `SHOULD`

- Where coverage is used as a gate, the repository `SHOULD` assess test-suite strength through an independent mechanism such as mutation testing, property-based tests, or independent review. Coverage alone does not distinguish effective assertions from ones that pass trivially. <sup>`AIC-test-strength-independent`</sup>
- Tests `SHOULD` be located close to the code they protect. <sup>`AIC-tests-colocated`</sup>
- Test environments `SHOULD` be deterministic where possible. Tests at the integration and end-to-end layers `SHOULD NOT` reach live external networks or shared production-like services by default; they `SHOULD` run against in-process mocks, recorded fixtures, or sandboxed substitutes, with any deviation explicitly opted in. Network nondeterminism amplifies AI-generated flakiness and erodes the signal of every gate that depends on the suite. <sup>`AIC-test-network-isolation`</sup>
- End-to-end and acceptance tests `SHOULD` execute against the same artifact the repository ships (for example the production build output, a built container image, or the published package), not the development server alone. Bundling, tree-shaking, asset rewriting, and environment-variable inlining produce divergence between dev and prod that only appears when the built artifact is exercised. <sup>`AIC-e2e-built-artifact`</sup>
- Environment-specific or excluded test suites `SHOULD` be explicitly documented. <sup>`AIC-excluded-suites-documented`</sup>

### `MAY`

- The repository `MAY` use differential or risk-based test selection in CI if the full quality bar remains intact before release. <sup>`AIC-risk-based-test-selection`</sup>
- Parser-heavy or security-sensitive components `MAY` use fuzzing to surface input-domain failures that example-based tests routinely miss. <sup>`AIC-fuzzing-parsers`</sup>

---

---

## 12. Accessibility

### `MUST when applicable`

- Shared UI components `MUST` be checked for serious accessibility failures. <sup>`AIC-a11y-component-checks`</sup>
- Accessibility expectations for semantics, focus, and labeling `MUST` be part of normal review and testing. <sup>`AIC-a11y-review-testing`</sup>

### `SHOULD`

- The repository `SHOULD` provide shared accessibility test helpers. <sup>`AIC-a11y-helpers`</sup>
- Keyboard behavior and focus management `SHOULD` be covered where interaction complexity warrants it. <sup>`AIC-a11y-keyboard-focus`</sup>

### `MAY`

- The repository `MAY` enforce additional accessibility gates such as motion, contrast, or localization-specific checks. <sup>`AIC-a11y-extra-gates`</sup>

---

---

## 13. Failure handling and observability

### `MUST when applicable`

- Production code `MUST` handle failure explicitly, not only through happy-path logic. <sup>`AIC-failure-handling-explicit`</sup>
- Retries, backoff, and fallback behavior `MUST` be deliberate where transient failure is expected. <sup>`AIC-retries-backoff-deliberate`</sup>
- When the repository operates a service, app, worker, proxy, or production runtime that emits logs, telemetry, traces, or error reports, observability outputs `MUST` redact secrets, credentials, and personally identifiable information, and `MUST` avoid leaking unnecessary personal data. §22 extends this requirement to AI-specific surfaces such as prompts, agent transcripts, and tool outputs. <sup>`AIC-observability-redaction`</sup>

### `SHOULD`

- The repository `SHOULD` define structured error handling patterns. <sup>`AIC-structured-error-patterns`</sup>
- It `SHOULD` provide clear ownership for alerts, logs, and operational visibility. <sup>`AIC-alert-ownership`</sup>
- It `SHOULD` preserve user work locally or durably when silent data loss would be unacceptable. <sup>`AIC-preserve-user-work`</sup>

### `MAY`

- The repository `MAY` include richer diagnostic breadcrumbs, tracing, or client event telemetry where privacy and value justify it. <sup>`AIC-rich-diagnostics`</sup>

---

---

## 14. Performance and reliability

### `MUST when applicable`

- User-facing systems `MUST` define performance budgets if speed materially affects user experience. <sup>`AIC-performance-budgets`</sup>
- Services and critical applications `MUST` define reliability expectations if downtime or latency materially affects users. <sup>`AIC-reliability-expectations`</sup>

### `SHOULD`

- Performance budgets `SHOULD` be measurable in automation. <sup>`AIC-budgets-automated`</sup>
- Reliability targets `SHOULD` have clear consequences or escalation paths when missed. <sup>`AIC-reliability-consequences`</sup>

### `MAY`

- Teams `MAY` use SLOs, SLIs, error budgets, or equivalent models according to operational maturity. <sup>`AIC-slo-sli-error-budgets`</sup>

---

---

### Pillar 4 — 🚀 Release

## 15. Supply-chain transparency and artifact integrity

### `MUST when applicable`

- Repositories that publish artifacts `MUST` be able to identify what dependencies went into a release. <sup>`AIC-release-dependency-identification`</sup>
- Repositories that publish artifacts to external consumers `MUST` generate an SBOM if the ecosystem and tooling support it reasonably. <sup>`AIC-sbom-generation`</sup>

### `SHOULD`

- Published artifacts `SHOULD` be built from CI rather than developer workstations. <sup>`AIC-release-from-ci`</sup>
- Repositories `SHOULD` provide provenance or attestations when downstream consumers need build trust. <sup>`AIC-build-provenance-attestation`</sup>
- Source, build instructions, and outputs `SHOULD` be linked through immutable references where practical. <sup>`AIC-build-immutable-refs`</sup>

### `MAY`

- Repositories `MAY` sign artifacts, verify attestations downstream, or adopt stronger supply-chain frameworks when their distribution model warrants it. <sup>`AIC-artifact-signing`</sup>
- Repositories `MAY` enforce admission control or attestation verification in downstream deployment environments so unsigned or unprovenanced artifacts cannot run. <sup>`AIC-policy-enforcement-admission-control`</sup>

---

---

## 16. Branch protection, ownership, and release governance

### `MUST`

- The default branch `MUST` be protected. <sup>`AIC-default-branch-protected`</sup>
- Required checks and required reviews `MUST` be enabled for protected branches. <sup>`AIC-required-checks-and-reviews`</sup>
- Required-review approvals on protected branches `MUST` come from human reviewers; bot or agent accounts `MUST NOT` satisfy required-review counts and `MUST NOT` merge their own pull requests. <sup>`AIC-human-review-required`</sup>
- Risky or sensitive changes `MUST` have clear ownership. <sup>`AIC-risky-change-ownership`</sup>

For solo-maintainer repositories, the sole human maintainer may satisfy the human-review requirement for an agent-authored pull request only when the platform records a distinct human approval and the bot or agent account neither approves nor merges the pull request. If the same human account both authors or pushes the material change and supplies the only approval, that approval is not independent review for this requirement.

### `MUST when applicable`

- Public or externally consumed repositories `MUST` provide a vulnerability disclosure path such as `SECURITY.md`. <sup>`AIC-vuln-disclosure-path`</sup>
- Repositories `MUST` identify sensitive paths — for example, authentication and authorization code, CI/CD workflow files, deployment configuration, dependency manifests, and policy documents — and define path-level ownership for them when platform support exists. <sup>`AIC-sensitive-path-ownership`</sup>

### `SHOULD`

- Path-level ownership `SHOULD` cover auth, infrastructure, workflow, deployment, and policy files (for example, a `CODEOWNERS` file on platforms that support it). <sup>`AIC-codeowners-coverage`</sup>
- The ownership manifest itself `SHOULD` have an owner. <sup>`AIC-codeowners-self-owned`</sup>
- Preview and production deployments `SHOULD` be separated. <sup>`AIC-deployment-separation`</sup>

### `MAY`

- The repository `MAY` add merge queues, release trains, or additional policy layers for high-throughput teams. <sup>`AIC-merge-queue-policy-layers`</sup>

---

---

### Pillar 5 — 🤖 AI Agents

## 17. AI operating model

### `MUST`

- The repository `MUST` provide one authoritative, versioned instruction source for AI agents. <sup>`AIC-ai-instruction-authoritative`</sup>
- That instruction source `MUST` describe how to build, test, lint, run, review, contribute, and determine when a change is ready to merge. <sup>`AIC-ai-instruction-coverage`</sup>
- It `MUST` define architectural boundaries, coding conventions, non-negotiable invariants, and approval requirements. <sup>`AIC-ai-instruction-boundaries`</sup>
- It `MUST` identify actions the AI is not allowed to perform automatically. <sup>`AIC-ai-forbidden-actions`</sup>
- The path of the authoritative source `MUST` be documented in `CONTRIBUTING.md` or `README.md` so contributors and AI tools can resolve it without guessing. Any tool-specific instruction files that exist alongside it `MUST` contain only a pointer to the authoritative source — they `MUST NOT` re-declare or contradict its content. <sup>`AIC-tool-specific-pointer-only`</sup>

### `SHOULD`

- The repository `SHOULD` standardize common AI workflows such as implementation, review, PR preparation, release preparation, and incident fix handling. <sup>`AIC-ai-workflow-standardization`</sup>
- It `SHOULD` keep AI-facing instructions concise, current, and linked from contributor documentation. As a working ceiling, the authoritative instruction source `SHOULD` stay under roughly 300 lines: longer files stop being read end-to-end by either humans or model context windows, and the seven coverage areas in `AIC-ai-instruction-coverage` collapse into prose rather than scannable rules. Push detail into linked policy docs rather than growing the instruction file. <sup>`AIC-ai-instructions-discoverable`</sup>

### `MAY`

- The repository `MAY` provide specialized task templates or commands for recurring workflows. <sup>`AIC-ai-task-templates`</sup>
- Multi-package repositories `MAY` add path-scoped instruction files in subdirectories so rules that apply to only one package live next to the code they govern. Path-scoped files `MUST` extend the root authoritative source, `MUST NOT` contradict it, and `MUST NOT` re-declare approval boundaries or forbidden actions — the root file remains authoritative for those. <sup>`AIC-scoped-ai-instructions`</sup>

### Examples (non-normative)

The spec is vendor-neutral and does not endorse a specific filename. Common conventions adopters can follow include:

- `AGENTS.md` at the repository root — a cross-vendor open convention that several editors and agents auto-load. The `AI-CONTRIBUTOR-GUIDE.md` worked example uses this name.
- `CLAUDE.md` — auto-loaded by Claude Code; if AGENTS.md is the authoritative source, `CLAUDE.md` should be one line: `See AGENTS.md.`
- `.github/copilot-instructions.md` — read by GitHub Copilot; same one-line-pointer pattern.
- `.cursorrules` and other tool dotfiles — same pattern.
- For multi-package repositories, path-scoped files such as `apps/<name>/AGENTS.md` or `packages/<name>/AGENTS.md` extend the root authoritative source per `AIC-scoped-ai-instructions`.

These names are illustrative. Any single authoritative path is conformant so long as `AIC-ai-instruction-authoritative` and `AIC-tool-specific-pointer-only` hold.

---

---

## 18. Skills and shared workflow modules

A **shared skill** is a reusable AI workflow module versioned in the repository and available to any contributor. A **personal helper** is an AI workflow module that exists only in a contributor's local configuration and is not versioned in the repository.

### `MUST when applicable`

- Repositories that use shared skills, slash commands, or reusable AI workflow modules `MUST` version them in the repository. <sup>`AIC-shared-skills-versioned`</sup>
- Shared skills `MUST` define their purpose, expected inputs, expected outputs, and meaningful side effects. <sup>`AIC-skill-contract-defined`</sup>
- Shared skills `MUST` be reviewed like code when they can change files, invoke tools, affect releases, or alter external systems. <sup>`AIC-skill-code-review`</sup>
- Shared skills `MUST NOT` contain secrets, tokens, or environment-specific credentials. <sup>`AIC-skill-no-secrets`</sup>

### `SHOULD`

- Repositories `SHOULD` separate project-shared skills from personal-only helpers. <sup>`AIC-skill-shared-vs-personal`</sup>
- Shared skills `SHOULD` include usage examples for high-risk or non-obvious workflows. <sup>`AIC-skill-usage-examples`</sup>

### `MAY`

- Repositories `MAY` group skills by domain such as implementation, review, release, migration, or incident response. <sup>`AIC-skill-domain-grouping`</sup>
- Shared skills `MAY` include lightweight sample inputs or fixtures to make behavior easier to validate. <sup>`AIC-skill-sample-fixtures`</sup>

### Cross-references

Skills are subject to the human-approval baseline defined in §23 (`AIC-no-silent-destructive-actions`). A skill that performs a destructive, security-sensitive, or release-affecting action carries the same approval requirements as a direct human or agent invocation. This is a non-normative reminder; the canonical clause and the score-able row both live at §23 / `Human Approval`.

---

---

## 19. MCP servers and external tool governance

### `MUST when applicable`

- Repositories that use MCP servers `MUST` explicitly approve which servers are allowed for team workflows. <sup>`AIC-mcp-allowlist`</sup>
- Every approved MCP server `MUST` have a defined owner and purpose. <sup>`AIC-mcp-owner-purpose`</sup>
- MCP tools and servers `MUST` use least privilege. <sup>`AIC-mcp-least-privilege`</sup>
- Write-capable MCP servers `MUST` be distinguishable from read-only ones. <sup>`AIC-mcp-write-vs-read-distinguishable`</sup>
- Filesystem roots and other exposed resources `MUST` be scoped deliberately to approved workspaces or data sources. <sup>`AIC-mcp-root-scoping`</sup>
- OAuth- or token-based MCP integrations `MUST` use secure token handling and redirect validation appropriate to the platform. <sup>`AIC-mcp-auth-security`</sup>

### `SHOULD`

- Teams `SHOULD` prefer read-only MCP access by default. <sup>`AIC-mcp-read-only-default`</sup>
- MCP servers `SHOULD` be pinned to known versions or controlled deployment channels where possible. <sup>`AIC-mcp-pinned-versions`</sup>
- Dev, staging, and production MCP connectors `SHOULD` be separated when they touch operational systems. <sup>`AIC-mcp-env-separation`</sup>
- Users `SHOULD` be prompted before exposing roots or other sensitive resources to MCP servers. <sup>`AIC-mcp-root-prompt`</sup>
- Teams `SHOULD` be able to identify which external systems an AI agent can read or mutate through MCP. <sup>`AIC-mcp-auditability`</sup>
- MCP prompts exposed as slash commands `SHOULD` be reviewed before being relied on operationally. <sup>`AIC-mcp-prompt-review`</sup>

### `MAY`

- Teams `MAY` use the official MCP Registry for discovery, but they remain responsible for server vetting. <sup>`AIC-mcp-registry-discovery`</sup>
- Teams `MAY` apply additional sandboxing, network isolation, or execution controls to third-party MCP servers. <sup>`AIC-mcp-extra-sandboxing`</sup>

---

---

## 20. Agents and delegation governance

An **autonomous agent** is an agent that can plan and execute actions without per-step human confirmation. A **delegated agent** is an agent invoked for a bounded task with a defined result and scope.

### `MUST when applicable`

- Repositories that use autonomous or delegated agents `MUST` define agent roles, scope boundaries, ownership, and success conditions. <sup>`AIC-agent-scope-defined`</sup>
- Agents `MUST` have explicit tool, write, and approval limits. <sup>`AIC-agent-permission-limits`</sup>
- Parallel agents `MUST NOT` edit overlapping files unless the workflow explicitly defines coordination for that case. <sup>`AIC-agent-parallel-isolation`</sup>
- Every material agent action `MUST` produce a record with, at minimum: agent identity, model identifier and model-version ID, prompt or skill version, ISO 8601 timestamp with seconds, and action category (read / write / merge / deploy / settings-change / external-call). The record location `MUST` be the same one documented for `AIC-prompt-audit-trail`. The record `MUST` be queryable: an auditor `MUST` be able to list material actions by agent, action category, or time range with one command or API query. Prose-only attribution ("our agents log to Linear") does not satisfy this rule. <sup>`AIC-agent-action-traceability`</sup>
- Agent-produced changes `MUST` pass the same quality gates as any other code contribution. <sup>`AIC-agent-quality-gates`</sup>
- Repositories that operate an autonomous runner (any agent that can merge, deploy, release, rotate settings, or otherwise act without per-change human approval) `MUST` provide a kill switch: a single documented action that immediately halts the runner, by both disabling its execution path (workflow, scheduled job, agent harness) and revoking or expiring the runner's credentials so a residual process cannot continue acting. The kill switch `MUST` be exercisable without a code change to the repository. This complements `AIC-agent-cost-ceiling`, which addresses cost runaway; this clause addresses content runaway. <sup>`AIC-agent-kill-switch`</sup>
- Repositories that operate an autonomous runner `MUST` document a rollback procedure for content the runner has already merged, deployed, or released. The procedure `MUST` rely on the authorship-traceability mechanism from `AIC-ai-authorship-traceability` so that runner-authored commits, releases, or settings changes are mechanically identifiable for revert without manual archaeology. Incident response (§29) may invoke this procedure. <sup>`AIC-agent-rollback-procedure`</sup>
- Repositories that operate an autonomous runner `MUST` define and enforce escalation triggers before the runner performs destructive, security-sensitive, release-affecting, high-volume, or repeatedly failing actions. The triggers `MUST` include per-window action limits, a named escalation owner, and a response expectation or SLA for paused work. <sup>`AIC-agent-escalation-trigger-enforcement`</sup>

### `SHOULD`

- Teams `SHOULD` define standard agent roles such as implementer, reviewer, researcher, or release helper. <sup>`AIC-agent-standard-roles`</sup>
- Delegation `SHOULD` be limited to bounded, well-scoped tasks. <sup>`AIC-agent-bounded-delegation`</sup>
- Agent outputs `SHOULD` be structured enough for safe handoff between agents and humans. <sup>`AIC-agent-structured-outputs`</sup>
- Agents `SHOULD` rely on repository-versioned instructions rather than hidden session state. <sup>`AIC-agent-versioned-instructions`</sup>
- Teams `SHOULD` define escalation paths for uncertainty around security, production systems, data handling, or architecture changes. <sup>`AIC-agent-escalation-paths`</sup>

### `MAY`

- Teams `MAY` benchmark agent roles on representative tasks. <sup>`AIC-agent-benchmarking`</sup>
- Teams `MAY` apply stronger sandboxing to higher-risk agents. <sup>`AIC-agent-extra-sandboxing`</sup>
- Teams `MAY` define trust tiers such as read-only, code-write, or release-capable agents. <sup>`AIC-agent-trust-tiers`</sup>

### Cross-references

Agent invocations are subject to the human-approval baseline defined in §23 (`AIC-no-silent-destructive-actions`). An agent that performs a destructive, security-sensitive, or release-affecting action that policy reserves for humans is governed by that clause. This is a non-normative reminder; the canonical clause and the score-able row both live at §23 / `Human Approval`.

---

---

### Pillar 6 — ⚠️ AI Risk

## 21. AI-specific risks

Three terms used in this section:

- A **pattern-filter guardrail** is a rule-based input or output filter using exact match, regex, blocklists, or similar deterministic matching. Fast and deterministic, but brittle against paraphrase, obfuscation, translation, and non-English content.
- An **LLM-filter guardrail** is a model-based classifier placed before or after an LLM that tries to flag or block malicious prompts or outputs. Non-deterministic, and unreliable against attackers who adapt to the filter.
- **Capability scoping** means restricting an agent's tools, read scopes, and write scopes at the permission layer before the agent runs. The scope is derived from the user's requested task, not from the model's self-policing.

### `MUST when applicable`

- Repositories that author system prompts, agent instructions, or shared skills `MUST` version them in the repository and review them like code when they materially affect agent behavior. <sup>`AIC-prompt-versioning-review`</sup>
- Repositories that route work to external AI providers or models `MUST` maintain an explicit allowlist. Each entry `MUST` record its approval scope — permitted data classifications (consistent with §22) and action categories (read-only research, code authoring, release-affecting automation). Agent workflows `MUST NOT` route outside the allowlist. <sup>`AIC-ai-provider-allowlist`</sup>
- Repositories whose AI workflows can introduce dependencies `MUST` define how those dependency additions are verified before use, including whether the package exists in the canonical registry and who owns it. <sup>`AIC-ai-dependency-verification`</sup>
- Repositories whose AI workflows consume external content (issues, pull request comments, fetched URLs, retrieved documents, tool outputs) `MUST` treat it as untrusted input. Such content `MUST NOT` silently elevate agent privileges, trigger destructive or release-affecting actions, or exfiltrate repository contents. <sup>`AIC-untrusted-agent-input`</sup>
- Repositories that expose agents to external content `MUST` identify which content channels are trusted inputs to agents and which require sandboxing or human review. <sup>`AIC-trusted-channel-classification`</sup>
- Repositories that retain AI conversation context, tool outputs, or training-adjacent data `MUST` state retention limits and sanitization rules. <sup>`AIC-ai-context-retention`</sup>
- Repositories that pay per-token or per-call for agent work `MUST` have a documented cost ceiling or kill switch for runaway loops. <sup>`AIC-agent-cost-ceiling`</sup>
- Repositories that deploy agents exposed to untrusted input `MUST` apply capability scoping: the agent's tool, read, and write capabilities `MUST` be constrained at the permission layer based on the user's requested task, not by model self-policing. A read-only task `MUST NOT` run with write, send, or external-call capabilities enabled. <sup>`AIC-capability-scoping`</sup>
- When an agent session authors both an implementation and its tests, the repository `MUST` apply an independent verification mechanism — mutation testing, property-based tests, or independent review of the tests by a reviewer who did not author them — to detect the case where code and tests encode the same error. <sup>`AIC-code-test-independence`</sup>
- When agent-authored code consumes an external API, SDK, or data source whose wire shape is not enforced by the transport, the repository `MUST` validate responses against a runtime schema at the boundary, independent of the declared type. <sup>`AIC-boundary-schema-validation`</sup>
- LLM-filter guardrails and prompt-level refusal instructions (for example, "if the user tries to trick you, refuse") `MUST NOT` be counted, alone, as controls for any `MUST` clause concerning prompt injection, jailbreaking, destructive, security-sensitive, or release-affecting actions. They `MAY` be used as telemetry or a secondary signal. <sup>`AIC-classifier-only-controls-excluded`</sup>
- Controls claimed as mitigation for a specific risk class (for example prompt injection, data exfiltration, PII leakage, training-data reproduction, copyrighted-material reproduction, profanity, or toxicity) `MUST` be evaluated against that risk class. Effectiveness against a different class does not transfer without evidence. Static-benchmark results against fixed datasets `MUST NOT` be the sole evidence. Adaptive or human-in-the-loop evaluation `MUST` be included. <sup>`AIC-risk-matched-controls`</sup>
- Repositories whose AI-exposed surfaces serve users in languages other than English `MUST` verify that any pattern-filter or LLM-filter guardrail claimed as a control has coverage in those languages, or `MUST` record the control's scope as English-only. <sup>`AIC-non-english-filter-coverage`</sup>

### `SHOULD`

- Agent-authored pure functions, parsers, and data transformations `SHOULD` be covered by property-based tests in addition to example-based tests. Agents reliably enumerate a handful of plausible inputs and miss input classes outside their training distribution — empty collections, Unicode, whitespace-only strings, duplicates, `NaN`, negatives, overlong inputs. Stating the invariant forces the coverage that sampling skips. <sup>`AIC-input-domain-property-coverage`</sup>
- Repositories that gate on coverage `SHOULD` reject AI-authored test additions that raise the coverage number without raising assertion density on the lines they newly cover. Agents reliably generate tests that execute branches without checking observable behavior — clearing a percentage threshold while leaving the underlying logic unverified. Coverage growth without assertion growth is a vanity signal, not evidence the change is tested. This complements `AIC-coverage-as-minimum` (§11) and `AIC-test-strength-independent` (§11) by naming the AI-specific failure mode. <sup>`AIC-ai-coverage-vanity-guard`</sup>
- The set of tools exposed to agents `SHOULD` be pinned and changes `SHOULD` be reviewed. <sup>`AIC-agent-tool-pinning`</sup>
- Repositories `SHOULD` surface unusual agent behavior such as broad file rewrites, sudden permission changes, or repeated retries on the same failing step. <sup>`AIC-agent-behavior-monitoring`</sup>
- Agent workflows `SHOULD` derive the minimum required capability set from the user's requested task before the agent runs. Tasks that would combine read-from-untrusted-source and write-to-sensitive-sink capabilities in a single agent context `SHOULD` be rejected without an explicit approval step. <sup>`AIC-minimum-capability-set`</sup>

### `MAY`

- Repositories `MAY` run agents in isolated workspaces, containers, or sandboxes when the blast radius of a mistake would be large. <sup>`AIC-agent-isolated-workspaces`</sup>
- Repositories `MAY` adopt model-output attestation or signing as agent-provenance tooling matures. <sup>`AIC-model-output-attestation`</sup>

---

---

## 22. Data protection and privacy

### `MUST`

- Repositories `MUST` classify the data that flows through AI agents and tools: source code, secrets, customer data, regulated data, telemetry. <sup>`AIC-ai-data-classification`</sup>
- Secrets, credentials, and personally identifiable information `MUST` be redacted from AI-specific surfaces (prompts, agent transcripts, tool outputs, and AI-related error reports), extending the observability requirements of §13 to AI workflows. <sup>`AIC-ai-surface-redaction`</sup>

### `MUST when applicable`

- Repositories whose AI workflows can expose regulated or secret data to provider context windows `MUST` prevent that data from entering any provider that is not explicitly approved for that data class. <sup>`AIC-regulated-data-provider-gate`</sup>
- Repositories handling regulated data (health, finance, government, minors, and similar) `MUST` document the legal basis and controls for sending any such data to AI providers or external tools. <sup>`AIC-regulated-data-controls`</sup>
- Repositories with data-residency requirements `MUST` verify that AI providers, MCP servers, and external tools respect those requirements. <sup>`AIC-data-residency-verified`</sup>

### `SHOULD`

- Repositories `SHOULD` provide a safe, scrubbed fixture set for AI workflows that would otherwise require real data. <sup>`AIC-ai-fixtures`</sup>
- Access to production data through AI workflows `SHOULD` be read-only unless a write path is explicitly designed and approved. <sup>`AIC-ai-prod-data-readonly`</sup>

### `MAY`

- Repositories `MAY` adopt data minimization, synthetic-data generation, or differential-privacy techniques for AI workflows that require representative data. <sup>`AIC-data-minimization-techniques`</sup>

---

---

### Pillar 7 — 🧭 Oversight

## 23. Human approval and manual checkpoints

### `MUST`

- The repository `MUST` define which actions require explicit human confirmation. The baseline list `MUST` include every action that meets the Definitions of _destructive_, _security-sensitive_, or _release-affecting_; repositories may add more, but may not silently narrow these categories. <sup>`AIC-human-approval-baseline`</sup>
- AI agents `MUST NOT` be allowed to silently perform destructive, security-sensitive, or release-affecting actions that the repository policy reserves for humans. <sup>`AIC-no-silent-destructive-actions`</sup>

**Solo-maintainer note (non-normative).** Solo repositories have one human. Two patterns work:

1. **Checks only (usually the honest choice for true solo repos).** Required reviewers = 0. Strong CI, signed commits, linear history. The owner's manual merge counts as approval. Score `Human Review Required` as `Warning` and write one line explaining why.
2. **Bot identity.** AI commits as a separate bot account (GitHub App or machine user). The human owner approves and merges. Required reviewers = 1. This pattern only pays off when AI runs in CI, or when a second human is involved. For local AI work on one machine, keeping a clean human/bot boundary in `git config` adds daily friction without reducing real risk.

The same person cannot push an AI change and approve it. That rule is in §16 (`AIC-human-review-required`). Pick one pattern. Write it down in your AI policy.

### `MUST when applicable`

- Repositories that accept contributions from outside the documented contributor group `MUST` publish a disclosure policy for materially AI-authored pull requests and `MUST` enforce it during intake review. The policy `MUST` define what "materially AI-authored" means for the repository, how authorship is declared in the pull request, and how missing or incorrect declarations are handled. <sup>`AIC-ai-authorship-disclosure-policy`</sup>

### `SHOULD`

- Human approval `SHOULD` be required before commit or push in workflows where AI can generate large or cross-cutting changes. <sup>`AIC-human-approval-large-changes`</sup>
- The repository `SHOULD` escalate approval requirements for migrations, deployment changes, auth changes, or repository-wide rewrites. <sup>`AIC-escalated-approval-categories`</sup>
- The disclosure policy for materially AI-authored pull requests `SHOULD` specify the verification evidence expected — reproducible test output, screenshots of behavior, API traces, or equivalent — so reviewers can verify the change rather than re-generate it. <sup>`AIC-disclosure-evidence`</sup>

### `MAY`

- Teams `MAY` add stronger sign-off requirements for regulated or high-impact systems. <sup>`AIC-stronger-signoff-regulated`</sup>

---

---

## 24. Guardrail documentation and evidence

### `MUST`

- The repository `MUST` document guardrails in one authoritative place. <sup>`AIC-authoritative-guardrail-doc`</sup>
- That document `MUST` clearly state what is enforced automatically and what depends on review or process. <sup>`AIC-machine-vs-manual-guardrails`</sup>
- It `MUST` identify where each guardrail is defined and how failure is surfaced. <sup>`AIC-guardrail-failure-surface`</sup>
- A threshold, budget, or limit declared in configuration `MUST NOT` be counted as an automatic guardrail unless an automated check evaluates it on every change path that claims it. <sup>`AIC-threshold-enforcement`</sup>
- An automated check `MUST NOT` be counted as enforcing a requirement from this document unless its failure blocks merge on the change path it evaluates. Jobs configured to continue on evaluation failure, or to otherwise mask non-zero results from the protected-branch status, `MUST` be labelled as advisory in the guardrail documentation. <sup>`AIC-gate-enforcement`</sup>

### `SHOULD`

- The repository `SHOULD` maintain lightweight evidence that important guardrails are actually active, such as CI configuration, security settings, or documented repository policy. <sup>`AIC-guardrail-active-evidence`</sup>

### `MAY`

- Teams `MAY` map this document to maturity models or external standards if organizational compliance requires it. <sup>`AIC-guardrail-doc-maturity-mapping`</sup>

---

## 25. Policy governance

### `MUST`

- The adopted specification itself `MUST` have a named owner and a documented review cadence. <sup>`AIC-policy-owner-cadence`</sup>
- Changes to the adopted specification `MUST` go through the same review process as code, including required reviewers. <sup>`AIC-policy-change-review`</sup>
- When a new AI-era risk becomes credible, the repository `MUST` decide whether to add or revise guardrails rather than treating the specification as frozen. <sup>`AIC-policy-living-document`</sup>

### `SHOULD`

- The repository `SHOULD` record the effective date and last review date of the adopted specification. <sup>`AIC-policy-effective-dates`</sup>
- The repository `SHOULD` link each checklist item to the specific automation, configuration, or review step that enforces it, so conformance is auditable in practice. <sup>`AIC-policy-evidence-links`</sup>

### `MAY`

- Teams `MAY` map this document to external standards or maturity frameworks when organizational compliance requires cross-referencing. <sup>`AIC-policy-external-mapping`</sup>

---

---

## 26. AI-generated content: licensing and attribution

This clause covers the legal and attribution status of AI-produced content committed to the repository. It does not replace §23 (human approval) or §21 (AI-specific risks). It makes the repository's position on AI output explicit.

### `MUST`

- The repository `MUST` declare its position on license and ownership for AI-generated content in a durable document (for example `CONTRIBUTING.md`, `LICENSING.md`, or the authoritative AI instruction file from §17). The declaration `MUST` say whether AI-generated code, documentation, and tests are accepted, and under what license they are contributed. <sup>`AIC-ai-output-licensing-declaration`</sup>
- Where the hosting platform or CI allows it, the repository `MUST` provide a way to identify materially AI-authored commits or pull requests after the fact — for example a commit trailer, PR label, or metadata field. The mechanism `MUST` be documented in the same place as the licensing declaration. <sup>`AIC-ai-authorship-traceability`</sup>

### `MUST when applicable`

- Repositories where AI materially authors code that ships `MUST` record, for every material AI-generated change: the model identifier, the prompt or system-prompt version, and any skill version used. The record location (commit trailer, PR body field, release manifest, audit-log row, or equivalent) `MUST` be documented with the `AIC-ai-authorship-traceability` mechanism. The record `MUST` be queryable: an auditor `MUST` be able to list AI-authored changes by model, prompt version, or skill version with one command or API query. This makes `AIC-ai-authorship-traceability` concrete for L3+ and supports `AIC-agent-rollback-procedure`. <sup>`AIC-prompt-audit-trail`</sup>

**Implementation note (Git/GitHub):** A compact, queryable pattern is to require each pull request to carry `AI-Authored: no` or `AI-Authored: yes (agent, model)`, and to preserve the same metadata as a Git commit trailer in the commits that land on the protected branch. When `AI-Authored` is `yes`, pair it with a `Prompt-Audit: <references>` field or trailer that names the prompt/system-prompt source, skill version when applicable, and transcript-retention location. When `AI-Authored` is `no`, use `Prompt-Audit: none`. `Co-Authored-By` trailers may still be useful for GitHub visibility, but they are visibility metadata; they do not replace the documented authorship-traceability and prompt-audit mechanism.

### `SHOULD`

- The repository `SHOULD` record the model identifier on material AI-generated changes so provenance can be reconstructed if a downstream licensing question arises. Below L3 this remains a SHOULD; at L3+ it is covered by `AIC-prompt-audit-trail`. <sup>`AIC-ai-model-provenance`</sup>
- The repository `SHOULD` align its AI-authorship disclosure policy (§23) with the licensing declaration in this section so contributors see a single, consistent story for both attribution and legal status. <sup>`AIC-licensing-disclosure-alignment`</sup>

### `MAY`

- The repository `MAY` require contributors to retain prompts, tool outputs, or other inputs that produced material AI-generated changes for a defined period, where audit or regulatory needs justify it. <sup>`AIC-ai-input-retention`</sup>

---

---

## 27. AI credential lifecycle

This clause extends §5 (Secrets and credentials) and §23 (Human approval) for the case where an AI agent participates in creating, distributing, rotating, or revoking credentials. The §5 controls govern the credential's existence; this clause governs the agent's role in changing that state.

### `MUST when applicable`

- Repositories whose agents can create, rotate, or revoke credentials `MUST` enumerate which credential classes the agent is allowed to operate on. Agent operations on classes outside that enumeration `MUST NOT` be permitted. <sup>`AIC-agent-credential-class-scope`</sup>
- Agent-initiated credential creation, rotation, and revocation `MUST` produce a durable audit record naming the agent, the human approver (per §23), the credential class, and the scope of the change. <sup>`AIC-agent-credential-audit`</sup>
- An agent `MUST NOT` be the sole approver of a credential rotation or revocation that affects production systems or any sensitive sink. Approval `MUST` come from a human reviewer per §23. <sup>`AIC-agent-credential-not-sole-approver`</sup>

### `SHOULD`

- Credentials issued or rotated by an agent `SHOULD` be short-lived where the platform supports it, consistent with §8's deployment-credential rule. <sup>`AIC-agent-credential-short-lived`</sup>
- Repositories `SHOULD` rotate any credential the agent demonstrably read from a transcript, tool output, or context window before continuing operations. The §22 redaction rules limit exposure; this rule treats observed exposure as a rotation trigger. <sup>`AIC-agent-observed-credential-rotation`</sup>

### `MAY`

- Repositories `MAY` constrain agent credential operations to a separate role or harness identity distinct from the human-operator identity, so agent operations are distinguishable in audit logs. <sup>`AIC-agent-credential-distinct-identity`</sup>

---

---

## 28. AI model and provider deprecation

This clause covers continuity when an entry in the §21 (AI-specific risks) provider and model allowlist is deprecated, sunset, repriced, retermed, or transferred to a new owner. Vendor changes are external — the repository's response is the policy that this clause defines.

### `MUST when applicable`

- The repository `MUST` define a procedure for evaluating an allowlist entry when the vendor announces deprecation, sunset, ownership change, or material terms-of-service change. The procedure `MUST` state who decides, on what evidence, and within what window. <sup>`AIC-provider-deprecation-procedure`</sup>
- Agent workflows `MUST NOT` continue routing to a deprecated or sunset entry past its end-of-life date without explicit re-approval recorded against the §21 allowlist. <sup>`AIC-no-routing-past-eol`</sup>
- When a vendor changes the data classifications or action categories an entry was approved for under §21 and §22, the entry's approval scope `MUST` be re-evaluated before agent workflows continue using it. <sup>`AIC-allowlist-rescope-on-terms-change`</sup>

### `SHOULD`

- The repository `SHOULD` track the published end-of-life or deprecation status of allowlisted models and providers in the same place as the allowlist itself, so the dependency on third-party lifecycles is visible. <sup>`AIC-provider-eol-tracked`</sup>
- The repository `SHOULD` plan a fallback path — an alternative allowlisted entry, a documented degradation mode, or an explicit pause of the affected workflow — before relying on a model or provider whose continuity is uncertain. <sup>`AIC-provider-fallback-path`</sup>

### `MAY`

- Repositories `MAY` subscribe to vendor deprecation channels and surface notices in repository tooling rather than relying on out-of-band communication. <sup>`AIC-provider-deprecation-feed`</sup>

---

---

## 29. AI incident response and guardrail-update loop

This clause covers the feedback loop from an AI-attributable incident — an action by an agent, skill, or autonomous runner that caused harm or required intervention — back into the repository's guardrail documentation (§24) and policy (§25). It complements general failure handling (§13) with the AI-specific obligation to update what is enforced when an agent works around or breaks an existing control. The immediate containment and rollback tools — kill switch and rollback procedure — are defined once in §20 (`AIC-agent-kill-switch`, `AIC-agent-rollback-procedure`); incident response invokes them rather than redefining them here.

### `MUST when applicable`

- Repositories that operate AI agents in production paths `MUST` define what counts as an AI-attributable incident, who triages it, and what evidence is preserved. <sup>`AIC-ai-incident-definition`</sup>
- After an AI-attributable incident, the repository `MUST` run a review that identifies the agent action that caused the harm, the control that should have prevented it, and whether that control existed, was bypassed, or was missing. <sup>`AIC-ai-incident-review`</sup>
- If the incident review identifies a missing or weakened control, the guardrail documentation under §24 `MUST` be updated to reflect the new or strengthened control before similar agent work resumes. <sup>`AIC-incident-guardrail-update`</sup>

### `SHOULD`

- Incident reviews `SHOULD` record the model identifier, prompt or skill version, and tool set involved, consistent with `AIC-prompt-audit-trail` (§26, MUST when applicable for L3+) and `AIC-ai-model-provenance`, so the review is reproducible against the same operating context. <sup>`AIC-incident-context-recorded`</sup>
- Repositories `SHOULD` cross-link the incident record from the affected guardrail's evidence under §24, so future readers see the lineage from incident to control change. <sup>`AIC-incident-evidence-lineage`</sup>

### `MAY`

- Repositories `MAY` operate a public or internal post-mortem cadence for AI-attributable incidents to share lessons across teams. <sup>`AIC-incident-postmortem-cadence`</sup>

---

---

## Conformance levels

Repositories can adopt this specification in stages. Each level includes the levels below it. Each level describes a clear decision about AI's role in the repository.

A repository that does not satisfy Level 0 has no conformance level; audit templates represent that state as `conformance_level: none`.

The headline level comes from the highest-risk AI capability the repository permits. Feature-specific controls still apply on their own. For example, a Level 2 workflow may use tool-calling assistants, GitHub issues, pull request comments, fetched URLs, dependency metadata, command output, filters, classifiers, or other external content as long as every change still passes through human acceptance. Those features still trigger the relevant provider allowlist, data-classification, untrusted-input, dependency-verification, retention, capability-scoping, risk-control, and non-English-filter-coverage rows.

- **Level 0 — Baseline Hygiene.** The repository satisfies the baseline requirements in §1, §2, and §5: no secrets in version control, placeholder-only env examples when contributor-supplied or runtime environment variables exist, documented credential handling, a clean setup path, committed lockfile, pinned runtime, pinned package manager, and automated formatting. AI is not yet part of the contribution workflow. A repository at Level 0 publishes `conformance_level: 0`.
- **Level 1 — Hardened.** Level 0, plus the remaining unconditional `MUST` rows in Pillars 1–4 and the oversight MUSTs in §23, §24, and §25. A Level 1 repository is strong enough for AI tooling to read repository content. AI-specific MUSTs in Pillars 5–6 are not yet evaluated.
- **Level 2 — AI Assisted.** Level 1, plus AI instructions, AI data classification, AI-surface redaction, AI-generated-content licensing, and authorship tracking. Any triggered §18–§22 or §26 rows must also be satisfied. AI may assist humans, but every change passes through human acceptance.
- **Level 3 — AI Authored.** Level 2, plus the rows triggered by AI-authored work, shared skills, MCP servers, delegated agents, or other AI tooling that materially authors code. `AIC-prompt-audit-trail` always applies because Level 3 means AI materially authors code that ships. Humans still review before merge.
- **Level 4 — AI Autonomous.** Level 3, plus any autonomous-runner rows and every applicable `SHOULD`. Each `SHOULD` row must be `Fulfilled` or `Not relevant` with a documented reason. `⚠️ Warning` is not passing for Level 4. This level is for repositories where AI ships changes without human review for each change.

Teams adopting the spec for the first time should reach Level 0 first, then close the remaining Level 1 controls.

### Why Level 0 has these baseline requirements

Three intersecting selection rules pick the Level 0 set, and the same rules explain what is deliberately *not* at L0:

1. **Universal hygiene.** Every MUST listed at L0 protects any repository regardless of AI use — secret leakage in git history, unreproducible builds, and unreviewable formatting drift hurt human-only teams just as much. A repository that fails any L0 row is broken on its own merits.
2. **AI-readability prerequisite.** L0 is also the floor below which AI tools, *just reading* the repository, immediately cause harm: an AI assistant scaffolding without a committed lockfile produces a different dependency graph each run; one that reads `.env` files committed to git exfiltrates secrets to the provider context window. L0 closes those failure modes before any AI tool is declared in scope.
3. **Subset of Level 1 with no AI-specific or stack-dependent obligations.** L0 is exactly the L1 rules from §1 (Reproducible environment), §2 (Static correctness — only the formatting MUST), and §5 (Secrets and credentials). Everything else is at L1 or higher.

Deliberately *not* at L0:

- **Strict typing, lint correctness, architecture boundaries, debug-statement lint** (§2, §3) — stack-dependent. A shell-script repository can pass L0 without a TypeScript-style strict mode.
- **Pre-commit hooks, CI guardrails, fast-iteration paths** (§4) — depend on a hook framework and a CI host being wired up. Useful at L0+ but not the universal floor.
- **Branch protection, CODEOWNERS, human review baseline** (§16) — require hosted-platform admin scope, which solo or self-hosted repositories may not have at the Level 0 stage.
- **Test layers, runtime validation, auth boundary, observability** (§7, §10, §11, §13) — assume a test framework or a runnable service. L0 covers repositories without one.
- **Everything AI-specific** (§17 AI operating model, §22 redaction, §26 AI-output licensing, all of Pillars 5–6) — by definition out of scope at the tier whose premise is "AI not yet declared in the contribution path."

This is why L0 → L1 is the substrate-to-AI-readable transition: L1 closes the stack-, host-, and test-framework-dependent MUSTs that make a repository safe for AI tools to *read*; L2 is where AI is first declared in scope.

## Which level do you need?

Choose the level based on the highest-risk AI workflow the repository permits:

| Minimum level | If the repository allows... |
|---|---|
| **L0 Baseline Hygiene** | AI is not part of the contribution workflow yet. People may still use AI for personal help, but no AI tool reads the repository as workspace context, creates commits, or opens pull requests. |
| **L1 Hardened** | AI tools may read repository context, explain code, suggest commands, or help with review, but do not produce shippable changes |
| **L2 AI Assisted** | AI may produce code, docs, tests, configuration, or migrations that a human actively accepts. Extra risks such as tool use, external GitHub content, fetched URLs, retained context, provider routing, and dependency suggestions must be controlled. |
| **L3 AI Authored** | AI may complete delegated implementation tasks, open pull requests, or make material repository changes for human review |
| **L4 AI Autonomous** | AI may merge, release, deploy, schedule recurring changes, approve workflows, rotate settings, or otherwise act without per-change human approval |

The level a repository should target is determined by the highest AI workflow it intends to support, not by the average. A team running a single auto-merge bot needs Level 4 even if most of its AI use is read-only assistance.

---

## Final principle

AI should not be trusted because it is capable.

AI should be trusted only when the repository makes correctness, safety, and reviewability the default outcome — and the conformance levels above are how that claim is tested.

# Guardrails

Authoritative governance catalog for the synthetic golden-audit repo. Test data; sectioning follows the recommended convention from the [AI Contributor Specification](https://github.com/ai-contributors/ai-contributor-spec). Linked from [`README.md`](README.md) and [`AGENTS.md`](AGENTS.md).

Real repositories should expand each section with concrete tables and owners; the contents here are minimal placeholders so the audit collector and validator can exercise the recognized-filename + linked-from-README path.

## Status and scope

- Document owners: golden-audit fixture (no real owner).
- Last reviewed: synthetic.
- Scope: governance catalog stub for audit-collector test purposes.
- Conformance level claimed: not applicable (synthetic test data).

## What is automated vs manual

`AIC-machine-vs-manual-guardrails`, `AIC-guardrail-failure-surface`, `AIC-threshold-enforcement`, `AIC-gate-enforcement`.

| Guardrail | Enforcement | Where defined | Where failure surfaces |
| --------- | ----------- | ------------- | ---------------------- |
| Type strictness | automated | `tsconfig.json#strict` | local `pnpm type-check` |
| Lint | automated | `eslint.config.js` (not present in this fixture) | local `pnpm lint` |
| Test pass | automated | `package.json#scripts.test` | local `pnpm test` |

## Provider and model allowlist

`AIC-ai-provider-allowlist`. Synthetic fixture; no providers approved. A real repo lists provider, model, approved data classes, action categories, approval date, owner, and re-review date.

## MCP server allowlist

`AIC-mcp-allowlist`. Synthetic fixture; no MCP servers approved.

## Data classification and AI permissions

`AIC-ai-data-classification`. Synthetic fixture; only public test code exists in this repo. No customer, regulated, or secret data classes apply.

## Authorship and prompt audit

`AIC-ai-authorship-traceability`, `AIC-prompt-audit-trail`. Synthetic fixture; no AI authorship trail. Real repos record `AI-Authored:` and `Prompt-Audit:` trailers on PRs and commits.

## Incident response and policy ownership

`AIC-incident-guardrail-update`, `AIC-policy-living-document`. Synthetic fixture; no incidents. Real repos define containment, review owner, and the rule that the catalog is updated before similar agent work resumes when a control is found missing.

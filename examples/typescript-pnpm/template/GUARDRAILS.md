# Guardrails

Authoritative governance catalog for this repository. The §24 "single authoritative place" required by the [AI Contributor Specification](https://github.com/ai-contributors/ai-contributor-spec). Linked from [`README.md`](README.md) and [`AGENTS.md`](AGENTS.md).

`AGENTS.md` is the operating manual that an AI agent reads at runtime; this file is the governance catalog that humans (engineering, security, compliance) own and review on a different cadence. The two are deliberately split.

This sectioning follows the recommended convention from the AI Contributor Specification. Sections are recommended, not normatively required.

## Status and scope

- Document owners: `<TEAM-OR-PERSON>`.
- Last reviewed: `<YYYY-MM-DD>`. Review cadence: `<quarterly | on policy change | …>`.
- Scope: AI-era guardrails for code, build, deployment, and AI-assisted contribution in this repository. General security policy (vulnerability disclosure, supported versions) lives in `SECURITY.md` when this repository publishes one.
- Conformance level claimed: `<L0 | L1 | L2 | L3 | L4>`. See `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` for evidence per row.

## What is automated vs manual

`AIC-machine-vs-manual-guardrails`, `AIC-guardrail-failure-surface`, `AIC-threshold-enforcement`, `AIC-gate-enforcement`.

| Guardrail               | Enforcement          | Where defined                            | Where failure surfaces |
| ----------------------- | -------------------- | ---------------------------------------- | ---------------------- |
| Type strictness         | automated            | `tsconfig.base.json#strict`              | CI `type-check` job    |
| Lint correctness rules  | automated            | `eslint.config.js`                       | CI `lint` job          |
| Test coverage threshold | automated            | `vitest.config.ts`                       | CI `test` job          |
| Secret scanning         | automated (advisory) | GitHub secret scanning                   | repo Security tab      |
| AI provider allowlist   | manual               | this file § Provider and model allowlist | PR review              |
| Incident response       | manual               | this file § Incident response            | postmortem doc         |

Add or remove rows as the repo evolves; the goal is a single auditable map of "is this enforced by a machine or by a human."

## Provider and model allowlist

`AIC-ai-provider-allowlist`, `AIC-regulated-data-provider-gate`, `AIC-provider-deprecation-procedure`, `AIC-no-routing-past-eol`, `AIC-allowlist-rescope-on-terms-change`.

| Provider   | Models / endpoints | Approved data classes             | Approved action categories         | Approval date  | Owner     | Re-review      |
| ---------- | ------------------ | --------------------------------- | ---------------------------------- | -------------- | --------- | -------------- |
| `<vendor>` | `<model-id>`       | public-source, synthetic-fixtures | code-authoring, read-only-research | `<YYYY-MM-DD>` | `<owner>` | `<YYYY-MM-DD>` |

Routing outside the allowlist is forbidden. If a vendor announces deprecation, sunset, ownership change, or a material terms-of-service change, the row is re-evaluated by `<owner>` within `<window>` before agent workflows continue using it.

## MCP server allowlist

`AIC-mcp-allowlist`, `AIC-mcp-root-scoping`, `AIC-mcp-read-only-default`, `AIC-mcp-pinned-versions`, `AIC-mcp-env-separation`, `AIC-mcp-auditability`.

| Server   | Version pin | Root scope (paths/resources) | Read-only? | Env separation | Owner     |
| -------- | ----------- | ---------------------------- | ---------- | -------------- | --------- |
| `<name>` | `<version>` | `<paths>`                    | yes/no     | `<env>`        | `<owner>` |

Root-scope policy lives in `.ai-contributor-policy/mcp-root-scope.json`; this table is the human-readable summary.

## Data classification and AI permissions

`AIC-ai-data-classification`, `AIC-ai-prod-data-readonly`, `AIC-data-minimization-techniques`.

| Class              | Examples                         | AI-permitted? | Conditions                                                         |
| ------------------ | -------------------------------- | ------------- | ------------------------------------------------------------------ |
| Public source      | this repo's source, public docs  | yes           | none                                                               |
| Synthetic fixtures | `tests/fixtures/**`              | yes           | none                                                               |
| Internal docs      | `docs/internal/**`               | conditional   | only on providers approved for internal-confidential               |
| Customer data      | production logs, support tickets | no            | never; redact before any AI pipeline                               |
| Regulated data     | PII, payment, health             | no            | never; routing outside the allowlist for these classes is an Alarm |
| Secrets            | `.env`, key material, tokens     | no            | never; secretlint blocks at commit time                            |

If a contributor is unsure whether a class qualifies, the default is "no" until the data-classification owner confirms.

## Authorship and prompt audit

`AIC-ai-authorship-traceability`, `AIC-prompt-audit-trail`, `AIC-ai-input-retention`, `AIC-agent-action-traceability`.

- PR template requires `AI-Authored: yes (agent, model)` or `AI-Authored: no`.
- When `AI-Authored: yes`, the PR also carries `Prompt-Audit: <reference>` naming the prompt source, skill version, and transcript-retention location.
- Material AI-authored commits preserve `AI-Authored:` and `Prompt-Audit:` as git trailers.
- `Co-Authored-By:` is visibility metadata, not the authoritative trail.
- Agent runs (read/write/merge/deploy/settings-change/external-call) record agent identity, model + version, prompt/skill version, ISO 8601 timestamp, and action category to `<destination>` and are queryable by agent, action, and time range.
- Retention period: `<duration>` (e.g., 90 days for prompts, indefinite for the trailer in git history).

## Incident response and policy ownership

`AIC-incident-guardrail-update`, `AIC-incident-context-recorded`, `AIC-policy-living-document`, `AIC-policy-owner-cadence`.

- Containment: invoke `AIC-agent-kill-switch` (`<command-or-runbook>`) and `AIC-agent-rollback-procedure` (`<command-or-runbook>`).
- Review owner: `<TEAM>`. The review records model identifier, prompt or skill version, and tool set involved.
- If the review identifies a missing or weakened control, this file is updated before similar agent work resumes.
- Policy owner: `<TEAM>`. Cadence: `<quarterly | on incident | on regulatory change>`. Each update bumps the "Last reviewed" line under § Status and scope and lands via PR with CODEOWNERS approval.

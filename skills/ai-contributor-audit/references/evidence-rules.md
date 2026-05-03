# Evidence Rules

Use these rules when filling checklist Status and Comment cells.

## One rule to remember

No evidence means no `Fulfilled`. If evidence is missing, partial, indirect, or unavailable, use `Warning` and explain what would be needed to verify the row.

## Status Meanings

- `✅ Fulfilled`: direct evidence proves the rule is satisfied for the audited scope.
- `⚠️ Warning`: partially satisfied, evidence is indirect, applicability is uncertain, or a required verification path is unavailable.
- `🚨 Alarm`: clearly not satisfied.
- `➖ Not relevant`: applicability trigger does not hold, with evidence.

Use `Warning` when uncertain. Do not use prose caveats to soften an unsupported `Fulfilled`.

## Comment Citation Shapes

Every non-blank row needs a self-contained Comment using one of these shapes:

- `` `command` → short output excerpt ``: command must appear verbatim in the current audit log.
- `file:line — "quoted excerpt"`: line number must exist in `audited_commit`.
- `` `file § Heading` `` or `file § Heading`: section-level evidence.
- `` `path/to/file.ext` ``: file existence or inspected static evidence.
- `` `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` ``: collector-derived evidence.

Comments using only prose are not enough.

## Audit-Log Rows

For setup rows, use literal `<preflight>` in the `Rules` column.

For evidence rows, list exact checklist rule names in backticks, for example:

```text
`Strict Types`, `Lockfile Integrity`
```

Every command cited in a checklist Comment must appear in the current audit log under the same `assessment_started_at`.

## Collector-Derived Rows

For rules derived by `audit-collect`:

- Read `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json.rules.<id>`.
- If `judgment_required === false`, copy `derived_status`.
- Cite `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`, the command, and the derivation reason.
- Do not re-score the row manually unless you found concrete evidence the collector missed.

## Configured Is Not Executed

A config file, package script, workflow file, or hook declaration proves intent, not execution.

For `Fulfilled`, executable controls need a passing command or host setting proving they run and block. If you cannot prove execution, use `Warning`.

## Hosted Settings Require API Evidence

Local checkout evidence is not enough for hosted settings.

`Fulfilled` requires `gh api` or equivalent host API evidence for:

- `Branch Protection`
- `Human Review Required`
- `CI Gates`
- `Gate Enforcement`
- `Secret Scanning`
- `Push Protection`
- `Dependency Security`
- `Dependency Review`
- `CODEOWNERS`
- `Deployment Protection`
- `Workflow Security`
- `SBOM` when provenance is hosted
- `SAST` when alerts are read from the host

A local file alone, such as `CODEOWNERS`, `dependabot.yml`, or CodeQL workflow YAML, is `Warning` at best when the hosted enforcement cannot be verified.

## Token-Tier Disclosure

Before any `gh api` evidence row, record `gh api user --jq .login`, `gh auth status`, or equivalent active-identity disclosure. Do not let this block the audit indefinitely; use the collector's bounded identity evidence or a manually bounded command. The validator check is `AUDIT038`. Include:

- login
- token scopes when available (`x-oauth-scopes` / `gh auth status` output)
- whether `GH_TOKEN` / `GITHUB_TOKEN` are set

Preferred audit token: read-only audit tier. Scopes are limited to:

- `read:org`
- `public_repo`
- `read:packages`
- `security_events`

If recorded scopes include `repo`, `workflow`, `admin:*`, `delete:*`, or organization-level admin, the audit may proceed. Do not downgrade an otherwise true hosted control solely because the token is broad/write-capable; record the token tier as an evidence caveat instead. A human reviewer may still ask for re-checking with a least-privilege read-only token when independence matters.

## Applicability Evidence

`Not relevant` needs evidence that the trigger does not apply.

Owner-provided profile answers in `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` are applicability evidence, not automatic fulfillment evidence. A `no` answer can support `Not relevant` only for mapped `MUST when applicable`, `SHOULD`, or `MAY` rows whose trigger is absent. A `yes` answer keeps the row in scope and the row still needs normal repository, host, or policy evidence. Blank answers leave the decision to the collector and auditor.

Mapped owner profile `no` answers are stamped automatically for eligible rows. Use a manual `Owner profile:` comment only when the profile answer is relevant evidence that the collector/stamper mapping does not cover.

Each `MUST when applicable` row must have one of three outcomes: `Fulfilled`, `Warning` / `Alarm`, or `Not relevant` with trigger evidence. Never silently skip a row.

| Rule | Applicability trigger | How to confirm non-applicability |
|---|---|---|
| `Env Template` | Repo requires contributor-supplied or runtime environment variables. | Cite absence of runtime env references and tracked env templates, or an owner profile `no` answer explaining that no contributor-supplied or runtime env vars are required. |
| `Failure Handling` | Repo includes production code or runtime paths where failure handling affects users, data integrity, security, or automation. | Cite docs-only/static/package-only shape, or an owner profile `no` answer explaining that the repo has no production runtime path. |
| `Observability` | Repo operates a service, app, worker, proxy, or production runtime that emits logs, telemetry, traces, or error reports. | Cite absence of a service/app/worker/proxy/production runtime, or an owner profile `no` answer explaining that operational telemetry does not exist for this repo. |
| `SAST` | Repo contains shipped source code in a language with a mature SAST offering: TS/JS/Python/Go/Java/C#/Ruby/Rust/etc. | Show no source language matches; a TS/JS repo cannot be `Not relevant`. |
| `SBOM` | Repo produces a shipped artifact: published package, container image, binary release, hosted service. | Check release workflow, Dockerfile, registry publish step, or equivalent; if none exist, cite that. A deployed web app is a shipped artifact. |
| `Dependency Review` | Repo has a dependency manifest: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc. | Only `Not relevant` when no dependency manifest is tracked. |
| `Dependency Security` | Same trigger as `Dependency Review`. | Same rule. |
| `Push Protection` | Hosted on a platform that offers push protection. | Cite platform lack of support or plan tier exclusion. "We have not enabled it" is `Warning`, not non-applicability. |
| `Accessibility` / `Performance Budget` | Repo ships user-facing UI: web, mobile, desktop GUI. | Cite absence of UI routes, HTML, or component tree. API-only services can be `Not relevant`. |
| `Reliability Targets` | Repo runs as a service with uptime expectations. | Cite absence of deployed service. CLI, library, and static-doc repos can be `Not relevant`. |
| `Security Policy` | Repo is public, accepts external contributions, or is externally consumed. | Cite private status plus documented closed-contribution policy. A private repo consumed externally is still applicable. |
| `CODEOWNERS` | Repo has paths whose change warrants specific human review: security config, policy docs, release infra, regulated code. | Rarely `Not relevant` for a multi-file repo; cite which areas are intentionally ungated and why. |
| `Deployment Protection` | Repo has a deploy workflow or auto-deploy path. | Cite absence of any deploy step. |
| `Threat Model` | System is security-sensitive, internet-facing, multi-tenant, or handles regulated data. | Cite absence of all four properties. |
| `Regulated Data Controls` | Product handles legally constrained data classes: PII under GDPR/CCPA, PHI, payment data, etc. | Cite data inventory showing none of these classes are processed. |
| AI-specific agent/tool rows (`Shared Skills`, `Skill Safety`, `Agent Scope`, `Agent Permissions`, `Agent Isolation`, `Agent Traceability`, `MCP Allowlist`, `MCP Least Privilege`, `MCP Root Scoping`, `MCP Auth Security`, `Capability Scoping`, `Untrusted Agent Input`, `Classifier-Only Controls Excluded`, `AI Provider Allowlist`, `Agent Cost Ceiling`, `AI Context Retention`, `Prompt Versioning`) | Team AI workflows use autonomous/delegated agents, shared skills, slash commands, reusable workflow modules, MCP servers, or AI providers over repository content. | Cite absence of `AGENTS.md` sections declaring agent use, no versioned shared skills/prompts/commands, no repo or team MCP config, no `.claude/`, `.github/agents/`, `.github/prompts/`, `.cursor/`, or similar directories, and no documented AI workflow invoking these tools. |

Absence of evidence is not proof of non-applicability.

## Scope-Sensitive Rules

Evaluate these against the scope inventory:

- `Clean Setup`
- `Pinned Toolchain`
- `Lockfile Integrity`
- `Strict Types`
- `Lint Rules`
- `Architecture Boundaries`
- `Invariants`
- `CI Gates`
- `Coverage Floor`

If only some units satisfy the rule, use `Warning` and name the uncovered units.

## Canonical Command Families

Use stack-appropriate equivalents, but record the exact command used.

The deterministic-table rules below are evaluated by `audit-collect` against the pinned commit where supported. The table is also the fallback when a stack needs manual equivalent commands.

| Rule | Canonical command family | What `Fulfilled` requires |
|---|---|---|
| `Formatting` | `pnpm format:check`, `prettier --check .`, or stack equivalent | Exit code 0 over tracked scope. A formatter that would change committed files is `Alarm`, not `Fulfilled`. |
| `Lint Rules` | `pnpm lint`, recursive workspace lint, or stack equivalent | Exit code 0 over every unit in the scope inventory. Silently excluded units force `Warning`. |
| `Strict Types` | `pnpm type-check`, `tsc --noEmit`, or stack equivalent plus strict-config inspection | Strict config and clean type-check for every unit in scope. |
| `Lockfile Integrity` | frozen/locked install verification for every tracked lockfile | Exit code 0. Multiple ecosystems require each lockfile to be verified. |
| `Pre-Commit` | inspect hook and dry-run hook script | Named meaningful checks such as lint, type-check, tests, or secret scan. Formatter alone is not enough. |
| `CI Gates` | `gh api repos/<owner>/<repo>/rules/branches/<default>` or branch protection endpoint | Ruleset/protection payload lists required status checks, and workflows define matching jobs. |
| `Branch Protection` | `gh api repos/<owner>/<repo>/rules/branches/<default>` plus `gh api repos/<owner>/<repo>/rulesets/<id>` or protection endpoint | `enforcement: active`, no permissive `bypass_actors`, and default branch covered. |
| `Human Review Required` | branch rules/protection API | `required_approving_review_count >= 1` and `dismiss_stale_reviews_on_push: true` or equivalent. A value of `0` is `Alarm`. |
| `Gate Enforcement` | grep `continue-on-error` plus rules/protection payload | No required status check has `continue-on-error: true`. If it does, the row is `Warning` at best and the job is labelled advisory. |
| `Secret Scanning` | host API or local detector in CI/pre-commit | Detector exists and is wired into a change path. |
| `Push Protection` | host secret-scanning/security-analysis API | Push protection enabled or host equivalent. Disabled/404 is `Warning` with reason. |
| `Dependency Security` | host dependency alerts or package-manager audit | Vulnerability source exists and is surfaced where humans see it. Disabled alerts without replacement are `Alarm`. |
| `Dependency Review` | dependency review workflow or enforced equivalent | PR path reviews dependency changes. Config without trigger is `Warning`. |
| `Automated Dependency Updates` | Dependabot/Renovate config | Config present and at least one ecosystem covered. |
| `SAST` | CodeQL/Semgrep/etc. workflow or equivalent | SAST job runs on the change path. Default-branch-only is `Warning`. |
| `SBOM` | CycloneDX/Syft/anchore or equivalent generation | Shipped artifacts can generate an SBOM. Absence for shipped artifacts is `Alarm`. |
| `Accessibility` | Lighthouse/a11y config plus CI job | A11y category asserts error and the CI job blocks merge. |
| `Performance Budget` | performance budget config plus CI job | Budget asserts error and the CI job blocks merge. |
| `CODEOWNERS` | `CODEOWNERS` plus branch protection API | File exists and code-owner review is enforced. Advisory-only ownership is `Warning`. |
| `Coverage Floor` | test config and test run | Threshold exists and is evaluated by the change path. |
| `Runtime Validation` | boundary validation search plus boundary review | External-input boundaries validate at runtime; partial coverage is `Warning`. |

## Self-Lint Before Handoff

Before final handoff:

1. No blank Status cells. Run:

   ```sh
   awk -F'|' '
     BEGIN { in_rules = 0; tables_seen = 0 }
     /^## `/ {
       was_in = in_rules
       in_rules = ($0 ~ /^## `(MUST|MUST when applicable|SHOULD|MAY)`/)
       if (in_rules && !was_in) tables_seen++
     }
     in_rules && /^\| `/ && NF >= 6 {
       status = $5; gsub(/^[ \t]+|[ \t]+$/, "", status)
       if (status == "") print FILENAME ":" NR ": " $0
     }
     END {
       if (tables_seen < 4) print "WARN: only " tables_seen " of 4 expected per-rule tables matched" > "/dev/stderr"
     }' .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md
   ```

2. Every command citation appears in the audit log.
3. Scope inventory was applied.
4. Canonical commands ran for `Fulfilled` executable controls.
5. Every `Not relevant` row cites applicability evidence.
6. Root backlog exhaustively includes non-`MAY` Warning/Alarm rows. Run:

   ```sh
   awk -F'|' '
     BEGIN { in_rules = 0 }
     /^## `/ { in_rules = ($0 ~ /^## `(MUST|MUST when applicable|SHOULD)`/) }
     in_rules && /^\| `/ && NF >= 6 {
       status = $5; gsub(/^[ \t]+|[ \t]+$/, "", status)
       if (status ~ /Warning|Alarm/) c++
     }
     END { print "warning/alarm rows in MUST/SHOULD tables: " c }' .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md
   ```

   Then compare with the non-empty backlog rows in `AI-CONTRIBUTOR-AUDIT.md`; the validator performs the exact structural check.

7. `conformance_level` matches the summary table.
8. Duration math is correct.
9. Token-tier disclosure precedes `gh api` (`AUDIT038`).
10. `Configured is not executed`: `Fulfilled` rows cite execution evidence, not config presence alone.
11. Hosted-settings `Fulfilled` rows cite API evidence for the hosted-settings list above.
12. Validator exits 0.

---
spec_version: "0.1.2"
spec_source:           # Stamped automatically by audit-stamp.ts from --spec-source, AI_CONTRIBUTOR_SPEC_SOURCE, the bootstrap manifest, or the pinned runbook path. Immutable source used for this audit, e.g. https://github.com/ai-contributors/ai-contributor-spec/tree/<full-commit-sha> or a release tag. Must match the companion audit log exactly.
assessment_started_at:    # Stamped automatically by audit-stamp.ts from the collector's evidence JSON. Leave blank — the stamper overwrites it. ISO 8601 date-time with seconds.
assessment_completed_at:  # Stamped automatically by audit-stamp.ts. Leave blank — the stamper overwrites it.
assessment_duration:      # Stamped automatically by audit-stamp.ts (HH:MM:SS, derived from the two timestamps). Leave blank — the stamper overwrites it.
audited_commit:     # Stamped automatically by audit-stamp.ts from AI-CONTRIBUTOR-EVIDENCE.json target.audited_commit, falling back to git rev-parse HEAD.
auditor:            # Stamped by audit-stamp.ts from --auditor or AI_CONTRIBUTOR_AUDITOR. Human: name (e.g. Jane Smith); AI: AGENT | MODEL | REASONING_EFFORT (e.g. "GitHub Copilot | gpt-5.4 | high"). Use "n/a" if the agent has no reasoning setting.
validator_version:  # Stamped automatically by audit-stamp.ts from the `VALIDATOR_VERSION` constant baked into the running stamper. Leave blank — the stamper overwrites it. Two audits diffed against each other are guaranteed to have run the same machinery because the validator fails when its runtime version disagrees with this value. Must match the companion audit log exactly.
collector_version:  # Stamped automatically by audit-stamp.ts from the `COLLECTOR_VERSION` constant baked into the running collector. Leave blank — the stamper overwrites it. Must match the companion audit log exactly.
runner_agent:       # Stamped by audit-stamp.ts from --runner-agent or AI_CONTRIBUTOR_RUNNER_AGENT. Must match the companion audit log exactly.
runner_model:       # Stamped by audit-stamp.ts from --runner-model or AI_CONTRIBUTOR_RUNNER_MODEL. Must match the companion audit log exactly.
conformance_level:  # one of: none, 0, 1, 2, 3, 4. Stamped automatically by audit-stamp.ts from the highest ✅ Yes row in the Conformance level summary table. Leave blank — the stamper overwrites it. Must match the companion audit log exactly.
---

# AI Contributor Conformance Checklist

> Companion audit checklist for [`AI-CONTRIBUTOR-SPECIFICATION.md`](../AI-CONTRIBUTOR-SPECIFICATION.md). Check your repository against every item and record the evidence (CI job, config file, review rule, policy document) that enforces each one.
>
> **Either an AI agent or a human can fill this in.** The rigor rules in "How to use this checklist" apply equally to both — strict Status definitions and evidence in every **Comment**.
>
> The audit produces one root summary and three audit output artifacts (this file, the audit log, and the evidence JSON), and reads one optional owner profile input (`AI-CONTRIBUTOR-AUDIT-PROFILE.md`) that the audit never overwrites. The sections below describe the structure of this file.
>
> - **Frontmatter** (top of file) — structured metadata (`spec_version`, `spec_source`, `assessment_started_at`, `assessment_completed_at`, `assessment_duration`, `audited_commit`, `auditor`, `validator_version`, `collector_version`, `runner_agent`, `runner_model`, `conformance_level`).
> - **Root summary** ([`../AI-CONTRIBUTOR-AUDIT.md`](../AI-CONTRIBUTOR-AUDIT.md)) — short conformance summary and severity-prioritized backlog for readers who do not need the full evidence trail.
> - **Conformance level summary** (top) — which of Levels 0–4 the repository has reached, with blockers in Notes. The stamper mirrors this section into the root summary.
> - **Backlog — what to address first** (top) — one step-by-step action plan ordered by conformance level, priority, then rule.
> - **Level tables** (middle) — Scope, automated marker (`A`), Status, Comment, and IDs for every row, grouped by level.
> - **Verification gaps** (bottom) — rows where evidence is indirect; the owner checks these manually.
> - **Audit log** ([`AI-CONTRIBUTOR-AUDIT-LOG.md`](AI-CONTRIBUTOR-AUDIT-LOG.md), companion file) — every evidence command, with output excerpt. This helps reviewers catch invented or stale evidence in AI-run audits and inspect the trail for human-run audits.

<!-- BEGIN:TEMPLATE-ONLY — Auditor: delete this entire block (and its END marker) when filling the checklist. The validator fails the audit if any TEMPLATE-ONLY marker survives in the filled output. -->

## Where these assets live

- **The root summary belongs at the adopting repository root** as `AI-CONTRIBUTOR-AUDIT.md`.
- **Full audit artifacts belong under `.ai-contributor-audit/`**: `AI-CONTRIBUTOR-CHECKLIST.md`, `AI-CONTRIBUTOR-AUDIT-LOG.md`, and `AI-CONTRIBUTOR-EVIDENCE.json`.
- **Commit and push all audit artifacts with every audit.** `audited_commit`, `spec_source`, and `assessment_started_at` pin each audit to a point in time. Git history becomes the audit trail.
- **Prior audits live in git history, not in the current file.** To inspect old results, run `git log -- .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` or `git show <sha>:.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`. Start each re-audit from the blank template.

## Re-audit protocol (start from scratch)

**A prior filled checklist or audit log in the target repository is NOT evidence.** When re-auditing, the auditor (human or AI) MUST:

1. **Pin `audited_commit` and run the evidence collector.** The audit is tied to a commit, not a worktree. Bootstrap `audit-collect` from the same `spec_source` the stamper will record — it extracts `audited_commit` (default: `HEAD`) into a temporary `git worktree`, runs every canonical command there, and emits `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` next to the full audit artifacts. Uncommitted local changes in the caller's worktree are recorded in `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json.preflight.original_worktree_status` for traceability but do **not** affect the audit. If `audit-collect` is not available through the local `tools` package, fetch it from `spec_source` and run via `npx tsx`; record the bootstrap command in the audit log. A prior filled checklist or audit log from an earlier run must be committed before re-auditing — the next steps overwrite the artifacts and uncommitted prior audit output would be lost. (If you specifically want to audit your working tree — rare; typically a pre-commit dry run — pass `--working-tree`. The collector then sets `audited_commit: "working-tree:HEAD=<sha>+dirty"` and the audit cannot be cited as conformance against a release tag.)
2. **Overwrite from the blank template.** Reset `AI-CONTRIBUTOR-AUDIT.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, and `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md` to the blank templates from the immutable `spec_source` used for this audit (for example a release tag or full commit SHA from the spec repo) before filling them. Do not edit in place on top of prior Status, Comment, Backlog, or audit-log content. Do not fetch templates from a mutable branch such as `main` unless you first resolve that branch to a full commit SHA; the bootstrap manifest or stamper `--spec-source` then records that immutable source. After the first stamp, confirm the stamped audit-log block records the `audit-collect` invocation and its `[audit-collect] wrote …` summary line.
3. **Do not read prior filled content as input.** Do not copy forward any Status, Comment, Backlog row, Verification-gap row, or audit-log entry from a previous run. Prior audits reflect a previous commit; the current audit reflects `audited_commit` and must stand on its own evidence.
4. **Every Comment must cite current-run evidence.** A checklist Comment must cite either a command recorded in the current run's audit log, a `file:line` / section citation from `audited_commit`, or `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` emitted by the current `audit-collect` invocation. This rule prevents copied evidence: an agent cannot reuse a Comment unless it also provides current, reviewable evidence. Each `Fulfilled` row `MUST` additionally have at least one matching audit-log entry whose `Spec IDs` column lists one of the rule's visible IDs from this checklist, unless the row is a collector-derived finding citing `AI-CONTRIBUTOR-EVIDENCE.json`; CI fails the audit otherwise.
5. **Timestamps must be fresh and measured by the scripts.** Do not run `date` or type assessment timestamps by hand. `audit-collect.ts` records `assessment_started_at` in `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`; `audit-stamp.ts` stamps `assessment_started_at`, `assessment_completed_at`, and `assessment_duration` into both files.
6. **Spec source must be immutable.** Ensure the stamper records the exact spec source used for the current run in both files. For an upstream audit, use a release tag or full commit SHA. For a forked local policy, pass `--spec-source` with the local policy file path plus its commit SHA. Same target repository, same `audited_commit`, same `spec_source`, and same external settings snapshots are the reproducibility boundary.

The audit artifacts have different roles: `AI-CONTRIBUTOR-EVIDENCE.json` is the source for collector-derived facts and findings, the audit log records command and manual evidence, this checklist is the rendered scoring and judgment surface, and the root `AI-CONTRIBUTOR-AUDIT.md` summary is a stamper-written projection from the checklist. The canonical ownership table is in [`AI-CONTRIBUTOR-AUDIT-MODEL.md` § Artifact And Field Ownership](../AI-CONTRIBUTOR-AUDIT-MODEL.md#artifact-and-field-ownership).

## Audit lifecycle and field ownership

The full lifecycle is: collect evidence, stamp mechanical fields, review current-run evidence and fill judgment-required gaps, stamp again, validate, then have a human or named accountable owner accept the result before claiming conformance.

- **Collector/stamper-owned fields:** assessment timestamps and duration, `spec_source`, `audited_commit`, identity fields supplied by flags or environment, `validator_version`, `collector_version`, automated checklist `A` / `Status` / `Comment` cells, stamped audit-log blocks, conformance summary `Status`, `conformance_level`, backlog derived columns, verification-gap stamped rows, and the root `AI-CONTRIBUTOR-AUDIT.md` summary. Do not hand-edit them.
- **Auditor-owned fields:** judgment-required checklist `Status` and `Comment` cells, manual audit-log rows below stamped blocks, conformance summary `Notes`, backlog `Next action` / `Owner` / `Target date`, and manual verification-gap rows. The auditor can be a human or an agent, but every populated row still needs current-run evidence.
- **Owner profile input:** `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` is owner-authored pre-audit input. The audit reads it but does not silently edit it. If the audit finds missing, ambiguous, or contradictory owner facts, record `⚠️ Warning` or a verification gap, update the profile in a separate profile step, then rerun the audit.
- **Hybrid field:** `Date reached` is entered by the auditor only when a level is first claimed as `✅ Yes`; the stamper preserves it while that level remains reached and clears it if the level later drops out of `✅ Yes`.
- **Human/accountable reviewer-owned step:** an agent-run audit is valid audit output when it follows this lifecycle and passes validation, but publishing a conformance claim requires human or named owner acceptance of the filled artifacts.

## Low-barrier way to fill this checklist

If this is your first audit, use this order:

1. Run the evidence collector.
2. Run the stamper once so mechanical frontmatter, automated rows, and stamped audit-log rows are current.
3. Work through auditor-owned rows from Level 0 upward. Do not skip a row.
4. For each row, ask: does the trigger apply, what evidence proves the answer, and what status does that evidence support?
5. Fill conformance summary `Notes`, and fill `Date reached` only for levels newly claimed as `✅ Yes`.
6. Run the stamper again, then run the validator before committing the audit files; the stamper refreshes the root `AI-CONTRIBUTOR-AUDIT.md` summary.
7. Have a human or named accountable owner review the filled artifacts before publishing a conformance claim.

Use `Warning` when you are unsure. A conservative `Warning` is a valid audit result; an unsupported `Fulfilled` is a defect.

## How to use this checklist

- Read [`AI-CONTRIBUTOR-SPECIFICATION.md`](../AI-CONTRIBUTOR-SPECIFICATION.md) first — the normative text lives there, and this checklist turns it into audit rows. Terms in this checklist (agent, harness, destructive action, security-sensitive action, release-affecting action, material action, engineering guardrail, equivalent) are defined in [`AI-CONTRIBUTOR-SPECIFICATION.md` § Definitions](../AI-CONTRIBUTOR-SPECIFICATION.md#definitions) and those definitions govern here. The conformance levels referenced below are defined in [`AI-CONTRIBUTOR-SPECIFICATION.md` § Conformance levels](../AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels).
- Copy this file into your repository and fill the **Status** column for every row.
- Allowed status values — apply the definitions strictly:
  - `Fulfilled` — requires evidence from the repository. Evidence may be a file excerpt, a command output, or a clear architectural property visible in configuration (for example `"strict": true` in `tsconfig.json`). "Obvious from the code" without backing is not evidence. No evidence, no `Fulfilled`.
  - `Warning` — the correct answer under uncertainty or partial evidence. Name what would be needed to verify. This is a default, not a fallback.
  - `Alarm` — requires a specific negative finding (for example: `.env` is tracked in git; the default branch has no protection rules; a dependency audit reports critical CVEs).
  - `Not relevant` — requires naming the `MUST when applicable` condition that does not hold, with evidence. Absence of evidence that a trigger applies is not enough; under uncertainty use `Warning`. `MUST` rows cannot be `Not relevant`.
  - Leave blank while unassessed — a blank row is an open gap, not a pass.
  - Prefix the status with an emoji for human readability and quick column scanning: `✅ Fulfilled`, `⚠️ Warning`, `🚨 Alarm`, `➖ Not relevant`. Matches the emoji convention used in the conformance-level summary table below.
- **Comment format.** Every non-blank status needs evidence a reader can independently verify:
  - `file:line — "quoted excerpt"` — for example `tsconfig.json:4 — "strict": true`.
  - `` `command` → short output excerpt `` — for example `` `grep -n '"strict"' tsconfig.json` → `4:  "strict": true` ``. The full command output belongs in [`AI-CONTRIBUTOR-AUDIT-LOG.md`](AI-CONTRIBUTOR-AUDIT-LOG.md); the comment here is the excerpt that makes the row self-contained.
  - For `Not relevant` rows, record which triggering characteristic does not apply and how you confirmed it.
- Scope rules:
  - `MUST` rows unchecked or at `Warning` / `Alarm` are conformance gaps.
  - `MUST when applicable` rows apply only for characteristics your repository has (UI, public releases, cloud deployments, agents, MCP servers, regulated data, etc.). `Not relevant` requires direct evidence that the triggering characteristic does not hold. A `MUST` bullet in the spec may legitimately map to a `MUST when applicable` row here when the bullet's own sentence carries an embedded applicability clause (for example "Multi-package repositories `MUST`…", "…where the persistence layer supports them"). The mapping rule lives in [`AI-CONTRIBUTOR-SPECIFICATION.md` § Normative language](../AI-CONTRIBUTOR-SPECIFICATION.md#normative-language).
  - `SHOULD` gaps (anything not `Fulfilled`) need a documented reason in the **Comment** column.
  - `MAY` items are optional.
- **Level sections.** Rows are grouped by the first conformance level where they become relevant. To compute "what is required at Level N", complete every row in Level N and every lower level whose scope/applicability triggers.
- **Scope column.** `MUST` rows are unconditional requirements. `MUST when applicable` rows are required only when the repository has the triggering characteristic. `SHOULD` rows must be resolved for Level 4. `MAY` rows are optional and never required for conformance.
- **IDs column.** The `AIC-*` IDs link each checklist row to the normative bullet or bullets in the specification. Use these IDs in the audit log's **Spec IDs** column when a command provides evidence for the row.
- **Automated result rows.** The `A` column is `x` when `audit-stamp.ts` mechanically rewrote `Status` and `Comment` from `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`. This includes rows where every visible `AIC-*` ID has decisive collector evidence (`judgment_required: false`, `derived_status` set) and owner-profile applicability answers that stamp `➖ Not relevant`. Rows with only partial collector coverage remain auditor-owned. The default `-` means the row is auditor-owned. Collector-derived comments start with `Mechanical (collector-derived) from`; profile-derived comments start with `Owner profile:`. Do not hand-edit automated cells; the next stamper run will overwrite them. Fill in `Status` and `Comment` only for rows the collector leaves blank.

- **After the tables**, fill two audit artifacts: **Verification gaps** at the bottom of this file, and the **Audit log** in [`AI-CONTRIBUTOR-AUDIT-LOG.md`](AI-CONTRIBUTOR-AUDIT-LOG.md). Each section explains what to record.
- **Keep the README badge in sync.** When `conformance_level` changes, update the AI Contributor badge in the repository's `README.md`. Badges start at Level 1. Remove the badge when `conformance_level` is `0` or `none`. Badge markup is in [the spec's README](https://github.com/ai-contributors/ai-contributor-spec#display-your-level).

**Conformance levels.** These summaries are for quick reference. The formal definitions are in [`AI-CONTRIBUTOR-SPECIFICATION.md` § Conformance levels](../AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels); if the two differ, the specification governs.

- **Level 0 — Baseline Hygiene:** The repository satisfies the baseline requirements in §1, §2, and §5: no secrets in version control, placeholder-only env examples when contributor-supplied or runtime environment variables exist, documented credential handling, a clean setup path, committed lockfile, pinned runtime, pinned package manager, and automated formatting. AI is not yet part of the contribution workflow. A repository at Level 0 publishes `conformance_level: 0`.
- **Level 1 — Hardened:** Level 0, plus the remaining unconditional `MUST` rows in Pillars 1–4 and the oversight MUSTs in §23, §24, and §25. A Level 1 repository is strong enough for AI tooling to read repository content. AI-specific MUSTs in Pillars 5–6 are not yet evaluated.
- **Level 2 — AI Assisted:** Level 1, plus AI instructions, AI data classification, AI-surface redaction, AI-generated-content licensing, and authorship tracking. Any triggered §18–§22 or §26 rows must also be satisfied. AI may assist humans, but every change passes through human acceptance.
- **Level 3 — AI Authored:** Level 2, plus the rows triggered by AI-authored work, shared skills, MCP servers, delegated agents, or other AI tooling that materially authors code. `AIC-prompt-audit-trail` always applies because Level 3 means AI materially authors code that ships. Humans still review before merge.
- **Level 4 — AI Autonomous:** Level 3, plus any autonomous-runner rows and every applicable `SHOULD`. Each `SHOULD` row must be `Fulfilled` or `Not relevant` with a documented reason. `⚠️ Warning` is not passing for Level 4. This level is for repositories where AI ships changes without human review for each change.

If no level is `✅ Yes`, set `conformance_level: none` and remove any AI Contributor badge. If only Level 0 is `✅ Yes`, set `conformance_level: 0` and still remove the badge because Level 0 has no badge.

## Quick audit (time-boxed path)

For a focused audit, work through the rows in this order and stop when you have enough signal for an action plan. A full audit covers every row; this path is for triage or a first pass.

1. Every `MUST` row in the Level 1 section — these apply to every repository.
2. In the Level 1 section, pick the `MUST when applicable` rows that match your repository's shape:
   - UI or web frontend → `Accessibility`, `Performance Budget`.
   - Public release or published artifacts → `SBOM`, `Security Policy`, `CODEOWNERS`.
   - Agents, shared skills, MCP servers, external providers, retained AI context, external GitHub content, fetched URLs, or AI-suggested dependencies → continue into Level 2 and Level 3 as needed; these sections contain the agent, MCP, and AI-risk rows.
   - Regulated data in AI workflows → `AI Data Classification`, `AI Provider Data Gate`, `Regulated Data Controls`.
3. Finish with the Level 4 `SHOULD` rows whose failure would change your Level 4 readiness.

The full tables remain the scoring surface. This path only gives a stopping point when time is short.

## Deterministic audit boundary

This checklist aims for reproducible findings, not identical text. Timestamps, command order, and short excerpts may differ. A finding is reproducible when another auditor can confirm the same status and evidence using the same `spec_source`, `audited_commit`, external-service access, and equivalent commands.

For hosted-platform or SaaS settings, record the exact API command or UI path, authenticated actor or role, and timestamped output excerpt in the audit log. A fresh local checkout cannot reproduce branch protection, required status checks, secret scanning, deployment environments, or repository security settings.

<!-- END:TEMPLATE-ONLY -->

---

## Conformance level summary

> `Status` is stamped automatically by `audit-stamp.ts` from the per-row tables below. Fill `Date reached` only when a level is first claimed as `✅ Yes`; the stamper preserves it while the level remains reached and clears it if the level drops. Edit `Notes` with blockers or review context. `Partial` means one or more rows at that level are `Alarm` or `Warning`; record the blockers in **Notes** and list them in the root backlog.

| Level                          | Status        | Date reached | Notes        |
| ------------------------------ | ------------- | ------------ | ------------ |
| **Level 0 — Baseline Hygiene** | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 1 — Hardened**         | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 2 — AI Assisted**      | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 3 — AI Authored**      | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 4 — AI Autonomous**    | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |

### Deriving `conformance_level`

`audit-stamp.ts` derives `conformance_level` from the table above:

1. Complete every checklist row first.
2. Run the stamper so each summary **Status** is derived from the checklist tables.
3. The stamper sets `conformance_level` to the numeric value of the **highest** level whose **Status** is `✅ Yes`.
4. If no level row is `✅ Yes`, the stamper sets `none`.
5. Never claim a level whose row is not `✅ Yes`, even if most requirements are met.

The frontmatter value and the summary table `MUST` agree; a mismatch is an audit defect. To advertise the level with a README badge, see [the badge section in the spec README](../README.md#display-your-level).

## Backlog — what to address first

> `Priority`, `Level`, `Rule`, `Scope`, and `Current status` are stamped automatically by `audit-stamp.ts` from the full checklist. Edit only `Next action`, `Owner`, and `Target date`.

Populate this table from **every** checklist row where **Status** is `Alarm` or `Warning`. Do not drop rows for brevity. This keeps audits reproducible.

**Priority tiers** (the `Priority` column is the tier number, **not** a sequential unique rank — ties are expected and correct):

1. `MUST` at `Alarm` — repository fails on an unconditional requirement.
2. `MUST when applicable` at `Alarm` — the requirement applies to the repository and is unmet.
3. `MUST` at `Warning` — partial coverage or drift risk on an unconditional requirement.
4. `MUST when applicable` at `Warning`.
5. `SHOULD` at `Alarm` / `Warning` — each unmet `SHOULD` needs a documented reason in its Comment to count toward Level 4.

**Ordering rules** (deterministic so two auditors produce the same row order):

- Primary: ascending by `Level` (`L0`, then `L1`, through `L4`).
- Secondary: ascending by `Priority` (tier 1 first, tier 5 last).
- Tertiary: alphabetical by **Rule** name (case-insensitive).
- `MAY` rows are **not** listed here even if at `Alarm` / `Warning`; `MAY` is optional and tracked only in the full checklist.

**Cell conventions:**

- `Priority` — severity tier, not a unique rank.
- `Level` — conformance level this row affects in the step-by-step backlog.
- `Scope` — one of `MUST`, `MUST when applicable`, `SHOULD`. No parentheticals.
- `Current status` — the emoji-prefixed status from the full checklist (`🚨 Alarm` or `⚠️ Warning`).
- `Next action` — the concrete remediation; reuse wording from the checklist Comment when appropriate.
- `Owner` — handle or team (e.g. `@org/team`); leave blank if unknown.
- `Target date` — ISO date (`YYYY-MM-DD`) or blank if unknown. Do **not** write `TBD`, `n/a`, or similar filler.

| Priority | Level | Rule | Scope | Current status | Next action | Owner | Target date |
|----------|-------|------|-------|----------------|-------------|-------|-------------|
| | | | | | | | |

Once a rule reaches `Fulfilled` or `Not relevant` in the checklist, it disappears from this backlog on the next stamp run.

## Checklist row tables

**Pillar legend.** The `Pillar` column in each table below holds the pillar number 1–7. The names, clause ranges, and scope summaries are defined once in [`AI-CONTRIBUTOR-SPECIFICATION.md` § Pillars](../AI-CONTRIBUTOR-SPECIFICATION.md#pillars). The pillar taxonomy is non-normative — it is a reader's map, not an additional requirement.

**Scope legend.** `MUST` rows are unconditional at that level. `MUST when applicable` rows are required only when their trigger applies. `SHOULD` rows must be resolved for Level 4. `MAY` rows are optional and never required for conformance.

## Level 0 — Baseline Hygiene

Level 0 contains seven unconditional normative MUST IDs represented by five checklist rows because `Pinned Toolchain` groups runtime, package-manager, and lockfile pinning. The `Env Template` row remains a Level 0 requirement when its environment-variable trigger applies.

| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |
|-------|------|---|--------|---------|-------------|--------|-----|
| `MUST` | `Clean Setup` | - |  |  | The project can be set up and run from a clean clone using documented commands. | 1 | `AIC-clean-clone-bootstrap` |
| `MUST` | `Pinned Toolchain` | - |  |  | Runtime version, package manager version, and lockfile are pinned. | 1 | `AIC-lockfile-committed`, `AIC-package-manager-pinned`, `AIC-runtime-version-pinned` |
| `MUST` | `Formatting` | - |  |  | Formatting is automated and enforced. | 1 | `AIC-formatting-automated` |
| `MUST` | `Credential Documentation` | - |  |  | Credential handling — how contributors and automation obtain and use credentials — is documented in a durable location reachable from the repository root. | 2 | `AIC-credential-handling-documented` |
| `MUST` | `Secret Hygiene` | - |  |  | Secrets and local environment files are excluded from version control. | 2 | `AIC-secret-vcs-exclude` |
| `MUST when applicable` | `Env Template` | - |  |  | **Triggered when:** the repository requires contributor-supplied or runtime environment variables. **Requirement:** example environment files contain placeholders only. | 2 | `AIC-env-example-placeholders` |

## Level 1 — Hardened

| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |
|-------|------|---|--------|---------|-------------|--------|-----|
| `MUST` | `Lockfile CI Enforcement` | - |  |  | CI rejects changes that would invalidate the committed lockfile (for example via `--frozen-lockfile`, `npm ci`, `pip --require-hashes`, or equivalent). | 1 | `AIC-lockfile-enforced-in-ci` |
| `MUST` | `Lockfile Integrity` | - |  |  | Dependency lockfiles include integrity hashes where the ecosystem supports them, and CI fails on verification errors. | 1 | `AIC-lockfile-integrity-hashes` |
| `MUST` | `Dependency Hygiene` | - |  |  | Circular dependencies, dead code, and unsafe imports are blocked. | 1 | `AIC-dead-code-and-cycles-surfaced` |
| `MUST` | `Lint Rules` | - |  |  | Linting enforces correctness, not only formatting. | 1 | `AIC-lint-correctness-rules` |
| `MUST` | `Strict Types` | - |  |  | Strict typing or equivalent compile-time correctness checks are enabled. | 1 | `AIC-strict-typing-enabled` |
| `MUST` | `Architecture Boundaries` | - |  |  | Layer boundaries and allowed dependency directions are explicit and enforced. | 1 | `AIC-architecture-rules-automated`, `AIC-dependency-directions-explicit`, `AIC-layer-responsibilities-defined`, `AIC-shared-layer-import-protection` |
| `MUST` | `CI Gates` | - |  |  | CI runs the full guardrail suite on protected branches. | 1 | `AIC-ci-guardrail-suite`, `AIC-ci-pinned-toolchain`, `AIC-protected-branch-status-checks` |
| `MUST` | `Pre-Commit` | - |  |  | Pre-commit hooks run meaningful checks. | 1 | `AIC-precommit-meaningful-checks` |
| `MUST` | `Secret Scanning` | - |  |  | Automated secret detection is enabled. | 2 | `AIC-secret-scanning-enabled` |
| `MUST` | `Credential Leakage Checks` | - |  |  | The repository has automated checks or tests that detect privileged credentials appearing in untrusted client code or roles being checked in the wrong layer. | 2 | `AIC-credential-leakage-checks` |
| `MUST` | `Real Auth Boundary` | - |  |  | Authorization is enforced on the server or data layer, not only in the client. | 2 | `AIC-authz-trusted-layer`, `AIC-no-privileged-creds-in-client` |
| `MUST` | `Invariants` | - |  |  | Critical system invariants are documented and testable. | 3 | `AIC-invariants-documented`, `AIC-invariants-executable` |
| `MUST` | `Runtime Validation` | - |  |  | Config files and external inputs are validated at runtime. | 3 | `AIC-input-validation` |
| `MUST` | `Test Layers` | - |  |  | Appropriate automated test layers cover critical behavior; repositories use more than one test style where the architecture warrants it. | 3 | `AIC-critical-behavior-tested`, `AIC-multiple-test-layers` |
| `MUST` | `Branch Protection` | - |  |  | Protected branches and required checks are enabled. | 4 | `AIC-default-branch-protected`, `AIC-required-checks-and-reviews`, `AIC-risky-change-ownership` |
| `MUST` | `Human Review Required` | - |  |  | Required-review approvals on protected branches come from human reviewers; bot or agent accounts do not satisfy required-review counts and do not merge their own pull requests. | 4 | `AIC-human-review-required` |
| `MUST` | `Human Approval` | - |  |  | Risky actions require explicit human confirmation. | 7 | `AIC-human-approval-baseline`, `AIC-no-silent-destructive-actions` |
| `MUST` | `Authoritative Guardrail Doc` | - |  |  | Guardrails are documented in one authoritative place (may be combined with the `AI Instructions` file). | 7 | `AIC-authoritative-guardrail-doc` |
| `MUST` | `Gate Enforcement` | - |  |  | Automated checks counted as enforcing a requirement block the change path on failure; jobs configured to continue on failure or mask non-zero results are labelled advisory and not counted toward `MUST` items. | 7 | `AIC-gate-enforcement` |
| `MUST` | `Machine vs Manual Guardrails` | - |  |  | The repository distinguishes machine-enforced guardrails from review-only or process-based ones. | 7 | `AIC-guardrail-failure-surface`, `AIC-machine-vs-manual-guardrails` |
| `MUST` | `Threshold Enforcement` | - |  |  | Thresholds, budgets, and limits declared in configuration are evaluated by an automated check on every change path that claims them; declared-but-unevaluated configs are not counted as automatic guardrails. | 7 | `AIC-threshold-enforcement` |
| `MUST` | `Policy Ownership` | - |  |  | The adopted specification has a named owner, a review cadence, and a change-control process. | 7 | `AIC-policy-change-review`, `AIC-policy-living-document`, `AIC-policy-owner-cadence` |
| `MUST when applicable` | `Deterministic Build Order` | - |  |  | **Triggered when:** the repository contains more than one package. **Requirement:** packages build, test, and lint in dependency order so a downstream package never compiles against a stale upstream artifact (e.g. `pnpm -r --sort run build`, `nx affected`, Turborepo task graph). | 1 | `AIC-deterministic-build-order` |
| `MUST when applicable` | `Push Protection` | - |  |  | **Triggered when:** the repository host supports push-time secret blocking. **Requirement:** secret leaks are blocked at push time. | 2 | `AIC-push-protection-enabled` |
| `MUST when applicable` | `Dependency Review` | - |  |  | **Triggered when:** pull requests can change dependencies. **Requirement:** dependency-changing PRs are reviewed automatically or through enforced workflow steps. | 2 | `AIC-dependency-review-visibility` |
| `MUST when applicable` | `Dependency Security` | - |  |  | **Triggered when:** the repository has dependencies supported by vulnerability detection tooling. **Requirement:** vulnerable dependencies are detected and tracked. | 2 | `AIC-dependency-vuln-detection` |
| `MUST when applicable` | `SAST` | - |  |  | **Triggered when:** the repository uses languages and platforms supported by security-focused static analysis. **Requirement:** SAST runs in CI. | 2 | `AIC-sast-in-ci` |
| `MUST when applicable` | `Data Integrity Constraints` | - |  |  | **Triggered when:** the repository owns a database schema and the persistence layer supports constraints. **Requirement:** persistence-layer data integrity constraints (foreign keys, unique constraints, NOT NULL, check constraints) exist where supported. | 2 | `AIC-data-integrity-constraints` |
| `MUST when applicable` | `Deployment Protection` | - |  |  | **Triggered when:** the repository has production deployment paths. **Requirement:** production deployment paths are protected from arbitrary execution and unauthorized triggering. | 2 | `AIC-prod-deploy-protected` |
| `MUST when applicable` | `Workflow Security` | - |  |  | **Triggered when:** the repository uses CI/CD workflows or deployment credentials. **Requirement:** CI/CD tokens use least privilege and deployment credentials are short-lived where possible. | 2 | `AIC-short-lived-deploy-creds`, `AIC-workflow-token-least-privilege` |
| `MUST when applicable` | `Threat Model` | - |  |  | **Triggered when:** the repository is security-sensitive, internet-facing, regulated, or multi-tenant. **Requirement:** the system undergoes threat modeling or security design review with a reviewable artifact and review date. | 2 | `AIC-threat-model-artifact`, `AIC-threat-model-required`, `AIC-threat-model-review-date` |
| `MUST when applicable` | `Coverage Floor` | - |  |  | **Triggered when:** coverage is used as a guardrail. **Requirement:** thresholds exist and are treated as a minimum only. | 3 | `AIC-coverage-as-minimum` |
| `MUST when applicable` | `Accessibility` | - |  |  | **Triggered when:** the repository ships a UI or shared UI components. **Requirement:** shared UI components are checked for accessibility issues and reviewed/tested where interaction complexity warrants it. | 3 | `AIC-a11y-component-checks`, `AIC-a11y-review-testing` |
| `MUST when applicable` | `Failure Handling` | - |  |  | **Triggered when:** the repository includes production code or runtime paths where failure handling affects users, data integrity, security, or automation. **Requirement:** error handling, retries, and safe fallbacks are implemented where needed. | 3 | `AIC-failure-handling-explicit`, `AIC-retries-backoff-deliberate` |
| `MUST when applicable` | `Observability` | - |  |  | **Triggered when:** the repository operates a service, app, worker, proxy, or production runtime that emits logs, telemetry, traces, or error reports. **Requirement:** operational visibility exists and secrets, credentials, and personally identifiable information are redacted from logs, telemetry, traces, and ordinary error reports. AI-specific prompts, agent transcripts, tool outputs, and AI-related error reports are covered by `AI Surface Redaction` at Level 2. | 3 | `AIC-observability-redaction` |
| `MUST when applicable` | `Performance Budget` | - |  |  | **Triggered when:** the repository ships a user-facing system. **Requirement:** user-facing systems define and enforce performance budgets. | 3 | `AIC-performance-budgets` |
| `MUST when applicable` | `Reliability Targets` | - |  |  | **Triggered when:** the repository operates services or critical applications. **Requirement:** services and critical applications define SLIs, SLOs, or equivalent reliability expectations. | 3 | `AIC-reliability-expectations` |
| `MUST when applicable` | `SBOM` | - |  |  | **Triggered when:** the repository ships artifacts. **Requirement:** a software bill of materials can be generated and release dependencies can be identified. | 4 | `AIC-release-dependency-identification`, `AIC-sbom-generation` |
| `MUST when applicable` | `CODEOWNERS` | - |  |  | **Triggered when:** the repository has sensitive paths. **Requirement:** sensitive paths have explicit ownership. | 4 | `AIC-sensitive-path-ownership` |
| `MUST when applicable` | `Security Policy` | - |  |  | **Triggered when:** the repository is public or externally consumed. **Requirement:** a `SECURITY.md` or equivalent disclosure process exists. | 4 | `AIC-vuln-disclosure-path` |

## Level 2 — AI Assisted

Level 2 is the AI-declared level. Every row below is required to formally declare AI as part of the repository's contribution workflow, or to close a feature-triggered risk control for AI-assisted work.

| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |
|-------|------|---|--------|---------|-------------|--------|-----|
| `MUST` | `AI Boundaries` | - |  |  | The instruction file defines forbidden actions, approval points, core workflows, and architectural constraints. | 5 | `AIC-ai-forbidden-actions`, `AIC-ai-instruction-boundaries`, `AIC-ai-instruction-coverage` |
| `MUST` | `AI Instructions` | - |  |  | The repository has one authoritative, versioned instruction file for AI agents and human contributors. | 5 | `AIC-ai-instruction-authoritative` |
| `MUST` | `Single AI Source` | - |  |  | Tool-specific instruction files (for example `.github/copilot-instructions.md`, `CLAUDE.md`, `.cursorrules`) are either absent or contain only a pointer to the authoritative file (commonly `AGENTS.md`). | 5 | `AIC-tool-specific-pointer-only` |
| `MUST` | `AI Data Classification` | - |  |  | Data flowing through AI agents and tools is classified: source code, secrets, customer data, regulated data, telemetry, and equivalent repository-specific classes. | 6 | `AIC-ai-data-classification` |
| `MUST` | `AI Surface Redaction` | - |  |  | Secrets, credentials, and personally identifiable information are redacted from AI-specific surfaces (prompts, agent transcripts, tool outputs, and AI-related error reports), extending the §13 observability redaction requirement to AI workflows. | 6 | `AIC-ai-surface-redaction` |
| `MUST` | `AI Authorship Traceability` | - |  |  | A mechanism exists (commit trailer, PR label, metadata field, or equivalent) to identify materially AI-authored commits or pull requests after the fact. | 7 | `AIC-ai-authorship-traceability` |
| `MUST` | `AI Output Licensing` | - |  |  | A durable document declares whether AI-generated code, docs, and tests are accepted, and under what license they are contributed. | 7 | `AIC-ai-output-licensing-declaration` |
| `MUST when applicable` | `Shared Skills` | - |  |  | **Triggered when:** the repository uses shared skills, slash commands, or reusable AI workflow modules. **Requirement:** shared skills are versioned, reviewed, owned, and scoped. | 5 | `AIC-shared-skills-versioned`, `AIC-skill-code-review`, `AIC-skill-contract-defined` |
| `MUST when applicable` | `Skill Safety` | - |  |  | **Triggered when:** the repository uses shared skills. **Requirement:** shared skills do not contain secrets and do not bypass required human approval for risky actions. The bypass-prohibition normative ID lives at §23 `AIC-no-silent-destructive-actions`, scored on the `Human Approval` row. | 5 | `AIC-skill-no-secrets` |
| `MUST when applicable` | `MCP Allowlist` | - |  |  | **Triggered when:** the repository uses MCP servers for team workflows. **Requirement:** only approved MCP servers are enabled, and every approved server has a defined owner and purpose. | 5 | `AIC-mcp-allowlist`, `AIC-mcp-owner-purpose` |
| `MUST when applicable` | `MCP Auth Security` | - |  |  | **Triggered when:** the repository uses OAuth- or token-based MCP integrations. **Requirement:** integrations follow secure token storage, redirect handling, and short-lived credential practices where supported. | 5 | `AIC-mcp-auth-security` |
| `MUST when applicable` | `MCP Least Privilege` | - |  |  | **Triggered when:** the repository uses MCP tools or servers. **Requirement:** MCP tools and servers are permission-scoped and separated by risk level; write-capable MCP servers are distinguishable from read-only ones. | 5 | `AIC-mcp-least-privilege`, `AIC-mcp-write-vs-read-distinguishable` |
| `MUST when applicable` | `MCP Root Scoping` | - |  |  | **Triggered when:** MCP servers expose filesystem roots or other resources. **Requirement:** roots and accessible resources are deliberately limited to approved workspaces or data sources. | 5 | `AIC-mcp-root-scoping` |
| `MUST when applicable` | `Agent Isolation` | - |  |  | **Triggered when:** the repository uses parallel agents. **Requirement:** parallel agents do not edit overlapping files unless coordination is explicitly designed. | 5 | `AIC-agent-parallel-isolation` |
| `MUST when applicable` | `Agent Permissions` | - |  |  | **Triggered when:** the repository uses autonomous, delegated, or tool-using agents. **Requirement:** agents have explicit tool, write, and approval limits. | 5 | `AIC-agent-permission-limits` |
| `MUST when applicable` | `Agent Scope` | - |  |  | **Triggered when:** the repository uses autonomous or delegated agents. **Requirement:** agents have explicit role, scope, ownership, and success boundaries, and agent-produced changes pass the same quality gates as any other code contribution. The bypass-prohibition normative ID lives at §23 `AIC-no-silent-destructive-actions`, scored on the `Human Approval` row. | 5 | `AIC-agent-quality-gates`, `AIC-agent-scope-defined` |
| `MUST when applicable` | `Agent Traceability` | - |  |  | **Triggered when:** material agent actions occur. **Requirement:** every material agent action records agent identity, model identifier + model-version ID, prompt or skill version (SHA or tag), ISO 8601 timestamp, and action category (read / write / merge / deploy / settings-change / external-call). The record lives in the same location as `Prompt Audit Trail` and can be queried by agent, category, and time range. Prose-only attribution is not enough. | 5 | `AIC-agent-action-traceability` |
| `MUST when applicable` | `AI Context Retention` | - |  |  | **Triggered when:** the repository retains AI conversation context, tool outputs, or training-adjacent data. **Requirement:** retention limits and sanitization rules exist for that retained AI context and output. | 6 | `AIC-ai-context-retention` |
| `MUST when applicable` | `AI Dependency Verification` | - |  |  | **Triggered when:** AI workflows can suggest or introduce dependency additions. **Requirement:** dependency additions are verified against canonical registries and ownership before use. | 6 | `AIC-ai-dependency-verification` |
| `MUST when applicable` | `AI Provider Allowlist` | - |  |  | **Triggered when:** work routes to external AI providers or models. **Requirement:** approved AI providers and models are listed with their approval scope (permitted data classes and action categories), and AI workflows only route to listed entries. | 6 | `AIC-ai-provider-allowlist` |
| `MUST when applicable` | `Capability Scoping` | - |  |  | **Triggered when:** agents or tool-using assistants are exposed to untrusted input. **Requirement:** tool, read, and write capabilities are constrained to the user's requested task at the permission layer, not by model self-policing. | 6 | `AIC-capability-scoping` |
| `MUST when applicable` | `Non-English Filter Coverage` | - |  |  | **Triggered when:** AI-exposed surfaces serve users in languages other than English and filter-based or classifier-based controls are claimed. **Requirement:** those controls have verified coverage in the served languages, or the control's scope is recorded as English-only. | 6 | `AIC-non-english-filter-coverage` |
| `MUST when applicable` | `Risk-Matched Controls` | - |  |  | **Triggered when:** a control is claimed as mitigation for a specific AI risk class such as prompt injection, data exfiltration, PII leakage, profanity, or toxicity. **Requirement:** the control is evaluated against that risk class and backed by adaptive or human-in-the-loop evaluation, not static benchmarks alone. | 6 | `AIC-risk-matched-controls` |
| `MUST when applicable` | `Untrusted Agent Input` | - |  |  | **Triggered when:** AI workflows consume external content such as issues, PR comments, fetched URLs, retrieved documents, dependency metadata, logs, or tool outputs. **Requirement:** external content is treated as untrusted input and trusted channels are classified. | 6 | `AIC-trusted-channel-classification`, `AIC-untrusted-agent-input` |
| `MUST when applicable` | `AI Provider Data Gate` | - |  |  | **Triggered when:** AI workflows can expose regulated or secret data to provider context windows. **Requirement:** regulated or secret data does not enter any provider that is not explicitly approved for that data class. | 6 | `AIC-regulated-data-provider-gate` |
| `MUST when applicable` | `Regulated Data Controls` | - |  |  | **Triggered when:** regulated data can flow through AI providers or external tools, or when data-residency requirements apply. **Requirement:** legal basis, controls, and data-residency guarantees are documented and verified for regulated data flowing through AI providers or external tools. | 6 | `AIC-data-residency-verified`, `AIC-regulated-data-controls` |
| `MUST when applicable` | `AI Authorship Disclosure` | - |  |  | **Triggered when:** the repository accepts contributions from outside the documented contributor group. **Requirement:** publish and enforce a disclosure policy for materially AI-authored PRs; the policy defines what counts as materially AI-authored, how authorship is declared, and how missing or incorrect declarations are handled. | 7 | `AIC-ai-authorship-disclosure-policy` |
| `MUST when applicable` | `Prompt Audit Trail` | - |  |  | **Triggered when:** AI materially authors code that ships, including AI-generated changes accepted by humans at Level 2. **Requirement:** every material AI-generated change records the model identifier, prompt or system-prompt version, and any skill version used, in a documented and queryable form. This makes `AI Authorship Traceability` concrete and supports `Agent Rollback Procedure`. | 7 | `AIC-prompt-audit-trail` |

## Level 3 — AI Authored

For any Level 3 claim, the Level 2 `Prompt Audit Trail` row is always applicable because Level 3 means AI materially authors code that ships.

| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |
|-------|------|---|--------|---------|-------------|--------|-----|
| `MUST when applicable` | `Agent Cost Ceiling` | - |  |  | **Triggered when:** the repository pays per-token or per-call for agent work. **Requirement:** paid agent workloads have a documented cost ceiling or kill switch. | 6 | `AIC-agent-cost-ceiling` |
| `MUST when applicable` | `Boundary Schema Validation` | - |  |  | **Triggered when:** agent-authored code consumes an external API, SDK, or data source whose wire shape is not enforced by the transport. **Requirement:** responses are validated against a runtime schema at the boundary, independent of the declared type signature. | 6 | `AIC-boundary-schema-validation` |
| `MUST when applicable` | `Classifier-Only Controls Excluded` | - |  |  | **Triggered when:** LLM-filter classifiers or prompt-level refusal instructions are claimed as controls for prompt injection, jailbreaking, destructive, security-sensitive, or release-affecting actions. **Requirement:** those classifiers or instructions are not counted alone as controls for any `MUST` clause; they may appear as telemetry or secondary signals only. | 6 | `AIC-classifier-only-controls-excluded` |
| `MUST when applicable` | `Code-Test Independence Check` | - |  |  | **Triggered when:** one agent session authors both an implementation and its tests. **Requirement:** an independent verification mechanism is applied, such as mutation testing, property-based tests, or independent review of the tests by a reviewer who did not author them. | 6 | `AIC-code-test-independence` |
| `MUST when applicable` | `Prompt Versioning` | - |  |  | **Triggered when:** the repository authors system prompts, agent instructions, or shared skills that materially affect agent behavior. **Requirement:** they are versioned in the repository and reviewed like code. | 6 | `AIC-prompt-versioning-review` |
| `MUST when applicable` | `Agent Credential Approval` | - |  |  | **Triggered when:** agents can rotate or revoke credentials affecting production systems or sensitive sinks. **Requirement:** an agent is not the sole approver; approval comes from a human reviewer. | 7 | `AIC-agent-credential-not-sole-approver` |
| `MUST when applicable` | `Agent Credential Audit` | - |  |  | **Triggered when:** agents can create, rotate, or revoke credentials. **Requirement:** each agent-initiated credential operation produces a durable audit record naming the agent, human approver, credential class, and scope of change. | 7 | `AIC-agent-credential-audit` |
| `MUST when applicable` | `Agent Credential Scope` | - |  |  | **Triggered when:** agents can create, rotate, or revoke credentials. **Requirement:** allowed credential classes are enumerated, and operations outside that enumeration are not permitted. | 7 | `AIC-agent-credential-class-scope` |
| `MUST when applicable` | `Allowlist Rescope on Terms Change` | - |  |  | **Triggered when:** a vendor changes the data classifications or action categories an allowlist entry was approved for. **Requirement:** the entry's approval scope is re-evaluated before agent workflows continue using it. | 7 | `AIC-allowlist-rescope-on-terms-change` |
| `MUST when applicable` | `No Routing Past EOL` | - |  |  | **Triggered when:** an allowlisted provider or model is deprecated or sunset. **Requirement:** agent workflows do not continue routing to it past its end-of-life date without explicit re-approval recorded against the AI provider allowlist. | 7 | `AIC-no-routing-past-eol` |
| `MUST when applicable` | `Provider Deprecation Procedure` | - |  |  | **Triggered when:** the repository has allowlisted providers or models. **Requirement:** a documented procedure exists for evaluating an allowlist entry when the vendor announces deprecation, sunset, ownership change, or material terms-of-service change — naming who decides, on what evidence, and within what window. | 7 | `AIC-provider-deprecation-procedure` |
| `MUST when applicable` | `AI Incident Definition` | - |  |  | **Triggered when:** the repository operates AI agents in production paths. **Requirement:** the repository defines what counts as an AI-attributable incident, who triages it, and what evidence is preserved. | 7 | `AIC-ai-incident-definition` |
| `MUST when applicable` | `AI Incident Review` | - |  |  | **Triggered when:** an AI-attributable incident occurs. **Requirement:** a review identifies the agent action that caused harm, the control that should have prevented it, and whether that control existed, was bypassed, or was missing. | 7 | `AIC-ai-incident-review` |
| `MUST when applicable` | `Incident Guardrail Update` | - |  |  | **Triggered when:** an AI incident review identifies a missing or weakened control. **Requirement:** guardrail documentation is updated to reflect the new or strengthened control before similar agent work resumes. | 7 | `AIC-incident-guardrail-update` |

## Level 4 — AI Autonomous

| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |
|-------|------|---|--------|---------|-------------|--------|-----|
| `MUST when applicable` | `Agent Escalation Triggers` | - |  |  | **Triggered when:** the repository operates an autonomous runner. **Requirement:** autonomous workflows define and enforce pre-action escalation triggers for destructive, security-sensitive, release-affecting, high-volume, or repeatedly failing actions, including per-window action limits, a named owner, and a response expectation or SLA. | 5 | `AIC-agent-escalation-trigger-enforcement` |
| `MUST when applicable` | `Agent Kill Switch` | - |  |  | **Triggered when:** the repository operates an autonomous runner. **Requirement:** a single documented action immediately halts it — disables the execution path AND revokes the runner's credentials — and is exercisable without a code change. Complements `Agent Cost Ceiling` (cost runaway) by addressing content runaway. | 5 | `AIC-agent-kill-switch` |
| `MUST when applicable` | `Agent Rollback Procedure` | - |  |  | **Triggered when:** the repository operates an autonomous runner. **Requirement:** a rollback procedure for runner-merged content leans on the authorship-traceability mechanism so runner commits, releases, and settings changes are mechanically identifiable for revert. | 5 | `AIC-agent-rollback-procedure` |
| `SHOULD` | `Heavy Build Prerequisites` | - |  |  | Heavy builds document memory, CPU, or platform prerequisites. | 1 | `AIC-heavy-build-prerequisites` |
| `SHOULD` | `Platform Targets` | - |  |  | Browser, runtime, and platform targets are explicit. | 1 | `AIC-platform-targets-explicit` |
| `SHOULD` | `Ban Unsafe Escape Hatches` | - |  |  | The repository bans unsafe escape hatches such as untyped `any` unless explicitly justified. | 1 | `AIC-ban-unsafe-escape-hatches` |
| `SHOULD` | `Debug Statement Hygiene` | - |  |  | Ad-hoc debug emitters (`console.log`, `print`, `dump`, language-equivalent) are flagged or blocked by lint, leaving structured logging from `Observability` as the only sanctioned output path. | 1 | `AIC-debug-statement-lint` |
| `SHOULD` | `Naming and Export Conventions` | - |  |  | Naming and export conventions are enforced where consistency materially improves maintenance. | 1 | `AIC-naming-export-conventions` |
| `SHOULD` | `Boundary Tests` | - |  |  | Boundary tests or scans complement linter rules for architectural boundaries. | 1 | `AIC-boundary-tests` |
| `SHOULD` | `Coupling Review Checklist` | - |  |  | A review checklist exists for coupling risks that tooling cannot catch. | 1 | `AIC-coupling-review-checklist` |
| `SHOULD` | `Expensive Jobs Explicit` | - |  |  | Expensive jobs are separated intentionally rather than omitted silently. | 1 | `AIC-expensive-jobs-explicit` |
| `SHOULD` | `Fast Iteration Path` | - |  |  | A fast-iteration command path (for example scoped tests, changed-file lint, or per-package verify scripts) is available so intermediate work can be validated cheaply without running the full guardrail suite on every iteration. | 1 | `AIC-fast-iteration-path` |
| `SHOULD` | `Local-CI Alignment` | - |  |  | The local and CI quality bars stay closely aligned. | 1 | `AIC-local-ci-aligned` |
| `SHOULD` | `Credential Rotation` | - |  |  | Credential rotation procedures are documented in the same location as credential handling. | 2 | `AIC-credential-rotation-documented` |
| `SHOULD` | `Custom Secret Patterns` | - |  |  | Organization-specific secrets are covered by custom detection patterns. | 2 | `AIC-custom-secret-patterns` |
| `SHOULD` | `Mock Mode` | - |  |  | The project offers a safe local mode that avoids requiring live credentials during onboarding. | 2 | `AIC-mock-mode-fallback` |
| `SHOULD` | `Automated Dependency Updates` | - |  |  | Supported dependency ecosystems receive automated update PRs. | 2 | `AIC-automated-dep-updates` |
| `SHOULD` | `License Compliance Automation` | - |  |  | Repositories with legal distribution constraints automate license checks. | 2 | `AIC-license-review-automation` |
| `SHOULD` | `Vuln Alert Ownership` | - |  |  | Unresolved vulnerability alerts have tracked ownership. | 2 | `AIC-vuln-alert-ownership` |
| `SHOULD` | `Sensitive Write Paths Owned` | - |  |  | Security-sensitive write paths have explicit ownership, auditability, and narrow interfaces. | 2 | `AIC-sensitive-write-paths-owned` |
| `SHOULD` | `Action Version Pinned` | - |  |  | Third-party GitHub Actions are referenced by a tagged version or release ref (for example `@v6`) rather than a floating branch ref like `@main` or `@master`, so what runs in CI is bounded by deliberate bumps. | 2 | `AIC-action-version-pinned` |
| `SHOULD` | `Deployment Protection Rules` | - |  |  | Production deployments require approval or environment protection rules. | 2 | `AIC-deploy-env-approvals` |
| `SHOULD` | `OIDC Federation` | - |  |  | OIDC or equivalent identity federation is used instead of long-lived cloud secrets. | 2 | `AIC-oidc-federation` |
| `SHOULD` | `Workflow Change Review` | - |  |  | Workflow file changes receive extra-scrutiny review. | 2 | `AIC-workflow-change-review` |
| `SHOULD` | `Security Design Reviews` | - |  |  | Architecture changes that affect trust boundaries are reviewed explicitly. | 2 | `AIC-threat-model-revisit` |
| `SHOULD` | `Fail Fast Diagnostics` | - |  |  | The repository fails fast on invalid inputs and emits actionable diagnostics. | 3 | `AIC-fail-fast-diagnostics` |
| `SHOULD` | `Structural vs Semantic Validation` | - |  |  | Validation layers separate structural validity from semantic validity. | 3 | `AIC-structural-vs-semantic-validation` |
| `SHOULD` | `Excluded Suites Documented` | - |  |  | Environment-specific or excluded test suites are explicitly documented. | 3 | `AIC-excluded-suites-documented` |
| `SHOULD` | `Test Against Built Artifact` | - |  |  | End-to-end and acceptance tests execute against the same artifact the repository ships (production build output, container image, published package), not the development server alone. | 3 | `AIC-e2e-built-artifact` |
| `SHOULD` | `Test Assertion Effectiveness` | - |  |  | Where coverage is used as a gate, test-suite strength is assessed through an independent mechanism (mutation testing, property-based tests, or independent review) — coverage alone does not distinguish effective assertions from ones that pass trivially. | 3 | `AIC-test-strength-independent` |
| `SHOULD` | `Test Network Isolation` | - |  |  | Integration and end-to-end tests do not reach live external networks or shared production-like services by default; they run against in-process mocks, recorded fixtures, or sandboxed substitutes, with any deviation explicitly opted in. | 3 | `AIC-test-network-isolation` |
| `SHOULD` | `Tests Colocated` | - |  |  | Tests are located close to the code they protect. | 3 | `AIC-tests-colocated` |
| `SHOULD` | `A11y Helpers` | - |  |  | UI repositories provide shared accessibility test helpers. | 3 | `AIC-a11y-helpers` |
| `SHOULD` | `A11y Keyboard Focus` | - |  |  | Keyboard behavior and focus management are covered where interaction complexity warrants it. | 3 | `AIC-a11y-keyboard-focus` |
| `SHOULD` | `Alert Ownership` | - |  |  | Clear ownership exists for alerts, logs, and operational visibility. | 3 | `AIC-alert-ownership` |
| `SHOULD` | `Preserve User Work` | - |  |  | User work is preserved locally or durably when silent data loss would be unacceptable. | 3 | `AIC-preserve-user-work` |
| `SHOULD` | `Structured Error Patterns` | - |  |  | Structured error handling patterns are defined. | 3 | `AIC-structured-error-patterns` |
| `SHOULD` | `Error Budgets` | - |  |  | Reliability targets have operational consequences when missed. | 3 | `AIC-reliability-consequences` |
| `SHOULD` | `Performance Budgets Automated` | - |  |  | Performance budgets are measurable in automation. | 3 | `AIC-budgets-automated` |
| `SHOULD` | `Build Origin Records` | - |  |  | Repositories that ship artifacts or releases provide provenance or attestations when consumers need supply-chain trust. | 4 | `AIC-build-immutable-refs`, `AIC-build-provenance-attestation` |
| `SHOULD` | `Release from CI` | - |  |  | Official releases are produced from CI, not from developer workstations. | 4 | `AIC-release-from-ci` |
| `SHOULD` | `CODEOWNERS Coverage` | - |  |  | Path-level ownership covers auth, infrastructure, workflow, deployment, and policy files (for example a `CODEOWNERS` file on platforms that support it). | 4 | `AIC-codeowners-coverage` |
| `SHOULD` | `CODEOWNERS Self-Owned` | - |  |  | The ownership manifest itself has an owner. | 4 | `AIC-codeowners-self-owned` |
| `SHOULD` | `Deployment Separation` | - |  |  | Preview and production deployments are separated. | 4 | `AIC-deployment-separation` |
| `SHOULD` | `AI Instructions Discoverable` | - |  |  | AI-facing instructions are concise, current, and linked from contributor documentation; the authoritative source stays under roughly 300 lines as a working ceiling. | 5 | `AIC-ai-instructions-discoverable` |
| `SHOULD` | `AI Workflow Standardization` | - |  |  | Common AI tasks such as implementation, review, release, and PR creation follow documented workflows. | 5 | `AIC-ai-workflow-standardization` |
| `SHOULD` | `Skill Shared vs Personal` | - |  |  | Project-shared skills are separated from personal-only helpers. | 5 | `AIC-skill-shared-vs-personal` |
| `SHOULD` | `Skill Usage Examples` | - |  |  | Shared skills include usage examples for high-risk or non-obvious workflows. | 5 | `AIC-skill-usage-examples` |
| `SHOULD` | `MCP Auditability` | - |  |  | The team can identify which external systems and write-capable actions AI agents can access through MCP. | 5 | `AIC-mcp-auditability` |
| `SHOULD` | `MCP Env Separation` | - |  |  | Dev, staging, and production MCP connectors are separated when they touch operational systems. | 5 | `AIC-mcp-env-separation` |
| `SHOULD` | `MCP Pinned Versions` | - |  |  | MCP servers are pinned to known versions or controlled deployment channels where possible. | 5 | `AIC-mcp-pinned-versions` |
| `SHOULD` | `MCP Prompt Review` | - |  |  | MCP prompts exposed as slash commands are reviewed before being relied on operationally. | 5 | `AIC-mcp-prompt-review` |
| `SHOULD` | `MCP Read-Only Default` | - |  |  | Read-only MCP access is preferred by default. | 5 | `AIC-mcp-read-only-default` |
| `SHOULD` | `MCP Root Prompt` | - |  |  | Users are prompted before exposing roots or other sensitive resources to MCP servers. | 5 | `AIC-mcp-root-prompt` |
| `SHOULD` | `Agent Bounded Delegation` | - |  |  | Delegation is limited to bounded, well-scoped tasks. | 5 | `AIC-agent-bounded-delegation` |
| `SHOULD` | `Agent Roles` | - |  |  | Standard agent roles and escalation paths exist for recurring work. | 5 | `AIC-agent-escalation-paths`, `AIC-agent-standard-roles` |
| `SHOULD` | `Agent Structured Outputs` | - |  |  | Agent outputs are structured enough for safe handoff between agents and humans. | 5 | `AIC-agent-structured-outputs` |
| `SHOULD` | `Agent Versioned Instructions` | - |  |  | Agents rely on repository-versioned instructions rather than hidden session state. | 5 | `AIC-agent-versioned-instructions` |
| `SHOULD` | `Agent Behavior Monitoring` | - |  |  | Unusual agent behavior such as broad rewrites, permission changes, or repeated retries is surfaced. | 6 | `AIC-agent-behavior-monitoring` |
| `SHOULD` | `Agent Tool Pinning` | - |  |  | The set of tools exposed to agents is pinned and changes are reviewed. | 6 | `AIC-agent-tool-pinning` |
| `SHOULD` | `AI Coverage Vanity Guard` | - |  |  | Repositories that gate on coverage reject AI-authored test additions that raise the coverage number without raising assertion density on newly covered lines, so a passing threshold still reflects verified behavior. | 6 | `AIC-ai-coverage-vanity-guard` |
| `SHOULD` | `Input-Domain Property Coverage` | - |  |  | Agent-authored pure functions, parsers, and data transformations are covered by property-based tests in addition to example-based tests, so input-domain edges that example suites routinely miss are exercised. | 6 | `AIC-input-domain-property-coverage` |
| `SHOULD` | `Minimum Capability Set` | - |  |  | Agent workflows derive the minimum required capability set from the user's requested task before the agent runs; tasks combining read-from-untrusted-source and write-to-sensitive-sink in a single agent context are rejected without explicit approval. | 6 | `AIC-minimum-capability-set` |
| `SHOULD` | `AI Fixtures` | - |  |  | Scrubbed fixtures are available for AI workflows that would otherwise require real data. | 6 | `AIC-ai-fixtures` |
| `SHOULD` | `AI Prod Data Read-Only` | - |  |  | Access to production data through AI workflows is read-only unless a write path is explicitly designed and approved. | 6 | `AIC-ai-prod-data-readonly` |
| `SHOULD` | `Disclosure Evidence` | - |  |  | The disclosure policy for materially AI-authored PRs specifies verification evidence (reproducible test output, screenshots of behavior, API traces, or equivalent) so reviewers verify the change rather than re-generate it. | 7 | `AIC-disclosure-evidence` |
| `SHOULD` | `Escalated Approval Categories` | - |  |  | Approval requirements are escalated for migrations, deployment changes, auth changes, or repository-wide rewrites. | 7 | `AIC-escalated-approval-categories` |
| `SHOULD` | `Human Approval — Large Changes` | - |  |  | Human approval is required before commit or push in workflows where AI can generate large or cross-cutting changes. | 7 | `AIC-human-approval-large-changes` |
| `SHOULD` | `Guardrail Active Evidence` | - |  |  | Lightweight evidence (CI configuration, security settings, documented repository policy) shows that important guardrails are actually active. | 7 | `AIC-guardrail-active-evidence` |
| `SHOULD` | `Policy Effective Dates` | - |  |  | The repository records the effective date and last review date of the adopted specification. | 7 | `AIC-policy-effective-dates` |
| `SHOULD` | `Policy Evidence Links` | - |  |  | Each checklist item links to the specific automation, configuration, or review step that enforces it. | 7 | `AIC-policy-evidence-links` |
| `SHOULD` | `AI Model Provenance` | - |  |  | The repository records the model identifier on material AI-generated changes so provenance can be reconstructed if a downstream licensing question arises. Below L3 this remains a SHOULD; at L3+ it is subsumed by `Prompt Audit Trail`. | 7 | `AIC-ai-model-provenance` |
| `SHOULD` | `Licensing-Disclosure Alignment` | - |  |  | The AI-authorship disclosure policy (§23) and the AI-output licensing declaration (§26) point at the same document or cross-reference each other, so contributors see a consistent story for both attribution and legal status. | 7 | `AIC-licensing-disclosure-alignment` |
| `SHOULD` | `Observed Credential Rotation` | - |  |  | Any credential the agent demonstrably read from a transcript, tool output, or context window is rotated before operations continue. | 7 | `AIC-agent-observed-credential-rotation` |
| `SHOULD` | `Short-Lived Agent Credentials` | - |  |  | Credentials issued or rotated by an agent are short-lived where the platform supports it, consistent with the §8 deployment-credential rule. | 7 | `AIC-agent-credential-short-lived` |
| `SHOULD` | `Provider EOL Tracking` | - |  |  | Published end-of-life or deprecation status of allowlisted models and providers is tracked in the same place as the allowlist itself, so the dependency on third-party lifecycles is visible. | 7 | `AIC-provider-eol-tracked` |
| `SHOULD` | `Provider Fallback Path` | - |  |  | A fallback path is planned — an alternative allowlisted entry, a documented degradation mode, or an explicit pause — before relying on a model or provider whose continuity is uncertain. | 7 | `AIC-provider-fallback-path` |
| `SHOULD` | `Incident Context Recorded` | - |  |  | Incident reviews record the model identifier, prompt or skill version, and tool set involved, so the review is reproducible against the same operating context. | 7 | `AIC-incident-context-recorded` |
| `SHOULD` | `Incident Evidence Lineage` | - |  |  | The incident record is cross-linked from the affected guardrail's evidence, so future readers see the lineage from incident to control change. | 7 | `AIC-incident-evidence-lineage` |

## Optional

| Scope | Rule | A | Status | Comment | Requirement | Pillar | IDs |
|-------|------|---|--------|---------|-------------|--------|-----|
| `MAY` | `Containerized Dev Env` | - |  |  | Containerized or sandboxed development environments are available for stronger consistency. | 1 | `AIC-containerized-dev-env` |
| `MAY` | `Domain Lint Rules` | - |  |  | Repository-specific lint rules enforce domain conventions where useful. | 1 | `AIC-domain-lint-rules` |
| `MAY` | `Architecture Analysis Tools` | - |  |  | Dedicated analysis tools model architecture constraints where the codebase justifies them. | 1 | `AIC-architecture-analysis-tools` |
| `MAY` | `Adaptive Staged CI` | - |  |  | Adaptive or staged CI is used with an explicit distinction between fast and slow checks. | 1 | `AIC-adaptive-staged-ci` |
| `MAY` | `Secret Rotation Automation` | - |  |  | Secret rotation or secret lease validation is integrated into operational workflows. | 2 | `AIC-secret-rotation-automation` |
| `MAY` | `DAST` | - |  |  | Internet-facing applications run dynamic security testing. | 2 | `AIC-dast-internet-facing` |
| `MAY` | `Penetration Testing` | - |  |  | High-risk systems undergo periodic penetration testing. | 2 | `AIC-penetration-testing-periodic` |
| `MAY` | `Strict New Dependency Policy` | - |  |  | New dependencies are subject to stricter policies than existing dependencies where useful. | 2 | `AIC-strict-new-dep-policy` |
| `MAY` | `Defense in Depth Client` | - |  |  | Client-side controls are used for defense in depth without being treated as authoritative authorization. | 2 | `AIC-defense-in-depth-client` |
| `MAY` | `Reusable Workflows` | - |  |  | Reusable workflows or central workflow templates reduce CI/CD drift. | 2 | `AIC-reusable-workflows` |
| `MAY` | `Third-Party Action Pinning` | - |  |  | Third-party GitHub Actions are SHA-pinned when the threat model justifies it — production deploys, high-stakes tokens, compliance — paired with an automated bumper (Renovate, Dependabot) that keeps pins current. Tag-pinning with an active bumper is the readable default. | 2 | `AIC-third-party-action-pinning` |
| `MAY` | `Lightweight Threat Review` | - |  |  | Lower-risk repositories use lightweight design review instead of heavyweight formal threat modeling. | 2 | `AIC-threat-model-lightweight` |
| `MAY` | `Non-Fatal Warning Downgrade` | - |  |  | Suspicious but non-fatal states may be downgraded to warnings when the product can continue safely. | 3 | `AIC-non-fatal-warning-downgrade` |
| `MAY` | `Fuzzing` | - |  |  | Parser-heavy or security-sensitive components use fuzzing. | 3 | `AIC-fuzzing-parsers` |
| `MAY` | `Risk-Based Test Selection` | - |  |  | Differential or risk-based test selection is used without weakening the full pre-release quality bar. | 3 | `AIC-risk-based-test-selection` |
| `MAY` | `Additional A11y Gates` | - |  |  | Additional accessibility gates such as motion, contrast, or localization checks are enforced. | 3 | `AIC-a11y-extra-gates` |
| `MAY` | `Rich Diagnostics` | - |  |  | Richer diagnostic breadcrumbs, tracing, or client telemetry are used where privacy and value justify them. | 3 | `AIC-rich-diagnostics` |
| `MAY` | `SLO/SLI Error Budgets` | - |  |  | SLOs, SLIs, error budgets, or equivalent operational models are used according to maturity. | 3 | `AIC-slo-sli-error-budgets` |
| `MAY` | `Artifact Signing` | - |  |  | Released artifacts are cryptographically signed when consumer ecosystems support it. | 4 | `AIC-artifact-signing` |
| `MAY` | `Policy Enforcement` | - |  |  | Admission control or attestation verification is enforced downstream in deployment environments. | 4 | `AIC-policy-enforcement-admission-control` |
| `MAY` | `Merge Queue Policy Layers` | - |  |  | Merge queues, release trains, or additional policy layers support high-throughput teams. | 4 | `AIC-merge-queue-policy-layers` |
| `MAY` | `AI Task Templates` | - |  |  | Specialized task templates or commands exist for recurring AI workflows. | 5 | `AIC-ai-task-templates` |
| `MAY` | `Scoped AI Instructions` | - |  |  | Multi-package repositories provide path-scoped instruction files (e.g. `apps/<name>/AGENTS.md`) that extend the root authoritative source without contradicting approval boundaries or forbidden actions. | 5 | `AIC-scoped-ai-instructions` |
| `MAY` | `Skill Domain Grouping` | - |  |  | Skills are grouped by domain such as implementation, review, release, migration, or incident response. | 5 | `AIC-skill-domain-grouping` |
| `MAY` | `Skill Sample Fixtures` | - |  |  | Shared skills include lightweight sample inputs or fixtures to make behavior easier to validate. | 5 | `AIC-skill-sample-fixtures` |
| `MAY` | `MCP Extra Sandboxing` | - |  |  | Additional sandboxing, network isolation, or execution controls protect third-party MCP servers. | 5 | `AIC-mcp-extra-sandboxing` |
| `MAY` | `MCP Registry Discovery` | - |  |  | The MCP Registry is used for discovery while server vetting remains the team responsibility. | 5 | `AIC-mcp-registry-discovery` |
| `MAY` | `Agent Benchmarking` | - |  |  | Agent roles are benchmarked on representative tasks. | 5 | `AIC-agent-benchmarking` |
| `MAY` | `Agent Extra Sandboxing` | - |  |  | Higher-risk agents run with stronger sandboxing. | 5 | `AIC-agent-extra-sandboxing` |
| `MAY` | `Agent Trust Tiers` | - |  |  | Agent trust tiers such as read-only, code-write, or release-capable are defined. | 5 | `AIC-agent-trust-tiers` |
| `MAY` | `Agent Isolated Workspaces` | - |  |  | Agents run in isolated workspaces, containers, or sandboxes where mistake blast radius is large. | 6 | `AIC-agent-isolated-workspaces` |
| `MAY` | `Model Output Attestation` | - |  |  | Model-output attestation or signing is adopted as agent-provenance tooling matures. | 6 | `AIC-model-output-attestation` |
| `MAY` | `Data Minimization Techniques` | - |  |  | Data minimization, synthetic data, or differential privacy supports AI workflows that need representative data. | 6 | `AIC-data-minimization-techniques` |
| `MAY` | `Stronger Regulated Signoff` | - |  |  | Regulated or high-impact systems have stronger sign-off requirements. | 7 | `AIC-stronger-signoff-regulated` |
| `MAY` | `Guardrail Maturity Mapping` | - |  |  | Guardrail documentation is mapped to maturity models or external standards when compliance requires it. | 7 | `AIC-guardrail-doc-maturity-mapping` |
| `MAY` | `Policy External Mapping` | - |  |  | Policy documentation is mapped to external standards or maturity frameworks when compliance requires cross-referencing. | 7 | `AIC-policy-external-mapping` |
| `MAY` | `AI Input Retention` | - |  |  | Prompts, tool outputs, or inputs that produced material AI-generated changes are retained when audit needs justify it. | 7 | `AIC-ai-input-retention` |
| `MAY` | `Agent Credential Distinct Identity` | - |  |  | Agent credential operations use a role or harness identity distinct from the human operator identity. | 7 | `AIC-agent-credential-distinct-identity` |
| `MAY` | `Provider Deprecation Feed` | - |  |  | Vendor deprecation notices are surfaced in repository tooling or monitored channels. | 7 | `AIC-provider-deprecation-feed` |
| `MAY` | `Incident Postmortem Cadence` | - |  |  | AI-attributable incidents follow a public or internal post-mortem cadence. | 7 | `AIC-incident-postmortem-cadence` |

---

## Verification gaps

List every row where your evidence is indirect — a file is present but you could not confirm it is active, a control is claimed in documentation but not verifiable by inspection, or a CI job exists but you could not determine whether it blocks merge. This surfaces where the owner needs to check manually.

Stamped rows for collector-flagged gaps are between the BEGIN/END markers; add manual rows below. The stamper adds a checksum sentinel inside non-empty stamped blocks and refuses to overwrite a block whose checksum no longer matches.

| Row | Status | What was verified | What is still unverified | What the owner should check |
|-----|--------|-------------------|--------------------------|------------------------------|
<!-- BEGIN:STAMPED-VERIFICATION-GAPS -->
<!-- END:STAMPED-VERIFICATION-GAPS -->
| | | | | |
| | | | | |

Add rows as needed. If the audit found no gaps, record that explicitly: _"No verification gaps — every non-blank status has direct evidence."_

## Audit log

The audit log lives in a companion file: [`AI-CONTRIBUTOR-AUDIT-LOG.md`](AI-CONTRIBUTOR-AUDIT-LOG.md). Every command run to gather evidence is recorded there with a short output excerpt so a fresh checkout plus the same external-service access can reproduce the findings. Keep the companion alongside this file when you commit the audit to your repository.

<!-- BEGIN:TEMPLATE-ONLY — Auditor: delete this entire block (and its END marker) when filling the checklist. -->

## Validating this checklist

Run the structural validator over both files before committing the audit. It checks frontmatter consistency between this file and the audit log, that every populated row has an evidenced Comment, that the root Backlog matches the per-row tables, that `conformance_level` matches the summary table, and that every Comment with a `` `command` `` cites a row that actually appears in the audit log. Exit 0 means the audit is mechanically consistent; exit 1 prints every defect with a stable `AUDITxxx` code.

```sh
# If the spec-repo tools package lives in your repo:
# Full cycle: collect, stamp, fill judgment-required rows, stamp again, validate
npm --prefix tools run audit -- \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
npm --prefix tools run audit:stamp     # writes derivable cells
npm --prefix tools run audit:validate  # read-only structural check

# Or invoke directly:
tsx skills/ai-contributor-audit/scripts/audit-stamp.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
tsx skills/ai-contributor-audit/scripts/audit-stamp.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --diff
tsx skills/ai-contributor-audit/scripts/audit-validate.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md
```

Conformance-level closure is enforced by default: a `✅ Yes` summary row fails if any applicable rule is still `⚠️ Warning`, `🚨 Alarm`, or blank. Pass `--lenient` to skip the closure check (the OK message will surface that it was skipped so consumers can filter lenient audits out of comparability analyses).

<!-- END:TEMPLATE-ONLY -->

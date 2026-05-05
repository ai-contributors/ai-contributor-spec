# AI Contributor Audit Model

This document explains the audit model behind the AI Contributor Specification.
It is non-normative: the specification defines the rules, while this document
explains how audits should produce evidence that is reproducible enough to
review.

## Goal

An AI Contributor audit should make five things explicit:

1. The repository state being audited.
2. The specification and tooling version used for the audit.
3. The evidence collected from that repository state.
4. The status derived from that evidence.
5. The judgment that remains for a human reviewer.

The goal is not full automation. The goal is a repeatable audit trail where
automated facts, derived conclusions, and human judgment are separated clearly.

## Plain-language summary

An audit should answer: which commit was checked, which version of the rules was
used, what evidence was collected, what status follows from that evidence, and
what a human still needs to judge.

The checklist is not trusted because an agent filled it. It is trusted only when
each status points back to evidence that another reviewer can inspect.

## Core Principles

### Pin The Target

The audit is tied to `audited_commit`, not to a caller's current worktree.

The collector should inspect a clean extraction of the audited commit. Dirty
local files may be recorded for traceability, but they must not affect the
audit unless the auditor explicitly chooses a working-tree audit mode.

### Pin The Policy

The audit is also tied to `spec_source`, the immutable source of the
specification, checklist, audit-log template, validator, and collector used for
that run.

Audits should not depend on a mutable branch name. If a branch is used as the
human input, it must first be resolved to a full commit SHA and that SHA must be
recorded.

### Collect Before Judging

Evidence collection happens before checklist rendering.

The durable machine-readable artifact is `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`. The checklist and
audit log are human-readable projections of that evidence plus any additional
manual evidence and judgment.

### Separate Measurement From Policy

Collectors and probes measure observable facts. They do not define the policy.

The policy lives in the specification and checklist. A probe may say that branch
protection requires pull requests, or that a lockfile installs with frozen
dependencies. The checklist decides whether those facts satisfy a rule.

### Prefer Small Probes

Small facts are easier to reproduce than broad conclusions.

Instead of one opaque "repository is protected" result, a collector should
prefer smaller observations such as:

- default branch detected
- branch-protection endpoint readable
- pull requests required
- status checks required
- bypass actors present
- token tier used for hosted API evidence

Checklist status can then be derived from those smaller facts where the
predicate is crisp.

### Keep Judgment First-Class

Not every rule should be automated.

Some statuses can be derived mechanically. Others require human review because
the evidence is semantic, contextual, or policy-dependent. In those cases the
collector should record evidence and set the collector-side
`judgment_required` flag, rather than pretending that the answer is
deterministic.

## Evidence Flow

The audit flow is:

```text
spec_source + audited_commit
  -> bootstrap          (materializes the pinned runbook before the audit)
  -> audit-run          (umbrella command for the normal cycle)
      -> audit-collect  (writes .ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json)
      -> audit-stamp    (writes derivable content into checklist + audit-log)
      -> auditor        (fills judgment-required rows)
      -> audit-stamp    (refreshes sections derived from row statuses)
      -> audit-validate (read-only structural checks)
```

The conceptual flow is the same when run phase by phase:

```text
spec_source + audited_commit
  -> audit-collect
  -> audit-stamp
  -> auditor            (fills judgment-required rows)
  -> audit-stamp
  -> audit-validate
```

## Artifact And Field Ownership

The audit artifacts have different jobs. No single rendered Markdown file is
the whole source of truth.

| Artifact or script | Role | Owner |
|---|---|---|
| `bootstrap.ts` | Materializes the audit runbook from the pinned `spec_source` before collection starts. | Runbook bootstrap |
| `AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json` | Records the exact runbook source and files materialized by bootstrap. | Runbook bootstrap |
| `audit-run.ts` | Orchestrates collect, initial stamp, edit pause, final stamp, and validate. | Runner |
| `audit-collect.ts` | Gathers repository and hosted-setting evidence from the pinned `audited_commit`. | Collector |
| `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` | Machine-readable source for collector-derived facts, command results, derived statuses, and collector-side verification gaps. | Collector |
| `audit-summary.ts` | Read-only one-shot summary of an existing evidence JSON file. | Reader |
| `audit-stamp.ts` | Writes every derivable field into the rendered audit artifacts. Idempotent. | Stamper |
| `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` | Human-readable conformance and scoring surface; contains stamped rows plus auditor judgment rows. | Stamper + auditor |
| `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md` | Command and manual evidence trace; contains stamped collector rows plus auditor-run evidence rows. | Stamper + auditor |
| `AI-CONTRIBUTOR-AUDIT.md` | Root-level projection of the checklist conformance summary and backlog. | Stamper |
| `audit-validate.ts` | Read-only structural consistency checks over the rendered artifacts. | Validator |

The frontmatter fields are owned as follows:

| Field or content | Owner |
|---|---|
| `spec_version` | Template and release process. Bump only with the specification version. |
| `spec_source`, `audited_commit`, `auditor`, `runner_agent`, `runner_model` | Supplied once by stamp flags, environment, evidence, manifest, or pinned runbook path; stamped identically into the checklist and audit log. |
| `assessment_started_at`, `assessment_completed_at`, `assessment_duration`, `validator_version`, `collector_version`, `conformance_level` | Stamped automatically by `audit-stamp.ts`. |
| Collector-derived checklist `A` / `Status` / `Comment`, stamped audit-log collector rows, verification-gap stamped rows, conformance summary `Status`, root summary, and backlog derived columns | Stamped automatically by `audit-stamp.ts`. |
| Judgment-required checklist `Status` / `Comment`, manual audit-log rows, conformance summary `Notes`, backlog `Next action` / `Owner` / `Target date`, and manual verification-gap rows | Auditor-owned. |
| `Date reached` | Hybrid: auditor enters it when a level is first claimed as reached; the stamper preserves it while reached and clears it when the level drops. |

The validator checks whether the rendered audit is internally consistent. It
does not rerun the audit, does not write to files, and does not decide whether
an arbitrary claim is true.

## Conceptual Split

The audit has four layers, each with a distinct responsibility:

1. **Collector** — observable facts and deterministic thresholds.
2. **Stamper** — mechanical writes of derivable content into the rendered artifacts.
3. **Auditor** (human or agent) — applicability, meaning, and explanation for rules that need judgment.
4. **Validator** — structural integrity of the rendered artifacts.

### When to generate, stamp, and validate

Generate when checked-in authoring content is fully derivable from canonical
source files. `AI-CONTRIBUTOR-SPECIFICATION.md` is generated from the
specification template plus `AI-CONTRIBUTOR-RULE-CATALOG.json`.
`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` is generated from the
checklist template plus the same catalog. `AI-CONTRIBUTOR-COVERAGE.md` is
generated from its coverage template plus catalog rule, pillar, and level
metadata. In the checklist, the conformance-level values, conformance-level
summary rows, quick-reference level bullets, row grouping, scope, requirement
summary, pillar, and `AIC-*` IDs belong to the catalog; the instructions,
stamped-block markers, status semantics, backlog policy, evidence rules, and
auditor workflow prose belong to the checklist template. The audit run-specific
`A`, `Status`, and `Comment` cells remain blank until the stamper or auditor
fills them for a repository audit.

Stamp when an audit run can mechanically derive content from the current
evidence JSON, current checklist state, and stamp flags. This includes
frontmatter, automated checklist `A` / `Status` / `Comment` cells, stamped
audit-log collector rows, the conformance summary, root summary, backlog
derived columns, verification-gap rows for collector-flagged gaps, stamped
block checksums, and cross-file equality fields. Stamping is audit-run output;
it must not redefine catalog-owned rule metadata or overwrite auditor-owned
judgment.

Validate when the artifact still contains auditor-owned fields or
cross-artifact consistency constraints. The checklist and audit log are
validated after stamping because judgment-required rows, manual audit-log rows,
summary notes, and backlog next actions cannot be generated from the catalog
or evidence without human or accountable-auditor judgment. Validation checks
structure, allowed status values, current-run evidence linkage, generated
projection freshness, and cross-file consistency; it does not decide whether a
semantic audit claim is convincing.

The collector records what exists, what commands produced, what hosted APIs
returned, and which statuses can be derived without judgment.

The stamper turns collector output and current checklist state into rendered
checklist and audit-log content. It writes timestamps, mechanical frontmatter
(`spec_source`, `audited_commit`, auditor identity fields), version fields,
derived row statuses and comments, the conformance summary, the conformance
level, the backlog, drift rows, judgment-required navigation hints,
verification-gap rows for collector-flagged gaps, audit-log evidence rows for
collector-derived rules, stamped-block checksum sentinels, and cross-file
equality fields. Anything the stamper writes is, by definition, not the
auditor's judgment.

The auditor decides whether a repository ships an artifact, whether a policy
is meaningful, whether a boundary is actually covered, and how to describe
remaining verification gaps. The auditor may be a human or an agent, but it
classifies, connects, and explains evidence that is visible in the repository,
collector output, hosted-setting snapshots, or audit log — never invents.

The validator checks that the filled checklist and audit log are structurally
consistent, tied to current-run evidence, and free of known anti-patterns such
as blank statuses or unlogged command citations. It does not write, does not
call external APIs, and does not decide whether cited evidence is semantically
convincing.

Rules with stable, observable thresholds are collector-derived and stamped.
Rules whose evaluation depends on meaning or context are auditor judgment. The
split keeps every judgment anchored in recorded evidence.

## Role of LLMs in the Audit

Scripts own facts and derivable content. LLMs interpret evidence and draft a
reviewable explanation for the rules that need judgment. Humans approve the
result.

Scripts are the right place for facts:

- files exist or are missing
- commands pass or fail
- lockfiles validate
- hosted APIs return specific settings
- generated projections are current
- checklist and audit-log structure is consistent

LLMs are useful where audit evidence requires interpretation:

- connecting repository-specific evidence and controls to checklist rows the collector leaves for judgment
- reading policy documents and judging whether they are specific enough
- explaining why evidence supports `Warning` instead of `Fulfilled`
- turning gaps into useful backlog actions
- recognizing equivalent controls that do not match the default stack
- reviewing `Not relevant` claims for weak assumptions
- summarizing hosted or API evidence for human reviewers

The LLM must not be the source of truth. It should classify, connect, and
explain current-run evidence only. If evidence is missing, indirect, or unclear,
the correct output is `Warning`, `Alarm`, `Not relevant` with a cited reason, or
`judgment_required` in collector output.

## Determinism Boundary

Repository-local evidence can be close to deterministic when the target commit,
tooling source, and execution environment are pinned.

Examples:

- tracked files
- lockfiles
- static configuration
- local scripts
- type-check or lint commands with pinned dependencies

Hosted or external evidence cannot be fully reproduced from Git alone.

Examples:

- branch protection
- repository rulesets
- hosted secret scanning settings
- dependency-alert state
- CI provider settings
- organization or team membership

For external evidence, the audit should record a snapshot:

- timestamp
- provider
- endpoint or command
- actor or token tier
- output excerpt or structured result
- whether access was complete, partial, or unavailable

The snapshot is evidence for the audit time. It is not a guarantee that the
external setting will remain unchanged.

## Applicability

Technology-neutral audits depend on explicit applicability.

The collector should first detect repository capabilities, then run relevant
probes:

```text
detect stack and provider
  -> decide applicability
  -> run matching probes
  -> derive status when possible
  -> mark judgment_required when not possible
```

A missing TypeScript configuration should not automatically fail a repository
that does not use TypeScript. A missing GitHub ruleset should not automatically
fail a repository hosted somewhere else. The audit must distinguish between:

- applicable and fulfilled
- applicable and not fulfilled
- not applicable
- unknown because the collector lacks access or support
- judgment required because the rule depends on meaning or context

## Derived Statuses

A derived status is appropriate when the rule has a clear condition and the
collector has enough evidence to evaluate it.

Good candidates:

- lockfile integrity
- strict type-checking for a detected typed stack
- branch protection when hosted settings are readable
- required CI checks when provider settings are readable
- objective file/config presence checks where presence itself satisfies the
  rule

Poor candidates:

- whether instructions are clear enough for a new agent
- whether a committed policy or instruction file is specific enough
- whether a fallback plan is credible
- whether a human review process is meaningful in practice
- whether a threat model covers the right risks

For judgment-heavy rules, the collector should gather evidence and explain why
the auditor must decide.

## Validator Boundary

The validator should enforce file consistency, not semantic truth.

It should check:

- matching frontmatter across audit files
- valid status values
- required comments
- no stale placeholders
- audit-log rows are structured
- command citations resolve to current audit-log rows
- collector-derived `Fulfilled` rows cite `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`
- conformance summary matches checklist rows

It should not:

- call external APIs
- rerun build or test commands
- decide whether prose evidence is convincing
- infer repository policy from unstructured comments
- silently change an audit result

This boundary keeps validation deterministic and cheap.

## Technology Neutrality

The core model should be independent of language, package manager, CI system,
repository host, and AI provider.

That means the core collector should be organized around adapters:

```text
core collector
  repo inventory
  git facts
  file probes
  ecosystem adapters
  provider adapters
  optional external tools
```

Adapters may be specific. The schema should stay generic.

For example, a TypeScript adapter can parse `tsconfig.json`, but the evidence
schema should describe the result as a toolchain-specific strictness probe, not
as a universal assumption that every repository has TypeScript.

## Optional External Tools

External tools can be useful, but they should not be required for the core audit
unless the project deliberately accepts that dependency.

When an external tool is used, record:

- tool name
- version or commit
- binary or container digest when available
- command
- exit code
- output excerpt or artifact path
- rules that consumed the result

External tools should provide supporting evidence. The audit should still make
its own rule mapping explicit.

## Operating Rules

Auditors and agents follow these rules:

1. Start from pinned `spec_source` and `audited_commit`; let the stamper record mechanical frontmatter from evidence, the bootstrap manifest, flags, or environment variables.
2. Run the collector before any rendering. `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` is the source of truth for collector-derived findings.
3. Run the stamper to populate every machine-derivable field. Do not hand-edit content the stamper owns.
4. Fill judgment-required rows from current-run evidence. Use audit-log rows for commands and manual evidence not captured by the collector.
5. Re-run the stamper after judgment edits so derived sections (summary, backlog, drift, judgment hints, verification gaps) reflect the final evidence and row statuses.
6. Do not copy prior filled audit content into a new run.
7. Cite current-run evidence in every non-blank checklist row.
8. Mark unsupported or ambiguous cases as `judgment_required` or `Warning` rather than inventing certainty.
9. Record hosted evidence as a timestamped snapshot with token/access context.
10. Keep provider- and stack-specific logic inside adapters.
11. Let the validator check consistency, not truth.

## North Star

A deterministic audit is not one where every answer is automated.

A deterministic audit is one where the target, policy, evidence, derivation, and
remaining judgment are pinned and explicit enough that another reviewer can
reconstruct how the audit reached each row.

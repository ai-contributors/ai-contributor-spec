# Agents

Authoritative AI instruction file for `ai-contributor-spec`. Both human
contributors and AI agents (Claude Code, Copilot, Cursor, Codex, autonomous
runners, etc.) MUST follow this document. Tool-specific instruction files
(e.g. `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`) MUST
either be absent or contain only a pointer back here. Rule and document
metadata source of truth:
[`AI-CONTRIBUTOR-RULE-CATALOG.json`](AI-CONTRIBUTOR-RULE-CATALOG.json).
The human-facing specification and audit checklist are projection/frame assets
that MUST stay synchronized with that catalog. The specification is generated
from
`tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template` plus the
catalog; the template owns long-form prose, and the catalog owns generated
facts such as version, pillars, the full specification clause section,
conformance levels, conformance workflow summaries, clause counts, normative
scope lists, and `AIC-*` rule bullets. The checklist rule tables are generated
from the catalog.

## What this repo is

A specification, audit checklist, audit log template, runbook scripts
(`skills/ai-contributor-audit/`), and verification tooling (`tools/`). It
ships normative documents and reusable audit machinery to other repositories.
There is no production runtime, no service, no UI, and no end-user
deployment surface.

Implication: the repo's primary risk surface is **drift between the rule
catalog, specification, and templates that adopters fetch**, plus
**supply-chain risk in the runbook scripts adopters execute via `bootstrap.ts`**.

## Architecture

- `AI-CONTRIBUTOR-RULE-CATALOG.json` — canonical catalog metadata: pillars,
  conformance levels, clauses, `AIC-` IDs, normative scope, rule text,
  checklist metadata, conformance workflow summaries, and detector linkage.
- `AI-CONTRIBUTOR-SPECIFICATION.md` — generated human-facing specification
  projection from `tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template`
  and the rule catalog.
- `tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template` —
  hand-authored specification prose outside the generated clause section plus
  placement directives for catalog-owned facts.
- `AI-CONTRIBUTOR-GUIDE.md`, `AI-CONTRIBUTOR-AUDIT-MODEL.md`, `AI-CONTRIBUTOR-COVERAGE.md` — companion docs.
- `.ai-contributor-audit/` — checklist + audit-log **templates** shipped to adopters via `bootstrap.ts`. Treat as published artifacts. The checklist rule tables are generated from the rule catalog; the surrounding audit instructions remain hand-authored frame text.
- `skills/ai-contributor-audit/` — runbook (`SKILL.md`, references, `scripts/`). The collector / stamper / validator / bootstrap.
- `skills/ai-contributor-audit-fix/`, `skills/ai-contributor-audit-profile/` — companion skills.
- `tools/` — verification tooling that keeps the catalog, spec, checklist,
  and runbook in sync.
- `examples/` — adopter-facing samples (golden-audit fixture, typescript-pnpm starter).
- `.github/` — CI workflows, CODEOWNERS, dependabot, PR template.

## Commands

```sh
npm ci --prefix tools           # install verification tooling
npm --prefix tools run check:ci-local   # local pre-push PR gate
npm --prefix tools run check    # aggregate repository check
npm --prefix tools run typecheck
npm --prefix tools run check:markdown
npm --prefix tools run generate:coverage   # refresh AI-CONTRIBUTOR-COVERAGE.md
npm --prefix tools run generate:checklist-assets   # refresh generated checklist regions
npm --prefix tools run generate:specification   # refresh generated specification
```

Audit-related entry points live under `skills/ai-contributor-audit/scripts/`
(`audit-collect.ts`, `audit-stamp.ts`, `audit-validate.ts`, `audit-run.ts`,
`bootstrap.ts`). They take repo paths as arguments — do not hardcode adopter
paths.

## Forbidden actions

The following are **never** permitted without explicit, in-band human approval
from a CODEOWNER on the relevant path:

- **No edits to `AI-CONTRIBUTOR-SPECIFICATION.md` outside an open PR with a normative version bump** (see `CONTRIBUTING.md` "When to bump").
- **No edits to `AI-CONTRIBUTOR-RULE-CATALOG.json` that are not synchronized with its markdown projections and generator/check updates.** It is the canonical rule and document metadata source; mutating it without projection checks creates silent spec/checklist drift.
- **No hand edits to generated specification content or generated checklist rule tables.** Edit `AI-CONTRIBUTOR-RULE-CATALOG.json` for structured facts/rules, edit `tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template` for specification prose, then run `npm --prefix tools run generate:specification` and `npm --prefix tools run generate:checklist-assets` as needed.
- **No edits to `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` or `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md` that aren't synchronised with the corresponding catalog/spec change.** These are templates; mutating them in isolation breaks every adopter.
- **No bypassing pre-commit, lint, type-check, or other CI gates** (`--no-verify`, `--ignore-scripts`, `continue-on-error`, masked exit codes, deleting failing checks instead of fixing the cause).
- **No force-push to `main`**, no `git reset --hard` of published commits, no rewriting tagged releases.
- **No `npm publish`** of any package from a contributor or agent workstation.
- **No new runtime dependencies** in `tools/` or `skills/ai-contributor-audit/scripts/` without maintainer approval — the runbook MUST stay reproducible from a SHA-pinned bootstrap.
- **No outbound network calls from runbook scripts except the documented bootstrap fetch/staleness probe and explicit GitHub hosted-setting collection through `gh` when network collection is enabled.**
- **No edits to `.github/workflows/` or `.github/CODEOWNERS`** without explicit maintainer approval — these are the gate definitions.
- **No regenerating `AI-CONTRIBUTOR-COVERAGE.md` by hand**; use `npm --prefix tools run generate:coverage`.
- **No deletion or rewrite of audit evidence files** (`.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` once produced) outside a re-audit run.

When in doubt, ask in the PR before acting. "Asking" means leaving a comment
or opening a draft PR — not waiting silently.

## Approval points (where the agent stops and the human decides)

- A normative version bump (Patch / Minor / Major per `CONTRIBUTING.md`).
- Addition of a new `MUST` / `SHOULD` / `MAY` clause or `AIC-` ID.
- Adding or removing a runbook script in `skills/ai-contributor-audit/scripts/` (must update `bootstrap.ts` `MANIFEST` and the test).
- Changes to evidence schema, validator version, collector version, stamped-block format.
- Any change that could affect adopter audits already in flight (template structure, frontmatter fields, summary table layout).
- Any merge to `main` — humans approve via review on a protected PR.

## Machine-enforced vs review-only guardrails

**Machine-enforced** (CI fails the PR; local `pre-push` runs the locally
reproducible subset through `npm --prefix tools run check:ci-local`):

- `tools/package.json` is the source of truth for local gates. Its `check`
  script lists the aggregate repository guardrails and test shards;
  `check:ci-local` adds audit-runtime coverage and template-scaffold
  verification.
- `check:rule-catalog` validates and canonicalizes
  `AI-CONTRIBUTOR-RULE-CATALOG.json`; `check:checklist-assets` verifies the
  generated checklist rule tables match the catalog; `check:specification`
  verifies `AI-CONTRIBUTOR-SPECIFICATION.md` matches the specification template
  plus catalog; `check:spec-clauses` is a compatibility alias for that full
  specification check;
  `check:checklist-pillars` verifies visible checklist IDs against the catalog
  and specification; `check:rule-catalog-projections` verifies the current
  specification and checklist projections match that catalog.
- `.github/workflows/` is the source of truth for GitHub-hosted gates such as
  CodeQL, dependency review, documentation checks, coverage, template
  verification, and release-tag dry runs.
- `check:test-shards-in-check` fails if a declared `test:*` shard is not
  reachable from `check`.
- `check:tooling-command-coverage` fails if a documented local `check:*` or
  `audit:*` command drifts from `TOOLING.md`.
- `check:audit-frontmatter-docs` fails if shipped audit frontmatter fields
  drift between templates and the canonical audit ownership docs.
- GitHub default secret scanning + push protection apply for this public repo.

**Review-only / process-based** (CODEOWNER review enforces them):

- "Is this change really normative?" judgement and the resulting version bump.
- AI-authored disclosure in the PR body (see `CONTRIBUTING.md` § "AI-authored contributions").
- Coordinated update of `CHANGELOG.md` and the `Version` field across spec + guide + README.
- Spec wording quality, RFC 2119 discipline, evergreen language.

If you add a guardrail that is **claimed** as enforcing a `MUST` clause, it
MUST be machine-enforced — see `Threshold Enforcement` and `Gate Enforcement`
in the checklist.

## Credentials

**No credentials are required to clone, build, or run the verification suite
locally.** Closes the AI Contributor `Credential Documentation` rule
(AIC-credential-handling-documented) by being the single durable source of
truth for credential handling in this repository.

CI uses the default `GITHUB_TOKEN` with least-privilege permissions per
workflow: `contents: read` for read-only checks, `pull-requests: write` only
on the dependency-review workflow, `security-events: write` only on CodeQL,
and `contents: write` only on the release-tagging job that creates immutable
specification tags on `main`. Do not introduce workflows that need
additional secrets without maintainer approval. If a future change adds
runtime credentials, this section MUST be updated in the same PR with the
acquisition path, scope, rotation cadence, and revocation procedure — and
[`SECURITY.md`](SECURITY.md) updated if the credential affects the disclosure
scope.

The `Co-Authored-By` trailer is the only authorship metadata accepted in
commits — see `Authorship` below.

## Authorship and disclosure

- **Materially AI-authored commits** MUST include a `Co-Authored-By:` trailer
  naming the AI (model + variant). See `AUTHORS.md` and `CONTRIBUTING.md` §
  "AI-authored contributions" for the disclosure rules.
- **Materially AI-authored pull requests** MUST include the **AI Authorship
  & Agent Trace** block in the PR body using the template at
  `.github/PULL_REQUEST_TEMPLATE.md` — three lines (`AI-Authored`,
  `Prompt-Audit`, `Subagent-Trace`) plus the license confirmation
  checkbox.
- Minor autocomplete / formatting / spelling suggestions are exempt from
  disclosure but still inherit the CC BY 4.0 / Apache-2.0 license terms for
  the path being changed.

The block is intentionally short. Earlier drafts of this template included
fields for AI-authored scope, validation evidence, and the human reviewer;
those duplicate signal already present elsewhere in the PR (the diff, the
"How validated" section, the reviewer assignment + CODEOWNERS) and were
dropped. Do not re-add fields without a load-bearing reason — the trace
block exists to satisfy specific normative rules, not to repeat everything
the PR already says.

## Prompt audit trail and agent traceability

Closes the AI Contributor `Prompt Audit Trail` (AIC-prompt-audit-trail) and
`Agent Traceability` (AIC-agent-action-traceability) rules. Material AI
authorship in this repository is traceable through the **`Co-Authored-By:`
trailer plus the AI Authorship & Agent Trace block** in the PR body, which
together form the durable, queryable record:

- **Model identifier** — `AI-Authored: yes (<tool/agent>, <model>)` in the
  PR body, plus the `Co-Authored-By:` trailer on each commit
  (`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`,
  `Co-Authored-By: GitHub Copilot <copilot@github.com>`, etc.). Variant
  precision matches what the agent actually self-reports at the time of the
  edit.
- **Skill / prompt version** — `Prompt-Audit:` cites the agent
  instruction sources used: `AGENTS.md@<commit-or-working-tree>;
  skill:<skills/.../SKILL.md>@<sha-or-local>; transcript:<location-or-none>`.
  When an authored change was driven by a skill in this repository, the
  skill citation MUST include the **commit SHA** of the skill version used.
  SHA pins the skill prompt; tags drift. `local` is acceptable for
  user-side or in-flight skills that do not yet have a commit SHA.
- **Subagent trace** — `Subagent-Trace:` lists subagents invoked by the
  primary agent (or `none`). Records the delegation graph for
  `AIC-agent-action-traceability`.
- **Action category** — the PR title + commit message together carry the
  category (`add` / `fix` / `refactor` / `docs` / merge); merge / deploy /
  settings-change actions are CODEOWNER-only and additionally appear in the
  GitHub audit log for the repository.
- **Timestamp** — git's commit timestamp is the canonical ISO 8601
  timestamp; do not rewrite history to alter it.
- **Queryable form** — `git log --grep='Co-Authored-By' --all` and the
  GitHub PR search UI satisfy "queryable by agent, category, and time range"
  for this repo's scale. If contribution volume grows past what `git log` can
  triage, this section MUST be revisited.

Prose-only attribution (e.g. "I used AI to write this") in a PR body without
the trailer is not sufficient. AI-edits that do not meet the disclosure rules
in `CONTRIBUTING.md` § "AI-authored contributions" are held until corrected.

## AI data classification

Closes the AI Contributor `AI Data Classification`
(AIC-ai-data-classification) rule. The data classes that flow through AI
agents working in this repository are:

| Class | Examples in this repo | Allowed in AI context | Notes |
|---|---|---|---|
| Public source / spec text | `AI-CONTRIBUTOR-SPECIFICATION.md`, `tools/`, `skills/`, examples | ✅ | License: CC BY 4.0 (docs) / Apache-2.0 (code). |
| Public CI / workflow definitions | `.github/workflows/`, `.github/CODEOWNERS` | ✅ | No secrets embedded; tokens come from `GITHUB_TOKEN` at runtime. |
| Author identity | `AUTHORS.md`, commit metadata | ✅ | Public by design. |
| Secrets / credentials | none | ❌ | Repository requires no credentials; see § "Credentials". |
| Customer data | none | ❌ | This repo holds no customer data. |
| Regulated data (PII, PHI, financial) | none | ❌ | Repo scope is policy + tooling; no regulated data flows through it. |
| Telemetry | none | ❌ | No application telemetry collected. |

If a future change introduces a new data class (for example a contributor
list with email addresses, or fixture data derived from a real customer
repo), this table MUST be updated in the same PR.

## AI surface redaction

Closes the AI Contributor `AI Surface Redaction` (AIC-ai-surface-redaction)
rule. **The repository operates no AI-specific runtime surfaces**: there are
no agent transcripts, prompt logs, tool-call recordings, or AI error reports
generated by this codebase. The only AI surfaces touching the repo are
external assistants (Claude Code, Copilot, Cursor, Codex, etc.) that human
contributors invoke locally; their transcripts live in those tools, not here.

Consequence: there are no surfaces in this repo from which secrets,
credentials, or PII could leak through AI-side logging. If a future change
introduces a runtime AI surface (an MCP server, a hosted prompt log, an
agent transcript collector, an autonomous runner), it MUST add the
corresponding redaction rules and data-handling controls in the same PR
before merge.

## AI dependency verification

Closes the AI Contributor `AI Dependency Verification`
(AIC-ai-dependency-verification) rule. AI-suggested or AI-introduced
dependencies in `tools/package.json` MUST be verified before merge:

1. **Registry of record:** npm package on the public npm registry; verify the
   package name resolves to the expected source repository (most listings on
   npmjs.com link back to GitHub).
2. **Maintainer ownership:** scan the `repository` field, owner/org, and
   recent release cadence; reject typosquats and packages with no public
   repository.
3. **License compatibility:** Apache-2.0 / MIT / BSD / ISC are accepted for
   `tools/`; copyleft (GPL/AGPL) requires maintainer approval.
4. **Vulnerability + supply-chain signal:** Dependabot
   (`.github/dependabot.yml`), the `dependency-review` workflow, and CodeQL
   provide post-add checks; first-add vetting still requires a human glance
   at install scripts and `dependencies` of the package itself.

Dependency additions ride the standard PR review path; CODEOWNER approval on
`tools/` is the gate.

## Shared skills

Closes the AI Contributor `Shared Skills` (AIC-shared-skills-versioned,
AIC-skill-contract-defined, AIC-skill-code-review) and `Skill Safety`
(AIC-skill-no-secrets) rules. This repository **ships** three skills under
`skills/`:

- `skills/ai-contributor-audit/` — runs an AI Contributor audit.
- `skills/ai-contributor-audit-fix/` — closes one audit finding at a time.
- `skills/ai-contributor-audit-profile/` — drafts the audit profile.

Each skill has:

- **A version pinned to the spec.** Skills are versioned together with the
  specification; adopters fetch a skill at a specific commit SHA via
  `bootstrap.ts`. There is no separate skill version number — drift between
  the spec and a shipped skill is treated as a bug.
- **A defined contract.** The skill's `SKILL.md` declares its trigger
  conditions, inputs, outputs, and the runbook scripts it invokes. Any
  change to the contract requires a normative version bump per
  `CONTRIBUTING.md`.
- **Code review.** Every change to `skills/` falls under the
  `.github/CODEOWNERS` rule pinning the path to the maintainer and is gated
  by `npm --prefix tools run check:ci-local` (including `test:skill-bootstrap`,
  which verifies the manifest-vs-disk reverse check).
- **No embedded secrets.** Skills MUST NOT contain API keys, tokens, or
  credentials; CI's CodeQL scan and the public-repo secret scanning catch
  accidental commits. If a skill needs a credential at runtime, the adopter
  supplies it through their own environment — the skill prompt MUST NOT bake
  a credential into the runbook.
- **No silent privileged actions.** Skills MUST NOT bypass the human-approval
  gate defined in § "Forbidden actions". Every skill that drives a write or
  destructive action is required to surface it for explicit human confirmation
  before execution.

The skill prompts (`SKILL.md` files), reference docs under `skills/<name>/references/`,
and runbook scripts under `skills/<name>/scripts/` are **system prompts and
agent instructions that materially affect agent behaviour**. They are versioned
in this repository, change-controlled by the same PR + CODEOWNER review path
as the specification, and pinned by commit SHA when adopters fetch them via
`bootstrap.ts`. This closes the AI Contributor `Prompt Versioning`
(AIC-prompt-versioning-review) rule.

## Code-test independence

Closes the AI Contributor `Code-Test Independence Check`
(AIC-code-test-independence) rule. AI sessions in this repository regularly
author both an implementation and the test that exercises it (for example
adding a new collector rule together with its `tools/tests/test-audit-collect-*.ts`
shard). When that happens, the verification mechanism is **independent
CODEOWNER review of the tests, separate from the implementation review**:

- The reviewer attests in the PR body — under the AI-authorship disclosure
  block — that the tests were read for **mutation resistance** (would they
  fail if the implementation's branch logic, comparison operators, or
  invariant checks were inverted?), not just for "tests pass".
- For golden-fixture tests (`tools/test-fixtures/`), the reviewer additionally
  confirms the fixture data was derived from the spec, not from the
  implementation's actual output — otherwise the test merely re-asserts what
  the code does.
- If the reviewer is unable to read the tests independently (small repo,
  one available reviewer, etc.), the PR MUST add a property-based or
  mutation-style check before merge, or be split so an independent reviewer
  can take the test half.

CODEOWNER approval on a PR that includes both implementation and tests is
treated as a positive attestation that this independence check was performed.

## Readiness for merge

A change is ready to merge when:

1. `npm --prefix tools run check:ci-local` passes locally, and all required CI
   checks pass on the PR.
2. Required reviews from CODEOWNERs of every touched path are in.
3. Required-review approvals come from **human** reviewers — bot or agent
   accounts do not satisfy required-review counts.
4. AI-authored contributions disclose the model/agent in the PR body.
5. Normative changes carry the matching version bump and `CHANGELOG.md`
   entry, with `AI-CONTRIBUTOR-COVERAGE.md` regenerated.

## Policy ownership

- **Owner:** [@ai-contributors](https://github.com/ai-contributors) — see `AUTHORS.md` and the root entry in `.github/CODEOWNERS`.
- **Review cadence:** this `AGENTS.md` is reviewed at every minor release of
  the specification (per `CONTRIBUTING.md`'s versioning policy) and on any
  incident that exposes a missing or weakened guardrail. The reviewed date is
  the latest commit date of this file.
- **Change control:** edits to this file follow the same PR + review path as
  the specification. Substantive changes (new forbidden action, removed
  approval point, changed enforcement claim) require a CODEOWNER review and
  a `CHANGELOG.md` entry.
- **Reporting a security issue:** see [`SECURITY.md`](SECURITY.md).

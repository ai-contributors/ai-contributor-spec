# AI Contributor Specification

> Guardrails for repositories where AI reads, writes, reviews, or releases code.
>
> This specification treats AI as a system actor and defines reviewable guardrails for agent, harness, and tool behavior.

**Version:** 0.2 · **License:** docs/specs [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); starter template, repo tooling, and audit runtime scripts [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) · **Change history:** [`CHANGELOG.md`](CHANGELOG.md)

## Why This Exists

Do you want to use AI on your repository, but you are not sure which guardrails
should be in place first?

This project gives you:

- a practical specification for repository-level AI guardrails,
- an audit profile skill that drafts applicability answers from repository
  evidence for owner confirmation,
- a runnable audit skill that finds gaps,
- a fix skill that closes the gaps blocking the next conformance level,
- an agent-free path: run the audit scripts yourself, or read the checklist by
  hand for early gap analysis.

The workflow is deliberately incremental: run the audit profile skill, confirm
the profile answers, run the audit, get a sorted backlog, fix the rows needed
for the next level, rerun the audit, and repeat until the repository reaches
the level you need.

It is written for engineering leads, platform teams, harness engineers,
security reviewers, and developers who want to use AI agents on real codebases
without guessing which guardrails should exist. The target is one repository:
the same checklist works for solo projects, team repositories, and monorepos,
and the level depends on repository controls and AI risk, not team size. Use
ownership, required reviews, branch protection, and path-scoped rules at the
level of formality your repository needs.

The scope is repository-side AI-assisted delivery: setup, policy, CI,
verification, review, release controls, agent instructions, shared skills,
MCP servers, AI provenance, and incident handling. The specification is
vendor-neutral. It does not fully cover consumer-facing AI runtime safety for
products such as in-product chatbots or end-user agent workflows; if your
product exposes AI to users, you still need product-specific AI safety
controls.

<!-- doc-site:extract:quickstart -->

## The Audit Process

```text
+--------------------------+
| Profile skill (optional) |
+--------------------------+
        |
        v
+-------------+
| Audit skill |
+-------------+
        |
        v
+------------------+   +----------------+   +----------------+   +----------------+   +-------------------+
| audit-collect.ts | -> | audit-stamp.ts | -> | auditor edits  | -> | audit-stamp.ts | -> | audit-validate.ts |
| (evidence JSON)  |    | (initial pass) |    | judgment rows  |    | (final pass)   |    | (read-only)       |
+------------------+   +----------------+   +----------------+   +----------------+   +-------------------+
                                                                                                |
                                                                                                v
                                                                                        +-------------------------------+
                                                                                        | Reviewable audit artifacts    |
                                                                                        | (filled MD, evidence JSON)    |
                                                                                        +-------------------------------+
                                                                                                |
                                                                                                v
                                                                                        +-----------+   +---------------------------+
                                                                                        | Fix skill  | -> | Audit skill (loop back)   |
                                                                                        | (optional) |    | after improvements        |
                                                                                        +-----------+   +---------------------------+
```

The audit is scripted. `audit-collect.ts`, `audit-stamp.ts`, and
`audit-validate.ts` own mechanical evidence, timestamps, derived fields, and
the root summary; the auditor — a human or an agent — owns the
judgment-required rows and manual evidence. Both auditor choices produce the
same artifacts and the same evidence chain, and a human or named accountable
owner reviews and accepts the artifacts before the repository publishes a
conformance claim. The optional fix-skill loop addresses gaps found by the
audit, then the audit runs again.

Before adopting the tooling, you can read the specification and checklist by
hand for gap analysis: treat the rows you would mark `Alarm` or `Warning` as
your backlog, and revisit the target level after each group of fixes. That
manual pass is useful for planning, but it is not audit evidence: timestamps,
summaries, derived level status, and evidence completeness are not
mechanically checked. Publishing a conformance claim requires a scripted
audit.

## Start Here

1. Run the
   [audit profile skill](skills/ai-contributor-audit-profile/SKILL.md), then
   have the owner confirm the profile answers. This gives the audit
   applicability evidence for checks that do not apply.
2. Run the [audit skill](skills/ai-contributor-audit/README.md) to produce the
   [audit artifacts](#what-the-audit-produces), including
   `AI-CONTRIBUTOR-AUDIT.md`.
3. Review the current result and decide which
   [target level](#choose-your-target-level) you want to reach.
4. Use the [fix skill](skills/ai-contributor-audit-fix/SKILL.md) to address the
   backlog rows blocking your target level. It confirms the batch scope with
   you, fixes each row, and finishes with a single re-audit.
5. Rerun the audit whenever you need refreshed results outside a fix batch.
6. Have a human or named accountable owner review the
   [audit evidence](AI-CONTRIBUTOR-AUDIT-MODEL.md) before claiming a level.

The audit also runs without an agent: run the audit scripts yourself and fill
the judgment-required rows by hand, or start with a script-free read of the
specification and checklist for gap analysis (see
[The Audit Process](#the-audit-process)).

Using TypeScript, pnpm, and GitHub? Follow the concrete adoption path in
[`AI-CONTRIBUTOR-GUIDE.md`](AI-CONTRIBUTOR-GUIDE.md).

Maintaining this repository? See [`TOOLING.md`](TOOLING.md) for the tooling
architecture, command map, and directory responsibilities.

## Install The Skills

For the scripted audit, have:

- `git`, Node.js 24.x, and `npm` / `npx` available.
- Network access to fetch the pinned specification and runbook tooling. The
  bootstrap/start command may use `npx --yes tsx@4.21.0`; after `audit-run.ts`
  starts, child phases reuse `tsx` from `PATH` instead of invoking `npx` again.
- The target repository checked out locally.
- The target repository's package tools installed where applicable, such as
  `pnpm` or `npm`.
- `gh` authenticated as an account that can read the target GitHub repository
  if you want hosted settings verified.

Without GitHub CLI access, the audit still runs, but hosted controls such as
branch protection, required reviews, secret scanning, push protection, and
dependency alerts may remain `Warning` / verification gaps.

Install the skills:

```sh
npx skills add ai-contributors/ai-contributor-spec --skill ai-contributor-audit-profile ai-contributor-audit ai-contributor-audit-fix
```

Refresh an already installed audit skill outside an audit run:

```sh
npx skills update ai-contributor-audit
```

Do not auto-update during an audit. The audit skill and specification are coupled, and silent updates would hurt reproducibility. Actual audits should materialize the runbook from a pinned release tag or full commit SHA.

Then start the skill using your agent's invocation syntax:

- GitHub Copilot / Claude Code: `/ai-contributor-audit-profile`,
  `/ai-contributor-audit`, or `/ai-contributor-audit-fix`.
- Codex: `$ai-contributor-audit-profile`, `$ai-contributor-audit`, or
  `$ai-contributor-audit-fix`.
- Other agents: ask for the skill by name.

The fix skill has two modes: **fix-next-level** (default —
`/ai-contributor-audit-fix` fixes every backlog row blocking the next
conformance level) and **fix-one** (`/ai-contributor-audit-fix <rule>` fixes
the single named row). Both confirm the scope with you first, fix each row,
ask what to do next (leave the changes uncommitted, commit, branch, push, or
open a PR), and finish with a single re-audit.

The skills are user-invoked only: an agent never starts them on its own from a
matched prompt.

If your agent does not support skills, or you prefer the prompt-based flow, use
the prompt in
[`AI-CONTRIBUTOR-AUDIT-PROMPT.md`](AI-CONTRIBUTOR-AUDIT-PROMPT.md).

## Choose Your Target Level

Choose the highest-risk AI workflow the repository allows. The formal
definitions are in
[`AI-CONTRIBUTOR-SPECIFICATION.md` § Conformance levels](AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels).

| Minimum level | Use this when... | What it enables |
|---|---|---|
| **L0 Baseline Hygiene** | AI is not part of the contribution workflow yet. | Foundational repository hygiene. |
| **L1 Hardened** | AI reads repository context, explains code, suggests commands, or helps with review. | Safer read-only AI assistance. |
| **L2 AI Assisted** | AI creates changes and a human actively accepts each one. | Human-accepted AI contributions. |
| **L3 AI Authored** | AI completes delegated tasks, opens pull requests, or changes files for review. | AI-authored work with human review. |
| **L4 AI Autonomous** | AI merges, releases, deploys, schedules changes, approves workflows, or changes settings without human approval for each action. | Autonomous AI operation. |

Level 0 is the minimum baseline. It covers universal hygiene such as secret
handling, pinned tooling, committed lockfiles, clean setup instructions, and
automated formatting.

## What The Audit Produces

- [`AI-CONTRIBUTOR-AUDIT.md`](AI-CONTRIBUTOR-AUDIT.md): root summary
  template. A populated audit contains the conformance level and sorted backlog.
- [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md):
  full row-by-row checklist.
- [`.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`](.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md):
  command and evidence trace.
- `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`: structured evidence
  collected from the repository and host.
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`:
  owner-confirmed applicability answers that can explain why mapped checks are
  or are not in scope. The profile skill should draft answers from repository
  evidence first, then ask the owner to confirm or correct them. The audit reads
  this file as pre-audit input; if new owner facts are needed, update the
  profile and rerun rather than relying on chat answers.

The audit is not a generic security review. It checks whether repository
guardrails are strong enough for the AI workflow level you want to claim.

<!-- /doc-site:extract:quickstart -->

## Pillars

The 29 clauses are grouped into seven pillars. This grouping is a reader's map;
conformance is still checked clause by clause in the specification and checklist.

| Pillar | Clauses | Scope |
|---|---|---|
| 🏗️ **Engineering Foundation** | §1–4 | The reproducible environment, static correctness, architecture boundaries, and pre-commit / CI gates that make any change reviewable. |
| 🛡️ **Security** | §5–9 | Secrets handling, dependency and CI/CD security, authorization boundaries, and threat modeling. |
| 🎯 **Quality & Reliability** | §10–14 | Runtime validation, testing strategy, accessibility, failure handling and observability, and performance and reliability. |
| 🚀 **Release** | §15–16 | Supply-chain transparency, branch protection, and release governance. |
| 🤖 **AI Agents** | §17–20 | How AI agents, shared skills, MCP servers, and delegated agents are governed in the repository. |
| ⚠️ **AI Risk** | §21–22 | AI-specific risks (prompt injection, untrusted input, capability scoping, allowlists, cost ceilings) and data protection for AI workflows. |
| 🧭 **Oversight** | §23–29 | Human approval, guardrail evidence, policy ownership, AI licensing and attribution, AI credential lifecycle, model/provider changes, and AI incident response. |

## Documentation Map

| Need | Read |
|---|---|
| Formal specification | [`AI-CONTRIBUTOR-SPECIFICATION.md`](AI-CONTRIBUTOR-SPECIFICATION.md) |
| Audit evidence model | [`AI-CONTRIBUTOR-AUDIT-MODEL.md`](AI-CONTRIBUTOR-AUDIT-MODEL.md) |
| No-skill audit prompt | [`AI-CONTRIBUTOR-AUDIT-PROMPT.md`](AI-CONTRIBUTOR-AUDIT-PROMPT.md) |
| TypeScript + pnpm + GitHub adoption | [`AI-CONTRIBUTOR-GUIDE.md`](AI-CONTRIBUTOR-GUIDE.md) |
| Coverage by level and pillar | [`AI-CONTRIBUTOR-COVERAGE.md`](AI-CONTRIBUTOR-COVERAGE.md) |
| Reusable TypeScript starter | [`examples/typescript-pnpm/`](examples/typescript-pnpm/) |

## Display Your Level

Repositories that have scored themselves against the AI Contributor checklist
can show their achieved level with a README badge. The claim is self-declared.
An auditor verifies it by rerunning the audit.

Badges start at Level 1. Level 0 is a minimum baseline check, not a public
claim. Repositories at `conformance_level: 0` or `none` do not display an AI
Contributor badge.

| Level | Badge |
|---|---|
| Level 1 — Hardened | [![AI Contributor: Level 1 Hardened](https://img.shields.io/badge/AI%20Contributor-Level%201%20Hardened-blue)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels) |
| Level 2 — AI Assisted | [![AI Contributor: Level 2 AI Assisted](https://img.shields.io/badge/AI%20Contributor-Level%202%20AI%20Assisted-green)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels) |
| Level 3 — AI Authored | [![AI Contributor: Level 3 AI Authored](https://img.shields.io/badge/AI%20Contributor-Level%203%20AI%20Authored-brightgreen)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels) |
| Level 4 — AI Autonomous | [![AI Contributor: Level 4 AI Autonomous](https://img.shields.io/badge/AI%20Contributor-Level%204%20AI%20Autonomous-blueviolet)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels) |

Paste the Markdown for your achieved level into your repository's README.

```markdown
[![AI Contributor: Level 1 Hardened](https://img.shields.io/badge/AI%20Contributor-Level%201%20Hardened-blue)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels)
[![AI Contributor: Level 2 AI Assisted](https://img.shields.io/badge/AI%20Contributor-Level%202%20AI%20Assisted-green)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels)
[![AI Contributor: Level 3 AI Authored](https://img.shields.io/badge/AI%20Contributor-Level%203%20AI%20Authored-brightgreen)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels)
[![AI Contributor: Level 4 AI Autonomous](https://img.shields.io/badge/AI%20Contributor-Level%204%20AI%20Autonomous-blueviolet)](https://github.com/ai-contributors/ai-contributor-spec/blob/main/AI-CONTRIBUTOR-SPECIFICATION.md#conformance-levels)
```

## Contributing

Issues and pull requests that strengthen the specification are welcome. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for scope and review expectations.

## License

Documentation and specification content in this repository is released under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/);
see [`LICENSE`](LICENSE).

The reusable starter template under
[`examples/typescript-pnpm/template/`](examples/typescript-pnpm/template/) is
released under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0);
see [`examples/typescript-pnpm/template/LICENSE`](examples/typescript-pnpm/template/LICENSE).

Repository tooling and helper scripts under [`tools/`](tools/), plus the shipped
audit runtime scripts under
[`skills/ai-contributor-audit/scripts/`](skills/ai-contributor-audit/scripts/),
are released under
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0); see
[`LICENSE-APACHE`](LICENSE-APACHE). Each file carries an
`SPDX-License-Identifier: Apache-2.0` header.

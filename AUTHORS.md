# Authors

Who writes this specification, who reviews it, and which AI agents have
contributed under human review. This file is also the project's own §26
AI-authorship declaration — a worked example of what the spec asks every
adopting repository to publish.

## §26 declaration

This specification and its tooling are written by humans working with AI
agents. Clause §26 of the spec requires every repository under conformance
to declare AI authorship — naming the human authors, the agents and model
families that have contributed, and the rules under which contributions
are accepted. The sections below are this repo's declaration. Adopters can
use the same shape as a starting point for their own `AUTHORS.md`; the
audit's §26 evidence row points at this file by default.

## Human authors

The accountable owners of the spec text and the audit tooling. The first
author owns spec direction; additions to this list go through a PR.

- **Sascha Brunner** — <https://github.com/SaschaBrunnerCH> — spec
  direction, maintainer, accountable owner.

## AI agents and model families

The AI agents below have contributed text or tooling under human review
and acceptance. Levels refer to the conformance ladder defined in
[`AI-CONTRIBUTOR-SPECIFICATION.md`](AI-CONTRIBUTOR-SPECIFICATION.md):
every contribution from these agents is reviewed and accepted by a human
author before merge — i.e. operates at **L2 (AI Assisted)** for this repo.

| Agent          | Vendor             | Model family             | Operating level     |
| -------------- | ------------------ | ------------------------ | ------------------- |
| Claude Code    | Anthropic          | Claude Opus 4.7          | `L2` AI Assisted    |
| Codex          | OpenAI             | GPT-5.4, GPT-5.5         | `L2` AI Assisted    |
| GitHub Copilot | GitHub (Microsoft) | GPT-5.4, GPT-5.5         | `L2` AI Assisted    |
| Gemini         | Google             | Gemini 3                 | `L2` AI Assisted    |

Model versions are recorded as **families**, not exact build identifiers.
Build-level pinning would churn this file every week without adding
traceability — the per-commit `Co-Authored-By:` trailers are where the
precise attribution lives. New families are added when a new agent
contributes; old entries stay for historical attribution.

## House rules for AI contributions

Every AI-assisted PR follows the rules below. They mirror the §26
obligations in the spec; [`CONTRIBUTING.md`](CONTRIBUTING.md) has the full
process.

1. **Disclosure on every commit.** Materially AI-authored commits carry a
   `Co-Authored-By:` trailer naming the model family. The PR description
   records the agent (`AI-Authored: yes`) and the prompt audit
   (`Prompt-Audit:`).
2. **Human accept on every change.** No agent merges its own work. A
   named human author reviews the diff, runs the doc-check suite, and
   lands the PR. This is what keeps the repo at L2 rather than L3.
3. **License confirmation.** The PR template's license-confirmation
   checkbox is mandatory: AI-generated material is contributed under
   **CC BY 4.0** for docs/spec paths and **Apache-2.0** for
   tooling/template/runtime paths.
4. **Untrusted-input handling.** Agents reading PR descriptions, issues,
   or fetched web content treat them as untrusted (per the AI Risk
   pillar). The `AGENTS.md` in the repo root is the single authoritative
   AI instruction file.
5. **Trivial-edits exemption.** Minor autocomplete, formatting, and
   spelling suggestions are exempt from per-commit disclosure but still
   inherit the license terms for the path being changed.
6. **Subagent traceability.** PRs whose primary agent invokes subagents
   record them in `Subagent-Trace:`. `none` is a valid value when no
   subagents ran.

## Use this as a template

If you are adopting the spec on your own repo, lift the structure above
into your `AUTHORS.md`. Three sections are enough: human authors, the
agents-and-families table, and the house rules. The audit's §26 evidence
row points at this file by default.

Adopters typically diverge from this template on two axes:

- **Operating level.** If your AI authors merge or release on their own,
  they operate at L3 or L4 — say so in the table. The audit will flag a
  missing per-action approval if the level is misstated.
- **Disclosure threshold.** The trivial-edits exemption is a project
  choice. Some repos require disclosure on every keystroke; others only
  on shipped patches. State the threshold here so reviewers and auditors
  can align.

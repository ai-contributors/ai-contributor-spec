---
name: ai-contributor-audit-fix
description: Guides agents through fixing one AI Contributor audit finding at a time without changing audit results by hand. Use when the user asks to fix, close, remediate, plan, or verify AI Contributor audit rows such as Human Review Required, Secret Scanning, Dependency Security, SAST, Security Policy, CI Gates, CODEOWNERS, AI Authorship Traceability, Prompt Audit Trail, MCP Root Scoping, or Level 4 SHOULD evidence gaps.
---

# AI Contributor Audit Fix

## Purpose

Use this skill to fix exactly one AI Contributor audit finding from the root backlog in `AI-CONTRIBUTOR-AUDIT.md`. It complements `ai-contributor-audit`: this skill changes only the target repository evidence or hosted settings needed for the selected fix. The audit skill reruns evidence collection, stamping, and validation.

Do not edit generated audit results. This includes statuses, summaries, conformance levels, checklist rows, evidence JSON, and backlog rows.

## Workflow

1. Start from the root audit summary `AI-CONTRIBUTOR-AUDIT.md`. Its `## Backlog — what to address first` table is the action queue for fixes.
2. Select the row:
   - If the user names a rule, select that rule.
   - Otherwise, take the first backlog row by current order: lowest `Level`, then lowest `Priority`, then table order.
   - Do not maintain a separate backlog parser. The audit backlog table is already stamped and sorted by `audit-stamp.ts`; read the table directly from `AI-CONTRIBUTOR-AUDIT.md`.
3. Stop after selecting one row. Tell the user which single finding will be addressed and ask whether to do it in a separate git worktree before making repository or hosted-setting changes.
4. Read the matching checklist row in `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` and its `Comment` before editing. The root backlog `Next action` is the task. The checklist `Comment` and `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` explain the evidence gap.
5. Classify the fix:
   - Hosted GitHub control: branch rules, reviews, secret scanning, push protection, deployment protection, Dependabot alerts, CODEOWNERS enforcement.
   - Repository file/config: workflows, policy docs, CodeQL/Semgrep, lint/type/test tooling, runtime validation, ownership docs.
   - AI governance: `AGENTS.md`, AI contribution policy, provenance, prompt retention, redaction, MCP scoping, incident process.
   - Level 4 SHOULD: either implement the control or add a documented reason that the repository intentionally defers it.
6. Make the smallest change that creates real evidence for only the selected finding. Repository fixes may edit normal source, config, workflow, or policy files; they must not edit audit output files. Hosted fixes may change repository settings only after the user confirms the change.
7. Verify with the command or API evidence the audit expects. Prefer the same command family named in the checklist comment or audit evidence.
8. Stop after the selected finding is fixed or blocked. Do not continue to the next backlog row in the same run unless the user explicitly asks.
9. Offer the user next-step choices appropriate to the current state: leave changes uncommitted, commit directly, create a branch and commit, push, or create a PR. Do not perform git publish actions without the user asking for them.
10. Always advise the user to rerun the AI Contributor audit to refresh results. If the user asks to rerun it now:
    - For pre-commit verification, run the audit collector in `--working-tree` mode.
    - For claimable release evidence, commit the fix first, then run the SHA-pinned audit flow.
    - Always run stamp and validate after collection.
11. Final response: name the one addressed rule, list files or hosted settings changed, include verification commands, recommend rerunning the audit, and call out whether the selected finding is fixed, blocked, or awaiting hosted-setting confirmation.

## Guardrails

- Fix one finding at a time. Do not bundle unrelated backlog rows into a single fix pass.
- Never edit `AI-CONTRIBUTOR-AUDIT.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`, or other generated audit result files as part of a fix.
- Do not treat a document-only policy as satisfying an executable control unless the rule allows process evidence.
- Keep broad Level 4 SHOULD work separate from L1/L2 blockers unless the user asks for Level 4 closure.

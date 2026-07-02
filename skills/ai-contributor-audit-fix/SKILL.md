---
name: ai-contributor-audit-fix
description: Fix the AI Contributor audit backlog findings that block the next conformance level (fix-next-level) or one named finding (fix-one), then verify with a single re-audit.
disable-model-invocation: true
---

# AI Contributor Audit Fix

## Purpose

This skill is user-invoked only (`disable-model-invocation: true`). Start it explicitly — `/ai-contributor-audit-fix` in Claude Code or GitHub Copilot, `$ai-contributor-audit-fix` in Codex — it never starts because an agent matched a prompt.

Fix the backlog findings in `AI-CONTRIBUTOR-AUDIT.md` that block the next AI Contributor conformance level. This skill complements `ai-contributor-audit`: it changes only the target-repository evidence or hosted settings needed for the confirmed fixes. The audit skill reruns evidence collection, stamping, and validation to record the result.

Do not edit generated audit results. This includes statuses, summaries, conformance levels, checklist rows, evidence JSON, and backlog rows.

## Modes

The invocation selects one of two modes:

- **fix-next-level** (default, no argument): fix every backlog row blocking the next unreached conformance level.
- **fix-one** (a rule named in the invocation, e.g. `/ai-contributor-audit-fix AIC-secret-scanning`): fix that single backlog row.

Both modes run the same fix loop and end with the same single re-audit; only the scope differs.

## Scope Selection

1. Read the root audit summary `AI-CONTRIBUTOR-AUDIT.md`. The conformance summary shows the current level. The `## Backlog — what to address first` table is the action queue — already stamped and sorted by `audit-stamp.ts` (lowest `Level`, then lowest `Priority`, then table order). Read it directly; do not maintain a separate backlog parser.
2. Resolve the scope from the mode:
   - fix-next-level: every backlog row whose `Level` is at or below the next unreached conformance level. If the user names a different target level, scope to that level's blockers instead. Level 4 SHOULD rows enter scope only when Level 4 is the target.
   - fix-one: the single backlog row for the named rule.
3. Confirm the scope with the user before changing anything: name the mode and target (level or single rule), list the in-scope backlog rows, and ask whether to do the work in a separate git worktree.

## Fix Loop

Work through the confirmed scope one finding at a time, in backlog order. For each finding:

1. Read the matching checklist row in `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` and its `Comment` before editing. The root backlog `Next action` is the task. The checklist `Comment` and `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` explain the evidence gap.
2. Classify the fix:
   - Hosted GitHub control: branch rules, reviews, secret scanning, push protection, deployment protection, Dependabot alerts, CODEOWNERS enforcement. Change repository settings only after the user confirms that specific change.
   - Repository file/config: workflows, policy docs, CodeQL/Semgrep, lint/type/test tooling, runtime validation, ownership docs.
   - AI governance: `AGENTS.md`, AI contribution policy, provenance, prompt retention, redaction, MCP scoping, incident process.
   - Level 4 SHOULD: either implement the control or add a documented reason that the repository intentionally defers it.
3. Make the smallest change that creates real evidence for the current finding only. Repository fixes may edit normal source, config, workflow, or policy files; they must not edit audit output files.
4. Verify with the command or API evidence the audit expects. Prefer the same command family named in the checklist comment or audit evidence.
5. Record the finding's outcome: `fixed`, `blocked` (with the reason), or `awaiting hosted-setting confirmation`. A blocked finding does not stop the batch — continue with the next in-scope row.

## Re-Audit Once, After the Batch

Run the re-audit after every in-scope finding is fixed or recorded as blocked — not after each individual fix.

1. Offer the user next-step choices for the accumulated changes: leave them uncommitted, commit directly, create a branch and commit, push, or create a PR. Do not perform git publish actions without the user asking for them.
2. Run one AI Contributor audit cycle to refresh results:
   - For pre-commit verification, run the audit collector in `--working-tree` mode.
   - For claimable release evidence, commit the fixes first, then run the SHA-pinned audit flow.
   - Always run stamp and validate after collection.
3. If the user defers the re-audit, state clearly that the backlog and conformance level are stale until the audit reruns.

## Final Report

Name the mode and target (level or single rule) and give a per-finding outcome table (rule, outcome, files or hosted settings changed, verification command). State whether the re-audit ran and whether it confirms the target level was reached, or which findings remain blocked.

## Before Declaring Done

- [ ] The user confirmed the batch scope before any change was made.
- [ ] Every in-scope backlog row has a recorded outcome: `fixed`, `blocked`, or `awaiting hosted-setting confirmation`.
- [ ] Each `fixed` finding has verification command or API evidence from this run.
- [ ] No generated audit result file was hand-edited; any change to `AI-CONTRIBUTOR-AUDIT.md` or `.ai-contributor-audit/` came from the audit scripts.
- [ ] Exactly one re-audit cycle ran after the batch, or the user explicitly deferred it and was told the results are stale.
- [ ] The final report covers target level, per-finding outcomes, changes, verification commands, and re-audit result.

## Guardrails

- Never edit `AI-CONTRIBUTOR-AUDIT.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`, or other generated audit result files as part of a fix.
- Do not treat a document-only policy as satisfying an executable control unless the rule allows process evidence.
- Do not bundle rows outside the confirmed scope into the batch. If the user asks for more mid-run, reconfirm the expanded scope first.

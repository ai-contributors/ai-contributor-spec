---
name: ai-contributor-audit-profile
description: Draft, confirm, and write the owner applicability profile .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md before an AI Contributor audit.
disable-model-invocation: true
---

# AI Contributor Audit Profile

Create or update `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`, the owner-confirmed applicability input for AI Contributor audits.

This skill is user-invoked only (`disable-model-invocation: true`). Start it explicitly — `/ai-contributor-audit-profile` in Claude Code or GitHub Copilot, `$ai-contributor-audit-profile` in Codex — it never starts because an agent matched a prompt.

The profile steers applicability only:

- `yes` means the affected checks are in scope and still need normal evidence.
- `no` can support `Not relevant` only when the mapped checklist row allows it.
- Blank means the collector and auditor decide from repository evidence.

Profile answers are not waivers and do not make rows `Fulfilled` unless the checklist row explicitly accepts owner attestation or policy text as fulfillment evidence.

The profile is prepared before an audit run and is not a temporary note file for
the audit. If an audit later finds a missing or contradictory owner fact, the
audit should report `Warning` or a verification gap and ask the owner to update
the profile in a separate profile step, then rerun the audit.

## Workflow

1. Always read `skills/ai-contributor-audit/references/audit-profile-template.md` first and extract the canonical applicability questions and affected checks.
2. Capture the starting status of profile and generated audit artifacts before editing:
   - run `git status --short -- AI-CONTRIBUTOR-AUDIT.md .ai-contributor-audit` when the target is a git repo,
   - explicitly report any existing modifications or deletions of generated audit outputs,
   - distinguish a tracked profile deletion (`D` status for `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`) from a profile that never existed,
   - do not describe generated audit output changes as caused by the profile step unless they appeared after your edit.
3. If the profile is deleted in the worktree but exists at `HEAD`, treat the tracked deletion as a fresh-start signal: the owner deliberately removed the file and the default action is to start from the canonical blank template. Do not silently restore the committed profile. State clearly that you are starting fresh because the profile is a tracked deletion, and offer the restore path as an explicit alternative the owner can request — proceed with fresh unless they ask otherwise. You may inspect `git show HEAD:.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` for context (e.g. to surface prior owner-only facts the owner might want to re-supply), but name it as the committed profile, not as an existing file, and do not lift its answers into the draft without owner direction.
4. If `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` exists in the worktree, compare its question text against the canonical template before reviewing evidence:
   - report the canonical question count and existing profile question count,
   - list missing canonical questions by exact text,
   - list unsupported or obsolete existing questions by exact text,
   - treat missing canonical questions as review blockers until they are added to the draft.
5. If the profile does not exist and is not a tracked deletion, start from the canonical template.
6. Build the draft profile in canonical question order. Preserve existing answers and evidence only for exact canonical question-text matches from the selected baseline. Insert missing canonical rows with a drafted answer, evidence, and confidence instead of leaving them invisible.
7. Explain the applicability-only semantics before asking questions.
8. Inspect the target repo lightly for obvious shape signals: manifests, source roots, UI files, deployment workflows, package/release workflows, `AGENTS.md`, MCP config, shared skills, prompt/session archives, and policy docs. Do not run a full audit. While inspecting, also look for **competing AI-instruction files**: if `AGENTS.md` (or another authoritative instruction file) exists alongside `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `GEMINI.md`, or other tool-specific files that are non-trivial (more than a short pointer block back to the authoritative file), surface this in the owner review as a Single AI Source (`AIC-tool-specific-pointer-only`) concern. The audit will catch this; flagging it now lets the owner fix it before the audit runs.
9. Draft each applicability answer from evidence before asking the owner. Use `yes` when repository evidence shows the scope is present, `no` when repository evidence clearly shows the scope is absent, and blank when the answer is uncertain or depends on owner-only facts.
10. Present the proposed change as a **rendered diff against the current worktree profile**, not a fresh review table. Group changes into three buckets so the owner can scan them quickly: **rows added** (new canonical questions inserted), **rows changed** (answer or evidence text differs from the worktree — show old vs new for both columns), and **rows whose `Owner (re)confirmed YYYY-MM-DD` date will move because answer or evidence changed in this run**. Do not list unchanged rows; their omission is the signal that nothing about them moved. For first-time profile creation (no worktree file to diff against), present the full draft table with a short note explaining why a diff is unavailable. The owner confirms or corrects from the diff. A persistent `Confidence` column (`high` / `medium` / `owner-confirm`) MAY accompany changed and added rows in the chat-rendered diff to mark which rows the owner should look at most closely; this column is **chat-only** — it MUST NOT appear in the persisted profile file.
11. Require explicit owner confirmation for low-confidence rows, newly inserted canonical rows, sensitive/regulatory/production-data rows, and any row where a `no` answer depends mostly on absence of evidence.
12. Accept only `yes`, `no`, or blank/unknown for the Answer cell. Capture short evidence or rationale, preferring repository paths/commands for agent-detected facts and owner rationale for owner-only facts.
13. Before writing, state whether the write will create a new profile, update an existing worktree profile, or restore a tracked deletion. If the owner asked to delete/reset the profile and has not chosen restore, do not write it back.
14. Write the Markdown profile table only after confirmation, preserving canonical question order and including every canonical question. Leave uncertain rows blank with rationale that names the missing owner fact.
15. **Do not bump `Owner (re)confirmed YYYY-MM-DD` dates on rows whose answer and evidence text are unchanged.** Refresh the date only on rows whose answer or evidence actually changed during this run, and on newly inserted canonical rows. A no-op date refresh creates churn in version control, weakens the meaning of "reconfirmed", and makes `git blame` lie about when the owner last engaged with the row. The diff in step 10 is what enforces this — if a row appears in the diff but only its date moved, drop the change.
16. Do not run the target repository's formatter on the profile file from inside this skill. The skill writes a structurally-correct table; cosmetic formatting (column alignment, line wrapping, end-of-file handling) is the target repository's responsibility through its pre-commit hook or CI. Invoking `prettier`, `pnpm format`, or any equivalent here couples the skill to whatever formatter the target happens to use, can fight `markdownlint` rules, and produces target-dependent output for an otherwise deterministic skill.
17. Run the read-only profile validator, not the audit validator. The validator prints a `skill version: ...` banner on its first line — capture that line in your run report so the Prompt Audit Trail records which skill version produced this profile:

    ```sh
    npx --yes tsx@4.21.0 <path-to-this-skill>/scripts/profile-validate.ts <target-repo-path>
    ```

18. Capture final `git status --short -- AI-CONTRIBUTOR-AUDIT.md .ai-contributor-audit` and report:
    - whether the profile changed,
    - whether the profile was created, updated, restored from a tracked deletion, or intentionally left deleted,
    - whether generated audit outputs were already modified/deleted before the profile step,
    - whether any generated audit output changed during the profile step.
19. Summarize which `no` answers may make mapped checks `Not relevant` and name any blank rows that still require owner facts.

## Guardrails

- Do not edit generated audit outputs: `AI-CONTRIBUTOR-AUDIT.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`, or `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`.
- Do not run `audit-collect.ts`, `audit-stamp.ts`, or `audit-validate.ts` unless the user asks for an audit after profile creation.
- Do not use generated audit-output deletions or modifications as profile evidence. Preserve and report them separately.
- Do not silently update the profile during an audit. If the owner gives new answers while an audit is running, finish the profile update first and rerun the audit from collection.
- Do not infer sensitive-data, production-data, or regulated-data answers from absence alone if the owner is unsure.
- Do not change checklist scopes while filling a target repo profile; checklist scope changes belong in this spec repo.
- Keep every decision question phrased in the same direction: `yes` enables affected checks, `no` disables them only when `Not relevant` is allowed.
- Do not describe a profile review as current, complete, or ready for final confirmation while any canonical template question is missing from the draft. Name the missing question and include it in the owner review table first.

## Before Declaring Done

- [ ] Every canonical template question appears in the written profile, in canonical order.
- [ ] Every answer cell is `yes`, `no`, or blank; blank rows carry rationale naming the missing owner fact.
- [ ] The owner confirmed the rendered diff before the file was written, including every low-confidence, newly inserted, and sensitive/regulatory row.
- [ ] `Owner (re)confirmed YYYY-MM-DD` dates moved only on rows whose answer or evidence text changed this run (workflow step 15).
- [ ] The persisted file has no `Confidence` column (workflow step 10) and was not run through the target repository's formatter (workflow step 16).
- [ ] `profile-validate.ts` ran cleanly and its `skill version: ...` banner is captured in the run report.
- [ ] The final report covers the profile change kind (created / updated / restored / left deleted), pre-existing generated-output modifications, which `no` answers may make mapped checks `Not relevant`, and which blank rows still need owner facts.

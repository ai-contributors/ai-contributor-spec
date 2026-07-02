---
name: ai-contributor-audit
description: Audit, re-audit, or score a repository against the AI Contributor Specification. Use this skill when a user asks for AI Contributor conformance, repository audit evidence, checklist scoring, or refreshing .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md / .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md. SKIP for generic security review, generic code review, dependency audit, license audit, repo-health roasts, or any "audit my repo" request that is not specifically about AI Contributor Specification conformance — those are different tasks and produce a different shape of output.
---

# AI Contributor Audit

> **Preflight (echo this to the user before doing anything):** "This is an AI Contributor Specification conformance audit. I will show the discovered `spec_version` and audit tool versions from the files being used, then pin the spec source, collect machine-readable evidence from the target repository, stamp mechanical fields, fill judgment-required rows from current evidence, stamp again, and run the structural validator. Tooling: `audit-run.ts` orchestrates `audit-collect.ts`, `audit-stamp.ts`, and `audit-validate.ts`; `bootstrap.ts` is used only when the target repo has not vendored the tooling. The collector checks local tools such as `git`, `gh`, `node`, `pnpm`, and `npm` when available. This produces reviewable audit artifacts; a human or named accountable owner should accept them before publishing a conformance claim. It is NOT a generic security review, code review, dependency audit, license audit, or repo-health assessment."

Run a reproducible conformance audit against the [AI Contributor Specification](https://github.com/ai-contributors/ai-contributor-spec).

The audit writes one root summary and three audit output artifacts in
`.ai-contributor-audit/`. It also reads one optional owner profile input
that the profile skill (or owner) authors before the audit runs:

Audit output (written by the audit):

- `AI-CONTRIBUTOR-AUDIT.md` — root summary
- `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`

Owner profile input (read by the audit, never overwritten):

- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`

Treat the filled checklist and audit log as reviewable audit output, not final acceptance. A human or named accountable owner should spot-check `Fulfilled` rows and scrutinize every `Not relevant` row before committing or publishing the result.

## What This Does

The skill answers:

- Which AI Contributor conformance level can this repository claim?
- Which rows are `Fulfilled`, `Warning`, `Alarm`, or `Not relevant`?
- Which evidence supports each status?
- Which gaps should be fixed first?

It is stricter than a readiness report. It pins the specification source, pins the audited commit, records command evidence, and runs the audit validator before handoff.

## Plain-language Workflow

The job is simple: establish the owner profile first, collect evidence, stamp mechanical fields, review current-run evidence and fill judgment-required gaps, stamp again, validate the pair, and hand the result to a human or named accountable owner. Do not treat memory, prior audit files, or unrecorded tool output as evidence.

Audit artifacts are not standalone documents for agents to patch. If a user asks to refresh a status, remove a backlog row, or update the root audit summary, run the audit flow first (`audit-collect` → `audit-stamp` → evidence review for judgment-required rows → `audit-stamp` → `audit-validate`) and let the scripts rewrite derived cells. Agents may edit only auditor-owned cells after current-run evidence exists, then must re-run stamp and validate.

The lifecycle and field-ownership model is canonical in [`references/audit-protocol.md`](references/audit-protocol.md#audit-lifecycle-and-field-ownership): collector/stamper-owned cells are mechanical, auditor-owned cells may be filled by a human or agent, `Date reached` is auditor-entered but stamper-preserved, and human/accountable-owner acceptance is a separate step before external conformance claims.

The owner profile at `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` is the default input for owner-confirmed applicability answers and should be prepared before collection starts. Run the `ai-contributor-audit-profile` companion skill first when the agent supports skills. Otherwise, copy `references/audit-profile-template.md` before the audit, draft answers from repository evidence, and ask the owner to confirm or correct them. Profile answers can explain applicability, but they do not make rows `Fulfilled` unless the row explicitly allows owner attestation or policy text as fulfillment evidence.

If the profile is a tracked deletion at audit time (the file is removed from the worktree but tracked at `HEAD`), `audit-run.ts` treats that as the owner's deliberate fresh-start signal and proceeds with no owner applicability input. The preflight surfaces this on stderr and the root summary records a "Boundary note" so a reader of the committed audit can see the audit ran without an owner profile. Restore the prior profile with `git restore -- .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` before audit-run if that was unintended.

Do not silently edit the owner profile during an audit. If collection or row review exposes a missing, ambiguous, or contradictory owner fact, mark the affected row `⚠️ Warning` or add a verification gap that names the needed profile answer. If the owner explicitly supplies a new answer, treat that as a profile update and rerun the audit from collection so the evidence chain includes the updated profile.

## Quick Run

Use the pinned spec source requested by the user. If the user did not name one, resolve the upstream default branch to a full commit SHA before fetching anything:

```sh
git ls-remote https://github.com/ai-contributors/ai-contributor-spec.git refs/heads/main
```

Fetch every specification file, template, and runbook from that same immutable ref. Do not mix refs in one audit.

Do not auto-update the installed skill during an audit. The audit skill and specification are coupled, and silent updates would hurt reproducibility. If the installed skill itself needs refreshing, stop before starting the audit and run:

```sh
npx skills update ai-contributor-audit
```

Actual audits still run from a pinned release tag or full commit SHA. Prefer release tags for released specification versions; use a full commit SHA only when intentionally auditing against an unreleased source revision. `bootstrap.ts` emits a non-fatal warning when it can safely compare the requested ref and sees that the installed skill/runbook ref is behind upstream `main` or the latest release tag.

The umbrella command runs collect, initial stamp, an edit pause when interactive, final stamp, then validate. In non-interactive shells it stops after the initial stamp and prints the exact stamp/validate commands to run after judgment-required edits are complete. Pass `--no-pause` only when intentionally skipping that edit checkpoint:

```sh
npm --prefix tools run audit -- \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

By default `audit-run` enables the clean-clone bootstrap smoke test (the Clean Setup row stays judgment-required without it). The smoke test installs and runs documented setup steps in a temporary clone, so it can take several minutes; pass `--no-bootstrap-smoke` to skip it (e.g. quick local iterations) or `--bootstrap-smoke-timeout-ms <n>` to adjust the cap. The lower-level `audit-collect.ts` keeps its `--enable-bootstrap-smoke` opt-in default unchanged.

For a fresh re-audit from blank pinned templates, add `--reset-templates`; it resets only `AI-CONTRIBUTOR-AUDIT.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, and `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`, preserving the owner profile and evidence JSON. This requires a vendored or bootstrapped runbook that includes the templates; otherwise pass `--template-root <path>`.

Before collecting evidence, the umbrella command checks whether the active `gh` login can read the target GitHub repository. If it cannot verify read access, it warns that hosted checks may remain `Warning` / Verification gaps instead of `Fulfilled` and asks before continuing. Do not add `--allow-missing-host-access` on the first run. If the preflight fails, stop and ask the user whether to switch `gh` accounts or continue with lower-confidence hosted evidence. In non-interactive runs, pass `--allow-missing-host-access` only after that choice is explicit.

When checking or switching GitHub identity by hand, prefer bounded API probes over a broad `gh auth status` scan. Use `gh api user --jq .login` to confirm the active account and `gh api repos/<owner>/<repo> --jq .full_name` to confirm repository read access. `gh auth status` is useful for token scopes, but it can hang on unrelated stored hosts or accounts.

Use the lower-level commands when you need to inspect or recover one phase. The full order is collect, stamp, fill judgment-required rows from current evidence, stamp again, then validate:

1. **Collect** evidence into `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`:

   ```sh
   npm --prefix tools run audit:collect
   ```

2. **Stamp** derivable values (mechanical frontmatter, timestamps, versions, automated row `A` + Status + Comment for collector-derived and owner-profile-derived rows, conformance summary, `conformance_level`, backlog) into `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`, and `AI-CONTRIBUTOR-AUDIT.md`:

   ```sh
   npm --prefix tools run audit:stamp -- \
     --auditor "AGENT | MODEL | REASONING_EFFORT" \
     --runner-agent "<runner>" \
     --runner-model "<model>"
   ```

   Add `-- --diff` to preview the stamper's changes without writing files. Add `-- --check` for a CI-friendly read-only dry run that exits `3` and prints a one-line summary when stamping would change anything (for gating "audit out of date" without depending on the validator). The check ignores wall-clock-only frontmatter drift (`assessment_completed_at`, `assessment_duration`).

   After a successful stamp the stamper writes two stderr advisories that batch-surface remaining auditor work in one place (each is non-fatal — the validator is still the authority on completeness):

   - `[audit-stamp] needs-evidence: …` — Warning/Alarm rows whose Comment lacks a backticked file/path/command citation (validator AUDIT034 will fail until each is fixed).
   - `[audit-stamp] needs-status: …` — non-optional rows whose Status is still empty (validator AUDIT015), each annotated with the matching collector rule's reason from `AI-CONTRIBUTOR-EVIDENCE.json` (`judgment-required: …`, `collector: …`, or `no collector coverage`). Use this list to fill all blank rows in one batch instead of discovering them one validate call at a time.

3. **Inspect** the collector's evidence (read-only, optional):

   ```sh
   npm --prefix tools run audit:summary
   ```

   Prints audit metadata, status counts, the list of collector-decisive rules with their status, and the list of collector-judgment-required rules with their reason. Useful for understanding what the collector decided before filling auditor-owned rows. No mutation; safe to run any time after `audit:collect`.

4. **Validate** the filled pair (read-only — never mutates):

   ```sh
   npm --prefix tools run audit:validate
   ```

The convenience `npm --prefix tools run audit` is the preferred vendored entry point.

If the target repo has not vendored the tooling, use the installed skill only to bootstrap the full runbook from the same pinned `SPEC_SHA`, then run the scripts from that bootstrapped directory. Do not run installed scripts with manually fetched templates; that mixes script and template refs and can reproduce stale collector behavior.

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
RUNBOOK="/tmp/ai-contributor-audit-${SPEC_SHA}"
npx --yes tsx@4.21.0 <path-to-this-skill>/scripts/bootstrap.ts "${SPEC_SHA}" --out="${RUNBOOK}"
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-run.ts" . \
  --reset-templates \
  --template-root "${RUNBOOK}" \
  --spec-source "https://github.com/ai-contributors/ai-contributor-spec/tree/${SPEC_SHA}" \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

The `npx --yes tsx@4.21.0` invocation acquires the TypeScript executor for
bootstrap/startup. Once `audit-run.ts` is running, its collect/stamp/validate
child phases invoke `tsx` from `PATH` and do not invoke `npm` or `npx` again.

Or run the phases directly from the bootstrapped runbook:

```sh
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-collect.ts" .
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-stamp.ts" \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --spec-source "https://github.com/ai-contributors/ai-contributor-spec/tree/${SPEC_SHA}" \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-validate.ts" \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md
```

When using the copy-and-paste prompt instead of an installed skill, fetch `bootstrap.ts` from the same pinned `spec_source` and let it materialize the runbook:

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
curl -fsSL \
  "https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec/${SPEC_SHA}/skills/ai-contributor-audit/scripts/bootstrap.ts" \
  -o /tmp/aic-bootstrap.ts
RUNBOOK="/tmp/ai-contributor-audit-${SPEC_SHA}"
npx --yes tsx@4.21.0 /tmp/aic-bootstrap.ts "${SPEC_SHA}" --out="${RUNBOOK}"
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-run.ts" . \
  --reset-templates \
  --template-root "${RUNBOOK}" \
  --spec-source "https://github.com/ai-contributors/ai-contributor-spec/tree/${SPEC_SHA}" \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

## Required Workflow

Follow the complete protocol in [`references/audit-protocol.md`](references/audit-protocol.md). Do not skip steps.

## Evidence Rules

Follow [`references/evidence-rules.md`](references/evidence-rules.md) when deciding statuses and writing comments.

Core rules:

- Every non-blank checklist row needs independently reviewable evidence.
- Every command cited in a checklist Comment must appear in the current `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`.
- Collector-derived `Fulfilled` rows cite `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`.
- Hosted settings such as branch protection, secret scanning, push protection, CODEOWNERS enforcement, and environment protection need host API evidence for `Fulfilled`.
- `Not relevant` needs evidence that the applicability trigger does not hold.
- Under uncertainty, use `Warning`, not `Fulfilled`.

## What Not To Do

- Do not invent evidence.
- Do not update `AI-CONTRIBUTOR-AUDIT.md`, automated checklist Status/Comment cells, conformance summary Status cells, backlog derived columns, or stamped audit-log blocks by direct Markdown edits.
- Do edit auditor-owned checklist Status/Comment cells, conformance summary Notes cells, newly reached Date reached cells, and backlog Next action/Owner/Target date cells only after current-run evidence exists, then re-run stamp and validate.
- Do not copy statuses, comments, backlog rows, or audit-log rows from a prior audit.
- Do not fetch templates or validators from mutable `main` after resolving `spec_source`.
- Do not leave any non-optional checklist row blank. Optional MAY rows may remain blank — the validator allows this. If you set a status on an optional row, it must carry evidence like any other.
- Do not mark hosted settings `Fulfilled` from local files alone.
- Do not hand off until the validator exits 0.

## Before Declaring Done

Before reporting the audit complete, you MUST verify:

1. **Template-only blocks removed.** Search the filled `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` for `TEMPLATE-ONLY` — there must be zero matches. The blank template wraps instructional sections (`Where these assets live`, `Re-audit protocol`, `How to use this checklist`, `Quick audit`, `Deterministic audit boundary`, `Validating this checklist`) in `<!-- BEGIN:TEMPLATE-ONLY -->` … `<!-- END:TEMPLATE-ONLY -->` markers. `audit-run.ts --reset-templates` strips these blocks automatically; pass `--keep-template-instructions` to keep them (and remove them by hand later). The validator (`AUDIT053`) fails if any marker remains.
2. **Placeholder tokens replaced.** Search for `<FILL_` — there must be zero matches. The conformance summary table ships with `<FILL_STATUS>`, `<FILL_DATE>`, `<FILL_NOTES>` tokens; replace each with the audited value (`✅ Yes` / `❌ No` / `⚠️ Partial`, an ISO date or `—`, the blocker notes or `—`). The validator (`AUDIT054`) fails on any surviving token.
3. **Status changes from the previous audit carry rationales.** When the target repository has a previously committed checklist, `audit-run.ts` passes it to the validator via `--previous`; any auditor-owned row whose Status changed must say `Changed from <old status> to <new status> because <reason>` in its Comment with a backticked current-run citation. The validator (`AUDIT070`/`AUDIT071`) fails otherwise; collector-derived and owner-profile stamped rows are exempt.
4. **Conformance summary fully filled.** Every level row has Status and Notes populated, each `✅ Yes` level has Date reached populated, non-reached levels have no Date reached value, and the `conformance_level` frontmatter value matches the highest `✅ Yes` row (or `none`).
5. **Validator exits 0.** Run `audit-stamp.ts` (stamps derivable cells), then `audit-validate.ts` (read-only check) over both files, and resolve every error and warning before declaring the audit complete.

A self-check pass that surfaces remaining issues is part of the audit, not an optional polish step.

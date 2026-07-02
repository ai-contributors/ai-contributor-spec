# Re-audit status-change rationale check — design

Issue: [#9 — Require rationale when re-audits change auditor-owned row status](https://github.com/ai-contributors/ai-contributor-spec/issues/9)

## Problem

Re-audits start from blank pinned templates, so a judgment-owned checklist
row can change status between two audits with no explanation in the
committed artifact. A reader of the re-audit commit sees `✅ Fulfilled`
become `⚠️ Warning` and cannot tell whether the repository changed, the
evidence changed, or the auditor weighed the same evidence differently.
The audit exists to make exactly that distinction legible.

Because the auditor is usually an LLM agent, an unexplained flip is also
cheap to produce. Requiring a rationale with a current-run citation
changes the cost structure: the agent must anchor every status change in
evidence from this run.

This check makes drift visible and reviewable. It does not prevent
drift — that is the job of per-row decision criteria (issue #5). The
rationales this check forces into existence are input data for writing
those criteria.

## Scoping decision

This ships as **non-normative tooling**: validator and orchestrator
behavior, docs, and tests. No catalog rule, no `specVersion` bump, no
checklist projection change. `VALIDATOR_VERSION` bumps `0.1.0` → `0.2.0`
(`audit-run.ts` reads the constant from the validator file, so no other
change is needed). The v0.2 spec work can later cite this as established
behavior if it is promoted to a normative requirement.

## Behavior

### Obtaining the previous audit

The only copy of the previous audit is the committed one. At validate
time, `audit-run.ts` (which already shells out to git) extracts

```sh
git show HEAD:.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md
```

to a temp file and passes it to the validator via a new flag:

```sh
audit-validate.ts <checklist.md> <audit-log.md> --previous <path>
```

`audit-validate.ts` stays read-only and git-free. When the checklist is
not tracked at `HEAD` (first audit), `--previous` is omitted and the
check is skipped. Direct validator invocations without the flag behave
exactly as today.

### Row matching

Previous and current rows are joined by rule name + scope, with the
row's AIC ID set as a tiebreaker (all three come from the existing
`ChecklistRow` parser). Rows present on only one side — e.g. the spec
version changed between audits — are ignored. A blank previous status
(unfinished prior audit) is ignored.

### Exempt rows

Only auditor-owned rows require a rationale. A changed row is exempt
when its **current** Comment carries mechanical provenance:

- it starts with `AUTO_STAMP_PREFIX` (collector-derived stamp), or
- it carries the owner-profile "Not relevant" stamp.

Provenance already explains those changes; no new row classification is
introduced.

### Required rationale shape

A non-exempt row whose status changed must contain, in its Comment
cell, a fragment of the form

```text
Changed from <old status> to <new status> because <reason>
```

where `<old status>`/`<new status>` are the emoji-labelled statuses
(e.g. `✅ Fulfilled`, `⚠️ Warning`) matching the diff, and the Comment
contains at least one backtick-quoted citation — the same citation
convention `AUDIT019` already enforces. The citation must point at
current-run evidence; the existing evidence-linkage checks continue to
apply to the row unchanged, so "prior audit content is not evidence"
is preserved.

### Error codes

New stable range, hard failures (exit 1):

| Code       | Condition                                                                 |
| ---------- | ------------------------------------------------------------------------- |
| `AUDIT070` | Auditor-owned row status changed; Comment has no matching rationale.      |
| `AUDIT071` | Rationale fragment present but no backtick citation in the Comment.       |
| `AUDIT072` | `--previous` file unreadable or unparseable (hard error, not silent skip).|

`--lenient` does not skip these; it continues to govern only the
closure check.

## Documentation changes

- `skills/ai-contributor-audit/references/audit-protocol.md`: new
  "Re-audit diff" paragraph describing the check and the rationale shape.
- Checklist template, Re-audit protocol section: one sentence stating
  that changed auditor-owned rows must carry a change rationale.
- `skills/ai-contributor-audit/SKILL.md`: mention the diff step in the
  flow description.

## Testing

In `tools/tests/test-audit-validate.ts` and
`test-audit-validate-cli.ts`:

- `Fulfilled → Warning` on an auditor-owned row without rationale fails
  `AUDIT070`.
- `Warning → Fulfilled` with rationale and citation passes.
- Rationale without citation fails `AUDIT071`.
- Mechanical (`AUTO_STAMP_PREFIX`) row change is exempt.
- No `--previous` flag: check skipped, existing behavior unchanged.
- Malformed previous file fails `AUDIT072`.

`audit-run.ts` coverage in `test-audit-run.ts`: previous checklist
extracted from `HEAD` and flag passed; flag omitted when the file is
untracked.

## Alternatives considered

- **Rationale in the audit log instead of the Comment cell.** Rejected:
  the checklist row is what readers and the summary consume, and issue
  #9's example is a comment-style sentence.
- **Validator runs git itself.** Rejected: breaks the validator's
  read-only, no-subprocess design; `audit-run.ts` already owns git
  interaction.
- **Separate `audit-diff.ts` script.** Rejected: more surface area for
  what is a single check inside the existing validate step.
- **Normative rule in the catalog now.** Deferred: would drag in
  `specVersion`/changelog work; issue #9 explicitly allows non-normative
  tooling first.

# Audit Protocol

Use this protocol for every audit and re-audit. The audit is tied to a commit and an immutable specification source, not to an agent's memory or a dirty working tree.

## Short version

Pin the target commit. Pin the spec source. Run the collector. Stamp mechanical fields. Review current-run evidence and fill judgment-required cells. Stamp again. Run the validator. A prior filled checklist is history, not evidence for the new audit.

Do not treat the checklist, audit log, or root summary as independent files to patch. A status change starts with `audit-collect`, then `audit-stamp`, then an evidence-review pass for judgment-required rows, then `audit-stamp`, then `audit-validate`; direct Markdown edits to derived cells are invalid audit output.

## Process Modes

The checklist supports three process modes:

| Mode | Boundary | Claim strength |
| --- | --- | --- |
| Manual self-assessment | A human reads the checklist and records findings by hand, without scripts or an agent. | Useful for early gap analysis, but not a reproducible audit claim. |
| Scripted human audit | A human owns judgment-required rows and manual evidence; the scripts collect, stamp, derive, and validate mechanical fields. | Recommended minimum before publishing a conformance claim. |
| Agent-assisted audit | An agent follows this protocol for judgment-required rows while the scripts collect, stamp, derive, and validate mechanical fields. | Valid audit output when validation passes, still requiring human/accountable-owner acceptance before publishing a claim. |

Script-free checklist use is allowed as a planning exercise. It must not be
presented as the same evidence chain as a scripted audit because timestamps,
derived summaries, `conformance_level`, and completeness checks are not
mechanically verified.

## Audit Lifecycle And Field Ownership

The canonical audit lifecycle is:

1. Run the audit profile skill, or complete the profile manually, and confirm
   the owner profile before the audit run.
2. Run `audit-collect.ts` against the pinned target commit.
3. Run `audit-stamp.ts` to write mechanical fields and automated evidence.
4. Review current-run evidence and fill judgment-required checklist rows and manual audit-log rows.
5. Run `audit-stamp.ts` again so derived summaries match those judgments.
6. Run `audit-validate.ts`.
7. Have a human or named accountable owner review and accept the artifacts before publishing a conformance claim.

The collector and stamper own mechanical fields: assessment timestamps and duration, `spec_source`, `audited_commit`, identity fields supplied by flags or environment, `validator_version`, `collector_version`, automated checklist `A` / `Status` / `Comment` cells, stamped audit-log blocks, conformance summary `Status`, `conformance_level`, backlog derived columns, verification-gap stamped rows, and the root `AI-CONTRIBUTOR-AUDIT.md` summary.

The owner profile is owner-confirmed input, not a temporary note file for the
auditor. Profile creation should start with repository discovery: draft
applicability answers with evidence, then ask the owner to confirm or correct
them. The audit reads the confirmed profile but does not silently edit it. If
the audit discovers missing, ambiguous, or contradictory owner facts, record
`⚠️ Warning` or a verification gap that names the needed profile answer. If the
owner explicitly updates the profile, rerun the audit from collection so the
updated profile is part of the evidence chain.

The auditor owns judgment-required checklist `Status` and `Comment` cells, manual audit-log rows below stamped blocks, conformance summary `Notes`, backlog `Next action` / `Owner` / `Target date`, and manual verification-gap rows. The auditor may be a human or an agent. In either case, every populated row must cite current-run evidence.

`Date reached` is hybrid. The auditor enters it only when a level is first claimed as `✅ Yes`; the stamper preserves it while that level remains reached and clears it when the level drops out of `✅ Yes`.

An agent-run audit is valid audit output when it follows this lifecycle and passes validation. It is not the same as the human/accountable-owner acceptance step required before claiming conformance externally.

## Authoritative Sources

Treat these files in the spec repo as the source of truth:

- `AI-CONTRIBUTOR-SPECIFICATION.md`
- `AI-CONTRIBUTOR-AUDIT-MODEL.md`
- `AI-CONTRIBUTOR-AUDIT.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`
- `skills/ai-contributor-audit/references/audit-profile-template.md`
- `AI-CONTRIBUTOR-GUIDE.md`

Canonical skill scripts:

- `skills/ai-contributor-audit/scripts/audit-collect.ts`
- `skills/ai-contributor-audit/scripts/audit-run.ts`
- `skills/ai-contributor-audit/scripts/audit-summary.ts`
- `skills/ai-contributor-audit/scripts/audit-stamp.ts`
- `skills/ai-contributor-audit/scripts/audit-validate.ts`
- `skills/ai-contributor-audit/scripts/bootstrap.ts`

The `skills/ai-contributor-audit/scripts/` files are the canonical audit runtime in this repository and the packaged runtime for installed skills and prompt-fetched runbooks. The `tools/` package is only the repository's local check/test harness; its audit npm scripts delegate to these skill scripts.

Pin `spec_source` using this preference order:

1. Release tag, for audits claiming a released spec version.
2. Full commit SHA, for draft or pre-release audits.
3. Never use mutable `main` as the recorded `spec_source`; it is force-pushable and makes later reproduction ambiguous.

Fetch every file from the same pin. Mixing pins makes the evidence chain unreproducible.

## 0. Produce Machine Evidence

Create or review `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` before running the evidence collector. The profile is owner-confirmed applicability input. When skills are available, run `ai-contributor-audit-profile` first. Otherwise, complete the same profile step manually: inspect the repository, draft answers with evidence, and ask the owner to confirm or correct the draft. Collecting after the profile exists lets the audit record applicability steering from the start.

Do not ask ad hoc applicability questions during the audit and treat the answers as final evidence. Applicability facts that require confirmation belong in the profile. If a needed answer is missing or unclear, keep the affected row at `⚠️ Warning` or record a verification gap, update the profile in a separate profile step, then rerun the audit.

Run the evidence collector before filling the checklist.

For the standard vendored flow, prefer the umbrella command. It runs collect, initial stamp, an interactive edit pause, final stamp, then validate. In non-interactive shells it stops after the initial stamp and prints the exact stamp/validate commands to run after judgment-required edits are complete. Pass `--no-pause` only when intentionally skipping that edit checkpoint:

```sh
npm --prefix tools run audit -- \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

For a fresh re-audit from blank pinned templates, add `--reset-templates`; it resets only `AI-CONTRIBUTOR-AUDIT.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, and `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`, preserving the owner profile and evidence JSON. This requires a vendored or bootstrapped runbook that includes the templates; otherwise pass `--template-root <path>`.

For non-vendored target repositories, first materialize the pinned runbook and run every audit phase from that directory. Do not mix installed scripts with separately fetched templates, because the installed skill may lag the pinned `spec_source`:

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
RUNBOOK="/tmp/ai-contributor-audit-${SPEC_SHA}"
npx --yes tsx@4.21.0 <path-to-installed-skill>/scripts/bootstrap.ts "${SPEC_SHA}" --out "${RUNBOOK}"
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

Do not auto-update the installed skill during an audit. The audit skill and specification are coupled, and silent updates would hurt reproducibility. If the installed skill itself needs refreshing, stop before starting the audit and run `npx skills update ai-contributor-audit`. Actual audits still run from a pinned release tag or full commit SHA. Prefer release tags for released specification versions; use a full commit SHA only when intentionally auditing against an unreleased source revision. `bootstrap.ts` emits a non-fatal warning when it can safely compare the requested ref and sees that the installed skill/runbook ref is behind upstream `main` or the latest release tag.

The umbrella command first checks whether the active `gh` login can read the target GitHub repository. If read access cannot be verified, confirm before continuing: without it, hosted checks such as branch protection, CI gates, review enforcement, secret scanning, push protection, and dependency security may stay `Warning` / Verification gap instead of `Fulfilled`. Do not pass `--allow-missing-host-access` preemptively. Stop, ask whether the user wants to switch `gh` accounts or continue with lower-confidence hosted evidence, then re-run with `--allow-missing-host-access` only when that choice is explicit. Interactive runs still ask for confirmation even when the flag is present; non-interactive runs require the flag to continue.

When checking or switching GitHub identity by hand, prefer bounded API probes over a broad `gh auth status` scan. Use `gh api user --jq .login` to confirm the active account and `gh api repos/<owner>/<repo> --jq .full_name` to confirm repository read access. `gh auth status` is useful for token scopes, but it can hang on unrelated stored hosts or accounts.

Use the lower-level commands below when you need to inspect or recover one phase.

Vendored form:

```sh
npm --prefix tools run audit:collect
```

Bootstrapped runbook form:

```sh
npx --yes tsx@4.21.0 <path-to-pinned-runbook>/skills/ai-contributor-audit/scripts/audit-collect.ts .
```

Raw pinned fallback:

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
curl -fsSL \
  "https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec/${SPEC_SHA}/skills/ai-contributor-audit/scripts/audit-collect.ts" \
  -o /tmp/audit-collect.ts
npx --yes tsx@4.21.0 /tmp/audit-collect.ts .
```

The collector writes `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`. It audits a SHA-pinned temporary worktree by default and records the caller's original worktree status for traceability.

Use `--working-tree` only for pre-commit dry runs that cannot be cited as released conformance. In SHA-pinned mode the collector reuses matching root and workspace `node_modules` caches when the root lockfile is byte-identical. If executable checks still cannot run in the extracted worktree, the collector may downgrade `Strict Types` or `Lint Rules` to `Warning` with a "rerun after install" reason instead of treating missing local dependencies as source failures.

After the first stamp, confirm the stamped collector row records the collector invocation and its `[audit-collect] wrote ...` summary as the first audit-log row.

## 1. Capture Start Time

The collector records `assessment_started_at` in `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` at the start of its run. Do not run `date` and do not type a timestamp by hand — `audit-stamp.ts` reads the value from the evidence JSON and stamps it into the audit log.

## 2. Resolve Spec Source

If the user did not request a release tag or SHA, resolve upstream `main` once:

```sh
git ls-remote https://github.com/ai-contributors/ai-contributor-spec.git refs/heads/main
```

Use the returned full SHA in raw file URLs and frontmatter.

## 3. Fetch Blank Templates

Overwrite any prior filled `AI-CONTRIBUTOR-AUDIT.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, and `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md` with blank templates from `spec_source`.

Also copy `skills/ai-contributor-audit/references/audit-profile-template.md` to `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` when the target repository has no confirmed profile yet. If a profile already exists, preserve it as confirmed profile input; do not overwrite confirmed answers during a re-audit unless the owner explicitly asks to reset the profile.

The profile is the default applicability input. Agents should draft answers from repository evidence first, then ask the owner to confirm or correct them. Each applicability question uses `yes`, `no`, or blank:

- `yes` means the affected checks are in scope and still need normal evidence.
- `no` can support `Not relevant` only for mapped `MUST when applicable`, `SHOULD`, or `MAY` rows whose trigger is absent.
- Blank means the collector and auditor decide from repository evidence, or the profile step could not confirm an owner-only fact.

Profile answers are applicability evidence, not free-form waivers. They fulfill a check only when that check's evidence model explicitly accepts owner attestation or policy text. Invalid answers must be corrected before claiming a completed audit.

If repository evidence contradicts the profile, repository evidence wins for the current audit. Record the contradiction as a `Warning` or verification gap and ask the owner to update the profile before the next run.

Do not copy forward previous statuses, comments, backlog rows, verification gaps, or audit-log entries. Prior audits live in git history.

## 4. Prepare Frontmatter Identity

Do not type duplicated mechanical frontmatter into both files. The canonical artifact and field ownership table is in [`AI-CONTRIBUTOR-AUDIT-MODEL.md` § Artifact And Field Ownership](../../../AI-CONTRIBUTOR-AUDIT-MODEL.md#artifact-and-field-ownership). `audit-stamp.ts` writes:

- `spec_source`
- `audited_commit`
- `auditor`
- `runner_agent`
- `runner_model`

`audited_commit` comes from `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` (`target.audited_commit`) or, as a fallback, `git rev-parse HEAD`. `spec_source` comes from `--spec-source`, `AI_CONTRIBUTOR_SPEC_SOURCE`, `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`, the bootstrap's `AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json`, or the pinned runbook path.

Pass identity fields once when stamping, or set the equivalent environment variables:

- `--auditor` / `AI_CONTRIBUTOR_AUDITOR`
- `--runner-agent` / `AI_CONTRIBUTOR_RUNNER_AGENT`
- `--runner-model` / `AI_CONTRIBUTOR_RUNNER_MODEL`

Leave `assessment_started_at`, `assessment_completed_at`, `assessment_duration`, `validator_version`, `collector_version`, and `conformance_level` blank. `audit-stamp.ts` writes them (`validator_version` from the running stamper, `collector_version` from the running collector, `conformance_level` from the just-stamped Conformance level summary table); `audit-validate.ts` then re-checks the just-written values.

For AI auditors, use:

```text
AGENT | MODEL | REASONING_EFFORT
```

Use `n/a` when the agent has no reasoning-effort setting.

## 5. Build Scope Inventory

Before row scoring, enumerate tracked top-level code units and record the inventory as one audit-log row.

Use tracked manifests and workspace files, not raw ignored directories:

- monorepos: workspace manifests, `apps/*`, `packages/*`, `services/*`
- polyrepos: root plus tracked nested manifests such as `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`
- intentionally tracked excluded units that still live in the repo

Scope-sensitive rows cannot be `Fulfilled` for only part of the inventory. If some units are uncovered, use `Warning` and name them.

## 6. Fill Every Checklist Row

Every row needs one of:

- `✅ Fulfilled`
- `⚠️ Warning`
- `🚨 Alarm`
- `➖ Not relevant`

Blank means unassessed and is a defective audit.

The collector currently evaluates only a subset of rows. It reduces variance; it does not reduce audit coverage. Continue manually through the remaining rows.

For automated rows:

- `audit-stamp.ts` stamps `A`, `Status`, and `Comment` automatically from `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` only when every visible `AIC-*` ID in the row has decisive collector evidence (`judgment_required === false` and `derived_status` set). Rows with partial collector coverage remain auditor-owned. The `A` cell is `x` for automated rows and `-` for auditor-owned rows. The stamped Comment starts with `Mechanical (collector-derived) from` and the backticked evidence path `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` — do not edit it. Re-runs are idempotent.
- `audit-stamp.ts` also stamps `A`, `➖ Not relevant`, and an `Owner profile:` Comment when the owner profile answers `no` for a mapped row whose scope allows `Not relevant`. Any decisive collector evidence for one of the row's IDs outranks profile answers; if machine evidence proves applicability or another status, the profile answer does not override it.
- When multiple AIC IDs on a single row resolve to different collector rules, the stamper picks the most severe status (`Alarm > Warning > Fulfilled > Not relevant`) and joins the derivation reasons.
- The agent fills `Status` and `Comment` only for rows the collector cannot decide.
- If an automated result looks stale, rerun `audit-collect` and `audit-stamp`; do not change the checklist row directly.

For judgment-required rows:

- Read the relevant files.
- Run commands needed to prove or disprove the requirement.
- Record each command and a short output excerpt in the audit log **below** the `<!-- END:STAMPED-COLLECTOR-ROWS -->` marker. The block above that marker is owned by `audit-stamp.ts`, which mirrors the `commands` array of every decisive collector rule into evidence rows. Editing inside the marker block is wasted work; non-empty stamped blocks carry a checksum sentinel, and the next stamp run refuses to overwrite a block whose checksum no longer matches.
- Decide the strictest supportable status.

## 7. Derive Conformance Level

`audit-stamp.ts` writes the Conformance level summary `Status` column from the current checklist row statuses and writes `conformance_level` in both files' frontmatter from the highest level whose Status is `✅ Yes`. Do not hand-edit `Status` or `conformance_level`.

Fill only the auditor-owned cells:

- `Date reached` — set on the first audit that claims the level. The stamper preserves it across re-runs as long as the level remains `✅ Yes`, and clears it when a level drops out of `✅ Yes` so the date does not overstate when the level was reached.
- `Notes` — preserved verbatim.

## 8. Fill Backlog

`audit-stamp.ts` writes the derived columns (`Priority`, `Level`, `Rule`, `Scope`, `Current status`) of the Backlog table in the checklist and root `AI-CONTRIBUTOR-AUDIT.md` — it rewrites those rows from the current checklist row statuses, ordered by conformance level first and priority second, before AUDIT040–046 run during validation. Do not hand-curate which rules appear, the level, the priority tier, or the sort order.

Fill only the model-authored columns for each row the stamper emits:

- `Next action` — concrete remediation; reuse wording from the row's main-table Comment when appropriate.
- `Owner` — handle or team (e.g. `@org/team`); leave blank if unknown.
- `Target date` — ISO date (`YYYY-MM-DD`) or blank if unknown. Do not write `TBD`/`n/a`.

Across re-audits the stamper preserves these three cells verbatim for any rule still expected in the backlog and clears them only when the rule moves to `✅ Fulfilled` / `➖ Not relevant` and disappears from the backlog by design.

`MAY` rows are optional and excluded from backlog.

## 9. Fill Verification Gaps

`audit-stamp.ts` writes one verification-gaps row per AIC ID for every collector rule that recorded a Verification gap (`judgment_required: true` and `derivation_reason` containing `Verification gap` — typically `branch-protection`, `ci-gates`, `human-review-required`, `push-protection`, `dependency-security` when run without host API access). Stamped rows sit between the `<!-- BEGIN:STAMPED-VERIFICATION-GAPS -->` and `<!-- END:STAMPED-VERIFICATION-GAPS -->` markers — do not edit them; non-empty stamped blocks carry a checksum sentinel, and the next stamp run refuses to overwrite a block whose checksum no longer matches.

Add manual rows below the END marker for the indirect-evidence cases the collector did not flag:

- file exists but active enforcement is unconfirmed
- policy claims a control but no enforcement is visible
- CI job exists but blocking behavior is unknown
- hosted setting cannot be verified with API access

## 10. Complete Timestamps

Skip manual timestamp entry. `audit-collect.ts` records `assessment_started_at`, and `audit-stamp.ts` writes `assessment_started_at`, `assessment_completed_at`, and `assessment_duration` in §12. Do not type these values by hand.

## 11. Check README Badge

If the repository README has an AI Contributor badge, make it match `conformance_level`. Badges start at Level 1; there is no badge for Level 0. If `conformance_level` is `0` or `none`, remove the badge.

## 12. Stamp

Run the stamper to write all derivable values into the audit pair and root summary (timestamps, `spec_source`, `audited_commit`, identity fields supplied once by flag/env, `validator_version`, `collector_version`, automated row `A` + Status + Comment for collector-derived and owner-profile-derived rows, audit-log evidence rows for collector commands, conformance summary `Status` cells, `conformance_level`, backlog derived columns, verification-gaps rows for collector-flagged gaps, root `AI-CONTRIBUTOR-AUDIT.md`, and cross-file frontmatter equality). The stamper is idempotent and reads `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` next to the audit log.

Use `--diff` to preview the exact changes without writing either file:

```sh
npx --yes tsx@4.21.0 <path-to-pinned-runbook>/skills/ai-contributor-audit/scripts/audit-stamp.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --diff
```

Vendored form:

```sh
npm --prefix tools run audit:stamp -- \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

Installed-skill or prompt-fetched runbook form:

```sh
npx --yes tsx@4.21.0 <path-to-pinned-runbook>/skills/ai-contributor-audit/scripts/audit-stamp.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

Raw pinned fallback:

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
curl -fsSL \
  "https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec/${SPEC_SHA}/skills/ai-contributor-audit/scripts/audit-stamp.ts" \
  -o /tmp/audit-stamp.ts
npx --yes tsx@4.21.0 /tmp/audit-stamp.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --spec-source "https://github.com/ai-contributors/ai-contributor-spec/tree/${SPEC_SHA}" \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

A non-zero stamper exit means evidence JSON is missing or malformed, or a derived table is in a shape the stamper cannot rewrite — fix the cause (most often: re-run `audit-collect.ts`) before continuing.

## 13. Validate

Run the read-only validator over the just-stamped pair. The validator never mutates the files; AUDIT* defects come from the audit content, not from missing stamping.

Vendored form:

```sh
npm --prefix tools run audit:validate
```

Installed-skill or prompt-fetched runbook form:

```sh
npx --yes tsx@4.21.0 <path-to-pinned-runbook>/skills/ai-contributor-audit/scripts/audit-validate.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md
```

Raw pinned fallback:

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
curl -fsSL \
  "https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec/${SPEC_SHA}/skills/ai-contributor-audit/scripts/audit-validate.ts" \
  -o /tmp/audit-validate.ts
npx --yes tsx@4.21.0 /tmp/audit-validate.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md
```

Record recovery-phase stamper and validator commands in the audit log only when those commands support a checklist finding or explain setup. Use `<preflight>` for setup-only rows; otherwise the validator reports them as uncited evidence commands.

A non-zero validator exit is a hard blocker. Fix the audit output; do not hand off with caveats. If the validator cannot run at all, set `conformance_level: none` until it can be run.

## 14. Handoff

End the run with this shape:

```text
spec_source: <immutable URL or commit>
audited_commit: <sha>
conformance_level: <none|0|1|2|3|4>
assessment_duration: <HH:MM:SS>

Changed since prior audit:
- <short list, or "No prior audit found">

Regressions:
- <rows that moved from Fulfilled to Warning/Alarm, or "None found">

Main gaps:
- <highest-priority Warning/Alarm rows>

Validation:
- <validator command> passed

Reviewer note:
- Treat the filled checklist and audit log as a draft. Spot-check Fulfilled rows and every Not relevant row before committing.
```

Use `git log` / `git show` for prior-audit comparison, not a filled working-tree copy.

Keep the handoff short and focused on the fields in the template.

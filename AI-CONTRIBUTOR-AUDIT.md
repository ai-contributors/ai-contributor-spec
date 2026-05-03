# AI Contributor Audit

> Blank root summary template shipped with the specification. A populated audit
> replaces the placeholders below and is reviewed together with the full
> artifacts in `.ai-contributor-audit/`.

Full audit artifacts live in [`.ai-contributor-audit/`](.ai-contributor-audit/):

- [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md)
- [`.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`](.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md)
- `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`

## Display your level badge

> Stamped automatically by `audit-stamp.ts` from `conformance_level`.

No badge is displayed for `conformance_level: none` or `conformance_level: 0`.

## Conformance level summary

> `Status` is stamped automatically by `audit-stamp.ts` from the per-row tables below. Fill `Date reached` only when a level is first claimed as `✅ Yes`; the stamper preserves it while the level remains reached and clears it if the level drops. Edit `Notes` with blockers or review context. `Partial` means one or more rows at that level are `Alarm` or `Warning`; record the blockers in **Notes** and list them in the root backlog.

| Level                          | Status        | Date reached | Notes        |
| ------------------------------ | ------------- | ------------ | ------------ |
| **Level 0 — Baseline Hygiene** | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 1 — Hardened**         | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 2 — AI Assisted**      | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 3 — AI Authored**      | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |
| **Level 4 — AI Autonomous**    | <FILL_STATUS> | <FILL_DATE>  | <FILL_NOTES> |

### Deriving `conformance_level`

`audit-stamp.ts` derives `conformance_level` from the table above:

1. Complete every checklist row first.
2. Run the stamper so each summary **Status** is derived from the checklist tables.
3. The stamper sets `conformance_level` to the **highest** level whose **Status** is `✅ Yes`. The value is `0` for Level 0, and `1`, `2`, `3`, or `4` for Levels 1–4.
4. If no level row is `✅ Yes`, the stamper sets `none`.
5. Never claim a level whose row is not `✅ Yes`, even if most requirements are met.

The frontmatter value and the summary table `MUST` agree; a mismatch is an audit defect. To advertise the level with a README badge, see [the badge section in the spec README](README.md#display-your-level).

## Backlog — what to address first

> `Priority`, `Level`, `Rule`, `Scope`, and `Current status` are stamped automatically by `audit-stamp.ts` from the full checklist. Edit only `Next action`, `Owner`, and `Target date`.

Populate this table from **every** checklist row where **Status** is `Alarm` or `Warning`. Do not drop rows for brevity. This keeps audits reproducible.

**Priority tiers** (the `Priority` column is the tier number, **not** a sequential unique rank — ties are expected and correct):

1. `MUST` at `Alarm` — repository fails on an unconditional requirement.
2. `MUST when applicable` at `Alarm` — the requirement applies to the repository and is unmet.
3. `MUST` at `Warning` — partial coverage or drift risk on an unconditional requirement.
4. `MUST when applicable` at `Warning`.
5. `SHOULD` at `Alarm` / `Warning` — each unmet `SHOULD` needs a documented reason in its Comment to count toward Level 4.

**Ordering rules** (deterministic so two auditors produce the same row order):

- Primary: ascending by `Level` (`L0`, then `L1`, through `L4`).
- Secondary: ascending by `Priority` (tier 1 first, tier 5 last).
- Tertiary: alphabetical by **Rule** name (case-insensitive).
- `MAY` rows are **not** listed here even if at `Alarm` / `Warning`; `MAY` is optional and tracked only in the full checklist.

**Cell conventions:**

- `Priority` — severity tier, not a unique rank.
- `Level` — conformance level this row affects in the step-by-step backlog.
- `Scope` — one of `MUST`, `MUST when applicable`, `SHOULD`. No parentheticals.
- `Current status` — the emoji-prefixed status from the full checklist (`🚨 Alarm` or `⚠️ Warning`).
- `Next action` — the concrete remediation; reuse wording from the checklist Comment when appropriate.
- `Owner` — handle or team (e.g. `@org/team`); leave blank if unknown.
- `Target date` — ISO date (`YYYY-MM-DD`) or blank if unknown. Do **not** write `TBD`, `n/a`, or similar filler.

| Priority | Level | Rule | Scope | Current status | Next action | Owner | Target date |
|----------|-------|------|-------|----------------|-------------|-------|-------------|
| | | | | | | | |

Once a rule reaches `Fulfilled` or `Not relevant` in the checklist, it disappears from this backlog on the next stamp run.

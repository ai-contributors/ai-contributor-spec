# Audit Profile

Owner-confirmed applicability for an audit. Narrows scope; does not
grant exemptions. This document is the human-facing companion to the
`ai-contributor-audit-profile` skill — the skill is the agent runbook,
this is the concept reference.

## What the profile is

The profile is a small Markdown file at
`.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md` that records
owner-confirmed applicability answers for an audit. It captures facts
the auditor cannot infer from the repository alone — whether the
project handles regulated data, whether a given workflow targets
production, whether shared MCP servers are in scope.

It does **not** grant exemptions. The profile narrows what an audit
must verify; it never marks a rule *Fulfilled* on its own. Mechanical
evidence still has to be present where a clause requires it.

## Why it exists separately from the audit

An audit run is mechanical and reproducible: collect evidence, score
against the rule catalog, stamp the result. The owner's applicability
answers are not mechanical — they describe intent, regulatory posture,
and what the repo is for. Mixing the two would let an audit silently
change scope between runs based on owner mood. Keeping the profile in
its own file means scope changes are reviewable and dated, and the
audit run itself stays stateless.

## What an answer means

- **`yes`** — the affected checks are in scope. Normal evidence still
  required.
- **`no`** — the affected checks may be marked *Not relevant*, but
  only when the mapped checklist row explicitly allows owner
  attestation as the disposition.
- **blank** — the auditor decides from repository evidence. Use this
  when the answer depends on facts already visible in the repo, or
  when the owner is unsure.

Confidence is reviewed at fill time, not stored in the file. Rows that
flip from blank to `no` on absence-of-evidence alone are flagged for
owner reconfirmation.

## Lifecycle

1. The profile is filled or refreshed *before* an audit, never during
   one. If an audit surfaces a missing or contradictory owner fact, it
   raises a verification gap and asks for a profile update; the audit
   is then rerun from collection.
2. Each row carries an `Owner (re)confirmed YYYY-MM-DD` stamp. The
   stamp moves only when the answer or evidence actually changed in
   that run. No-op date refreshes are forbidden — they erase the
   meaning of "reconfirmed".
3. A tracked deletion (`git status` shows `D`) is treated as a
   fresh-start signal. The default is to start from the canonical
   blank template, not to silently restore the prior file.

## How to fill it

Two paths, both produce the same file:

- **Skill-driven.** Run the
  [`ai-contributor-audit-profile`](../skills/ai-contributor-audit-profile/SKILL.md)
  skill in a tool-using agent. The skill walks the canonical questions,
  drafts answers from repo evidence, and presents a rendered diff
  against the existing profile for owner confirmation.
- **By hand.** Copy the canonical question template from this
  repository, answer in canonical order, preserve the
  `Area · Question · Answer · Evidence · Affected checks · Owner (re)confirmed`
  column shape.

## Related references

- [`AI-CONTRIBUTOR-AUDIT-MODEL.md`](../AI-CONTRIBUTOR-AUDIT-MODEL.md) —
  where the profile fits in the audit loop.
- [`skills/ai-contributor-audit-profile/SKILL.md`](../skills/ai-contributor-audit-profile/SKILL.md)
  — the agent-facing runbook, including guardrails and validator
  commands.
- [`AI-CONTRIBUTOR-AUDIT-PROMPT.md`](../AI-CONTRIBUTOR-AUDIT-PROMPT.md)
  — the no-install prompt path that does not require the skills
  package.

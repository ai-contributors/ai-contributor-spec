# AI Contributor Audit Skill

Install:

```sh
npx skills add ai-contributors/ai-contributor-spec --skill ai-contributor-audit-profile ai-contributor-audit ai-contributor-audit-fix
```

This skill audits a repository against the AI Contributor Specification and writes the reviewable audit artifacts:

- `AI-CONTRIBUTOR-AUDIT.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`

Use it when you want an agent to run or repeat a conformance audit, refresh evidence, or score a repository against the current specification.

The skill includes its audit collector, stamper, and validator in `scripts/`. It fetches the specification, checklist template, audit-log template, and audit-profile template from the same pinned source revision. It records the audited commit and produces evidence reviewers can challenge.

## Low-barrier run

1. Install the audit profile, audit, and fix skills.
2. Run the `ai-contributor-audit-profile` skill, or prepare the profile
   manually, then have the owner confirm
   `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`.
3. Ask the agent to audit the repository against the AI Contributor Specification.
4. Have a human or named accountable owner review `AI-CONTRIBUTOR-AUDIT.md` plus the full files in `.ai-contributor-audit/`.
5. Fix `Alarm` rows first, then `Warning` rows.
6. Commit the audit files only after a human has checked the evidence.

The audit reads the profile as pre-audit owner-confirmed input. The profile skill should inspect the repository, draft applicability answers with evidence, and ask the owner to confirm or correct them before writing durable answers. If the audit discovers a missing or contradictory owner fact, update the profile in a profile step and rerun the audit; do not rely on chat-only answers as durable evidence.

## Prerequisites

- `git`, Node.js, and `npm` / `npx` available.
- Network access to fetch the pinned specification and runbook tooling.
- The target repository checked out locally.
- Package tools installed where applicable, such as `pnpm` or `npm`.
- `gh` authenticated as an account that can read the target GitHub repository
  for hosted checks.

Without GitHub CLI access, the audit still runs, but hosted controls may remain
`Warning` / verification gaps.

## Recommended install

Project install:

```sh
npx skills add ai-contributors/ai-contributor-spec --skill ai-contributor-audit-profile ai-contributor-audit ai-contributor-audit-fix
```

Global install:

```sh
npx skills add ai-contributors/ai-contributor-spec --skill ai-contributor-audit-profile ai-contributor-audit ai-contributor-audit-fix -g
```

Refresh an already installed audit skill outside an audit run:

```sh
npx skills update ai-contributor-audit
```

Do not auto-update during an audit. The audit skill and specification are coupled, and silent updates would hurt reproducibility. Actual audits should materialize the runbook from a pinned release tag or full commit SHA.

To inspect without installing:

```sh
npx skills add ai-contributors/ai-contributor-spec --list
```

## Safety Notes

- Review the filled checklist and audit log before committing them.
- Treat agent-generated audit results as reviewable artifacts, not human/accountable-owner acceptance.
- Use read-only repository/API credentials for hosted settings verification.
- Record write-capable tokens as evidence caveats for hosted settings.

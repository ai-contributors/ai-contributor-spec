# AI Contributor Audit Prompt

Use this prompt when your agent does not support skills or when you want a
copy-and-paste onboarding path.

For repeat audits, prefer the
[`ai-contributor-audit`](skills/ai-contributor-audit/SKILL.md) skill. The skill
uses the same audit model, but is easier to reuse and less error-prone.

## Copy-Paste Prompt

Run this from the repository root:

```text
Audit this repository against the AI Contributor Specification.

1. Resolve the current specification source to a full commit SHA:
   git ls-remote https://github.com/ai-contributors/ai-contributor-spec.git refs/heads/main
   Capture the 40-char SHA as SPEC_SOURCE_COMMIT.

2. Download the pinned runbook with the bootstrap script. This file list is authoritative; do not guess paths from prose:
   curl -fsSL \
     "https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec/${SPEC_SOURCE_COMMIT}/skills/ai-contributor-audit/scripts/bootstrap.ts" \
     -o /tmp/ai-contributor-bootstrap.ts
   npx --yes tsx@4.21.0 /tmp/ai-contributor-bootstrap.ts "${SPEC_SOURCE_COMMIT}"
   The bootstrap writes the pinned runbook outside the repository, normally under /tmp, and prints the path of the SKILL.md to follow next.

3. Follow that SKILL.md exactly. Do not guess file paths or fetch sources from a different ref. Base every status on the current working directory, generated evidence, or recorded repository settings -- never on memory. Do not update the audit artifacts as standalone Markdown files; status, summary, and backlog changes must go through collect, stamp, evidence review for judgment-required rows, stamp, and validate. Treat the filled checklist and audit log as reviewable audit output, not human/accountable-owner acceptance.
```

## Review Before Trust

For agent-run audits, treat the filled checklist and audit log as reviewable
artifacts. Agent audit results can be wrong or invented, even when a runbook
and evidence collector are used.

Before you commit filled audit files:

- Check a sample of `Fulfilled` rows against the cited evidence.
- Review every `Not relevant` row and confirm the reason applies.
- Re-run any standard command listed by the audit runbook.

The `audited_commit` and `auditor` fields exist so a reviewer can reproduce and
challenge any line.

For the evidence model behind this flow, read
[`AI-CONTRIBUTOR-AUDIT-MODEL.md`](AI-CONTRIBUTOR-AUDIT-MODEL.md).

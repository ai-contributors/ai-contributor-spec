---
spec_version: "0.1.2"
spec_source:           # Stamped automatically by audit-stamp.ts from --spec-source, AI_CONTRIBUTOR_SPEC_SOURCE, the bootstrap manifest, or the pinned runbook path. Must match the companion checklist exactly.
assessment_started_at:    # Stamped automatically by audit-stamp.ts from the collector's evidence JSON. Leave blank — the stamper overwrites it. ISO 8601 date-time with seconds.
assessment_completed_at:  # Stamped automatically by audit-stamp.ts. Leave blank — the stamper overwrites it.
assessment_duration:      # Stamped automatically by audit-stamp.ts (HH:MM:SS, derived from the two timestamps). Leave blank — the stamper overwrites it.
audited_commit:     # Stamped automatically by audit-stamp.ts from AI-CONTRIBUTOR-EVIDENCE.json target.audited_commit, falling back to git rev-parse HEAD.
auditor:            # Stamped by audit-stamp.ts from --auditor or AI_CONTRIBUTOR_AUDITOR. Human: name (e.g. Jane Smith); AI: AGENT | MODEL | REASONING_EFFORT (e.g. "GitHub Copilot | gpt-5.4 | high"). Use "n/a" if the agent has no reasoning setting.
validator_version:  # Stamped automatically by audit-stamp.ts from the `VALIDATOR_VERSION` constant baked into the running stamper. Leave blank — the stamper overwrites it. Must match the companion checklist exactly.
collector_version:  # Stamped automatically by audit-stamp.ts from the `COLLECTOR_VERSION` constant baked into the running collector. Leave blank — the stamper overwrites it. Must match the companion checklist exactly.
runner_agent:       # Stamped by audit-stamp.ts from --runner-agent or AI_CONTRIBUTOR_RUNNER_AGENT. Must match the companion checklist exactly.
runner_model:       # Stamped by audit-stamp.ts from --runner-model or AI_CONTRIBUTOR_RUNNER_MODEL. Must match the companion checklist exactly.
conformance_level:  # one of: none, 0, 1, 2, 3, 4. Stamped automatically by audit-stamp.ts from the highest ✅ Yes row in the Conformance level summary table on the companion checklist. Leave blank — the stamper overwrites it. Must match the companion checklist exactly.
---

# AI Contributor Audit Log

> Audit-log companion to [`AI-CONTRIBUTOR-CHECKLIST.md`](AI-CONTRIBUTOR-CHECKLIST.md). Record every auditor-run command used to gather evidence. The stamper records collector-run commands in the stamped block. A fresh checkout plus the same external-service access should reproduce the findings. This helps reviewers catch invented or stale evidence, especially in AI-run audits.
>
> Keep this file next to the checklist. Checklist evidence references point here for command output. Keep the stamper-owned frontmatter fields (`spec_source`, `assessment_started_at`, `assessment_completed_at`, `assessment_duration`, `audited_commit`, `auditor`, `validator_version`, `collector_version`, `runner_agent`, `runner_model`, `conformance_level`) in sync with the checklist frontmatter.

## Where this asset lives

- **This file belongs under `.ai-contributor-audit/`**, next to `AI-CONTRIBUTOR-CHECKLIST.md` and `AI-CONTRIBUTOR-EVIDENCE.json`.
- **Commit and push it with every audit**, together with the root `AI-CONTRIBUTOR-AUDIT.md` summary and the full `.ai-contributor-audit/` artifacts. `audited_commit`, `spec_source`, and `assessment_started_at` pin each audit to a point in time. Git history becomes the audit trail.
- **Prior audit logs live in git history.** To inspect old evidence, run `git log -- .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md` or `git show <sha>:.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`. Do not copy old entries into a new audit.

## Shortest correct use

Record one row for every command or hosted-setting check that supports the checklist. The first row is the evidence collector. Do not record `date` rows for the assessment timestamps — `audit-stamp.ts` stamps `assessment_started_at`, `assessment_completed_at`, and `assessment_duration` itself.

Keep each output excerpt short. Do not paste a full terminal session. Show enough for another reviewer to see which command produced each checklist status.

## Re-audit protocol (start from scratch)

The re-audit protocol is defined in [`AI-CONTRIBUTOR-CHECKLIST.md` § Re-audit protocol](AI-CONTRIBUTOR-CHECKLIST.md#re-audit-protocol-start-from-scratch). It applies to both files. Start from the blank template, let the collector and stamper write fresh timestamps, and let the stamper record an immutable `spec_source`. The first stamped evidence row must be the `audit-collect` command and its `[audit-collect] wrote ...` summary. Every checklist `Comment` must cite current-run evidence: a command in this log, a `file:line` or section citation from `audited_commit`, or `AI-CONTRIBUTOR-EVIDENCE.json` from this collector run.

## What to record

- **Use the table form only.** Columns: `Spec IDs | Rules | Command | Output excerpt`. This keeps audits easy to compare and validate.
- **Every evidence row must name the checklist rule(s) it supports** in the `Rules` column. Use `<preflight>` only for setup rows such as `audit-collect` and token disclosure.
- **Every non-preflight row must list the spec IDs it supports** in the `Spec IDs` column. Use backtick-quoted `AIC-*` IDs from [`AI-CONTRIBUTOR-SPECIFICATION.md`](../AI-CONTRIBUTOR-SPECIFICATION.md), separated by commas. Preflight rows such as `audit-collect` may leave `Spec IDs` blank and use `<preflight>` in `Rules`. CI checks non-preflight IDs against the spec and checklist.
- Include two to three rows per rule (or per cluster of related rules) — enough that a reviewer on a fresh clone can reproduce the finding without guessing which command produced which evidence.
- Paste the command exactly as run (including flags and working directory when non-obvious). `Output excerpt` is a short preview — up to ~5 lines, with long output truncated using `…` and a pointer like `# truncated — full output in <path or CI job link>`. Do not paste 20-line blocks into cells; move them to a linked file or gist.
- Prefer commands that read repository state (`ls`, `cat`, `grep`, `git log`, `git config --get-all branch.*.protection`, `gh api`, package-manager introspection). Avoid commands that mutate the repository or call external services with side effects.
- Redact secrets from pasted output. If a command's output would include credentials, record the command but replace secret values with `***redacted***` and note the redaction.
- If you relied on GitHub UI screenshots or settings pages that have no CLI equivalent, record the navigation path instead (for example `Settings → Branches → main → Require a pull request before merging: ON`) and still name the rule it evidences.
- For external settings that can be queried, prefer timestamped API evidence over UI memory. Record the exact endpoint or command, the authenticated actor or role if relevant, and the output excerpt. A local checkout cannot reproduce external branch protection, security settings, deployment environments, or SaaS policy state by itself.
- Negative findings count: a command that returned `No files found` or `no matches` is evidence for a `Warning` or `Alarm` row and should be logged with the rule it supports.

Example commands to record (illustrative, not exhaustive): `ls -la AGENTS.md .github/copilot-instructions.md CLAUDE.md .cursorrules`, `grep -n '"strict"' tsconfig*.json`, `pnpm test --reporter=min`, `pnpm audit --prod`, `gh api repos/:owner/:repo/branches/main/protection`, `gh secret list`, CI job IDs or URLs for protected-branch runs.

Row-shape examples, not live rows:

- Preflight row: leave `Spec IDs` blank, set `Rules` to `<preflight>`, record the `audit-collect` command, and paste its `[audit-collect] wrote ...` summary.
- Evidence row: set `Spec IDs` to one or more real backtick-quoted `AIC-*` IDs, set `Rules` to the exact checklist rule name, paste the command exactly as run, and include a short output excerpt.

---

Rows between `<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->` and `<!-- END:STAMPED-COLLECTOR-ROWS -->` are written by `audit-stamp.ts` from `AI-CONTRIBUTOR-EVIDENCE.json` — do not edit them. The stamper adds a checksum sentinel inside non-empty stamped blocks and refuses to overwrite a block whose checksum no longer matches. Add manual rows for judgment-required rules below the END marker.

| Spec IDs | Rules | Command | Output excerpt |
|---------|-----------------|---------|----------------|
<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->
<!-- END:STAMPED-COLLECTOR-ROWS -->

Append further rows as needed. If a rule is evidenced entirely by `AI-CONTRIBUTOR-EVIDENCE.json`, keep the collector row and cite `AI-CONTRIBUTOR-EVIDENCE.json` in the checklist Comment.

## Validating this audit log

Run the structural validator over both files before committing the audit. It cross-checks this log against [`AI-CONTRIBUTOR-CHECKLIST.md`](AI-CONTRIBUTOR-CHECKLIST.md) — every Comment that cites a `` `command` `` must match a Command cell here, every `Rules` entry must name a real checklist rule, and the synchronized frontmatter fields must be identical in both files. Exit 0 means the pair is mechanically consistent; exit 1 prints every defect with a stable `AUDITxxx` code.

Validation makes the audit mechanically consistent. A human or named accountable owner still reviews and accepts the filled artifacts before publishing a conformance claim, especially for agent-run audits.

```sh
# If the spec-repo tools package lives in your repo:
# Full cycle: collect, stamp, fill judgment-required rows, stamp again, validate
npm --prefix tools run audit -- \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
npm --prefix tools run audit:stamp     # writes derivable cells
npm --prefix tools run audit:validate  # read-only structural check

# Or invoke directly:
tsx skills/ai-contributor-audit/scripts/audit-stamp.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
tsx skills/ai-contributor-audit/scripts/audit-stamp.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --diff
tsx skills/ai-contributor-audit/scripts/audit-validate.ts \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md \
  .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md
```

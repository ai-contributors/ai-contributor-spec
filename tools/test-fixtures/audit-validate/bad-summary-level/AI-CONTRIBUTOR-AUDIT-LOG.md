---
spec_version: "0.2"
spec_source: https://github.com/ai-contributors/ai-contributor-spec/tree/0123456789abcdef0123456789abcdef01234567
assessment_started_at: 2026-04-25T10:00:00+02:00
assessment_completed_at: 2026-04-25T11:30:00+02:00
assessment_duration: 01:30:00
audited_commit: abc1234
auditor: Jane Smith
validator_version: "0.1.0"
collector_version: "0.1.0"
runner_agent: claude-code
runner_model: claude-opus-4-7
conformance_level: 1
---

# AI Contributor Audit Log

## What to record

| Spec IDs | Rules | Command | Output excerpt |
|---------|-----------------|---------|----------------|
<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->
<!-- STAMPED-BLOCK-SHA256: 7575d7df350aff611dabbbdc8c566c90af96b307fccfd29cc0383f3d114c61a6 -->

|  | `<preflight>` | `npx tsx skills/ai-contributor-audit/scripts/audit-collect.ts . --commit abc1234` | `[audit-collect] wrote AI-CONTRIBUTOR-EVIDENCE.json — 13 rules; Fulfilled=2 Warning=2 Alarm=0 judgment_required=0 token_tier=audit_read_only` |

<!-- END:STAMPED-COLLECTOR-ROWS -->
|  | `<preflight>` | `gh auth status` | `Logged in as audit-bot, scopes: read:org, public_repo, security_events` |
| `AIC-secret-vcs-exclude` | `Secret Hygiene` | `grep -n '\.env' .gitignore` | `2:.env` |
| `AIC-default-branch-protected` | `Branch Protection` | `gh api repos/:owner/:repo/branches/main/protection` | `required_pull_request_reviews: enabled` |
| `AIC-strict-typing-enabled` | `Strict Types` | `cat tsconfig.json` | `"strict": false` |

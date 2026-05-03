---
spec_version: "0.1"
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
---

# AI Contributor Audit Log

## What to record

| Spec IDs | Rules | Command | Output excerpt |
|---------|-----------------|---------|----------------|
|  | `<preflight>` | `npx tsx skills/ai-contributor-audit/scripts/audit-collect.ts . --commit abc1234` | `[audit-collect] wrote AI-CONTRIBUTOR-EVIDENCE.json — 13 rules; Fulfilled=2 Warning=2 Alarm=0 judgment_required=0 token_tier=audit_read_only` |
|  | `Secret Hygiene` | `grep -n '\.env' .gitignore` | `2:.env` |
|  | `Branch Protection` | `gh api repos/:owner/:repo/branches/main/protection` | `required_pull_request_reviews: enabled` |
|  | `Strict Types` | `cat tsconfig.json` | `"strict": false` |

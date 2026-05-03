---
spec_version: "0.1"
spec_source: https://github.com/ai-contributors/ai-contributor-spec/tree/0123456789abcdef0123456789abcdef01234567
assessment_started_at: 2026-04-25T10:00:00+02:00
assessment_completed_at: 2026-04-25T11:30:00+02:00
assessment_duration: 01:30:00
audited_commit: abc1234
auditor: Jane Smith
validator_version: "0.0.1-mismatch"
collector_version: "0.1.0"
runner_agent: claude-code
runner_model: claude-opus-4-7
conformance_level: none
---

# AI Contributor Conformance Checklist

## Conformance level summary

| Level | Status | Date reached | Notes |
|-------|--------|--------------|-------|
| **Level 1 — Hardened** | ⚠️ Partial | | Strict Types still Warning |
| **Level 2 — AI Assisted** | ❌ No | | |
| **Level 3 — AI Authored** | ❌ No | | |
| **Level 4 — AI Autonomous** | ❌ No | | |

## Backlog — what to address first

| Priority | Rule | Scope | Current status | Next action | Owner | Target date |
|----------|------|-------|----------------|-------------|-------|-------------|
| 3 | `Strict Types` | MUST | ⚠️ Warning | Enable `"strict": true` in tsconfig.json | | |
| 5 | `Mock Mode` | SHOULD | ⚠️ Warning | Document a no-credentials local mode | | |

## `MUST`

| Rule | Pillar | Min Level | Requirement | Status | Comment |
|------|--------|-----------|-------------|--------|---------|
| `Secret Hygiene` | 2 | L1 | Secrets and local environment files are excluded from version control. | ✅ Fulfilled | `grep -n '\.env' .gitignore` → `2:.env` |
| `Branch Protection` | 4 | L1 | Protected branches and required checks are enabled. | ✅ Fulfilled | `AI-CONTRIBUTOR-EVIDENCE.json` → `rules.branch-protection.derived_status: Fulfilled`; `rules.branch-protection.derivation_reason` records required protection |
| `Strict Types` | 1 | L1 | Strict typing is enabled. | ⚠️ Warning | tsconfig.json:4 — needs `"strict": true` |

## `MUST when applicable`

| Rule | Pillar | Min Level | Requirement | Status | Comment |
|------|--------|-----------|-------------|--------|---------|
| `SBOM` | 4 | L1 | Repositories that ship artifacts can generate a software bill of materials. | ➖ Not relevant | No public release — repo is internal-only, confirmed in `README.md:5` |

## `SHOULD`

| Rule | Pillar | Min Level | Requirement | Status | Comment |
|------|--------|-----------|-------------|--------|---------|
| `Mock Mode` | 2 | L4 | Safe local mode that avoids requiring live credentials. | ⚠️ Warning | `README.md:42` — no mock-mode instructions; deferred |

## `MAY`

| Rule | Pillar | Min Level | Requirement | Status | Comment |
|------|--------|-----------|-------------|--------|---------|
| `Fuzzing` | 3 | — | Parser-heavy components use fuzzing. | | |

## Verification gaps

| Row | Status | What was verified | What is still unverified | What the owner should check |
|-----|--------|-------------------|--------------------------|------------------------------|
| | | | | |

_No verification gaps — every non-blank status has direct evidence._

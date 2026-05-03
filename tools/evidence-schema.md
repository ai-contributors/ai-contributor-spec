# `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` schema (v1)

Output of `skills/ai-contributor-audit/scripts/audit-collect.ts`. Consumed by the audit skill to
fill `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` without re-deriving deterministic rule
statuses. Two runs of the collector against the same `audited_commit` produce
byte-identical evidence outside time-derived fields and external command
output.

For implementers: this file describes what the collector records. It does not
define conformance by itself; the specification and checklist decide how
evidence maps to status.

## Top-level fields

| Field | Type | Notes |
|---|---|---|
| `$schema_version` | `"1"` | Bumped on breaking changes. |
| `audit_collect_version` | string | Version of the collector binary. |
| `spec_version` | string \| null | Specification version read from the audited checklist template when available. |
| `assessment_started_at` | string | ISO 8601 date-time with seconds, captured at the start of the collector run. Source of truth for the audit log's `assessment_started_at` — `audit-stamp.ts` reads this field and stamps it into the audit log frontmatter. |
| `spec_source` | string \| null | Pinned ref/SHA the audit cites. Filled by the skill, not the collector. |
| `target` | object | See below. |
| `preflight` | object | Worktree state, tooling versions, extraction location, and executor metadata. |
| `stack` | object | Detected stack(s) and the files the detection relied on. |
| `scope_inventory` | object | Inventory units (workspaces / build units) and any deliberate exclusions. |
| `profile` | object | Owner-confirmed applicability answers from `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`. |
| `github_api` | object | Active GitHub API login, token tier, observed scopes, and bounded auth-status excerpt. |
| `ai_surface_inventory` | object | Inventory of AI-facing files and AI SDK dependencies. Evidence-only; no rule status derived. |
| `applicability_hints` | object | Repo-shape classification used to pre-fill the owner profile. Evidence-only; no rule status derived. |
| `hosted_settings` | object | Normalized GitHub-API-derived signals (branch protection, required checks/reviews, codeowners enforcement, secret scanning, push protection, dependency alerts, deployment environments). Each field carries `value` / `source` / `last_checked`. |
| `bootstrap_smoke` | object | Opt-in clean-clone install + build evidence. Off by default; `enabled: false`, `ran: false` unless `--enable-bootstrap-smoke` is set. |
| `rules` | object | Per-rule evidence. Keys are stable rule IDs (kebab-case). |
| `errors` | array | Collector-level errors (rule errors live in their rule entry). |

## `target`

```json
{
  "path": "/abs/path/to/repo",
  "audited_commit": "094d535…",            // SHA, or "working-tree:HEAD=<sha>+dirty"
  "default_branch": "main",
  "host": { "kind": "github", "owner": "Foo", "repo": "Bar" },
  "mode": "sha-pinned" | "working-tree"
}
```

`mode: "working-tree"` indicates the audit was *not* SHA-pinned. The validator
must refuse to score such an audit as conformance against a release tag.

## `preflight`

`extracted_to` is the temporary worktree path created by
`git worktree add --detach`. It is removed at process exit. The
`original_worktree_status` field records `git status --porcelain` of the
caller's checkout for traceability — uncommitted changes there do not affect
the audit because evidence commands run inside the extracted tree.

`node_modules_cache_hit` is `true` when the collector hardlinked the caller's
`node_modules` into the extracted tree because lockfiles matched. Pure
performance optimization; does not influence rule status.

`executor` records the TypeScript executor used by prompt/skill/runbook flows,
including the exact npm package pin. The current prompt and skill invoke the
runtime with `npx --yes tsx@4.21.0`, so evidence records:

```json
{
  "package": "tsx",
  "version": "4.21.0",
  "pin": "tsx@4.21.0",
  "pin_kind": "npm-exact-version",
  "invocation": "npx --yes tsx@4.21.0",
  "node_version": "v24.11.1",
  "entrypoint": "audit-collect.ts"
}
```

The executor pin is package-version pinning, not a SHA or lockfile pin. It is
recorded so reviewers can reproduce which executor family ran the pinned
runbook.

## `profile`

The collector reads `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`
from the audited worktree when present. Missing profiles are allowed but are
reported in `profile.warnings` so auditors can tell that owner applicability
steering was not provided. When the profile is missing, the collector records
`default_policy: "all_checks_on_when_missing"` and emits `yes` answers with
`evidence_kind: "collector_default"` for every canonical profile question. This
means the audit runs with all profile-controlled checks enabled; absence of a
profile never disables a row.

When a profile exists but contains no explicit `yes` or `no` answers, the
collector treats it as an untouched template. It records
`default_policy: "all_checks_on_when_empty"`, emits the same collector-default
`yes` answers, and warns that the profile has not provided confirmed steering.

```json
{
  "path": ".ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md",
  "present": true,
  "default_policy": "owner_profile",
  "answers": [
    {
      "question_id": "env-required",
      "question": "Apply environment-variable template checks?",
      "answer": "no",
      "owner_evidence": "No runtime or contributor-supplied environment variables.",
      "evidence_kind": "owner_attestation",
      "evidence_use": "applicability",
      "affected_aic_ids": ["AIC-env-example-placeholders"],
      "source_line": 10
    }
  ],
  "warnings": [],
  "errors": []
}
```

Valid answer values are `"yes"`, `"no"`, or `""` for blank. `evidence_kind` is
`"owner_attestation"` for confirmed answers read from the profile and
`"collector_default"` for missing-profile defaults. The JSON field remains
`owner_evidence` for compatibility; it can contain repository evidence,
agent-discovered rationale, or owner-only rationale confirmed during the
profile step. Invalid values
are recorded in `profile.errors`, mirrored into top-level `errors` with
`stage: "profile"`, and make the collector exit with code 3. Unsupported
questions are recorded as warnings. Affected AIC IDs are validated against the
target checklist when available, otherwise against the collector's built-in
profile map.

## `github_api.token_tier`

| Tier | Meaning | Effect on hosted-settings rules |
|---|---|---|
| `none` | `gh` not installed, not logged in, `gh api user` failed, or `--no-network` | `derived_status: null`, `judgment_required: true` (skill renders as Verification gap) |
| `api_identity_verified_scopes_unknown` | `gh api user` succeeded, but token scopes were not reported because `gh auth status` failed or timed out | Status set normally; `Fulfilled` hosted evidence records the missing scope classification in `derivation_reason` |
| `audit_read_only` | scopes were observed and are limited to `{read:org, public_repo, read:packages, security_events, repo:status}` | Status set normally |
| `broad_write_capable` | scopes include any of `repo`, `workflow`, `admin:*`, `delete:*`, `write:*` | Status set normally; `Fulfilled` hosted evidence records the broad token tier in `derivation_reason` |

The collector uses `gh api user --jq .login` as the primary bounded identity
probe. `gh auth status` is used only as a bounded diagnostic to classify token
scope breadth when it returns promptly; a keyring timeout there does not erase
successful API identity evidence.

The validator's `AUDIT039` check refuses a `Fulfilled` checklist row for a
collector-derived rule when the row's Comment does not cite `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`.
Hosted-settings derivations collected under `broad_write_capable` or
`api_identity_verified_scopes_unknown` are evidence caveats, not automatic
checklist-status downgrades. The row can remain `Fulfilled` when the hosted
control is actually enabled, but the caveat must remain visible in
`derivation_reason` / the stamped comment.

## `ai_surface_inventory`

Evidence-only inventory of AI-facing files and AI SDK dependencies tracked at
`audited_commit`. Other audit packages (`ai-instructions`, `mcp-inventory`,
`prompt-skill-inventory`) consume this list; the collector itself derives no
rule status from it. Missing files yield empty arrays, never errors.

```json
{
  "instruction_files": ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"],
  "rule_files": [".cursor/rules/strict-types.md"],
  "skill_files": [".claude/skills/audit/SKILL.md"],
  "prompt_files": ["prompts/triage.md"],
  "mcp_config_files": [".mcp.json", ".claude/mcp.json"],
  "ai_sdk_deps": [
    { "name": "@anthropic-ai/sdk", "manifest": "package.json" },
    { "name": "openai", "manifest": "services/api/package.json" }
  ]
}
```

Detected paths (top-level instruction files):
`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`,
`.cursorrules`. Detected directories: `.cursor/rules/**` (rule files),
`.claude/skills/**`, `.agents/skills/**`, `skills/**` (skill files),
`.claude/prompts/**`, `.agents/prompts/**`, `prompts/**` (prompt files).
Detected MCP config files: `.mcp.json`, `.claude/mcp.json`, `.cursor/mcp.json`,
`.codex/mcp.json`. AI SDK deps are scanned in every tracked `package.json`,
`pyproject.toml`, and `requirements*.txt`; entries are sorted by `(name,
manifest)` for byte-identical reproducibility.

## `applicability_hints`

Evidence-only repo-shape classification. Feeds the owner-profile draft so
applicability rows can be pre-filled from observable signals; the auditor or
owner still confirms. No AIC rule is decided here.

```json
{
  "shapes": ["containerized", "deploying", "package", "service"],
  "signals_by_shape": {
    "package": ["package.json: name=foo"],
    "service": ["package.json: dep express"],
    "web-ui": [],
    "cli": [],
    "library": [],
    "containerized": ["Dockerfile"],
    "deploying": ["terraform/", ".github/workflows/deploy-prod.yml"],
    "...": []
  }
}
```

Recognized shapes: `package`, `service`, `web-ui`, `cli`, `library`,
`containerized`, `deploying`. A shape only appears in `shapes` when its
`signals_by_shape` array is non-empty; multi-shape repos return multiple
shapes, each with at least one cited signal.

## `hosted_settings`

Normalized view of every GitHub-API-derived signal the collector probes,
so rules and auditors can read from one shape instead of re-parsing each
endpoint's response. Each field uses the same envelope:

```json
{
  "value": <typed value or null>,
  "source": "gh:rules-api" | "gh:protection-api" | "gh:repo" | "gh:secret-scanning" | "gh:dependabot" | "gh:environments" | "no-host-access",
  "last_checked": "2026-05-01T12:34:56.789Z"
}
```

Fields:

| Field | `value` shape |
|---|---|
| `branch_protection` | `{ active, permissive_bypass }` |
| `required_status_checks` | `string[]` (rule contexts) |
| `required_reviews` | `{ count, dismiss_stale }` |
| `codeowners_enforced` | `boolean` |
| `secret_scanning` | `"enabled"` / `"disabled"` |
| `push_protection` | `"enabled"` / `"disabled"` |
| `dependency_alerts` | `{ open_high }` |
| `deployment_environments` | `[{ name, has_required_reviewers, required_reviewer_count }]` |

`value: null` + `source: "no-host-access"` is the verification-gap shape;
the collector falls back to it when `gh` is missing, `--no-network` is
set, or no GitHub remote is configured. `last_checked` mirrors
`assessment_started_at` so re-runs against unchanged settings produce
byte-identical hosted_settings (modulo the time fields documented under
"Reproducibility-stable fields"). Endpoint responses are memoized so the
hosted_settings builder and the rules consuming the same endpoint share
one round-trip.

## Per-rule evidence

```json
{
  "spec_rule_name": "Lockfile Integrity",
  "applicability": {
    "verdict": "applicable" | "not_applicable" | "unknown",
    "trigger_evidence": "lockfiles found: pnpm-lock.yaml"
  },
  "commands": [
    {
      "cmd": "pnpm install --frozen-lockfile --ignore-scripts --prefer-offline --lockfile-only",
      "cwd": "<extracted>",                  // relative form — no random tmpdir suffix
      "exit_code": 0,
      "duration_ms": 4123,
      "stdout_excerpt": "Scope: all 7 workspace projects\nDone in 297ms",
      "kind": "shell" | "gh_api",
      "response_summary": { /* parsed JSON for gh_api responses */ }
    }
  ],
  "derived_status": "Fulfilled" | "Warning" | "Alarm" | "Not relevant" | null,
  "derivation_reason": "all 1 lockfile(s) installed cleanly with frozen-lockfile",
  "judgment_required": false,
  "aic_ids": ["AIC-lockfile-integrity-hashes", "AIC-lockfile-enforced-in-ci"],
  "raw_artefact_refs": ["AGENTS.md"],        // present for judgment-required rules
  "errors": []                                // command-level failures, if any
}
```

`derived_status: null` + `judgment_required: true` means the skill must read
`raw_artefact_refs` (or fall back to its existing §6 procedure) and decide
the status itself. Rules in v0.1 with this shape: `AI Instructions`,
`AI Boundaries`, `Architecture Boundaries`, `Threat Model`, etc.

`derived_status` set + `judgment_required: false` means the skill MUST copy
the status verbatim. Re-deriving it is a defect.

`aic_ids` lists every checklist `AIC-*` row whose Status is determined by this
rule's `derived_status` (when `judgment_required: false`). `audit-stamp.ts`
joins on these IDs directly to stamp rows; no naming heuristic is applied.
Empty array means the rule does not deterministically map to any specific AIC
ID and the stamper writes nothing for it.

## Stable rule IDs (v0.1)

| Rule ID | Spec rule name | Status mode |
|---|---|---|
| `lockfile-integrity` | Lockfile Integrity | derived |
| `branch-protection` | Branch Protection | derived (hosted, token-tier caveat-aware) |
| `build-immutable-refs` | Build Immutable Refs | derived (workflow `uses:` SHA pinning) |
| `workflow-token-least-privilege` | Workflow Token Least Privilege | derived (workflow / job `permissions:`) |
| `sbom-generation` | SBOM Generation | derived (SBOM-generating action / format directive) |
| `artifact-signing` | Artifact Signing | derived (cosign / sigstore / attest-build-provenance / SLSA) |
| `build-provenance-attestation` | Build Provenance Attestation | derived (attest-build-provenance / SLSA) |
| `release-from-ci` | Release from CI | derived (publish step + tag/release gating) |
| `dead-code-and-cycles-surfaced` | Dead Code and Cycles Surfaced | derived (knip / depcheck / ts-prune / madge / unimported / vulture in deps + invocation) |
| `architecture-rules-automated` | Architecture Rules Automated | derived (dependency-cruiser / eslint-plugin-boundaries / import-linter / ESLint `import/no-restricted-paths`) |
| `credential-leakage-checks` | Credential Leakage Checks | derived (gitleaks / trufflehog / detect-secrets / secretlint / ggshield) |
| `secret-vcs-exclude` | Secret VCS Exclude | derived (no tracked secret-bearing files + protective `.gitignore`) |
| `credential-handling-documented` | Credential Handling Documented | derived (README/CONTRIBUTING/SECURITY/AGENTS/docs subject + guidance) |
| `env-example-placeholders` | Env Example Placeholders | derived (`.env.example` values match placeholder shapes) |
| `ai-instruction-authoritative` | AI Instruction Authoritative | derived (single canonical instruction file; pointer files via 5-gram Jaccard similarity) |
| `tool-specific-pointer-only` | Tool-Specific Pointer Only | derived (canonical referenced from README/CONTRIBUTING; non-canonical files classified pointer-only) |
| `ai-forbidden-actions` | AI Forbidden Actions | derived (canonical instruction file contains "do not" / "never" / "must not" directives) |
| `mcp-root-scoping` | MCP Root Scoping | derived (every configured MCP root is workspace-scoped — `$HOME`, `~/`, `/`, `/etc`, `/usr`, `/var` Alarm) |
| `mcp-pinned-versions` | MCP Pinned Versions | derived (every MCP server pins its package version; `@latest`, `^x.y.z`, etc. Warning) |
| `mcp-read-only-default` | MCP Read-Only Default | derived (`--read-only` arg or `READ_ONLY=true` env signal on every MCP server) |
| `prompt-audit-trail` | Prompt Audit Trail | derived (doc-corpus mention of audit trail OR tracked path under known audit-trail location) |
| `sensitive-path-ownership` | Sensitive Path Ownership | derived (CODEOWNERS covers tracked sensitive paths — `.github/workflows`, `infra/`, `terraform/`, `migrations/`, `db/`, `charts/`, `Dockerfile*`) |
| `multiple-test-layers` | Multiple Test Layers | derived (≥2 distinct test layers from runner configs / test directory layout) |
| `coverage-as-minimum` | Coverage as Minimum | derived (coverage threshold > 0 in jest/vitest/pytest config; threshold = 0 is Warning) |
| `formatting-automated` | Formatting Automated | derived (formatter config + CI/script/pre-commit invocation; config without invocation is Warning) |
| `authoritative-guardrail-doc` | Authoritative Guardrail Doc | derived (recognized guardrail catalog — `docs/guardrails.md` or `GUARDRAILS.md` — linked from README or canonical instruction file) |
| `ai-authorship-traceability` | AI Authorship Traceability | derived (`Co-Authored-By:` trailer matching known AI authors over the last N commits; window via `--authorship-window`) |
| `deploy-env-approvals` | Deployment Environment Approvals | derived (every GitHub deployment environment has required reviewers; production-named env without reviewers Alarms) |
| `clean-clone-bootstrap` | Clean Clone Bootstrap | opt-in; auditor-owned unless `--enable-bootstrap-smoke` is set, then derived from a fresh-clone install + build (any non-zero exit Alarms) |

Future v0.x rules: `lint-rules`, `strict-types`, `pinned-toolchain`,
`pre-commit`, `ci-gates`, `human-review-required`, `gate-enforcement`,
`secret-scanning`, `push-protection`, `dependency-security`,
`automated-dependency-updates`.

## Reproducibility-stable fields

These fields are time-derived or contain external-tool output and MUST be
excluded from any byte-identical reproducibility check:

- `preflight.started_at`, `preflight.completed_at`, `preflight.extracted_to`,
  `preflight.node_modules_cache_hit` (depends on caller's `node_modules`)
- `rules[].commands[].duration_ms`
- `rules[].commands[].stdout_excerpt`, `stderr_excerpt`
  (external tools embed timing strings that vary)

Everything else is expected to be byte-identical across two runs of the
collector against the same `audited_commit`. Drift in any other field is a
collector bug, not a target-repo signal.

# AI Contributor Adoption Guide

> **Version:** 0.1.1 · **Reference specification:** [`AI-CONTRIBUTOR-SPECIFICATION.md`](AI-CONTRIBUTOR-SPECIFICATION.md) v0.1.1 · **Change history:** [`CHANGELOG.md`](CHANGELOG.md)

A step-by-step adoption path for small teams and solo developers building TypeScript web applications on GitHub. Follow it from top to bottom. Each phase moves the repository to the next level: Phase 0 → Level 0, Phase 1 → Level 1 and simple Level 2 workflows, Phase 2 → Level 3, Phase 3 → Level 4.

## Shortest Useful Path

For a new TypeScript + pnpm repository:

1. Do Phase 0 before any AI tool reads or changes the repository.
2. Do Phase 1 before AI-generated changes can be accepted into code that may ship.
3. Do Phase 2 before agents open PRs, edit files as delegated workers, use shared skills, or use governed tooling.
4. Do Phase 3 before any AI runner can merge, release, deploy, or change settings without approval for each action.

You do not need to understand every clause before starting. Follow the steps, keep the evidence, then use the checklist to score the repository.

## Before you start

- **Scope.** This guide is for GitHub + TypeScript + web. The specification itself is vendor-neutral. See [`CONTRIBUTING.md`](CONTRIBUTING.md) if you want to add a guide for another stack.
- **Repository target.** Adopt this in one repository at a time. It works for solo projects, team repositories, multi-team repositories, and monorepos. The checklist stays the same; owners, approval paths, package instructions, workspace commands, and CODEOWNERS coverage scale with the repository.
- **How to read each step.** Every step has **Do**, **Why**, **How**, **Verify**, **Scored as**, and **Spec reference**. **Scored as** names the checklist rows an auditor will look for.
- **Verify is a self-check.** The **Verify** commands tell you whether the step works as a developer. The audit collector may run narrower commands and may still mark a row `Warning` if it cannot find committed evidence. Treat **Verify** as a handoff check, not as a replacement for the audit.
- **Checkpoints are not shortcuts.** Each phase ends with "You can stop here if…". That marks the level you reached. Stopping mid-phase leaves required rows unmet.
- **Time.** Each phase fits in one to two afternoons for a new repository.

## Contents

- [Phase 0 — Before AI touches your repo](#phase-0--before-ai-touches-your-repo) (Level 0 — Baseline Hygiene · 3 steps)
- [Phase 1 — Before AI assists shipped changes](#phase-1--before-ai-assists-shipped-changes) (Level 1 + Level 2 · 12 steps)
- [Phase 2 — Before AI materially authors code or uses governed tooling](#phase-2--before-ai-materially-authors-code-or-uses-governed-tooling) (Level 3 · 6 steps)
- [Phase 3 — Before the full Level 4 audit](#phase-3--before-the-full-level-4-audit) (Level 4 · 9 steps)
- [Going further — beyond Level 4](#going-further--beyond-level-4)

---

## Phase 0 — Before AI touches your repo

_Completes Level 0 — Baseline Hygiene. This is the minimum baseline. Level 1 builds on it._

### Step 0.1: Reproducible environment

**Do:** Pin Node, pin pnpm, commit the lockfile, verify a clean clone boots.

**Why:** AI agents often create changes that work only in one local setup. They add new tooling without warning, and without pinning you cannot tell agent regressions from environment drift.

**How (TypeScript + pnpm + GitHub):**
- Pin `packageManager` and `engines` in [`examples/typescript-pnpm/template/package.json`](examples/typescript-pnpm/template/package.json)
- Pin the Node version in [`examples/typescript-pnpm/template/.nvmrc`](examples/typescript-pnpm/template/.nvmrc)
- Pin the toolchain in CI: [`examples/typescript-pnpm/template/.github/workflows/ci.yml`](examples/typescript-pnpm/template/.github/workflows/ci.yml)
- Install with `pnpm install --frozen-lockfile` in every CI job

**Verify (contributor):** `rm -rf node_modules && pnpm install --frozen-lockfile && pnpm build` succeeds from a fresh clone.

**Verify (auditor will run):** `pnpm install --frozen-lockfile --ignore-scripts --prefer-offline --lockfile-only` (per [`audit-collect.ts` `ruleLockfileIntegrity`](skills/ai-contributor-audit/scripts/audit-collect.ts)). This proves the lockfile resolves without running scripts. The auditor does not run `pnpm build`; toolchain pinning is scored separately from `.nvmrc` and `packageManager`.

**Scored as:** `Clean Setup`, `Lockfile Integrity`, `Pinned Toolchain`, `Platform Targets` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §1 — Reproducible environment](AI-CONTRIBUTOR-SPECIFICATION.md#1-reproducible-environment)

### Step 0.2: Automated formatting

**Do:** Configure an automated formatter (Prettier for TS/JS) and enforce it on every commit.

**Why:** Consistent formatting keeps diffs reviewable. AI-generated code often changes whitespace and quote style. Automated formatting removes that noise.

**How (TypeScript + pnpm + GitHub):**
- Prettier config: [`examples/typescript-pnpm/template/.prettierrc`](examples/typescript-pnpm/template/.prettierrc)
- Wire it into the pre-commit hook (Husky) and CI; `pnpm format:check` is the merge gate.

**Verify (contributor):** `pnpm format:check` passes on a fresh clone. Introduce inconsistent whitespace and confirm the gate fails.

**Verify (auditor will check):** the auditor looks for formatter config plus a CI or pre-commit step that runs it. A config file alone is a `Warning`. Wire the formatter into both your pre-commit hook and a CI job before handoff.

**Scored as:** `Formatting` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §2 — Static correctness](AI-CONTRIBUTOR-SPECIFICATION.md#2-static-correctness)

### Step 0.3: Secrets and credentials

**Do:** Add `.env` and `.env.*` to `.gitignore`. Add `!.env.example` so the example file can still be committed. Commit a `.env.example` with placeholder values only.

**Why:** Committed secrets stay in git history forever, even after a force-push. AI agents scaffold `.env` files routinely and may not know your exclusion rules. `.gitignore` makes that mistake impossible.

**How (TypeScript + pnpm + GitHub):**
- Use this `.gitignore`: [`examples/typescript-pnpm/template/.gitignore`](examples/typescript-pnpm/template/.gitignore)
- Use this `.env.example` pattern: [`examples/typescript-pnpm/template/.env.example`](examples/typescript-pnpm/template/.env.example)
- Document credential handling in `AGENTS.md` or `CONTRIBUTING.md`: where contributors and automation get tokens, which env vars are required, and how to rotate credentials.

**Verify:** `git ls-files | grep -E '(^|/)\.env$'` returns nothing.

**Scored as:** `Secret Hygiene`, `Env Template`, `Credential Documentation` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §5 — Secrets and credentials](AI-CONTRIBUTOR-SPECIFICATION.md#5-secrets-and-credentials)

### Phase 0 checkpoint

You can stop here if: **AI is not yet part of your contribution workflow** and you want the baseline in place before AI contributes.

Phase 0 covers the Level 0 requirements: reproducible environment, automated formatting, secrets hygiene, and credential handling. Continue to Phase 1 before AI assistance contributes to changes that may ship.

_Completes Level 0 — Baseline Hygiene._

Continue to Phase 1 before AI assistance contributes to changes that may ship to users.

---

## Phase 1 — Before AI assists shipped changes

_Earns Level 1 (Hardened). With AI instructions, AI-output licensing, authorship tracking, and AI-surface redaction in place, it also supports Level 2 (AI Assisted) for human-accepted assistance workflows when the applicable §18–§20 rows are closed._

### Step 1.1: Add an authoritative AI instruction file

**Do:** Make `AGENTS.md` the main instruction file at the repository root. Reduce tool-specific files (`.github/copilot-instructions.md`, `CLAUDE.md`, `.cursorrules`, etc.) to a one-line pointer back to it.

**Why:** Without one main file, each AI tool can follow different rules. The repository can drift into conflicting guidance across `.github/copilot-instructions.md`, `CLAUDE.md`, `.cursorrules`, `AGENTS.md`, and other files. A single source keeps the rules consistent while still working with each tool's auto-load behavior.

**How (TypeScript + pnpm + GitHub):**
- **Authoritative file:** `AGENTS.md` at the repo root.
- **Tool-specific pointers** — keep each to a single line so no tool can read stale content:
  - `.github/copilot-instructions.md` → `See ../AGENTS.md.`
  - `CLAUDE.md` → `See AGENTS.md.`
  - `.cursorrules` and any other tool dotfile → same one-line pointer pattern.

  Add every pointer file to `CODEOWNERS` (wired formally in Step 1.10) so a pointer can't silently re-expand into a second source of truth.
- **Minimum content** in `AGENTS.md`: architecture overview, coding conventions and architectural boundaries, non-negotiable invariants, canonical commands (`pnpm install`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm type-check`), forbidden actions (destructive / security-sensitive / release-affecting — see `AI-CONTRIBUTOR-SPECIFICATION.md` §23), how contributors and automation obtain credentials (which env vars are required, where dev secrets live, how to rotate), readiness criteria for merge (what counts as done — tests green, spec reference met, human approval obtained), and links to `AI-CONTRIBUTOR-SPECIFICATION.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, and your approved AI provider list.
- **Monorepos:** if the repository has multiple apps or packages with distinct rules, add path-scoped `AGENTS.md` files next to the code they govern (`apps/web/AGENTS.md`, `packages/ui/AGENTS.md`, etc.). Keep the root file authoritative for approval boundaries and forbidden actions — nested files extend the root, they don't override it. Tools that support nearest-in-tree precedence (Codex, Copilot) will load these automatically; tools that do not support this will use the root file.
- **Recommended sectioning (not normatively required):** the audit-spec community recommends keeping `AGENTS.md` as the *operating manual* (terse, agent-readable, fits in a context window) and putting governance content (the full provider/MCP allowlist, the data-classification matrix, the incident playbook) in a separate `GUARDRAILS.md` at the repo root (or `docs/guardrails.md` if your project keeps governance docs under `docs/`). This is the same split as `CONTRIBUTING.md` versus `SECURITY.md` — same repo, different audiences and review cadences. The collector recognizes both `GUARDRAILS.md` and `docs/guardrails.md` as the `AIC-authoritative-guardrail-doc` location (Step 7.1). Recommended section names — copy-pasteable starting points, not enforced — are:
  - **`AGENTS.md`:** `## Authority and scope` · `## Forbidden actions` · `## Approved AI providers and MCP servers` · `## Data handling` · `## Reliability and observability` · `## Skills, prompts, and audit trail`
  - **`GUARDRAILS.md`:** `## Status and scope` · `## What is automated vs manual` · `## Provider and model allowlist` · `## MCP server allowlist` · `## Data classification and AI permissions` · `## Authorship and prompt audit` · `## Incident response and policy ownership`

  The names borrow from existing terminology (allowlist, data classification, incident response) and avoid neologisms. A small repo can keep everything in `AGENTS.md` (the spec is format-agnostic on §24); the split is the recommended pattern once any single section grows past about 30 lines or needs a different reviewer than the rest. Worked examples ship in [`examples/typescript-pnpm/template/AGENTS.md`](examples/typescript-pnpm/template/AGENTS.md) and [`examples/typescript-pnpm/template/GUARDRAILS.md`](examples/typescript-pnpm/template/GUARDRAILS.md).
- See [`examples/typescript-pnpm/hints-typescript-pnpm.md` §17](examples/typescript-pnpm/hints-typescript-pnpm.md#17-ai-operating-model) for a worked example.

**Tradeoff:** Claude Code auto-loads `CLAUDE.md` from the working directory. Recent versions also read `AGENTS.md`. Keeping the one-line `CLAUDE.md` pointer preserves auto-load behavior across tool versions. The cost is trivial and it keeps all instruction files aligned.

**Verify:** `ls AGENTS.md` succeeds. Every tool-specific instruction file at the repo root is three lines or fewer and contains only a pointer to `AGENTS.md`. Following only `AGENTS.md` on a fresh clone, a new contributor can run every canonical command and obtain the credentials they need.

**Scored as:** `Single AI Source`, `AI Instructions`, `AI Boundaries` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §17 — AI operating model](AI-CONTRIBUTOR-SPECIFICATION.md#17-ai-operating-model)

### Step 1.2: Branch protection and human review

**Do:** Require a human-reviewed pull-request path on `main` and require passing status checks before merge.

**Why:** Once AI is contributing, you need one guaranteed gate before its changes reach your main branch. Branch protection makes that gate required.

**How (TypeScript + pnpm + GitHub):**
- On GitHub: **Settings → Branches → Add branch protection rule →** Branch name pattern `main` → check "Require a pull request before merging" and "Require status checks to pass before merging".
- Also check "Do not allow bypassing the above settings" so admins are held to the same rule.
- Require that required-review approvals come from human reviewers. Enable "Require approval from someone other than the last pusher" so an agent that pushes a commit cannot approve it. Keep bot and GitHub App accounts out of any team that is listed as a Code Owner or counted toward the required-review count — on GitHub there's no native toggle for "bots may not approve," so this control is enforced through team membership.
- **Solo-maintainer mode:** pick one pattern and write it down in the AI policy. **Checks only:** set required reviewers to 0, keep strong CI, signed commits, and linear history, then treat the owner's manual merge as the approval checkpoint; score `Human Review Required` as `Warning` and explain why. **Bot identity:** use an agent, bot, or GitHub App identity to open the PR, then have the human repository owner review and merge after checks pass; this pattern fits best when AI runs in CI or when a second human is involved. If the human owner pushes the material change under their own account and then supplies the only approval, the approval is not independent review under the specification.

**Verify (contributor):** A direct push to `main` from a local branch is rejected with "protected branch." A PR opened and approved only by a bot account cannot be merged.

**Verify (auditor will check):** branch protection is a hosted setting; the auditor calls the GitHub API (`gh api repos/<owner>/<repo>/branches/<default>/protection`) per [`audit-collect.ts` `ruleBranchProtection`](skills/ai-contributor-audit/scripts/audit-collect.ts) and records `derived_status` from the response. Without a token that has admin:repo scope the row demotes to `Warning` — the auditor's evidence is the API response, not your local push attempt. Disclose the token tier (`gh auth status`) in the audit log so the demotion is auditable.

**Scored as:** `Branch Protection`, `Human Review Required`, `CODEOWNERS` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §16 — Branch protection, ownership, and release governance](AI-CONTRIBUTOR-SPECIFICATION.md#16-branch-protection-ownership-and-release-governance)

### Step 1.3: Static correctness — typing, lint, and dead code

**Do:** Enable TypeScript strict mode, lint with correctness rules, block unused variables and dead code.

**Why:** When AI writes code that compiles but does something subtly different from what you asked for, the type checker and lint rules are your first line of defense. An escape hatch like `any` hides exactly the bugs AI is most likely to introduce.

**How (TypeScript + pnpm + GitHub):**
- Strict TypeScript: [`examples/typescript-pnpm/template/tsconfig.base.json`](examples/typescript-pnpm/template/tsconfig.base.json)
- Flat ESLint config with correctness rules: [`examples/typescript-pnpm/template/eslint.config.js`](examples/typescript-pnpm/template/eslint.config.js)
- Forbid `any` unless explicitly justified. Treat unused imports and dead code as errors, not warnings.

**Verify:** `pnpm type-check && pnpm lint` both pass. Introduce `let x: any = 1` and confirm lint fails.

**Scored as:** `Strict Types`, `Lint Rules`, `Dependency Hygiene`, `Debug Statement Hygiene` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §2 — Static correctness](AI-CONTRIBUTOR-SPECIFICATION.md#2-static-correctness)

### Step 1.4: Architecture boundaries

**Do:** Define your module / package / layer responsibilities and enforce allowed dependency directions in lint rather than review.

**Why:** AI will import anything it can resolve. Without automated boundary checks, AI-generated code slowly erodes the architecture no matter how many humans review.

**How (TypeScript + pnpm + GitHub):**
- pnpm workspaces define package boundaries: [`examples/typescript-pnpm/template/pnpm-workspace.yaml`](examples/typescript-pnpm/template/pnpm-workspace.yaml) and [`examples/typescript-pnpm/template/packages/core`](examples/typescript-pnpm/template/packages/core)
- For per-layer rules inside a package, use `eslint-plugin-import` `no-restricted-paths` or equivalent. See [`hints-typescript-pnpm.md` §3](examples/typescript-pnpm/hints-typescript-pnpm.md#3-architecture-boundaries).

**Verify:** `pnpm lint` fails when a deliberate cross-boundary import is introduced.

**Scored as:** `Architecture Boundaries` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §3 — Architecture boundaries](AI-CONTRIBUTOR-SPECIFICATION.md#3-architecture-boundaries)

### Step 1.5: Pre-commit hook and CI gates

**Do:** Run type-check, lint, and test locally on every commit via a pre-commit hook, and again in CI on every PR. Make the CI checks required for merge on `main`.

**Why:** Pre-commit gives fast feedback and prevents obvious failures from ever reaching a PR. That helps both humans and AI agents that iterate quickly. CI is the non-skippable gate. For AI-authored PRs, it is the only check the repository controls end-to-end. `AI-CONTRIBUTOR-SPECIFICATION.md` §4 requires both.

**How (TypeScript + pnpm + GitHub):**
- Pre-commit hook: install Husky (`pnpm add -D husky && pnpm exec husky init`) and put `pnpm type-check && pnpm lint` in `.husky/pre-commit`. Keep it fast (under a few seconds) so it isn't bypassed.
- GitHub Actions workflow: [`examples/typescript-pnpm/template/.github/workflows/ci.yml`](examples/typescript-pnpm/template/.github/workflows/ci.yml)
- On GitHub: **Settings → Branches →** `main` rule → check "Require status checks" → add the CI jobs as required.
- **Set the workflow-level token default to least privilege.** Add `permissions:\n  contents: read` at the top level of every workflow file in `.github/workflows/` (the bundled `examples/typescript-pnpm/template/.github/workflows/ci.yml` already does this). Grant broader scopes only as per-job overrides where a specific job needs them. Step 3.2 builds on this default; without it, `GITHUB_TOKEN` defaults to the repository-wide write scope.
- **Fast-iteration path (separate from the merge gate).** Expose a scoped command path so agents and humans can validate intermediate work cheaply: `pnpm test --changed` for scoped tests, `pnpm lint --cache` for incremental lint, and `pnpm --filter <pkg> test` when a monorepo makes full-suite runs slow. This is for the iteration loop. The pre-commit hook and CI gates above remain the authoritative merge gate.

**Verify (contributor):** A deliberate type error fails the pre-commit hook locally. The same error, if pushed with `--no-verify`, still blocks the PR from merging via the required status check. For every declarative limit in the repo (coverage thresholds, Lighthouse budgets, bundle-size caps, timeout values referenced by workflow scripts), confirm there's a CI step that evaluates it. Configs without an evaluator are documentation, not a gate.

**Verify (auditor will check):** the auditor reads `.husky/pre-commit` (and equivalents like `lefthook.yml`, `.pre-commit-config.yaml`) plus workflow files in `.github/workflows/`. `Pre-Commit` is `Fulfilled` only when the hook script names ≥ 2 of {lint, type-check, test, secret-scan} (per [`audit-collect.ts` `rulePreCommit`](skills/ai-contributor-audit/scripts/audit-collect.ts)) — a hook that just runs `pnpm format` is `Warning`. `Threshold Enforcement` requires that every declared threshold (coverage, bundle size, perf) be referenced in a workflow step that actually evaluates it. If the threshold lives only in `vitest.config.ts` and no CI job reads it, the row stays `Warning`.

**Scored as:** `Pre-Commit`, `CI Gates`, `Threshold Enforcement`, `Gate Enforcement`, `Fast Iteration Path`, `Machine vs Manual Guardrails` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §4 — Pre-commit and CI gates](AI-CONTRIBUTOR-SPECIFICATION.md#4-pre-commit-and-ci-gates), [`AI-CONTRIBUTOR-SPECIFICATION.md` §8 — CI/CD workflow hardening](AI-CONTRIBUTOR-SPECIFICATION.md#8-cicd-workflow-hardening)

### Step 1.6: Auth boundary and runtime validation

**Applies when:** you have any server-side authorization (user roles, ACLs, per-tenant access) to enforce, or any external input (env vars, config files, request bodies, build-time data) to validate. A pure static content site with no auth and no external inputs can skip the authorization half. The runtime-validation half still applies to any config the build reads.

**Do:** Enforce authorization on the server, API, or data layer, never only in the client. Validate every external input (env, config, request bodies) at the boundary.

**Why:** AI will implement "is the user an admin?" by reading a client-side flag. Server-side enforcement is the difference between "looks right in code review" and "actually secure." Runtime validation catches the invariants the type system can't.

**How (TypeScript + pnpm + GitHub):**
- Zod validator pattern for env vars: [`examples/typescript-pnpm/template/config/env.ts`](examples/typescript-pnpm/template/config/env.ts)
- See [`hints-typescript-pnpm.md` §10](examples/typescript-pnpm/hints-typescript-pnpm.md#10-runtime-validation-and-invariants) for request-body, config, and feature-flag validators.

**Verify:** Remove a required env var, then run the app. It fails to boot with an actionable diagnostic that names the missing var.

**Scored as:** `Real Auth Boundary`, `Runtime Validation`, `Boundary Schema Validation`, `Credential Leakage Checks`, `Data Integrity Constraints`, `Invariants` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §7 — Authorization and trusted boundaries](AI-CONTRIBUTOR-SPECIFICATION.md#7-authorization-and-trusted-boundaries), [`AI-CONTRIBUTOR-SPECIFICATION.md` §10 — Runtime validation and invariants](AI-CONTRIBUTOR-SPECIFICATION.md#10-runtime-validation-and-invariants)

### Step 1.7: Test layers and failure handling

**Do:** Cover critical behavior with more than one test style (unit + integration at minimum). Handle failures explicitly (retries, timeouts, fallbacks). Redact secrets and PII from logs.

**Why:** Unit tests alone give AI a false green. It writes code that passes isolated mocks but breaks against real integrations. Mixing test layers catches what the other misses. Explicit failure handling prevents AI from swallowing errors with `try/catch (_) {}`.

**How (TypeScript + pnpm + GitHub):**
- Vitest for unit + integration: [`examples/typescript-pnpm/template/packages/core/src/index.test.ts`](examples/typescript-pnpm/template/packages/core/src/index.test.ts)
- Playwright for end-to-end tests if the project has a UI.
- See [`hints-typescript-pnpm.md` §11](examples/typescript-pnpm/hints-typescript-pnpm.md#11-testing-strategy) and [§13](examples/typescript-pnpm/hints-typescript-pnpm.md#13-failure-handling-and-observability) for logger redaction patterns.
- If you enable coverage, set a threshold in `vitest.config.ts` (see [`hints-typescript-pnpm.md` §11](examples/typescript-pnpm/hints-typescript-pnpm.md#11-testing-strategy)) and treat the number as a floor, not a target, per `AI-CONTRIBUTOR-SPECIFICATION.md` §11.

**Verify (contributor):** `pnpm test` runs both unit and integration suites. A test that only passes with mocked I/O fails when the mock is removed. In addition, every threshold, budget, or limit declared in test, perf, or size config is actually evaluated in the CI job that runs those checks. Declared-but-unenforced limits drift over time. Treat them as reference material, not enforcement.

**Verify (auditor will check):** the auditor does not execute `pnpm test`. It looks for a CI workflow step that runs the test command, plus declared coverage thresholds in `vitest.config.ts` / equivalent. "Tests passed locally" cannot be evidenced from committed files; the auditor records `Fulfilled` only when a CI job runs the suite (executable evidence) and the row's Comment cites that job. If your test setup runs only locally, the row will be `Warning` — wire the tests into CI before claiming `Fulfilled`.

**Scored as:** `Test Layers`, `Coverage Floor`, `Failure Handling`, `Observability`, `Code-Test Independence Check` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §11 — Testing strategy](AI-CONTRIBUTOR-SPECIFICATION.md#11-testing-strategy), [`AI-CONTRIBUTOR-SPECIFICATION.md` §13 — Failure handling and observability](AI-CONTRIBUTOR-SPECIFICATION.md#13-failure-handling-and-observability)

### Step 1.8: AI data classification and redaction

**Do:** Classify the data that flows through AI agents (source code, secrets, customer data, regulated data, telemetry). Prevent regulated or secret data from entering AI provider context windows unless that provider is explicitly approved for that class. Redact secrets, credentials, and PII from AI-specific surfaces: prompts, agent transcripts, tool outputs, and AI-related error reports.

**Why:** The moment an AI agent reads from your codebase, it reads everything it can see. That includes API keys in dotfiles, customer records in fixtures, and production snapshots left from a debug session. Without a classification map and a redaction layer on the AI surface, secret data leaks to provider context windows silently and stays there. The log redaction in Step 1.7 covers §13. These requirements are the §22 extension of it to AI-specific surfaces. Same principle, different surface, and the specification makes both unconditional.

**How (TypeScript + pnpm + GitHub):**
- In `AGENTS.md` / `CLAUDE.md`, add a **"Data classification"** section listing each class you handle and whether it is permitted in AI contexts. Call out secrets and regulated data as "never in an AI context unless the provider has explicit approval for that class."
- Reuse the logger redactor from Step 1.7 for AI surfaces. Wrap every place your code sends a prompt, receives a tool output, or persists an AI error. See [`hints-typescript-pnpm.md` §22](examples/typescript-pnpm/hints-typescript-pnpm.md#22-data-protection-and-privacy).
- For fixtures and scratch data used with AI, confirm they are scrubbed of real secrets and PII before an agent ever reads them. If you lack scrubbed fixtures, generate synthetic ones rather than give real data to a model.

**Verify:** Sampling recent AI-agent sessions, no secret, credential, or PII appears in prompts, transcripts, tool outputs, or error reports. A test that passes a fake recognized secret through an AI flow confirms the redaction fires before the prompt leaves your process.

**Scored as:** `AI Data Classification`, `AI Provider Allowlist` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §22 — Data protection and privacy](AI-CONTRIBUTOR-SPECIFICATION.md#22-data-protection-and-privacy)

### Step 1.9: Guardrail documentation, ownership, and human approval

**Do:** In your `AGENTS.md` / `CLAUDE.md` file, list (a) which actions require explicit human confirmation, (b) who owns each sensitive path (auth code, deploy config, CI workflow files, dependency manifests, policy documents), and (c) which guardrails are machine-enforced vs. review-only and how each one surfaces failure.

**Why:** If "human approval required" lives only in reviewer heads, AI agents will silently cross the line. Writing it down makes the line automatable and auditable. Naming an owner per sensitive path (`AI-CONTRIBUTOR-SPECIFICATION.md` §16 MUST) means a risky change can't be merged without the right reviewer. That serves both review and post-incident accountability.

**How (TypeScript + pnpm + GitHub):**
- Extend the file from Step 1.1 with three sections: **"Forbidden without confirmation"** (baseline: every destructive, security-sensitive, or release-affecting action per `AI-CONTRIBUTOR-SPECIFICATION.md` Definitions), **"Sensitive path ownership"** (a table: path → named owner), and **"Guardrails"** (a table: tool / enforced where / how failure is surfaced).
- For path ownership on GitHub, a `CODEOWNERS` file is the simplest option for most teams. See [`hints-typescript-pnpm.md` §17](examples/typescript-pnpm/hints-typescript-pnpm.md#17-ai-operating-model).

**Verify:** An AI agent asked to `rm -rf` the repo or run `git push --force` stops and asks for confirmation instead of executing. A PR touching auth code is automatically assigned to or blocked on its named owner.

**Scored as:** `Authoritative Guardrail Doc`, `Human Approval`, `Risk-Matched Controls`, `Classifier-Only Controls Excluded` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §16 — Branch protection, ownership, and release governance](AI-CONTRIBUTOR-SPECIFICATION.md#16-branch-protection-ownership-and-release-governance), [`AI-CONTRIBUTOR-SPECIFICATION.md` §23 — Human approval and manual checkpoints](AI-CONTRIBUTOR-SPECIFICATION.md#23-human-approval-and-manual-checkpoints), [`AI-CONTRIBUTOR-SPECIFICATION.md` §24 — Guardrail documentation and evidence](AI-CONTRIBUTOR-SPECIFICATION.md#24-guardrail-documentation-and-evidence)

### Step 1.10: Policy governance, AI-output licensing, and authorship traceability

**Do:** Name an owner and a review cadence for your adopted copy of `AI-CONTRIBUTOR-SPECIFICATION.md` (and your derived `AGENTS.md` / `CLAUDE.md`). Treat changes to these documents as code: same review process, same required reviewers. Revisit the document when a new AI-era risk appears. Do not treat it as frozen. In the same governance pass, declare the repository's position on AI-generated-content licensing and put a mechanism in place to identify materially AI-authored commits or pull requests after the fact.

**Why:** Specifications become outdated quietly. If no one owns yours, it can stop matching reality within a few quarters. Since AI agents read these documents as ground truth, outdated text becomes outdated agent behavior. Naming an owner and a cadence is what turns "we have a specification" into "our specification reflects how we actually ship." Licensing and authorship metadata for AI-generated content belongs in the same governance pass: if a downstream consumer, auditor, or legal review later asks "which commits were AI-authored, and under what license did they enter the repository?", you need the answer recorded at the time of contribution, not reconstructed from memory.

**How (TypeScript + pnpm + GitHub):**
- In the `AI-CONTRIBUTOR-SPECIFICATION.md` frontmatter of your adopted copy, fill in the owner and record a review cadence (e.g. "reviewed each quarter" or "reviewed when auth / deployment / trust-boundaries change"). Record the effective date and last-review date.
- Add `AI-CONTRIBUTOR-SPECIFICATION.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, `AI-CONTRIBUTOR-GUIDE.md`, `AGENTS.md`, and any tool-specific pointer files (`.github/copilot-instructions.md`, `CLAUDE.md`, `.cursorrules`, etc. — see Step 1.1) to your `CODEOWNERS`. This ensures edits require the named owner's approval and prevents a pointer file from silently re-expanding into a second source of truth.
- Put a recurring reminder (calendar, Linear/Jira, etc.) on the owner's queue for the review cadence you chose.
- In `CONTRIBUTING.md` (or a dedicated `LICENSING.md`), add a short section stating (a) whether AI-generated code, docs, and tests are accepted into the repository, and (b) that AI-generated contributions are licensed under the same license as the rest of the repository (or whatever your legal position is). Cross-link this section from `AGENTS.md` so agents see it when they read instructions.
- Choose an authorship-traceability mechanism and document it in the same place: a Git commit trailer, GitHub PR label, PR body field, or equivalent metadata field. For GitHub repositories, prefer the compact PR and trailer pair `AI-Authored: no` or `AI-Authored: yes (agent, model)`. Add `Prompt-Audit: none` when `AI-Authored` is `no`; when `AI-Authored` is `yes`, use `Prompt-Audit: <references>` to record the prompt or system-prompt source, skill version when applicable, and transcript-retention location. Preserve the same metadata as Git commit trailers in the commits that land on `main`. `Co-Authored-By: <model identifier> <noreply@…>` trailers are allowed for GitHub visibility, but do not treat them as a substitute for the documented `AI-Authored` and `Prompt-Audit` mechanism. Agents that open PRs must apply the mechanism; the check belongs in the PR template from Step 1.11 and in the disclosure policy from Step 3.8.

**Verify:** The adopted `AI-CONTRIBUTOR-SPECIFICATION.md` has a non-placeholder owner and a concrete review cadence. A PR editing `AI-CONTRIBUTOR-SPECIFICATION.md` or `AGENTS.md` is blocked until that owner reviews. `CONTRIBUTING.md` (or `LICENSING.md`) states the AI-output licensing position and names the authorship-traceability mechanism. `git log --grep` (or the chosen label filter) can list materially AI-authored commits.

**Scored as:** `Policy Ownership`, `Policy Evidence Links`, `AI Output Licensing`, `AI Authorship Traceability`, `Licensing-Disclosure Alignment` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §25 — Policy governance](AI-CONTRIBUTOR-SPECIFICATION.md#25-policy-governance), [`AI-CONTRIBUTOR-SPECIFICATION.md` §26 — AI-generated content: licensing and attribution](AI-CONTRIBUTOR-SPECIFICATION.md#26-ai-generated-content-licensing-and-attribution)

### Step 1.11: PR and task templates

**Do:** Add a pull-request template at `.github/PULL_REQUEST_TEMPLATE.md` with the shape **What changed / Why / How validated**. Add a task / issue template at `.github/ISSUE_TEMPLATE/task.md` with the shape **Input / Expected output / Constraints / Definition of done**.

**Why:** Agents fail on vague tasks more often than they fail on hard code. A task template with explicit inputs, expected outputs, and a definition of done prevents vague requests like "build the whole feature" and makes completion reviewable. The PR template forces the author — human or agent — to state *how* the change was verified, which is the reviewer's first question on any AI-authored PR. Writing these once up front means every later PR and every later agent task inherits the shape.

**How (TypeScript + pnpm + GitHub):**
- PR template: `.github/PULL_REQUEST_TEMPLATE.md` with three H2 sections — `## What changed`, `## Why`, `## How validated` (commands run with output excerpts, screenshots for UI, spec clause or checklist row the change satisfies). Step 3.8 extends this with the AI-authorship disclosure checkbox for external contributors.
- Task template: `.github/ISSUE_TEMPLATE/task.md` with `## Input`, `## Expected output`, `## Constraints`, `## Definition of done`. Scope every task so it has a testable end state, not "finish feature X."
- Keep each agent-consumed task small enough that one PR closes it and the PR's `## How validated` section fits on one screen. If the definition of done can't fit, the task is too big — split it.

**Verify:** Opening a new PR auto-populates the What / Why / How-validated template. Opening a new task issue auto-populates the Input / Expected-output / Constraints / Definition-of-done template. An agent handed an issue in this shape produces a PR whose `## How validated` section directly mirrors the issue's `## Definition of done`.

**Scored as:** `AI Task Templates`, `AI Workflow Standardization` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §17 — AI operating model](AI-CONTRIBUTOR-SPECIFICATION.md#17-ai-operating-model), [`AI-CONTRIBUTOR-SPECIFICATION.md` §20 — Agents and delegation governance](AI-CONTRIBUTOR-SPECIFICATION.md#20-agents-and-delegation-governance)

### Step 1.12: Enable secret scanning and push protection

**Do:** Turn on secret scanning and push protection in repository settings.

**Why:** Push protection rejects commits containing recognized credentials *before* they enter history. Secret scanning flags anything that slipped through. They close the unconditional automated-secret-detection requirement in §5 before AI-assisted changes can enter the protected branch.

**How (TypeScript + pnpm + GitHub):**
- **Settings → Code security and analysis → Secret scanning:** Enable
- Same page → **Push protection:** Enable
- **Fallback when GitHub-native scanning isn't available:** GitHub Advanced Security is only sold through organization and enterprise plans. A personal account with a private repository cannot enable secret scanning or push protection natively. Add [secretlint](https://github.com/secretlint/secretlint) as a dev dependency (`pnpm add -D secretlint @secretlint/secretlint-rule-preset-recommend`), wire it into the Husky hook from Step 1.5, and run it as a required status check in CI. [gitleaks](https://github.com/gitleaks/gitleaks) is a reasonable alternative if you need git-history scanning.

**Verify (contributor):** Create a feature branch, commit a fake but recognized secret (e.g. `AKIAIOSFODNN7EXAMPLE`), then run `git push origin <branch>`. The push is rejected, either by GitHub push protection or by the local secretlint / gitleaks hook.

**Verify (auditor will check):** secret scanning and push protection are hosted settings; the auditor calls the GitHub API (`security_and_analysis.secret_scanning.status`, `security_and_analysis.secret_scanning_push_protection.status`) per [`audit-collect.ts` `ruleSecretScanning` / `rulePushProtection`](skills/ai-contributor-audit/scripts/audit-collect.ts). A token without admin:repo scope cannot read these fields; the rows demote to `Warning`. Disclose the token tier in the audit log.

**Scored as:** `Secret Scanning`, `Push Protection` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §5 — Secrets and credentials](AI-CONTRIBUTOR-SPECIFICATION.md#5-secrets-and-credentials)

### Phase 1 checkpoint

You can stop here if: **your repository uses AI only as a verifier, reviewer, suggester, test generator, or pair-programming assistant where humans accept every change before it ships, and the assistance workflow does not invoke shared skills, MCP servers, or delegated agents.** At this point AI is assisting, not completing self-contained implementation tasks or shipping without per-step human review.

Phase 1 covers the Level 1 (Hardened) path for GitHub + TypeScript + web. Before claiming full Level 1 conformance, walk through [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) once. A few rows depend on your architecture and aren't expanded as dedicated steps because their shape is project-specific — close them against the checklist directly:

- `Data Integrity Constraints` (§7): foreign keys, unique constraints, and check constraints where your database supports them. `MUST when applicable` — triggers for repositories that own a database schema.
- `Credential Leakage Checks` (§7): automated checks or tests that detect privileged credentials in untrusted client code or roles being checked in the wrong layer. Unconditional `MUST`.
- `Deterministic Build Order` (§1): for multi-package repositories, build/test/lint runs in dependency order. `MUST when applicable` — triggers when the repository contains more than one package.
- `Invariants` (§10): critical system invariants are documented in one authoritative place and executable through tests, assertions, or validators. What those invariants are depends on your domain.
- `Policy Ownership` (§25): a named owner, a review cadence, and a change-control process for your adopted copy of the specification. The §25 portion of Step 1.10 is required for Level 1 (the §26 AI-output licensing portion is Level 2 and is covered in the next paragraph).

Close any of those that apply to you, then you are at Level 1.

**Reaching Level 2 (AI Assisted) at this checkpoint.** Levels are normative; phases are practical chunks. They do not align 1:1 here. Level 2 requires four things, of which three are complete at the Phase 1 checkpoint:

1. ✅ Step 1.1 — the authoritative AI instruction file (§17 MUSTs).
2. ✅ The §22 AI-surface redaction MUSTs (covered by Phase 1's secret-handling and observability work, applied to AI surfaces — prompts, agent transcripts, tool outputs, AI-related error reports).
3. ✅ Step 1.10 — the §26 AI-generated-content licensing declaration and authorship-traceability mechanism.
4. ⚙️ Any §18–§20 `MUST when applicable` rows your assistance toolchain triggers — for example `Shared Skills` if the workflow invokes versioned skills or slash commands, `MCP Allowlist` if any MCP server is enabled, `Agent Scope` / `Agent Traceability` if a delegated agent is in the loop. Each row's per-row work lives in Phase 2 (Steps 2.1, 2.2, 2.3 cover them in detail), but at this checkpoint you only need the subset that applies to *your* assistance workflow. Walk the §18–§20 rows in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) and mark each one `Fulfilled` or `Not relevant` (with evidence) before claiming Level 2.

If your assistance workflow uses none of those mechanisms, items 1 + 2 + 3 are sufficient and you have reached Level 2. If it uses any of them, complete only the per-row subset above — the rest of Phase 2 is Level 3 work and stays in Phase 2 proper.

You must continue to Phase 2 in full before you let AI materially author code that ships, ingest untrusted external content, or use any §18–§20 mechanism beyond what your assistance workflow triggered. You must continue through Phase 3 before AI ships changes without per-step human review.

---

## Phase 2 — Before AI materially authors code or uses governed tooling

_Earns conformance Level 3 (AI Authored)._

### Step 2.1: Shared skills governance

**Do:** If you author shared AI skills / slash commands / reusable workflow modules, version them in the repository, review them like code, and scope them.

**Why:** A shared skill is code that can change files, invoke tools, and affect releases. That is exactly the threat surface code review exists to cover. Treating skills as configuration bypasses that review.

**How (TypeScript + pnpm + GitHub):**
- Keep skills under `.claude/skills/**`, `.claude/commands/**`, or `.github/prompts/**`. Each skill file declares purpose, inputs, outputs, side effects, and owner.
- Skills that run destructive tools (`git push --force`, `npm publish`, `rm -rf`) must gate on human confirmation per `AI-CONTRIBUTOR-SPECIFICATION.md` §23.
- See [`hints-typescript-pnpm.md` §18](examples/typescript-pnpm/hints-typescript-pnpm.md#18-skills-and-shared-workflow-modules).

**Verify:** Each shared skill file opens with the declared fields above. `grep -iE 'api[_-]?key|token|secret' .claude/` returns no plaintext credentials.

**Scored as:** `Shared Skills`, `Skill Safety` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §18 — Skills and shared workflow modules](AI-CONTRIBUTOR-SPECIFICATION.md#18-skills-and-shared-workflow-modules)

### Step 2.2: MCP governance

**Do:** Maintain an explicit allowlist of MCP servers your team is permitted to use, with owner and purpose per server. Prefer read-only. Scope filesystem roots tightly. For OAuth- or token-based MCP integrations, use secure token handling and validate redirects.

**Why:** Every MCP server is a tool the LLM can call. Without an allowlist, any contributor can install one that reaches production systems, and no one knows what your agents can actually do. OAuth and token-based integrations add their own surface. A loose redirect validator or a plaintext token file turns an MCP connector into a credential-harvesting opportunity.

**How (TypeScript + pnpm + GitHub):**
- Keep the allowlist in your `AGENTS.md` / `CLAUDE.md` with a row per server: name, purpose, owner, read-only vs. write-capable, pinned version, auth model (OAuth / static token / none).
- Separate read-only from write-capable servers in the UI or config. Never mix them silently.
- Do not expose `$HOME` or repository-wide roots to a server when a subdirectory suffices.
- For OAuth- or token-based MCP servers: validate redirect URIs against an explicit allowlist (no wildcards, no user-controlled hosts). Use short-lived credentials with refresh where the platform supports it. Store tokens in platform-provided secret storage (OS keychain, GitHub-managed secrets, a secrets manager), never in plaintext config files or environment files committed to the repo. Rotate tokens on a schedule and on personnel change.

**Verify:** Every MCP server currently enabled for the team appears in the allowlist with all six fields above. Any server using OAuth or tokens has its redirect allowlist, token storage location, and rotation cadence documented. An MCP server in active use that isn't on the list, or an OAuth server with a missing rotation entry, fails the audit.

**Scored as:** `MCP Allowlist`, `MCP Least Privilege`, `MCP Auth Security`, `MCP Auditability`, `MCP Root Scoping`, `Minimum Capability Set` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §19 — MCP servers and external tool governance](AI-CONTRIBUTOR-SPECIFICATION.md#19-mcp-servers-and-external-tool-governance)

### Step 2.3: Agent governance

**Do:** If you run delegated agents that produce code for human-reviewed pull requests, define each agent's role, scope, ownership, success boundaries, and explicit tool / write / approval limits. Prevent parallel agents from editing overlapping files unless coordination is explicitly designed. Apply the same controls to any autonomous runner before Phase 3.

**Why:** Agents without defined scope drift into whatever looks productive. Parallel unsandboxed agents race each other into mutual corruption. Traceability is the only way to learn from a bad run.

**How (TypeScript + pnpm + GitHub):**
- One file per agent role (e.g. `.claude/agents/<role>.md`) listing scope, permitted tools, approval triggers, and owner.
- For parallel work, use git worktrees or file-level partitioning so agents do not overlap.
- Record agent-produced changes with the model identifier and the skill or prompt version used (see `AI-CONTRIBUTOR-SPECIFICATION.md` §21 `SHOULD` on recording model, prompt, and skill versions for audit and rollback).

**Verify:** For a recent agent-authored commit, you can name (a) which agent produced it, (b) what its scope was, and (c) what tools it was allowed to call.

**Scored as:** `Agent Scope`, `Agent Traceability`, `Agent Roles`, `Agent Permissions`, `Agent Behavior Monitoring`, `Agent Isolation`, `Short-Lived Agent Credentials`, `Agent Credential Scope`, `Agent Credential Approval`, `Agent Credential Audit`, `Observed Credential Rotation` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §20 — Agents and delegation governance](AI-CONTRIBUTOR-SPECIFICATION.md#20-agents-and-delegation-governance)

### Step 2.4: Untrusted input, capability scoping, and channel classification

**Do:** Treat issues, PR comments, fetched URLs, retrieved documents, and tool outputs as untrusted input. Constrain an agent's tools, read, and write capabilities at the permission layer to only what the user's requested task needs, not what the model thinks is appropriate. Explicitly classify each content channel your agents consume as either trusted or as requiring sandboxing or human review.

**Why:** Prompt injection is a control failure, not a "the model should know better" failure. A read-only summarization task has no business executing shell commands or sending network requests, regardless of what the retrieved page says. Not every input channel carries the same risk. An internal Linear issue from an employee is a different threat model than a public GitHub issue from an anonymous reporter. The team needs an explicit map of which channels require which controls.

**How (TypeScript + pnpm + GitHub):**
- Before an agent runs, decide the minimum capability set for the task. Reject tasks that combine read-from-untrusted-source and write-to-sensitive-sink in the same agent context unless explicitly approved.
- In your `AGENTS.md` / `CLAUDE.md`, add a **"Content channels"** table: channel (GitHub issues, PR comments, fetched URLs, retrieved docs, MCP tool outputs, etc.) → trust level (trusted / sandboxed / requires human review).
- Do not count LLM-based classifier filters or "refuse if tricked" system-prompt text as controls. Per `AI-CONTRIBUTOR-SPECIFICATION.md` §21, they are telemetry, not enforcement.
- If your product serves users in languages other than English, verify that any pattern-filter or LLM-filter guardrail you claim as a control has coverage in those languages. Otherwise record the control's scope as English-only so no one later assumes otherwise.

**Verify:** For each agent role, you can name which capabilities are enabled for which task classes. Every content channel your agents read from appears in the **Content channels** table with an explicit trust level. A summarization task running with file-write or network-send capabilities enabled is a violation.

**Scored as:** `Untrusted Agent Input`, `Capability Scoping`, `Non-English Filter Coverage` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §21 — AI-specific risks](AI-CONTRIBUTOR-SPECIFICATION.md#21-ai-specific-risks)

### Step 2.5: Provider allowlist scope, regulated data, residency

**Do:** If your AI workflows route to external AI providers or models, maintain an explicit allowlist that records each entry's approval scope: the data classifications it is permitted to handle and the action categories (read-only research, code authoring, release-affecting automation) it is approved for. If you handle regulated data (health, finance, government, data about minors, or similar) or have data-residency requirements, document the legal basis and verify that each AI provider, MCP server, and external tool respects those constraints.

**Why:** "We used this provider for X once, so we'll use it for Y" is how regulated data ends up in unapproved context windows. An explicit approval-scope field per provider closes that gap. For regulated data, "we assumed the provider was compliant" is not a defensible answer. The specification requires documented legal basis and controls, not inferred ones. Phase 1 Step 1.8 already put the classification and redaction guardrails in place. This step hardens the external-routing surface on top of them.

**How (TypeScript + pnpm + GitHub):**
- Create or extend a provider allowlist for external AI providers. Add two fields per entry: **permitted data classes** (using the classes from Step 1.8) and **action categories** (read-only research / code authoring / release-affecting automation). Agent workflows must not route outside the allowlist. Enforce this at the SDK wrapper or reverse-proxy layer so it isn't a policy-only rule.
- If regulated data applies, add a **"Regulated data controls"** subsection to `AGENTS.md` / `CLAUDE.md` documenting the legal basis (e.g. HIPAA BAA, GDPR Article 28 DPA, SOC 2 scope), which providers or tools have that basis on file, and the effective date of each agreement.
- If data residency applies, add a **"Residency"** subsection listing the permitted regions per data class and verify each provider or MCP server supports region pinning. Re-verify on any provider change or regional expansion.
- See [`hints-typescript-pnpm.md` §21](examples/typescript-pnpm/hints-typescript-pnpm.md#21-ai-specific-risks) and [§22](examples/typescript-pnpm/hints-typescript-pnpm.md#22-data-protection-and-privacy).

**Verify:** Every entry in the provider allowlist has both data-class and action-category fields filled in. A workflow attempting to route an unapproved data class to a provider is rejected by the SDK wrapper, not by a human reviewer noticing. For each provider handling regulated data, a BAA, DPA, or equivalent agreement is on file. Every data-residency commitment traces to a provider configuration setting or contract clause.

**Scored as:** `AI Provider Allowlist`, `Regulated Data Controls`, `Allowlist Rescope on Terms Change`, `Provider Deprecation Procedure`, `Provider EOL Tracking`, `No Routing Past EOL`, `Provider Fallback Path` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §21 — AI-specific risks](AI-CONTRIBUTOR-SPECIFICATION.md#21-ai-specific-risks), [`AI-CONTRIBUTOR-SPECIFICATION.md` §22 — Data protection and privacy](AI-CONTRIBUTOR-SPECIFICATION.md#22-data-protection-and-privacy)

### Step 2.6: Cost ceiling, context retention, dependency verification

**Do:** For paid agent workloads, document a cost ceiling or kill switch. Define retention and sanitization rules for AI conversation context and tool outputs. When AI adds a dependency, verify the package exists in the canonical registry and who owns it before merge.

**Why:** Runaway agent loops are the modern "bill of $20k overnight." Retained transcripts without sanitization become a data-leak vector. Dependency hallucination (AI inventing a package name that a squatter then registers) is a supply-chain attack that needs the controls of §21 plus §6.

**How (TypeScript + pnpm + GitHub):**
- Set provider-side spend alerts and a hard cut-off where the provider supports one.
- In `AGENTS.md` / `CLAUDE.md`, document how long agent transcripts are retained and what fields are redacted at write time.
- For dependency additions authored by AI, operationalize the verification at PR time rather than leaving it to reviewer judgment. For every new entry in `package.json` / `pnpm-lock.yaml`:
  - **Canonical registry:** `pnpm view <pkg> name repository maintainers time.created` — the package must exist on the registry your repo pulls from (not a typosquat from a mirror). Record maintainer handles.
  - **Ownership age:** reject packages < 30 days old or with ownership transfers in the last 30 days unless explicitly approved (npm's `time.modified` and `maintainers` fields catch both).
  - **Pin exactly:** the version in `package.json` and `pnpm-lock.yaml` must match; `pnpm install --frozen-lockfile` in CI enforces this already (from Step 0.1), but re-assert it in review so a reviewer doesn't merge a lockfile-less change.
  - **Integrity:** pnpm writes `sha512` integrity hashes by default — do not strip them. CI runs `pnpm install --frozen-lockfile` which fails on integrity mismatch.
  - **Signatures (where supported):** `npm audit signatures` against the range the PR adds. Not every package publishes signatures; treat absence as information, not a block.
  - Enforce the above as a CI job that runs only when `package.json` or `pnpm-lock.yaml` changed, so human PRs aren't slowed by it.

**Verify:** A simulated runaway loop (deliberate infinite agent retry) hits the cost ceiling and stops. A PR adding a fictitious dependency is caught in review and reverted.

**Scored as:** `Agent Cost Ceiling`, `AI Context Retention`, `AI Dependency Verification`, `Prompt Audit Trail`, `Prompt Versioning` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §21 — AI-specific risks](AI-CONTRIBUTOR-SPECIFICATION.md#21-ai-specific-risks)

### Phase 2 checkpoint

You can stop here if: **your repository lets AI materially author code that humans review before merge, or uses governed shared skills, MCP servers, delegated agents, or untrusted external content, but does not let AI merge, release, deploy, or otherwise ship without per-step human review.**

Phase 2 covers the Level 3 (AI Authored) path for every Pillar 6 `MUST` or `MUST when applicable` row triggered by AI-authored work, plus the applicable §18–§20 rows for the skills, MCP servers, delegated agents, or other AI tooling that materially author code. Two narrow §21 clauses aren't called out as dedicated steps and should be confirmed against [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) before you claim Level 3:

- **Anti-pattern controls** (§21): no LLM-filter classifier or "refuse if tricked" system-prompt instruction is being counted, alone, as a control for any MUST clause. They may appear as telemetry only.
- **Control evidence** (§21): each claimed control is evaluated against the specific risk class it addresses (prompt injection, data exfiltration, PII leakage, etc.), with adaptive or human-in-the-loop evaluation rather than static-benchmark results alone.

Close these if they apply, then you are at Level 3. Reaching this level is what lets AI materially author code that can ship after human review.

Continue to Phase 3 before AI ships changes without per-step human review. That phase covers autonomous-runner controls, remaining `MUST when applicable` items tied to repository shape (security scanning, CI hardening, threat modeling, accessibility, performance, supply chain, expanded ownership), plus a documented exception log for unmet `SHOULD`s.

---

## Phase 3 — Before the full Level 4 audit

_Earns conformance Level 4 (AI Autonomous)._

Phase 3 closes the controls needed before AI ships without per-step human review, the remaining `MUST when applicable` items tied to repository shape, and documented exceptions for any `SHOULD` you chose not to implement. Before starting it, re-check Phase 2 Step 2.3 for every autonomous runner; delegated-agent controls are not enough unless they also cover the no-human-review path. Several steps only apply when the repository has the triggering characteristic (public distribution, a UI, user-facing performance, services with uptime expectations, autonomous runners). Each step says when it applies.

### Step 3.1: Security scanning and dependency hygiene

**Applies when:** your language/platform has SAST tooling and your dependency manager supports vulnerability detection (nearly every real-world repository).

**Do:** Run security-focused static analysis in CI. Enable dependency vulnerability detection. Make dependency changes visible to reviewers through automation.

**Why:** AI-generated code routinely produces patterns SAST catches (injection sinks, unsafe deserialization, auth bypass) and freely adds dependencies a human would spot-check. These three controls together substitute for "a careful human read every line."

**How (TypeScript + pnpm + GitHub):**
- Enable CodeQL under **Settings → Code security → Code scanning**, or run Semgrep with the `r2c-ci` ruleset as a CI job.
- Enable Dependabot alerts and security updates. Add Dependabot or Renovate config for routine update PRs.
- Require `pnpm audit --audit-level=high` in CI. Track accepted exceptions in `SECURITY.md` with an expiry date.
- Add `actions/dependency-review-action@v4` to PRs so reviewers see every added package inline.
- See [`hints-typescript-pnpm.md` §6](examples/typescript-pnpm/hints-typescript-pnpm.md#6-security-scanning-and-dependency-security).

**Verify (contributor):** A PR that introduces a known-vulnerable dependency fails CI. A PR that adds a new transitive dependency shows an inline Dependency Review summary. CodeQL or Semgrep reports on every PR.

**Verify (auditor will check):** for `Dependency Security`, the auditor first tries `gh api repos/<owner>/<repo>/dependabot/alerts?state=open&severity=high` and, failing that, runs `pnpm audit --prod --json` per inventory unit that has its own `pnpm-lock.yaml` (per [`audit-collect.ts` `ruleDependencySecurity`](skills/ai-contributor-audit/scripts/audit-collect.ts)). For `Automated Dependency Updates` the auditor inspects committed config (`.github/dependabot.yml`, `renovate.json`); a workflow that simply runs `pnpm audit` does not satisfy the rule — the rule wants automated update PRs.

**Scored as:** `Dependency Security`, `SAST`, `Custom Secret Patterns`, `Automated Dependency Updates`, `Dependency Review` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §6 — Security scanning and dependency security](AI-CONTRIBUTOR-SPECIFICATION.md#6-security-scanning-and-dependency-security)

### Step 3.2: CI/CD token hardening and deployment path protection

**Applies when:** CI does anything beyond running tests on a PR: deploys, publishes artifacts, writes to external systems, or holds secrets that could reach production. The developer/agent credential bullets below apply whenever humans or AI agents use `git` or `gh` against the repository from a local machine or sandbox.

**Do:** Tighten workflow tokens to least privilege per job. Replace long-lived cloud secrets with OIDC. Protect deployment paths with required reviews and environment protection rules. Give developers and AI agents the narrowest GitHub credential that still lets them do the job.

**Why:** A workflow with default `GITHUB_TOKEN` permissions can let a malicious PR compromise the supply chain. Long-lived cloud credentials in Actions secrets multiply that risk. Environment protection rules are the required gate between "CI can deploy" and "a human approved this deploy." The same principle applies off-CI: a classic PAT with `repo` scope sitting in an agent's credential store can push, delete branches, and change settings across every repository the user can reach. That impact is much wider than whatever task the agent was invoked for.

**How (TypeScript + pnpm + GitHub):**

Workflow tokens and deployment paths:
- Audit each workflow. The workflow default is already `permissions: contents: read` (Step 1.5). Add per-job overrides only where needed (`id-token: write` for OIDC, `packages: write` for publishing, etc.).
- Configure OIDC against AWS, GCP, or Azure. Replace long-lived cloud access keys with `role-to-assume` in deploy jobs.
- Create GitHub **Environments** `preview` and `production`. On `production`, enable "Required reviewers" and restrict deployment branches to `main`.
- Pin third-party Actions deliberately. Tag-pinning (`@v6`) plus an automated bumper (Renovate or Dependabot) is the practical default; SHA-pinning (`@<full-sha> # v6`) is recommended only when the threat model justifies it — production-deploy workflows, high-stakes tokens, or compliance regimes that require bit-exact reproducibility — and only when paired with a bumper that keeps the SHAs current. SHA-pinning without a bumper goes stale and stops delivering security patches, which is worse than tag-pinning.
- Require security-team review on PRs touching `.github/workflows/**` via CODEOWNERS.
- See [`hints-typescript-pnpm.md` §8](examples/typescript-pnpm/hints-typescript-pnpm.md#8-cicd-workflow-hardening).

Developer and agent credentials to GitHub:
- Prefer **fine-grained PATs** scoped to specific repositories over classic PATs with account-wide `repo` scope. Grant only the permissions the task needs, and set the shortest expiry the workflow tolerates. The profiles below map directly to the trust tiers in §20 ("read-only, code-write, or release-capable agents"):

  | Trust tier (§20)             | Typical use                                              | Repository permissions                                                                                                                                                                                                     | Explicitly **no access to**                                                       |
  |-----------------------------|----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
  | **Read-only agent**         | Read-only assistants, triage                             | `Contents: Read`, `Metadata: Read` (auto), `Pull requests: Read`, `Issues: Read`                                                                                                                                           | Everything else                                                                   |
  | **Read-only audit agent**   | Audit skill and conformance audits that verify host settings | `Contents: Read`, `Metadata: Read` (auto), `Pull requests: Read`, `Issues: Read`, `Actions: Read`, `Administration: Read`, `Secret scanning alerts: Read`, `Dependabot alerts: Read`                                      | All write scopes, `Secrets`, `Webhooks`, `Deployments`                            |
  | **Code-write agent**        | AI agent that opens PRs on feature branches              | `Contents: Read and write`, `Pull requests: Read and write`, `Metadata: Read` (auto), `Issues: Read and write` (optional), `Actions: Read` (to view CI)                                                                    | `Administration`, `Secrets`, `Environments`, `Actions: write`, `Workflows: write`, `Webhooks`, `Deployments` |
  | **Release-capable**         | Agent that cuts tags or publishes artifacts              | Code-write permissions, plus the minimum write scope for the release action (e.g. `Contents: write` with tag-push allowed, or `Packages: write` for registries)                                                            | `Administration`, `Secrets`, `Environments`, `Webhooks`                           |

  In all profiles: set **Repository access** to "Only select repositories" (never "All repositories"), and cap expiry at ≤ 30 days. For release-capable, prefer a GitHub App over a PAT and protect the tag/release paths with branch or tag protection rules.
- Treat `Contents: write` as broader than "open a PR." It can update repository contents and refs, and some GitHub APIs use it for PR merge operations. A code-write agent therefore also needs branch protection, rulesets, or fork-based workflows that prevent pushes to protected branches, protected-ref deletion, bypass of required human review, and self-merge of its own PRs. If you cannot enforce those path controls, do not give the agent a write-capable repository token.
- For bot or automation accounts, prefer a **GitHub App installation token** over a PAT. Installation tokens are short-lived (one hour), scoped to the installation's repository set, and revocable without touching a human's account.
- Keep `gh auth` **accounts separated by context**. If one machine authenticates to multiple GitHub identities (personal, work, bot), switch explicitly with `gh auth switch` before pushing, and verify `gh auth status` points at the intended account. Do not let an agent pick up ambient credentials for an identity that was not authorized for the task.
- For AI agents running locally, mount the narrowest credential the task requires rather than the developer's full PAT. A read-only audit agent should receive the audit-specific read scopes above only when it is verifying host settings; it should never hold a write-capable token. A PR-authoring agent should not hold a token that can change repository settings, bypass branch or ruleset controls, or modify protected or release refs.
- Rotate and revoke on offboarding, suspected leak, or scheduled cadence (§5). Document the rotation trigger in the repository's credential-handling notes.

**Verify:** Every workflow file declares an explicit `permissions:` block with only the scopes used. A deploy job uses OIDC (no cloud secret in Actions secrets). A PR targeting `production` waits on a human approver. PATs issued for humans or agents show a fine-grained scope, a non-empty expiry, and a repository allowlist (not "all repositories"). Code-write agent tokens cannot push to protected branches, delete protected refs, bypass required human review, or merge their own PRs. Bot automation uses a GitHub App installation token, not a long-lived PAT. `gh auth status` on a shared workstation shows which account is active, and agents are invoked with that account set deliberately.

**Scored as:** `Workflow Security`, `Action Version Pinned`, `Deployment Protection`, `Deployment Protection Rules`, `Deployment Separation`, `Release from CI` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §8 — CI/CD workflow hardening](AI-CONTRIBUTOR-SPECIFICATION.md#8-cicd-workflow-hardening)

### Step 3.3: Threat model and security design review

**Applies when:** the repository is internet-facing, multi-tenant, handles regulated data, or is otherwise high-impact. Skip for internal tools on trusted networks with no sensitive data.

**Do:** Produce and maintain a threat model artifact identifying assets, trust boundaries, entry points, and likely attacker paths. Record the last-review date. Revisit when authentication, deployment, storage, or trust boundaries change.

**Why:** AI produces code that looks correct at the line level but routinely misses system-level questions: "who can call this, as whom, over what channel." Threat modeling surfaces those once so they show up in every later design review, AI-assisted or otherwise.

**How (TypeScript + pnpm + GitHub):**
- Store the model in `docs/threat-model.md`. The four required sections, with a one-sentence definition for each:
  - **Assets** — what is worth protecting if an attacker reaches it (customer data, auth credentials, signing keys, service availability, billing records).
  - **Trust boundaries** — the points where a request crosses from an untrusted context into a trusted one (public internet → API, tenant A → tenant B, unauthenticated → authenticated, browser → server).
  - **Entry points** — the concrete public surface where untrusted input can arrive (HTTP endpoints, webhook receivers, file upload handlers, queue consumers, third-party callback URLs, agent tool calls backed by external content).
  - **Attacker paths** — the top 3–5 realistic end-to-end scenarios an attacker could walk ("authenticated tenant reads another tenant's documents via an unscoped API", "prompt injection in a support ticket exfiltrates the ticket database via the AI agent").
- Record `Last reviewed: YYYY-MM-DD` at the top. Put a calendar reminder on the owner's queue matching the review cadence from Step 1.10.
- A STRIDE or LINDDUN walkthrough in a shared doc is enough for most cases. Heavier cases may want IriusRisk or OWASP Threat Dragon.
- Add `docs/threat-model.md` to `CODEOWNERS` for security-team review on change.

**Verify:** `docs/threat-model.md` exists, covers assets + trust boundaries + entry points, and has a `Last reviewed` date within your cadence. A PR changing authentication or deployment surfaces the threat model for re-review.

**Scored as:** `Threat Model`, `Security Design Reviews` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §9 — Threat modeling and security design review](AI-CONTRIBUTOR-SPECIFICATION.md#9-threat-modeling-and-security-design-review)

### Step 3.4: Accessibility gates

**Applies when:** the repository ships a user interface.

**Do:** Check shared UI components for serious accessibility failures automatically. Make focus, semantics, and labeling part of normal component review.

**Why:** AI generates markup that looks right and fails screen readers: decorative icons without `aria-hidden`, buttons that are actually divs, focus traps in modal dialogs. Static a11y lint plus component-level axe assertions catch these before merge.

**How (TypeScript + pnpm + GitHub):**
- Enable `eslint-plugin-jsx-a11y` at `error` in `eslint.config.js`.
- Add `vitest-axe` (or `jest-axe`) assertions to shared-component tests. No `critical` or `serious` violations in default and typical-state renders.
- Add `@axe-core/playwright` checks to primary user flows in E2E.
- Document keyboard behavior (Tab order, Escape, focus return on dialog close) in the component's test or story.
- See [`hints-typescript-pnpm.md` §12](examples/typescript-pnpm/hints-typescript-pnpm.md#12-accessibility).

**Verify:** `pnpm lint` fails on `<div onClick>` and similar violations. Shared-component tests fail on serious axe findings. Playwright runs of primary flows report no new serious violations.

**Scored as:** `Accessibility`, `A11y Helpers` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §12 — Accessibility](AI-CONTRIBUTOR-SPECIFICATION.md#12-accessibility)

### Step 3.5: Performance budgets and reliability targets

**Applies when:** the product is user-facing (perf matters) or runs as a service with uptime or latency expectations (reliability matters).

**Do:** Define and enforce performance budgets in CI where speed affects UX. Define reliability expectations (SLIs, SLOs, or equivalent) for services whose downtime or latency affects users.

**Why:** Performance regressions from AI-assisted changes are common and hard to spot. A rewritten component looks cleaner but ships twice the JS. A CI-enforced budget catches it before merge. Reliability targets turn "the service feels slow" into a measurable incident trigger.

**How (TypeScript + pnpm + GitHub):**
- **Frontend:** `size-limit` for bundle budgets. Lighthouse CI (`lhci autorun`) with LCP / INP / CLS thresholds. Fail PRs that regress past threshold.
- **Service:** export p95 latency, error rate, and availability as SLIs. Define SLOs (e.g. "p95 < 300ms, 99.9% over 30 days"). Wire error-budget breach to oncall escalation.
- Budgets and thresholds are declarative configs. Per Step 1.5's `Threshold Enforcement` rule, every declared threshold must be evaluated in CI or production monitoring. Config without an evaluator doesn't count.
- See [`hints-typescript-pnpm.md` §14](examples/typescript-pnpm/hints-typescript-pnpm.md#14-performance-and-reliability).

**Verify:** A PR that increases bundle size past the `size-limit` threshold fails CI. A PR that regresses LCP past budget fails CI. The SLI dashboard is live; SLO breach triggers a documented response.

**Scored as:** `Performance Budget`, `Reliability Targets`, `Error Budgets` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §14 — Performance and reliability](AI-CONTRIBUTOR-SPECIFICATION.md#14-performance-and-reliability)

### Step 3.6: SBOM, provenance, and release discipline

**Applies when:** the repository publishes artifacts (npm packages, Docker images, binaries, Helm charts, etc.) to external consumers.

**Do:** Identify what went into each release. Generate an SBOM where the ecosystem supports it. Build releases from CI, not workstations. Provide provenance or attestations when consumers need supply-chain trust.

**Why:** Consumers of an AI-assisted codebase can't verify what's inside a release unless you publish the manifest. "Built from CI + SBOM + provenance" is the minimum that lets a downstream team tell what you shipped and where it came from.

**How (TypeScript + pnpm + GitHub):**
- Generate an SBOM in the release workflow. `@cyclonedx/cyclonedx-node-npm` or `syft` produces CycloneDX JSON. Attach it as a release asset.
- For npm: `npm publish --provenance` (requires CI context; npm attaches a signed statement).
- For container or generic artifacts: `actions/attest-build-provenance@v1` for signed attestations.
- Block `npm publish` and `docker push` outside the release workflow. No publish tokens on workstations.
- Tag releases from CI. Require signed commits on `main`.
- See [`hints-typescript-pnpm.md` §15](examples/typescript-pnpm/hints-typescript-pnpm.md#15-supply-chain-transparency-and-artifact-integrity).

**Verify:** The latest release has an SBOM asset attached. The registry reports provenance metadata (`npm view <package> --json | jq .dist.attestations` or equivalent). An attempt to publish from a developer workstation fails for lack of token.

**Scored as:** `SBOM`, `Build Origin Records`, `Release from CI` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §15 — Supply-chain transparency and artifact integrity](AI-CONTRIBUTOR-SPECIFICATION.md#15-supply-chain-transparency-and-artifact-integrity)

### Step 3.7: Expand CODEOWNERS and publish SECURITY.md

**Applies when:** CODEOWNERS expansion always applies once sensitive paths exist. `SECURITY.md` is `MUST when applicable` for public or externally consumed repositories.

**Do:** Expand `CODEOWNERS` beyond policy docs to every sensitive path category: auth or authz code, CI/CD workflow files, deployment configuration, dependency manifests, database migrations, threat model. Publish `SECURITY.md` with a vulnerability disclosure path if the repo is public or consumed externally.

**Why:** CODEOWNERS is how "the security team must approve auth changes" becomes an automated gate instead of a norm people forget. `SECURITY.md` is how an external reporter reaches you instead of filing a public issue.

**How (TypeScript + pnpm + GitHub):**
- Extend the CODEOWNERS from Step 1.10 to cover auth and authz paths, `.github/workflows/**` (already in Step 3.2), deployment config, `package.json` + `pnpm-lock.yaml`, migrations, `docs/threat-model.md`, and any path that carries credentials or policy.
- Write a `SECURITY.md` with: contact (email or GitHub private vulnerability reporting), disclosure SLA, supported versions, and scope (what is in or out of bounds for reports).
- See [`hints-typescript-pnpm.md` §16](examples/typescript-pnpm/hints-typescript-pnpm.md#16-branch-protection-ownership-and-release-governance).

**Verify:** A PR touching `src/auth/**` auto-routes to the security owner. A PR changing `package.json` auto-routes to the platform owner. `SECURITY.md` exists at root, names a contact, and has been reviewed within your chosen cadence.

**Scored as:** `CODEOWNERS`, `Security Policy` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §16 — Branch protection, ownership, and release governance](AI-CONTRIBUTOR-SPECIFICATION.md#16-branch-protection-ownership-and-release-governance)

### Step 3.8: AI-authorship disclosure for external contributions

**Applies when:** the repository accepts pull requests from contributors outside the documented contributor group — public repos, partner teams, outside orgs.

**Do:** Publish a disclosure policy in `CONTRIBUTING.md` that defines what counts as a materially AI-authored PR, how authorship is declared, and how missing declarations are handled. Enforce it during intake review.

**Why:** Reviewing AI-generated code often takes as long as generating it, sometimes longer, because surface-level correctness hides subtle wrongness. Disclosure at intake lets reviewers budget the right amount of time and ask for reproducible evidence instead of reading thousands of lines looking for the one line that's wrong. It also shifts contributor responsibility for verification from "we'll figure it out in review" to "you state it upfront."

**How (TypeScript + pnpm + GitHub):**
- Add an **"AI-authored contributions"** section to `CONTRIBUTING.md` covering: (a) what counts as "materially AI-authored" for your repository (e.g. "more than 50% of changed lines generated by an AI tool, or the high-level design came from an AI agent"), (b) how authorship is declared (for example `AI-Authored: no` or `AI-Authored: yes (agent, model)` in the PR body), (c) how prompt audit metadata is declared (for example `Prompt-Audit: none` or `Prompt-Audit: <references>`), (d) how a PR missing the declaration is handled (auto-close with a comment, request update, or reject at intake), and (e) the verification evidence expected per change type — UI: screenshot or recording; backend or library: reproducible terminal or API output; test or behavior change: test output showing the new behavior.
- Extend the `.github/PULL_REQUEST_TEMPLATE.md` from Step 1.11 with an AI-authorship declaration checkbox so external contributors can't forget it.
- Configure a GitHub Actions workflow that fails intake if the declaration is missing on a PR from a user not in `CODEOWNERS` or not a member of the repository's documented contributor group.

**Verify:** A PR from an external contributor that opens without the AI-authorship declaration fails the intake workflow. The `CONTRIBUTING.md` AI-authored section exists, names the declaration format, and names the expected evidence per change type.

**Scored as:** `AI Authorship Disclosure`, `Disclosure Evidence` in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md).

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §23 — Human approval and manual checkpoints](AI-CONTRIBUTOR-SPECIFICATION.md#23-human-approval-and-manual-checkpoints)

### Step 3.9: Exception log for unmet SHOULDs

**Applies when:** always. This is the meta-requirement that makes Level 4 auditable.

**Do:** For every `SHOULD` in `AI-CONTRIBUTOR-SPECIFICATION.md` that your repository does not satisfy, record a reason in `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`'s Comment column. Add a review date if the exception is provisional.

**Why:** `SHOULD` in RFC 2119 terms means "strongly recommended unless there is a documented reason not to implement it." Level 4 depends on those reasons being written down, not in reviewer heads. That is how an auditor can tell the difference between "we chose not to" and "we forgot."

**How (TypeScript + pnpm + GitHub):**
- Walk every `SHOULD` row in `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`. For each not at `Fulfilled`, put a short Comment (e.g. "Deferred — no UI yet", "Accepted risk — internal tool", "Planned Q3 2026").
- For "planned" exceptions, put a reminder on the owner's queue matching the target date.
- Treat the exception log as part of the policy artifact. Edits follow the same review path as `AI-CONTRIBUTOR-SPECIFICATION.md` per §25.

**Verify:** Every `SHOULD` in the checklist is `Fulfilled`, `Not relevant` (with reason), or has a documented reason in Comment. A reader can open the checklist and immediately see which exceptions the team has accepted.

**Scored as:** every `SHOULD` row in [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md). For each not-fulfilled `SHOULD` row, the `Comment` column carries the exception reason; the auditor reads the comments as the exception log.

**Spec reference:** [`AI-CONTRIBUTOR-SPECIFICATION.md` §25 — Policy governance](AI-CONTRIBUTOR-SPECIFICATION.md#25-policy-governance)

### Phase 3 checkpoint

At this point **every unconditional `MUST`, every relevant `MUST when applicable`, and every unmet `SHOULD` has either a control or a documented reason.** This is Level 4 (AI Autonomous) — the full conformance bar.

---

## Going further — beyond Level 4

Level 4 is the highest conformance level. Teams that want to go further have two independent directions:

- **`MAY` items and hardening patterns**: fuzzing, DAST, penetration testing, license-compliance automation, artifact signing, reproducible builds, SLSA 3+ provenance, downstream admission control. These are explicitly optional in `AI-CONTRIBUTOR-SPECIFICATION.md`. Adopt them where the blast radius of a failure justifies the cost. Consider a separate `AI-CONTRIBUTOR-HARDENING.md` companion in your adopted copy to record which patterns you run and why.
- **Domain overlays**: healthcare (HIPAA), payments (PCI-DSS), government (FedRAMP-adjacent), EU (GDPR formal treatment), minors' data (COPPA). These layer domain-specific requirements on top of the base specification. They are better expressed as parallel specifications (e.g. `AI-CONTRIBUTOR-SPECIFICATION-healthcare.md`) referencing the base document rather than as higher conformance levels.

If you're contributing a parallel guide for another stack (Python + uv, Go, Rust, JVM, …), mirror the four-phase spine and the per-step Do / Why / How / Verify / Spec-reference shape so readers get a predictable experience across stacks. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

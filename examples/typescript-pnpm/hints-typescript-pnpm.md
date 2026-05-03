# Hints — TypeScript + pnpm Stack

> Concrete tooling hints for satisfying [`AI-CONTRIBUTOR-SPECIFICATION.md`](../../AI-CONTRIBUTOR-SPECIFICATION.md) in a TypeScript monorepo managed with pnpm. These are suggestions, not requirements — substitute equivalents that fit your context (see the "Equivalent" definition in `AI-CONTRIBUTOR-SPECIFICATION.md`).
>
> A minimal reference scaffold of the configs referenced below lives in [`template/`](template/). Treat it as a coupled starting point, not as unrelated snippets.

**Scope:** TypeScript source, pnpm workspaces, Node-based tooling. Most hints transfer to Bun / npm / Yarn with small adjustments. Sections are numbered to match `AI-CONTRIBUTOR-SPECIFICATION.md`; clauses without stack-specific tooling are omitted.

**Reference versions:** the authoritative pins live in [`template/package.json`](template/package.json), [`template/.nvmrc`](template/.nvmrc), and [`template/.github/workflows/ci.yml`](template/.github/workflows/ci.yml). This document does not restate them. Pin majors explicitly in your own `package.json`; let minor/patch updates flow through Renovate or Dependabot (§6).

## How to use this long file

Do not copy every hint blindly. Start with the clause or checklist row you are trying to satisfy, then copy the smallest coherent configuration that enforces that outcome. When a hint names a tool, an equivalent tool is acceptable if it is documented, enforced, and produces the same audit result.

---

## Clause index

- [§1 Reproducible environment](#1-reproducible-environment)
- [§2 Static correctness](#2-static-correctness)
- [§3 Architecture boundaries](#3-architecture-boundaries)
- [§4 Pre-commit and CI gates](#4-pre-commit-and-ci-gates)
- [§5 Secrets and credentials](#5-secrets-and-credentials)
- [§6 Security scanning and dependency security](#6-security-scanning-and-dependency-security)
- [§8 CI/CD workflow hardening](#8-cicd-workflow-hardening)
- [§10 Runtime validation and invariants](#10-runtime-validation-and-invariants)
- [§11 Testing strategy](#11-testing-strategy)
- [§12 Accessibility](#12-accessibility)
- [§13 Failure handling and observability](#13-failure-handling-and-observability)
- [§14 Performance and reliability](#14-performance-and-reliability)
- [§15 Supply-chain transparency and artifact integrity](#15-supply-chain-transparency-and-artifact-integrity)
- [§16 Branch protection, ownership, and release governance](#16-branch-protection-ownership-and-release-governance)
- [§17 AI operating model](#17-ai-operating-model)
- [§18 Skills and shared workflow modules](#18-skills-and-shared-workflow-modules)
- [§19 MCP servers and external tool governance](#19-mcp-servers-and-external-tool-governance)
- [§20 Agents and delegation governance](#20-agents-and-delegation-governance)
- [§21 AI-specific risks](#21-ai-specific-risks)
- [§22 Data protection and privacy](#22-data-protection-and-privacy)

---

## 1. Reproducible environment

| Pin | How |
|---|---|
| Node version | `.nvmrc` (e.g. `24`) and `package.json` `"engines": { "node": ">=24" }` |
| Package manager | `package.json` `"packageManager": "pnpm@10.x.x"`. The bundled scaffold pins version-only for ease of bumping. For Level 3+ supply-chain hardening, append the integrity hash Corepack writes (`pnpm@10.x.x+sha512.<hash>`) and regenerate it on every version bump. |
| Lockfile | `pnpm-lock.yaml` committed; `pnpm install --frozen-lockfile` in CI |
| Integrity | pnpm writes `sha512` integrity hashes by default — do not disable |
| Workspace topology | `pnpm-workspace.yaml` + `pnpm -r --sort run build` for topological build |

```yaml
# .github/workflows/ci.yml
- uses: actions/setup-node@v6
  with:
    node-version-file: '.nvmrc'
- uses: pnpm/action-setup@v6      # reads packageManager from package.json
- run: pnpm install --frozen-lockfile
```

`pnpm/action-setup@v6` is cleaner than relying on `corepack enable` on current GitHub runners; either works as long as the pnpm version is pinned in `package.json`.

For heavy builds, pin memory explicitly: `NODE_OPTIONS=--max-old-space-size=8192 pnpm build`.

---

---

## 2. Static correctness

### TypeScript (`tsconfig.base.json`)

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", "coverage"]
}
```

Run via `pnpm -r type-check` → `tsc --noEmit` per package. Use `moduleResolution: "bundler"` instead of `NodeNext` in packages that are built by Vite / esbuild / Rspack rather than executed directly by Node. On TypeScript 6, set `"types": ["node"]` explicitly in the tsconfig that compiles Node-facing files (scripts, config readers) — TS 6 no longer implicitly pulls in `@types/node` globals like `process` and `console`.

### ESLint (`eslint.config.js`, flat config — ESLint 10+)

ESLint 9 removed legacy `.eslintrc.*` support and ESLint 10 keeps flat config as the only supported format. Use `typescript-eslint` v8+ with its `tseslint.config(...)` helper. For import rules on ESLint 10 use the actively-maintained [`eslint-plugin-import-x`](https://github.com/un-ts/eslint-plugin-import-x) — it is a drop-in for `eslint-plugin-import` with matching rule names (`import/no-cycle`, `import/order`, etc.) and supports ESLint ≥ 8.57.

Correctness rules worth promoting to `error`:

| Rule | Purpose |
|---|---|
| `@typescript-eslint/no-explicit-any` | Ban untyped `any` |
| `@typescript-eslint/no-floating-promises` | Catches forgotten `await` |
| `@typescript-eslint/no-misused-promises` | Catches promises where sync is expected |
| `@typescript-eslint/no-unsafe-assignment` | Stops `any` leaking |
| `@typescript-eslint/consistent-type-imports` | Enforces `import type` |
| `import/no-cycle` | Blocks import cycles |
| `import/no-default-export` | Optional: named exports only |
| `import/order` | Grouped, alphabetised imports |
| `check-file/filename-naming-convention` | Enforce filename casing |
| `prettier/prettier` | Formatting as a lint error |

### Prettier (`.prettierrc`)

Single config. Let ESLint enforce it via `prettier/prettier` so there is one failure path.

---

---

## 3. Architecture boundaries

Roughly in order of enforcement strength:

1. **pnpm workspace packages** — making layers separate packages (`packages/core`, `packages/ui`, `packages/app`) forces every cross-layer import through a reviewable `package.json` `dependencies` list.
2. **ESLint `no-restricted-imports`** — scoped config blocks per `packages/*` for cheap "this layer cannot import X" rules.
3. **`dependency-cruiser`** — declarative allowed/forbidden dependency directions, runs in CI.
4. **`madge --circular`** — extra cycle detection.
5. **Shell boundary scan** — `grep`-based scan of `packages/**/src/` for forbidden import literals; fast and unambiguous.

---

---

## 4. Pre-commit and CI gates

### Local (husky + lint-staged)

```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
}
```

```sh
# .husky/pre-commit
pnpm lint-staged
pnpm type-check
pnpm boundary-scan   # if §3 Layer 5 is used
pnpm test --run --changed
```

### CI

Full `install → type-check → lint → test → build` chain on the pinned toolchain. If you use a `Hooks-Verified: true` commit trailer pattern to avoid duplicating locally run checks in PRs, document that workflow in your own repository policy and CI rules so reviewers can audit when it is allowed.

---

---

## 5. Secrets and credentials

- `.gitignore`: `.env`, `.env.*`, `!.env.example`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `id_rsa*`
- `.env.example`: placeholders only, committed
- Scanning: `gitleaks` (pre-commit + CI) or GitHub native secret scanning + push protection
- Mock mode: if critical env vars are missing, boot into a mock data mode so `pnpm dev` works without credentials (see §22)

---

---

## 6. Security scanning and dependency security

| Concern | Tool |
|---|---|
| Known CVEs | `pnpm audit --audit-level=high` in CI |
| SAST | `CodeQL` (free on public GitHub repos) or `Semgrep` (`r2c-ci` ruleset) |
| Supply-chain risk | Socket Security, Snyk, or `npm-audit-resolver` |
| Update PRs | Dependabot or Renovate |
| Typosquat / slopsquat | Socket Security; validate AI-added deps against canonical registry (see §21) |

Block merges on new critical vulnerabilities. Track accepted exceptions in `SECURITY.md` with an expiry date.

---

---

## 8. CI/CD workflow hardening

- Least-privilege `permissions:` block at top of each workflow (`contents: read` default; opt in to `id-token: write`, `contents: write`, etc., only where needed)
- Pin third-party GitHub Actions deliberately. Tag pins (`pnpm/action-setup@v6`) plus an automated bumper such as Renovate or Dependabot are the readable default. SHA pins (`pnpm/action-setup@5280c022466e8e5ea34ea201e2fda33875aeefdb # v6`) defend against tag mutation but only when paired with a bumper — without one, the SHAs go stale and you stop receiving security patches. Use SHA pins for production-deploy workflows, high-stakes tokens, or compliance regimes that require bit-exact reproducibility
- Use OIDC (`permissions: id-token: write`) for AWS / GCP / Azure instead of long-lived cloud secrets
- Separate `preview` and `production` GitHub Environments with required reviewers on `production`
- Require a code review on any PR that touches `.github/workflows/**`

---

---

## 10. Runtime validation and invariants

**Libraries:** `zod` (v4+), `valibot`, `@sinclair/typebox`, `ajv` (for external JSON Schema).

Principles:
- Validate config files at load time — fail fast with actionable errors
- Validate every external input at the boundary: request bodies, query params, env vars, webhook payloads
- Prefer schemas that also produce static types (`z.infer<typeof Schema>`) so runtime and compile-time agree
- Separate structural validation (schema) from semantic validation (business rules)
- For agent-authored code consuming external APIs, SDKs, or third-party JSON whose wire shape is not transport-enforced, parse responses through a Zod schema at the boundary and derive the TypeScript type from the schema rather than the other direction — the declared signature an agent wrote against can drift from the wire without warning, and the runtime parse is what catches it (implements `AI-CONTRIBUTOR-SPECIFICATION.md` §21 `SHOULD` — "validate responses against a runtime schema at the boundary, independent of the declared type")

```ts
// config/env.ts
import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})
export const env = Env.parse(process.env)
```

---

---

## 11. Testing strategy

| Layer | Tool |
|---|---|
| Unit | `vitest` (v4+) |
| Component | `@testing-library/react` + `vitest` (`environment: 'jsdom'` or `happy-dom`) |
| Property | `fast-check` via `@fast-check/vitest` (`it.prop`) |
| Mutation | `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` |
| Integration | `vitest` against real services or `testcontainers` |
| E2E | `playwright` (v1.50+) |
| Contract | `pact` or generated clients from OpenAPI |

Settings worth enforcing:
- `coverage.thresholds` as a minimum floor in `vitest.config.ts` (Vitest 3 and 4 use the nested `coverage: { thresholds: { lines, functions, branches } }` shape — verify against current Vitest release notes when you upgrade)
- `coverage.provider: 'v8'` — the fastest stable option; requires `@vitest/coverage-v8`
- `process.env.TZ = 'UTC'` for deterministic date tests
- Playwright `forbidOnly: !!process.env.CI` — no `test.only()` leaks to CI
- Expensive suites behind dedicated scripts (`test:integration`, `test:e2e`) run separately from the fast pre-commit suite
- Prefer tests that interact through the public API; avoid asserting against private helpers or internal state. Refactor-driven "update the tests to match" rewrites are the signal a test was coupled to implementation rather than behavior (implements `AI-CONTRIBUTOR-SPECIFICATION.md` §11 `SHOULD` — "Automated tests `SHOULD` exercise the public behavior of the code they protect, not implementation details").
- For agent-authored pure functions, parsers, and data transformations: add `fast-check` property tests alongside example-based tests (implements `AI-CONTRIBUTOR-SPECIFICATION.md` §21 `SHOULD` — "Agent-authored pure functions, parsers, and data transformations `SHOULD` be covered by property-based tests"). Agents routinely enumerate two or three plausible inputs and miss Unicode, whitespace-only strings, duplicates, `NaN`, negatives, and overlong inputs; properties force the invariant to be stated rather than sampled.
- Where coverage is gated (see §11 `MUST when applicable`), run `stryker` on a nightly or per-PR schedule as the independent verification mechanism for test-suite strength (implements `AI-CONTRIBUTOR-SPECIFICATION.md` §11 / §21 `SHOULD` — mutation testing as one of the mechanisms that distinguish effective assertions from tautologies, and as the independent verification mechanism when an agent authors both code and tests). Use `thresholds.break` to turn mutation score into a merge gate once the baseline is stable; treat per-file scores as advisory.

---

---

## 12. Accessibility

- `vitest-axe` or `jest-axe` in component tests; assert no `critical`/`serious` violations
- `eslint-plugin-jsx-a11y` for static hints during authoring
- `@axe-core/playwright` for E2E a11y passes
- Keyboard focus and ARIA roles part of normal component review

---

---

## 13. Failure handling and observability

- **Error tracking:** `@sentry/node` / `@sentry/react` (v10+) or self-hosted GlitchTip. Set `sendDefaultPii: false` and use `beforeSend` to strip cookies, auth headers, and sensitive fields. Sentry v9+ requires calling `Sentry.init()` before any other imports that you want instrumented.
- **Logging:** `pino` (v10+) with an explicit `redact` list for tokens, cookies, PII. Structured JSON output only.
- **React:** `ErrorBoundary` at app root; route-level boundaries around heavy features.
- **Retries:** explicit `p-retry` with backoff rather than silent re-fetches hidden in data layers.
- **AI transcripts:** apply the same redaction list to any agent log or prompt audit store (see §22).

---

---

## 14. Performance and reliability

- Bundle size: `size-limit` or Vite `rollupOptions.output.manualChunks` + a CI assertion on chunk sizes
- UI perf: Lighthouse CI (`lhci`) budgets; fail PRs that regress LCP / INP beyond threshold
- Backend latency: export SLI metrics (p95 latency, error rate) to Grafana / Datadog / whatever dashboards oncall actually watches
- Explicit chunking: `react-vendor`, `<domain>-vendor`, `sentry-vendor` etc. — predictable cache behavior

---

---

## 15. Supply-chain transparency and artifact integrity

- Lockfile committed, `--frozen-lockfile` in CI (covered in §1)
- SBOM: `@cyclonedx/cyclonedx-node-npm` or `syft` in release workflow
- Provenance: `npm publish --provenance` (npm registry) or GitHub's generic artifact attestation (`actions/attest-build-provenance`)
- Releases from CI only — never `npm publish` from a workstation
- For signed tags: `gpg` or `ssh` commit signatures required on `main`

---

---

## 16. Branch protection, ownership, and release governance

**`CODEOWNERS`** covering at minimum:

```text
# .github/CODEOWNERS
/.github/                         @org/platform
/.github/workflows/               @org/platform @org/security

# Policy docs and pointer files — every instruction surface AI reads
/AI-CONTRIBUTOR-SPECIFICATION.md       @org/platform @org/security
/.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md @org/platform @org/security
/AI-CONTRIBUTOR-GUIDE.md          @org/platform
/AGENTS.md                        @org/platform
/.github/copilot-instructions.md  @org/platform
/CLAUDE.md                        @org/platform
/.cursorrules                     @org/platform
/.claude/                         @org/platform

# Tooling configuration
/tsconfig.base.json               @org/platform
/eslint.config.js                 @org/platform

# Sensitive source paths
/packages/*/src/auth/             @org/security
/packages/*/src/payments/         @org/security
/supabase/migrations/             @org/data
```

GitHub branch protection on `main`:
- Require PR with at least one review
- Require status checks: `type-check`, `lint`, `test`, `build`
- Require signed commits (optional)
- Block force push and direct push
- Require branches to be up to date before merge

`SECURITY.md` with a disclosure address for public or externally consumed repos.

---

---

## 17. AI operating model

**Files:** [`AGENTS.md`](https://agents.md) (multi-tool, cross-vendor convention), `.github/copilot-instructions.md` (GitHub Copilot), `CLAUDE.md` (Anthropic Claude Code), `.cursorrules` (Cursor)

Pick one authoritative file. Tool-specific dotfiles `SHOULD` be thin pointers to the authoritative one to avoid drift.

Contents:
- Architecture overview, layer boundaries, non-negotiable invariants
- Canonical commands: `pnpm install`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm type-check`
- Forbidden actions (destructive / security-sensitive / release-affecting — per `AI-CONTRIBUTOR-SPECIFICATION.md` §23)
- Link to `AI-CONTRIBUTOR-SPECIFICATION.md`, `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`, approved AI provider list (§21)

---

---

## 18. Skills and shared workflow modules

**Directory:** `.claude/skills/**`, `.claude/commands/**`, or `.github/prompts/**`

- Version alongside code; review changes like source files
- One skill per purpose; no secrets in skill files
- Skills that can run destructive tools (`git push --force`, `rm -rf`, `npm publish`) `MUST` gate on human confirmation per §23

Boilerplate for a skill `SHOULD` include: purpose, inputs, outputs, side effects, owner.

---

---

## 19. MCP servers and external tool governance

**Location:** per-tool config (`.mcp.json`, `.cursor/mcp.json`, `.claude/settings.json`, etc.) — keep the allowlist in the repository, not in personal user config.

Maintain a single allowlist entry per approved server so a reviewer can see scope, owner, and risk class at a glance:

```yaml
# .ai/mcp-allowlist.yaml
servers:
  - name: github
    purpose: read issues/PRs, comment on PRs
    transport: stdio          # stdio | http
    write_scopes: [pr-comment]   # [] if read-only
    roots: []                    # filesystem roots exposed; [] if none
    auth: oauth-github-app        # token storage per §19 MUST
    risk: medium                  # low | medium | high
    owner: @platform-team
    approved: 2026-04-22
  - name: filesystem-readonly
    purpose: grep repo contents for context
    transport: stdio
    write_scopes: []
    roots: [./src, ./docs]
    auth: none
    risk: low
    owner: @platform-team
    approved: 2026-04-22
```

- Any server not in the allowlist `MUST` be refused at the harness config layer (per §19 MCP Allowlist).
- `write_scopes` and `roots` narrow the server's blast radius — empty lists mean "read-only, no filesystem access."
- `risk: high` entries (arbitrary-shell execution, production DB access, package publishing) `SHOULD` require human approval per §23 before invocation, not just at allowlist time.
- Audit: `grep -r "mcpServers" .claude .cursor .vscode 2>/dev/null` should match only entries present in `mcp-allowlist.yaml`.

---

---

## 20. Agents and delegation governance

**Trailer convention for AI-authored commits.** Implements the attribution requirement in `AI-CONTRIBUTOR-SPECIFICATION.md` §20 (`MUST` — "which agent performed which material actions") and the `SHOULD` in §21 that model, prompt, and skill versions be recorded on material AI-generated changes.

Structured Git trailers on every agent-authored commit:

```text
AI-Agent: claude-code@2.1.0
AI-Model: claude-opus-4-7
AI-Skill: speckit.implement@v1.2
AI-Session: 2026-04-22T14:03-abc123   # optional; correlates with transcripts per §22
```

- `AI-Agent` — the CLI, harness, or framework that ran the session (`claude-code`, `codex`, `cursor`, `aider`, a custom harness). Include the version — harness releases change context packing, tool wiring, and prompt scaffolding independent of the model.
- `AI-Model` — underlying model identifier. Include a provider prefix if the short name is ambiguous across vendors.
- `AI-Skill` — skill, slash command, or prompt-template name with its version. Omit for ad-hoc prompts.
- `AI-Session` — optional. Include only if you persist session transcripts and want a correlation key; follow §13 redaction and §22 retention.

Keeping `AI-Agent` and `AI-Model` separate matters for diagnosis: same model in a different harness is a different system, and a harness-only version bump can regress behavior without the model moving.

Enforcement (CI, on the PR commit range):

```sh
# Fail when an agent-authored commit lacks AI-Agent or AI-Model.
git log --format='%H%n%(trailers:only,unfold)%x00' ${{ github.event.pull_request.base.sha }}..HEAD \
  | awk 'BEGIN{RS="\0"}
         /^[a-f0-9]+\n/ {
           if ($0 !~ /AI-Agent:/) { print "missing AI-Agent:", $1; bad=1 }
           if ($0 !~ /AI-Model:/) { print "missing AI-Model:", $1; bad=1 }
         }
         END{ exit bad }'
```

`commitlint` with a custom rule that parses trailers works equivalently. Classify a commit as agent-authored by branch convention, a harness-written author-email suffix (e.g. `noreply+claude@…`), or a `Co-Authored-By` signature — whichever your pipeline produces reliably.

`git commit --amend` and rebases strip trailers silently; re-verify after force-push. Protect the lint workflow file under `CODEOWNERS` (§16) so the check cannot be turned advisory without review — see §24 `Gate Enforcement`.

---

---

## 21. AI-specific risks

- **Instruction files** (`AGENTS.md`, `.github/copilot-instructions.md`, `CLAUDE.md`, `.cursorrules`) versioned and reviewed like code
- **Skills / slash commands** stored under `.claude/skills/**` or `.github/prompts/**`, reviewed on change
- **Provider allowlist** in `AI-PROVIDERS.md` (or inside the instruction file) listing approved providers and models with scoped data classes and action categories (per §21 of the specification). Minimum template:

  ```yaml
  # AI-PROVIDERS.yaml
  providers:
    - name: anthropic
      models: [claude-opus-4-7, claude-sonnet-4-6]
      data_classes: [source, public]      # never regulated or secret
      actions: [research, code-authoring] # exclude release-affecting
      residency: us
      approved: 2026-04-22
      owner: @platform-team
    - name: openai
      models: [gpt-5.4]
      data_classes: [public]
      actions: [research]
      residency: us
      approved: 2026-04-22
      owner: @platform-team
  ```

  Routing code `MUST` refuse any `(provider, model, data_class, action)` tuple not listed. Review the file on the same cadence as the adopted specification (§25).
- **Untrusted content:** agents fetching URLs, reading issue bodies, or consuming tool outputs `MUST NOT` let that content elevate privileges or trigger release-affecting actions. Sanitise before passing to model instructions.
- **AI-added dependencies:** reviewer checks every new entry against npm registry metadata — package exists, maintainer looks legitimate, publish age ≥ some threshold, download count reasonable, no recent ownership transfer
- **Cost ceiling / kill switch:** set per-run or per-month spending caps at the provider API level; circuit-breaker around paid agent loops
- **Transcripts and prompt audit:** if you persist them, redact secrets and PII before storage; document retention limits

---

---

## 22. Data protection and privacy

- **Mock mode:** auto-activates when credentials are absent — clone-and-run without touching production data
- **Fixtures:** scrubbed snapshots in `fixtures/` or `test/fixtures/`, committed only after review for leakage
- **Data classification comments:** `// @data-class: secret|regulated|customer|public` on schema definitions make downstream code review easier
- **Read-only by default:** any AI-accessible data path is read-only unless the write path has been explicitly designed and approved
- **Regulated data:** document the legal basis and controls in a dedicated section of `SECURITY.md` or a separate `COMPLIANCE.md`; verify provider data-residency claims before routing regulated data

## Further reading

- [`AI-CONTRIBUTOR-SPECIFICATION.md`](../../AI-CONTRIBUTOR-SPECIFICATION.md) — the normative specification this document implements
- [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](../../.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) — the audit checklist
- [`template/`](template/) — minimal config files referenced throughout this document

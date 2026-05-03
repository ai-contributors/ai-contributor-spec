# Reference Scaffold — TypeScript + pnpm

Copy-pasteable reference scaffold for a TypeScript + pnpm stack adopting [`AI-CONTRIBUTOR-SPECIFICATION.md`](../../../AI-CONTRIBUTOR-SPECIFICATION.md).

This template directory is licensed under Apache License 2.0; see [`LICENSE`](LICENSE).

It is a coupled reference scaffold, not a menu of unrelated snippets. If you keep the root scripts unchanged, keep `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `eslint.config.js`, and `packages/core/` aligned as a unit. This scaffold is validated in the upstream repository's CI on Node 24.

## Smallest useful adoption

Copy the scaffold as a unit, replace the placeholder names, run the commands in [How to use](#how-to-use), then score the result with the checklist. Cherry-picking a single file is possible, but you must re-check the script names and workspace paths it references.

This is a **reference scaffold**, not a complete project. It contains:

- `package.json` — root manifest with pinned Node engine, pinned pnpm package manager, canonical scripts, `lint-staged` config
- `pnpm-workspace.yaml` — workspace declaration
- `.nvmrc` — Node version pin
- `tsconfig.base.json` — strict TypeScript compiler options
- `eslint.config.js` — ESLint 10 flat config with typescript-eslint v8
- `.prettierrc` — formatting config
- `.gitignore`, `.env.example` — secret hygiene starters
- `.github/workflows/ci.yml` — CI pipeline with pnpm lockfile cache
- `.github/CODEOWNERS` — ownership skeleton (replace `@org/*` handles)
- [`AGENTS.md`](AGENTS.md) — AI-agent operating manual (terse, agent-readable; recommended sections per the AI Contributor Specification)
- [`GUARDRAILS.md`](GUARDRAILS.md) — governance catalog (the `AIC-authoritative-guardrail-doc` single authoritative place; recommended sections per the AI Contributor Specification)
- `config/env.ts` — sample runtime env validation using Zod
- `packages/core/` — one placeholder workspace package showing per-package layout plus a smoke test

## How to use

1. Copy this scaffold as a coherent starting point, then delete or reshape the parts you do not need. If you cherry-pick individual files, re-check the references between the root scripts, workspace layout, and TypeScript config before keeping the upstream command set.
2. Replace `@org/*` team handles in `.github/CODEOWNERS` with your real teams.
3. Replace the placeholder package (`packages/core`) with your actual packages.
4. Run `pnpm install`, then `pnpm type-check && pnpm lint && pnpm test && pnpm build` to verify the scaffold locally.
5. Wire up the Husky pre-commit hook (not shipped as an executable — create it once, locally):

   ```sh
   pnpm prepare
   cat > .husky/pre-commit <<'EOF'
   pnpm lint-staged
   pnpm type-check
   pnpm test
   EOF
   chmod +x .husky/pre-commit
   ```

## What this scaffold does NOT include

- A production-ready AI instruction file. The included `AGENTS.md` and
  `GUARDRAILS.md` are placeholders that need your real owners, providers, and
  rules.
- A runtime framework (pick React / Next / Fastify / Hono or another framework
  that fits your project)
- A database layer
- Production-grade `CODEOWNERS` for your domain
- Secret scanning, branch protection, human approval gates, SBOM generation, or dependency update automation — enable these as per the hints document
- Level 3+ supply-chain hardening: the `packageManager` field is version-pinned only (`pnpm@10.33.2`) for ease of bumping. To reach Level 3+, append the Corepack-generated `+sha512.<hash>` integrity suffix and regenerate it on every version bump — see [`../hints-typescript-pnpm.md`](../hints-typescript-pnpm.md) §1 for the rationale

This scaffold helps with parts of the baseline, but it does **not** by itself satisfy every baseline `MUST` in the specification. Use [`../hints-typescript-pnpm.md`](../hints-typescript-pnpm.md), [`../../../.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](../../../.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md), and your repository policy files to close the remaining gaps.

See the hints document ([`../hints-typescript-pnpm.md`](../hints-typescript-pnpm.md)) for the rationale and for clauses not covered by this scaffold.

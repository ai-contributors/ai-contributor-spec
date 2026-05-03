# Example: TypeScript + pnpm

A worked reference stack for adopting [`../../AI-CONTRIBUTOR-SPECIFICATION.md`](../../AI-CONTRIBUTOR-SPECIFICATION.md) in a TypeScript monorepo managed with pnpm.

## Fast path

If you want a practical starting point, copy the [`template/`](template/) directory first, then use [`hints-typescript-pnpm.md`](hints-typescript-pnpm.md) when a checklist row needs stack-specific tooling. The template is not a full conformance claim; it is a starting scaffold.

## Contents

- [`hints-typescript-pnpm.md`](hints-typescript-pnpm.md) — per-clause tooling hints, config snippets, and rule tables
- [`template/`](template/) — minimal reference scaffold referenced by the hints document

## How to use

1. Read [`hints-typescript-pnpm.md`](hints-typescript-pnpm.md) alongside the main [`AI-CONTRIBUTOR-SPECIFICATION.md`](../../AI-CONTRIBUTOR-SPECIFICATION.md).
2. Copy [`template/`](template/) as a starting point or lift a coherent subset from it — adjust package names, owners, and versions to your context.
3. Walk [`../../.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](../../.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) and record the automation or review step that enforces each ticked item.

## Reference versions

The authoritative version pins live in [`template/package.json`](template/package.json), [`template/.nvmrc`](template/.nvmrc), and [`template/.github/workflows/ci.yml`](template/.github/workflows/ci.yml). This document does not restate them — consult those files for the current majors. Pin majors explicitly in your own `package.json`; let minor/patch updates flow through Renovate or Dependabot after CI verifies them.

# Agents

Authoritative AI-agent operating manual for the synthetic golden-audit repo. This repository is test data for the audit collector; sectioning follows the recommended convention from the [AI Contributor Specification](https://github.com/ai-contributors/ai-contributor-spec). Real repositories should expand each section.

Governance details live in [`GUARDRAILS.md`](GUARDRAILS.md).

## Authority and scope

This file is the single authoritative source for AI-agent behaviour in this repo. Tool-specific files would be thin pointers back to this file. CODEOWNERS overrides this file when they conflict.

Owners: golden-audit fixture (no real owner). Last reviewed: synthetic.

## Forbidden actions

- No `git push --force` to `main`.
- No `npm publish` from a developer workstation.
- No edits to `.github/workflows/` without security-owner approval.

## Approved AI providers and MCP servers

Synthetic fixture — no real providers or MCP servers are approved. See [`GUARDRAILS.md`](GUARDRAILS.md#provider-and-model-allowlist) for the structure a real repo would use.

## Data handling

Public source code only. Synthetic; no production or regulated data exists in this repo.

## Reliability and observability

Tests, lint, and type-check must pass on every change. Errors surface to the human reviewer with the failing command output.

## Skills, prompts, and audit trail

Synthetic fixture; no skills or prompts. A real repo would record AI-authored changes via `AI-Authored:` and `Prompt-Audit:` trailers per [`GUARDRAILS.md`](GUARDRAILS.md#authorship-and-prompt-audit).

## Architecture

Single-package TypeScript scaffold. Source in `src/`, tests in `src/**/*.test.ts`.

## Commands

- `pnpm install` — install dependencies
- `pnpm type-check` — TypeScript strict-mode check
- `pnpm lint` — eslint
- `pnpm test` — vitest

## Credentials

Local development uses `.env` (gitignored). Secrets ship via repo secrets only; never commit `.env`. Rotate keys via the team's secret manager when a contributor leaves.

## Readiness

A change is ready to merge when: tests pass, lint passes, type-check passes, the change is reviewed by a CODEOWNER, and the PR template's `## How validated` field cites direct evidence.

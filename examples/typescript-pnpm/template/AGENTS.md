# Agents

Authoritative AI-agent operating manual for this repository. Keep this file
terse so it fits comfortably in an agent's context window. Governance details
(the full provider allowlist, the data-classification matrix, and the incident
playbook) live in [`GUARDRAILS.md`](GUARDRAILS.md).

This sectioning follows the recommended convention from the [AI Contributor Specification](https://github.com/ai-contributors/ai-contributor-spec). Sections are recommended, not normatively required.

## Authority and scope

This file is the single authoritative source for how AI agents act in this
repo. Tool-specific files (`CLAUDE.md`, `.cursorrules`,
`.github/copilot-instructions.md`, `GEMINI.md`, etc.) MUST be thin pointers
back to this file. CODEOWNERS and the security policy override this file when
they conflict.

Owners: `<TEAM-OR-PERSON>`. Last reviewed: `<YYYY-MM-DD>`.

## Forbidden actions

Non-negotiable. Agents must refuse and ask for human approval rather than do any of these:

- No `git push --force` to protected branches.
- No edits to `.github/workflows/`, branch protection rules, or environment protection rules without security-owner approval.
- No `npm publish`, `pnpm publish`, or release tags from an agent workstation; releases run from CI.
- No installation of new top-level dependencies without checking license, ownership, and supply-chain signals (see [`GUARDRAILS.md`](GUARDRAILS.md#provider-and-model-allowlist)).
- No exfiltration of `.env`, secret manager values, customer data, or regulated data to any AI provider.

## Approved AI providers and MCP servers

Short list for at-a-glance reference. The full allowlist with approval scope per data class lives in [`GUARDRAILS.md`](GUARDRAILS.md#provider-and-model-allowlist).

Providers: `<list>` (e.g., Anthropic Claude, OpenAI GPT-5).
MCP servers: `<list>` (e.g., none, or `filesystem`, `github`).

If you need a provider or MCP server not on the list, stop and request approval — do not work around it.

## Data handling

Public source code, public docs, and synthetic test fixtures may go to AI
providers. Secrets, customer data, and regulated data may not. The full matrix
per classification and provider lives in
[`GUARDRAILS.md`](GUARDRAILS.md#data-classification-and-ai-permissions).

If unsure about a class, treat it as restricted and ask.

## Reliability and observability

- Tests, lint, type-check, and the guardrail suite must pass on every PR before merge.
- On unexpected errors, surface the failure to the human reviewer with the command output and the file:line context. Do not silently retry destructive commands.
- Logs from agent runs go to `<destination>` and are queryable by agent identity, model, and time range (see [`GUARDRAILS.md`](GUARDRAILS.md#authorship-and-prompt-audit)).

## Skills, prompts, and audit trail

- Approved skills/prompts live in `<path>` (e.g., `.github/prompts/`, `.claude/commands/`).
- Material AI-authored changes record the model identifier, the prompt or skill version, and timestamp in the commit/PR metadata, per [`GUARDRAILS.md`](GUARDRAILS.md#authorship-and-prompt-audit).
- Use `Co-Authored-By:` for visibility, plus the `AI-Authored:` and `Prompt-Audit:` trailers for queryable provenance.

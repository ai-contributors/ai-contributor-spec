# Synthetic Golden-Audit Repo

This is a hand-curated minimal repo whose audit output is asserted by [`tools/tests/check-golden-audit.ts`](../../../tools/tests/check-golden-audit.ts).

It is test data for the audit collector, not an example of a complete production repository.

The point: two different agents auditing this directory at the same `spec_source` SHA must produce the same `derived_status` for every collector rule. Drift here is an early warning that audit comparability has regressed.

The expected per-rule statuses are recorded in [`../expected/derived-statuses.json`](../expected/derived-statuses.json). Adjust there (and document why) when collector behavior changes deliberately.

AI-agent operating manual: [`AGENTS.md`](AGENTS.md). Governance catalog: [`GUARDRAILS.md`](GUARDRAILS.md).

# Specification Clauses From JSON Design

## Goal

Make `AI-CONTRIBUTOR-RULE-CATALOG.json` the source of truth for normative
rule bullets in `AI-CONTRIBUTOR-SPECIFICATION.md`.

## Scope

This slice generates the `AIC-*` rule bullets under `## Specification
clauses` from the catalog. It keeps the existing clause frame text in the
specification: pillar headings, clause headings, scope headings, explanatory
paragraphs, examples, cross-references, and non-normative notes.

Keeping frame text hand-authored avoids a large catalog format expansion for
rich prose blocks. The catalog remains canonical for the rule-bearing content:
ID, clause, pillar, scope, and exact normative sentence.

## Approach

Add `tools/spec-authoring/generate-spec-clauses.ts` with two modes:

- default mode rewrites the normative bullet blocks in
  `AI-CONTRIBUTOR-SPECIFICATION.md` from the catalog;
- `--check` mode verifies the file is current and fails with a regenerate
  hint if not.

The renderer parses the existing specification clause frame, tracks the current
clause and scope, and replaces only contiguous rule bullets that carry visible
`AIC-*` IDs. Non-rule prose is preserved byte-for-byte. If the catalog contains
a clause/scope group that the frame does not expose, the check fails instead of
silently dropping rules.

## Ordering

No presentation order fields are added to the catalog. Within each
clause/scope group, rules render deterministically by:

1. conformance level;
2. checklist rule label;
3. rule ID.

This accepts small rule reorders as the cost of avoiding duplicated ordering
metadata.

## Validation

The branch adds focused tests that prove:

- generated spec bullets are rendered from catalog text and IDs;
- surrounding non-normative frame text is preserved;
- stale hand edits in generated rule bullets are detected;
- missing clause/scope frame locations are reported.

The aggregate repository check then runs the new `check:spec-clauses` guardrail
before the existing catalog projection checks.

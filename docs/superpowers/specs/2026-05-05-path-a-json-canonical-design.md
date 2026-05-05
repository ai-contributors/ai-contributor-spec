# Path A JSON Canonical Design

## Goal

Move the rule metadata source of truth from markdown-derived extraction toward
`AI-CONTRIBUTOR-RULE-CATALOG.json` as the checked-in canonical rule catalog.

This slice does not change rule semantics, rule IDs, conformance levels,
checklist frontmatter, audit-log format, or detector behavior. It changes the
authoring direction: markdown assets are treated as projections of the catalog
and must match it.

## Scope

This slice adds:

- Catalog-first validation for `AI-CONTRIBUTOR-RULE-CATALOG.json`.
- A projection check that verifies current specification/checklist markdown
  matches catalog rule metadata.
- Package and tooling wiring so the aggregate local check enforces both the
  catalog format and markdown projection consistency.
- Repository instruction updates documenting that catalog rule metadata is now
  the source of truth for future path A work.

This slice does not edit:

- `AI-CONTRIBUTOR-SPECIFICATION.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`
- `.github/workflows/`
- `.github/CODEOWNERS`

## Source Of Truth Boundary

`AI-CONTRIBUTOR-RULE-CATALOG.json` is canonical for per-rule metadata already
present in the catalog:

- `AIC-*` ID
- clause
- pillar
- normative scope
- conformance level
- normative sentence text
- checklist rule name, row scope, and requirement text
- detector linkage and detector confidence

The surrounding prose frame in `AI-CONTRIBUTOR-SPECIFICATION.md` remains
hand-authored until a later slice adds enough structured catalog fields to
render it. The checklist template frontmatter and audit instructions also
remain hand-authored until their generator can reproduce the current template
without semantic drift.

## Architecture

`generate-rule-catalog.ts` keeps the existing extractor API for tests and
one-time migration work, but the CLI default changes direction. By default it
reads `AI-CONTRIBUTOR-RULE-CATALOG.json`, validates it, canonicalizes ordering
and formatting, and supports `--check`.

A new projection checker reads the canonical catalog and compares it to the
current markdown projections:

- specification normative bullets must match catalog `id`, `clause`, `scope`,
  `pillar`, and `text`;
- checklist rows must match catalog `level`, `checklist.rule`,
  `checklist.scope`, `checklist.requirement`, and grouped IDs;
- detector metadata remains validated through existing catalog consumers.

The old markdown extractor remains available behind an explicit
`--from-markdown` CLI flag. That flag is a migration aid, not the default
authoring path.

## Validation

Focused tests cover:

- catalog canonicalization sorting rules without parsing markdown;
- projection mismatch detection for spec text and checklist row metadata;
- existing downstream consumers (`coverageRowsFromCatalog`,
  `rowScopeProblemsFromCatalog`, collector row coverage) still using catalog
  data.

Repository checks run:

- `check:rule-catalog` to validate and canonicalize the JSON catalog;
- `check:rule-catalog-projections` to verify current markdown projections
  match the catalog.

## Follow-Up Work

Later slices can replace projection checks with actual renderers for:

- `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- `AI-CONTRIBUTOR-SPECIFICATION.md`
- `AI-CONTRIBUTOR-AUDIT-MODEL.md`
- `AI-CONTRIBUTOR-AUDIT-PROMPT.md`

Those slices must preserve generated output byte-for-byte where practical and
route any guarded artifact diffs through the approval points in `AGENTS.md`.

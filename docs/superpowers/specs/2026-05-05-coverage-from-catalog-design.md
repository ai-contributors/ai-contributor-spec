# Catalog-Backed Coverage Design

## Goal

Make `AI-CONTRIBUTOR-COVERAGE.md` a direct projection of
`AI-CONTRIBUTOR-RULE-CATALOG.json`, including both row counts and display
metadata for pillars and conformance levels. Use a Markdown template so the
authoring workflow is obvious: prose lives in the template, structured facts
live in the catalog, and the root coverage file is generated output.

## Context

The current generator already deduplicates coverage rows from the catalog, but
it still reads pillar names and level labels from
`AI-CONTRIBUTOR-SPECIFICATION.md`. That leaves one remaining indirect source
for the coverage map. Since the specification is now a generated projection of
the catalog and template, coverage should not parse the specification to learn
catalog-owned metadata.

## Design

`tools/spec-authoring/generate-coverage.ts` will load and validate
`AI-CONTRIBUTOR-RULE-CATALOG.json` once, derive coverage rows from
`catalog.rules`, derive pillar labels from `catalog.pillars`, and derive level
labels/order from `catalog.levels`. The optional `—` level remains excluded
from required-level iteration and is rendered as the existing optional row.

`tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template` owns the
coverage-map frame prose and placement. It uses explicit directives:
`{{generated:coverage-at-a-glance}}`, `{{generated:coverage-by-scope}}`,
`{{generated:coverage-by-pillar}}`, `{{generated:coverage-by-level}}`, and
`{{generated:coverage-cumulative}}`. `AI-CONTRIBUTOR-COVERAGE.md` is the
rendered projection and should not be edited directly.

## Testing

Add unit coverage in `tools/tests/test-rule-catalog.ts` that mutates catalog
pillar and level labels and verifies rendered coverage blocks use those catalog
values. This prevents a future regression where coverage silently falls back to
spec or checklist parsing for display metadata.

Add template-rendering coverage that verifies the renderer preserves
template-owned prose, replaces every coverage directive, and rejects unknown
coverage directives.

Run `npm --prefix tools run test:rule-catalog`, `npm --prefix tools run
check:coverage`, focused documentation checks, and finally
`npm --prefix tools run check:ci-local`.

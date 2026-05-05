# Checklist Assets From JSON Design

## Goal

Generate the rule-bearing checklist assets from
`AI-CONTRIBUTOR-RULE-CATALOG.json` so the catalog is no longer only checked
against `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`. This slice makes
the checklist rule tables reproducible from the catalog, while checklist ID
bindings are checked directly against the catalog.

## Scope

This slice adds:

- a renderer for the checklist row tables grouped by conformance level;
- a generator/check command that rewrites or checks those generated regions
  inside `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`;
- a pillar/checklist check that derives expected `Rule` to `AIC-*` bindings
  from the catalog instead of an embedded checklist comment;
- tests proving the rendered fragments are deterministic and drift is detected;
- tooling, `AGENTS.md`, and changelog updates describing the generation rule.

This slice does not change rule semantics, row status placeholders, auditor
instructions, checklist frontmatter, audit-log format, the evidence schema,
collector behavior, `.github/workflows/`, or `.github/CODEOWNERS`.

## Source Of Truth Boundary

`AI-CONTRIBUTOR-RULE-CATALOG.json` is authoritative for checklist row metadata:
row rule, IDs, level, scope, requirement, and pillar. The checklist template
still owns the surrounding audit instructions, lifecycle text, backlog table,
summary table, verification gaps, and validation instructions.

The catalog does not yet contain enough data to regenerate all specification
or audit prose. Full document generation requires additional structured fields
such as prose sections, section ordering, applicability text, rationale,
examples, and any hand-authored explanatory blocks.

## Architecture

Create `tools/spec-authoring/generate-checklist-assets.ts` with importable
functions and a CLI:

- `renderChecklistRuleTables(catalog)` renders the `## Level N` and
  `## Optional` rule tables from grouped catalog rows.
- generated rows are sorted mechanically by level, scope, clause, rule, then
  ID. This may reorder existing hand-authored rows, but does not change row
  semantics.
- `renderChecklistAssets(catalog)` renders the generated rule-table fragment
  and removes any legacy `CHECKLIST-ID-BINDINGS` block.
- `checklistAssetProblems({ catalog, checklistContent })` compares rendered
  rule tables with the checked-in template and fails if a legacy binding block
  remains.
- CLI `--check` fails on drift; default mode rewrites the generated regions.

Generated rule tables are selected by the existing stable anchors:

- `## Checklist row tables` through `---` before `## Verification gaps`

The existing projection checker remains as a semantic check. The new generator
is stricter for the checklist regions because it enforces byte-identical output
from catalog data. The catalog does not store presentation-only order fields.

## Validation

Focused tests cover:

- rendering row tables from grouped catalog rows;
- removing the legacy ID binding block during checklist asset rendering;
- rejecting presentation-order fields as catalog metadata;
- detecting stale checklist fragments;
- current repository checklist fragments matching the catalog.

Repository checks add `check:checklist-assets` and
`generate:checklist-assets`, and the aggregate `check` chain runs the new
check after `check:rule-catalog`.

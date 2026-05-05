# Rule Catalog First Slice Design

## Goal

Implement the first safe slice of issue #4 by adding a validated,
machine-readable rule catalog named `AI-CONTRIBUTOR-RULE-CATALOG.json`.

The catalog is a generated artifact derived from the current specification,
audit checklist, and collector registry. It does not make the JSON catalog the
normative source of truth yet.

## Scope

This slice adds:

- `AI-CONTRIBUTOR-RULE-CATALOG.schema.json`, a JSON Schema for the catalog.
- `AI-CONTRIBUTOR-RULE-CATALOG.json`, generated from existing repository
  sources.
- A generator/check command under `tools/spec-authoring/`.
- Tests and local check wiring so catalog drift fails locally.

This slice does not edit:

- `AI-CONTRIBUTOR-SPECIFICATION.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`
- `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`
- `.github/workflows/`
- `.github/CODEOWNERS`

## Catalog Contents

Each rule entry contains:

- `id`: the stable `AIC-*` ID.
- `clause`: the numeric specification clause.
- `pillar`: the numeric pillar parsed from the specification.
- `scope`: one of `MUST`, `MUST when applicable`, `SHOULD`, or `MAY`.
- `level`: the checklist minimum level, or `—` for optional rows.
- `text`: the normative sentence from the specification bullet.
- `checklist`: the current checklist row name and requirement text.
- `detectors`: collector rule IDs that currently emit decisive evidence for
  the AIC ID.
- `detectorConfidence`: `indicative` for existing collector-backed IDs and
  `manual` for IDs without collector linkage.

The catalog keeps current row grouping intact. A checklist row with multiple
IDs produces one catalog entry per `AIC-*` ID, with the same checklist row
metadata repeated for each entry.

## Architecture

The generator builds on existing parsers instead of adding another source of
truth. It extends `tools/spec-authoring/shared/spec-model.ts` to expose
normative bullet text by ID, reuses `parseChecklistRows`, and reads
`RULE_AIC_IDS` from the collector registry through a small exported helper or
static import.

`generate-rule-catalog.ts` writes deterministic, pretty-printed JSON and
supports `--check`, matching the existing `generate-coverage.ts` pattern.
Schema validation is implemented with local TypeScript checks rather than a new
runtime dependency.

## Validation

Focused tests cover:

- normative text extraction from specification bullets,
- catalog generation from representative spec/checklist/collector inputs,
- detector mapping for collector-backed and manual-only rules,
- stable sort order and duplicate ID rejection.

Repository checks add a script that runs the catalog generator in check mode.
The aggregate `npm --prefix tools run check` command includes that script, so
local and CI-style checks fail when the catalog drifts.

## Future Work

After this slice lands, a later change can migrate selected markdown outputs to
be generated from the catalog, then decide whether to make the catalog canonical
for spec authoring. That later change will require maintainer approval because
it affects guarded normative and template artifacts.

## Follow-Up Slice: Coverage Catalog Consumption

The next safe slice moves `AI-CONTRIBUTOR-COVERAGE.md` generation to read
`AI-CONTRIBUTOR-RULE-CATALOG.json` instead of reparsing the checklist. The
generated coverage output must remain byte-identical.

This requires adding checklist row scope to the catalog because coverage counts
checklist rows, not individual `AIC-*` IDs. Multi-ID checklist rows must be
deduplicated by checklist row identity before counting, preserving today's row
counts while making the catalog the coverage generator's data contract.

The catalog generator still derives the catalog from the current specification,
checklist, and collector registry. This slice does not make the catalog the
normative authoring source and does not edit guarded specification or audit
template files.

## Follow-Up Slice: Collector Coverage Check Catalog Consumption

The collector row coverage check should also read detector metadata from
`AI-CONTRIBUTOR-RULE-CATALOG.json`. The check still verifies the same invariant:
a collector-backed row may stamp mechanically only when every visible `AIC-*`
ID in that checklist row has decisive collector evidence.

This removes the check's regex parser for `collector-registry.ts`. The catalog
generator remains responsible for deriving detector metadata from the registry,
and `check:rule-catalog` keeps that generated metadata current before downstream
catalog consumers rely on it.

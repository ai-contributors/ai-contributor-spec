# Checklist Template From Catalog Design

## Goal

Move `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md` to the same authoring
model as the specification and coverage map: a Markdown template owns prose and
placement, while `AI-CONTRIBUTOR-RULE-CATALOG.json` owns generated checklist
rule facts and conformance-level metadata.

This slice must not change rule semantics, checklist row grouping,
frontmatter fields, stamped verification-gap markers, validator behavior, audit
log format, or collector behavior.

## Context

The checklist rule tables are already catalog-generated, but the generator
rewrites an in-place region inside the checked-in checklist file. That leaves a
different workflow from the specification and coverage map, where maintainers
edit templates under `tools/spec-authoring/templates/` and regenerate checked-in
output.

The remaining inconsistency is authoring clarity. Maintainers should not need
to know which part of the checklist file is hand-edited and which part is
generated. They should edit a checklist template for prose, edit the catalog for
rule metadata, and run `generate:checklist-assets`.

## Design

Add `tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template`.
The template is derived from the current shipped checklist and replaces the
catalog-owned rule-table section with:

```md
{{generated:checklist-rule-tables}}
```

The frontmatter `spec_version` uses `{{specVersion}}` so the catalog remains
the source of truth for the shipped checklist version.

`generate-checklist-assets.ts` becomes a full-file renderer:

- reads `AI-CONTRIBUTOR-RULE-CATALOG.json`;
- reads the checklist template;
- replaces `{{specVersion}}` with `catalog.specVersion`;
- replaces `{{generated:conformance-level-values}}` with the valid numeric
  conformance-level values from catalog level metadata;
- replaces `{{generated:conformance-level-summary-rows}}` with the Level 0–4
  summary table rows from catalog level labels;
- replaces `{{generated:conformance-level-bullets}}` with the quick-reference
  conformance-level bullets from catalog level labels and descriptions;
- replaces exactly one `{{generated:checklist-rule-tables}}` directive with
  the existing catalog-rendered rule tables whose level headings use catalog
  level labels;
- rejects unknown, missing, duplicate, or unresolved checklist directives;
- writes the rendered output to
  `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`;
- checks that the rendered output matches the shipped checklist in `--check`
  mode.

The generated checklist output does not retain template directives. The
stamped verification-gap block, status semantics, backlog policy, evidence
rules, and `TEMPLATE-ONLY` auditor instructions remain ordinary template-owned
prose/markers in the rendered output because they are part of the shipped audit
template contract, not catalog rule metadata.

## Compatibility

The public npm command names stay the same:

- `npm --prefix tools run generate:checklist-assets`
- `npm --prefix tools run check:checklist-assets`

Existing parser, validator, collector, stamper, and projection checks continue
to read the shipped checklist output. The old legacy checklist-ID binding
removal path is no longer needed for normal generation, but the generator may
continue to reject legacy binding blocks in rendered output so old migrations
fail loudly.

## Testing

Extend `tools/tests/test-rule-catalog.ts` with focused renderer tests that:

- prove template-owned prose is preserved;
- prove catalog level labels/descriptions render into the summary table,
  quick-reference bullets, and rule-table headings;
- prove `{{generated:checklist-rule-tables}}` renders current catalog rows;
- prove the rendered output contains no unresolved template directives;
- prove unknown checklist directives fail with a clear error.

Run a red-green cycle against `npm --prefix tools run test:rule-catalog`, then
regenerate the checklist and run `check:checklist-assets`, markdown/link checks,
and the full local gate before committing.

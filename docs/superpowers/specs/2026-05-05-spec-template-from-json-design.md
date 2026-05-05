# Specification Template From Catalog Design

## Goal

Generate `AI-CONTRIBUTOR-SPECIFICATION.md` from a Markdown template plus
`AI-CONTRIBUTOR-RULE-CATALOG.json`, so catalog data is the source of truth for
spec version, pillar metadata, conformance levels, conformance workflow
summaries, clause headings, clause counts, normative scope lists, and normative
`AIC-*` rule bullets.

## Boundary

The catalog owns durable structured facts:

- `specVersion`
- pillar number, icon, title, description
- conformance level id, label, order, description, workflow summary
- clause number, pillar, title
- rule id, clause, scope, level, text, checklist binding, detector metadata

The template owns prose and document flow:

- introduction, scope, definitions, and normative-language prose outside the
  generated clause section
- Level 0 rationale and "Which level do you need?" framing prose
- final principle and other reader guidance

This keeps JSON useful for projections and audits without turning long-form
specification prose into escaped strings.

## Template Directives

The template lives at
`tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template`.

It uses a deliberately small directive set:

- `{{specVersion}}`
- `{{generated:clause-count}}`
- `{{generated:spec-scope-list}}`
- `{{generated:pillars-table}}`
- `{{generated:conformance-levels}}`
- `{{generated:level-workflow-table}}`
- `{{generated:specification-clauses}}`
- `{{generated:pillar-heading:<number>}}`
- `{{generated:clause-heading:<number>}}`
- `{{generated:spec-rules:<clause>:<scope>}}`

The full-section `{{generated:specification-clauses}}` directive is used by
the checked-in template. The fine-grained heading/rule directives remain
supported for small tests and compatibility, but they are not used in the
production specification template.

The generated output does not retain these directives. CI compares the rendered
output with `AI-CONTRIBUTOR-SPECIFICATION.md`; any direct edit to generated
content fails until the template or catalog is updated and the generator is
rerun.

## Rendering Rules

- Pillars render in catalog order as the `## Pillars` table.
- Clause counts render from the catalog `clauses` array.
- Scope lists render from the generator's canonical specification scope order.
- The complete `## Specification clauses` body renders from catalog pillars,
  clauses, scope groups, and rule bullets.
- Conformance-level bullets render from catalog `levels`, excluding the
  optional `—` pseudo-level.
- The "Which level do you need?" table renders from catalog level labels and
  workflow summaries, excluding the optional `—` pseudo-level.
- The generator fails if the template references an unknown pillar, clause, or
  rule group.
- The generator fails if the workflow table directive is used and any rendered
  conformance level is missing a workflow summary.
- When fine-grained directives are used, the generator fails if any catalog
  pillar, clause, or rule group has no matching template directive.
- The generator fails if a rendered document still contains an unresolved
  directive.

## Compatibility

Existing command names remain usable as aliases:

- `generate:spec-clauses` delegates to the full specification generator.
- `check:spec-clauses` delegates to the full specification check.

New clearer command names are added:

- `generate:specification`
- `check:specification`

## Testing

`tools/tests/test-rule-catalog.ts` covers the template renderer with a small
synthetic catalog and template:

- renders version, pillars, complete specification clauses, rule bullets, and
  conformance levels
- renders clause counts, scope lists, and conformance workflow table rows
- preserves non-generated prose
- detects stale generated specification output
- reports unknown directives
- reports missing directives for catalog rule groups

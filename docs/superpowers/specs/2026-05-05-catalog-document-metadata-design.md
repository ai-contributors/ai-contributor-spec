# Catalog Document Metadata Design

## Goal

Move the specification's structural document metadata into
`AI-CONTRIBUTOR-RULE-CATALOG.json` so the next generator can render
specification clauses from the catalog without reparsing headings for pillar,
clause, or level labels.

## Scope

This slice adds top-level catalog metadata for:

- pillars: number, icon, title, and short description;
- clauses: number, owning pillar, and title;
- levels: level ID, display label, description, and sort order.

It also aligns the catalog and shipped audit templates with the current
specification version `0.2`.

This slice does not generate `AI-CONTRIBUTOR-SPECIFICATION.md` yet. The
current projection checks remain the semantic safety net. The next slice can
replace the checked projection with a generated `## Specification clauses`
region.

## Catalog Shape

The catalog gains these top-level arrays:

```json
{
  "pillars": [
    {
      "number": 1,
      "icon": "🏗️",
      "title": "Engineering Foundation",
      "description": "The reproducible environment, static correctness, architecture boundaries, and pre-commit / CI gates that make any change reviewable."
    }
  ],
  "levels": [
    {
      "id": "L0",
      "order": 0,
      "label": "Baseline Hygiene",
      "description": "The repository satisfies the baseline requirements..."
    }
  ],
  "clauses": [
    {
      "number": 1,
      "pillar": 1,
      "title": "Reproducible environment"
    }
  ],
  "rules": []
}
```

The optional checklist level is represented as level ID `—` with a high sort
order so renderers can continue grouping optional rows without treating them
as a conformance level.

## Validation

Validation enforces that:

- pillar numbers, level IDs, level orders, and clause numbers are unique;
- every pillar, level, and clause has non-empty display text;
- every rule references an existing clause and level;
- each rule's pillar matches the owning pillar of its clause;
- catalog document metadata matches the current markdown projection.

`generate-rule-catalog.ts --from-markdown` remains a migration aid and now
extracts these fields from the current specification/checklist projection.

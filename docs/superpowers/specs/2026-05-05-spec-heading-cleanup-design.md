# Spec Heading Cleanup Design

## Goal

Clean up the heading hierarchy inside `AI-CONTRIBUTOR-SPECIFICATION.md` before
the next JSON-generation slice renders the normative clause section.

## Design

The public Markdown spec keeps its existing document shape and rule wording.
Only the heading levels inside `## Specification clauses` change:

- `### Pillar N` remains the pillar heading.
- `## N. Clause title` becomes `#### N. Clause title`.
- Scope groups such as backticked `MUST` and `SHOULD` headings become `#####`.
- Non-normative clause-local subsections such as examples and cross-references
  also become `#####` because they belong to the clause, not to the whole spec.

This creates a normal hierarchy: document section -> pillar -> clause -> scope
or clause-local subsection.

## Compatibility

The rule catalog remains the source of truth for rule metadata. This cleanup
does not change any `AIC-*` ID, normative text, clause number, pillar
assignment, checklist row, or conformance rule. Parsers and doc checks should
accept the cleaned hierarchy and continue to tolerate legacy `## N. Clause`
headings where useful for existing fixtures and examples.

## Validation

Validation covers:

- spec-model parsing of the cleaned heading hierarchy;
- clause-reference and pillar-structure checks;
- normative ID coverage;
- rule-catalog projection checks proving rule text and IDs are unchanged;
- markdown and link checks for heading anchors.

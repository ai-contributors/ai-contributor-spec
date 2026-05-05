# Final Stack Review

## Scope

This note reviews the issue 4 JSON-source migration as one stacked change set
from `main` through `issue-4-authoring-docs-cleanup`.

The stack covers:

- catalog creation and canonicalization;
- generated specification clauses and full specification template rendering;
- generated coverage map;
- generated checklist assets and full checklist template rendering;
- generated root audit summary and audit-log templates;
- contributor and agent authoring guidance for the catalog/template workflow.

## Current Branch Stack

| Order | Branch | Commit | Package |
|---:|---|---|---|
| 1 | `issue-4-rule-catalog` | `cbf2c61` | Add the initial rule catalog and schema. |
| 2 | `issue-4-path-a-json-canonical` | `be52def` | Make the JSON catalog canonical and add projection checks. |
| 3 | `issue-4-checklist-assets-from-catalog` | `ce01f49` | Generate checklist rule assets from the catalog. |
| 4 | `issue-4-spec-heading-cleanup` | `57b38ad` | Normalize specification heading hierarchy. |
| 5 | `issue-4-catalog-doc-metadata` | `08b5f1e` | Add catalog-owned pillar, clause, level, and version metadata. |
| 6 | `issue-4-generate-spec-clauses` | `1ee02ec` | Generate specification clause rules from the catalog. |
| 7 | `issue-4-spec-template-from-json` | `d84cc0c` | Generate the full specification from template plus catalog. |
| 8 | `issue-4-coverage-from-catalog` | `81174c1` | Generate coverage from template plus catalog. |
| 9 | `issue-4-checklist-template-from-catalog` | `8f6b3a4` | Generate the full checklist from template plus catalog. |
| 10 | `issue-4-audit-templates-from-catalog` | `cd1e02e` | Generate audit summary and audit-log templates from catalog metadata. |
| 11 | `issue-4-authoring-docs-cleanup` | `HEAD` | Align contributor docs with catalog/template authoring and record the stack packaging decision. |

The former local branch name `issue-4-generate-docs-from-json` has been renamed
to `issue-4-checklist-assets-from-catalog` so the branch name matches the
package it contains. This was a local branch-pointer rename only; no remote
branch was pushed or renamed.

## Review Findings

The stack is linear and each package has one local commit. The top-branch diff
is broad: 58 files, about 13k insertions, and about 1.4k deletions. The largest
single artifact is the catalog itself, followed by generator/test additions and
generated projection rewrites.

The migration is internally coherent:

- `AI-CONTRIBUTOR-RULE-CATALOG.json` is the canonical structured source for
  rule, document, coverage, checklist, level, clause, and version metadata.
- Markdown templates under `tools/spec-authoring/templates/` own long-form prose
  and placement.
- Generated projections are checked by dedicated commands:
  `check:rule-catalog`, `check:specification`, `check:coverage`,
  `check:checklist-assets`, `check:audit-templates`, and
  `check:rule-catalog-projections`.
- `CONTRIBUTING.md`, `AGENTS.md`, `TOOLING.md`, and
  `AI-CONTRIBUTOR-AUDIT-MODEL.md` describe the current authoring boundaries.

No additional implementation package is needed before review. The remaining
work is reviewer packaging and, after merge direction is settled, ordinary local
branch cleanup.

## Packaging Decision

Preferred packaging is a linear PR stack, preserving the current package order
and one squashed commit per branch. This keeps reviewable boundaries around each
source-of-truth step and avoids presenting the entire 58-file migration as one
large PR.

If maintainers want fewer GitHub PRs, the safest compression is four squashed
review packages:

1. Catalog foundation: branches 1 through 5.
2. Specification generation: branches 6 and 7.
3. Generated companion and audit artifacts: branches 8 through 10.
4. Authoring docs cleanup and final review: branch 11.

A single mega-PR is not recommended unless reviewers explicitly prefer it. The
diff is large enough that collapsing all packages would make it harder to
separate catalog-source changes from generated-output changes.

## Final Gate

Run the full local PR gate on the top branch before opening or updating the PR:

```sh
npm --prefix tools run check:ci-local
```

# Changelog

This file records notable normative changes to the AI Contributor Specification and its companion checklist, guide, and audit-log templates.

**Scope.** Only normative changes appear here: new or modified `MUST` / `SHOULD` / `MAY` clauses, checklist row changes, audit-log or evidence-model changes, and changes to shipped audit/skill behavior that adopters can observe. Tooling, coverage lifts, internal refactors, and CI gate adjustments live in `git log` rather than this file. Squash-merged commits to `main` therefore do not all map one-to-one to CHANGELOG entries.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Specification releases use SemVer bump semantics with compact patch-zero notation:

- A major bump marks a change that breaks existing conformance claims.
- A minor bump adds or tightens normative requirements.
- A patch bump covers corrections that do not change what a conforming repository must do.

For the specification and companion templates, patch-zero releases are written as `MAJOR.MINOR` (`0.1`, `1.2`) rather than `MAJOR.MINOR.0`. Patch releases are explicit only when they exist (`0.1.1`, `1.2.1`). Maintainers should prefer minor releases for meaningful specification changes and reserve patch releases for narrow corrections to an already published minor line.

**Release tag versus tool versions.** A Git release tag such as `v0.1` is the specification release and pins the whole adopter-facing bundle at that commit: specification, guide, checklist template, audit-log template, audit skill, examples, bootstrap, collector, stamper, and validator. The tag version is the spec version. It is not the same thing as `BOOTSTRAP_VERSION`, `collector_version`, or `validator_version`; those are implementation versions stamped into audit artifacts so auditors can identify which runtime produced a result. Mention runtime/tool changes in a release entry only when adopters can observe the behavior. Internal refactors, test-only changes, coverage lifts, and implementation version bumps with no adopter-visible behavior stay in `git log`.

The catalog's `specVersion` is the adopter-facing specification release, while
`schemaVersion` is the catalog JSON shape version used by tooling. Patch
releases may update `specVersion` without changing `schemaVersion`.

Every released entry lists the release date (the day the version lands on `main`).

## [0.1.3] — 2026-07-02

### Changed

- Collapsed the three documented process options (manual self-assessment,
  scripted human audit, agent-assisted audit) into a single scripted audit
  process whose judgment-required rows are filled by a human or an agent.
  Both auditor choices produce the same artifacts and evidence chain and
  require human/accountable-owner acceptance before a conformance claim.
- Manual self-assessment is now described as a script-free planning exercise
  for gap analysis rather than a peer process option; it was never a valid
  conformance-claim path, and that remains unchanged.
- Audit field-ownership documentation is consolidated:
  `AI-CONTRIBUTOR-AUDIT-MODEL.md` § Artifact And Field Ownership is the single
  canonical table, and the shipped audit protocol and `CONTRIBUTING.md` link
  to it instead of restating it. The ownership rules themselves are unchanged.
- The bootstrap runbook manifest now materializes
  `AI-CONTRIBUTOR-AUDIT-MODEL.md` so the protocol's canonical ownership
  reference resolves inside pinned runbooks.

This patch release does not change rule semantics, checklist rows, audit
frontmatter fields, or conformance obligations.

## [0.1.2] — 2026-05-10

### Changed

- Added stable generated anchors to specification pillar and clause headings so
  internal links remain readable and deterministic.
- Expanded adopter-facing reference docs for the rule catalog, glossary, audit
  profile, and threat model without changing conformance obligations.
- Clarified audit artifact terminology and catalog/checklist relationships to
  match the current generated audit templates.

This patch release does not change rule semantics, checklist rows, audit
frontmatter fields, or conformance obligations.

## [0.1.1] — 2026-05-05

### Changed

- `AI-CONTRIBUTOR-RULE-CATALOG.json` is now the canonical source for rule IDs,
  normative rule text, pillar and clause metadata, conformance-level metadata,
  checklist row bindings, coverage data, and generated audit-template version
  fields.
- Generated projections now render from Markdown templates plus the rule
  catalog: `AI-CONTRIBUTOR-SPECIFICATION.md`,
  `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`,
  `AI-CONTRIBUTOR-COVERAGE.md`, `AI-CONTRIBUTOR-AUDIT.md`, and
  `.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`.
- Checklist rule-table ordering is now mechanical and may differ from earlier
  hand-authored ordering, while visible `AIC-*` IDs and checklist semantics
  remain unchanged.
- The specification clause section now uses a nested heading hierarchy:
  pillars under `###`, clauses under `####`, and scope groups under `#####`.
  Rule IDs and normative text are unchanged.
- Non-normative explanatory clause prose was moved into scope guidance,
  definitions, or the adoption guide so the generated specification clause
  body contains only catalog-owned structure and normative rule bullets.
- Shipped audit templates now carry `spec_version: "0.1.1"` to match the
  current specification release.

This patch release does not change rule semantics or conformance obligations.

## [0.1] — 2026-05-03

Initial public version of the AI Contributor Specification.

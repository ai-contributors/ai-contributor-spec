# Changelog

This file records notable normative changes to the AI Contributor Specification and its companion checklist, guide, and audit-log templates.

**Scope.** Only normative changes appear here: new or modified `MUST` / `SHOULD` / `MAY` clauses, checklist row changes, audit-log or evidence-model changes, and changes to shipped audit/skill behavior that adopters can observe. Tooling, coverage lifts, internal refactors, and CI gate adjustments live in `git log` rather than this file. Squash-merged commits to `main` therefore do not all map one-to-one to CHANGELOG entries.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Specification releases use SemVer bump semantics with compact patch-zero notation:

- A major bump marks a change that breaks existing conformance claims.
- A minor bump adds or tightens normative requirements.
- A patch bump covers corrections that do not change what a conforming repository must do.

For the specification and companion templates, patch-zero releases are written as `MAJOR.MINOR` (`0.1`, `1.2`) rather than `MAJOR.MINOR.0`. Patch releases are explicit only when they exist (`0.1.1`, `1.2.1`). Maintainers should prefer minor releases for meaningful specification changes and reserve patch releases for narrow corrections to an already published minor line.

**Release tag versus tool versions.** A Git release tag such as `v0.1` is the specification release and pins the whole adopter-facing bundle at that commit: specification, guide, checklist template, audit-log template, audit skill, examples, bootstrap, collector, stamper, and validator. The tag version is the spec version. It is not the same thing as `BOOTSTRAP_VERSION`, `collector_version`, or `validator_version`; those are implementation versions stamped into audit artifacts so auditors can identify which runtime produced a result. Mention runtime/tool changes in a release entry only when adopters can observe the behavior. Internal refactors, test-only changes, coverage lifts, and implementation version bumps with no adopter-visible behavior stay in `git log`.

Every released entry lists the release date (the day the version lands on `main`).

## [0.2] — 2026-05-05

### Changed

- Rule metadata authoring now flows through
  `AI-CONTRIBUTOR-RULE-CATALOG.json`, with specification and checklist
  projections checked against the catalog. No rule semantics changed.

## [0.1] — 2026-05-03

Initial public version of the AI Contributor Specification.

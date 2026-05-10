# Contributing

Thanks for considering a contribution. This repository maintains:

- the canonical rule and document metadata catalog:
  [`AI-CONTRIBUTOR-RULE-CATALOG.json`](AI-CONTRIBUTOR-RULE-CATALOG.json)
- the generated normative specification:
  [`AI-CONTRIBUTOR-SPECIFICATION.md`](AI-CONTRIBUTOR-SPECIFICATION.md)
- the generated companion checklist:
  [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md)
- the step-by-step GitHub + TypeScript + web guide: [`AI-CONTRIBUTOR-GUIDE.md`](AI-CONTRIBUTOR-GUIDE.md)
- the repository tooling described in [`TOOLING.md`](TOOLING.md)

Contributions should improve clarity, tighten requirements, close real gaps, reflect new AI-era risks, or extend the guide to additional stacks.

## Pick the right path

The repository is several artifacts in one tree. Different changes go through different gates. Pick the path that matches what you are changing — the rest of this document expands each path.

- **Spec change.** A new clause, a clarified `MUST`, a new conformance level, a renamed pillar. RFC-style discussion in an issue first. Touches `AI-CONTRIBUTOR-SPECIFICATION.md` and the rule catalog. Goes through a tagged spec release.
- **Tooling change.** A new doc check, a fix in the collector, a new evidence row, an update to a skill. Lives in `tools/` and `skills/`. Does not bump the spec rev unless it changes normative behavior.
- **Docs / guide change.** A typo, a clarification, a new walkthrough, a new stack guide. Lives in the root Markdown files and the audit-skill docs. Lightest review path, but still runs the doc-check suite.

## Low-barrier contribution path

For a small editorial improvement to a hand-authored document:

1. Edit only the affected document.
2. Run `npm --prefix tools run check`.
3. Open a focused pull request and explain what became clearer.

For a small editorial improvement to generated output, edit the source template
under `tools/spec-authoring/templates/`, regenerate the projection, then run
the relevant check. For any change that adds, removes, promotes, demotes, or
renames a requirement, follow the full process below. Those changes are
normative. The catalog, generated projections, guide, README, and changelog
must stay aligned.

## Scope

In scope:

- Corrections, clarifications, and tightening of existing clauses.
- New `MUST`, `SHOULD`, or `MAY` items that address a credible, recurring risk in AI-assisted development.
- Better definitions, examples, or cross-references.
- Keeping the catalog, generated projections, checklist, and specification
  synchronized.

Out of scope:

- Vendor-specific guidance (tool names, product SKUs, SaaS configurations).
- Advice that cannot be enforced by automation or review.
- Duplicating existing industry standards instead of referencing them.
- Expanding the document beyond AI-assisted development on working codebases (see "Scope and audience" in `AI-CONTRIBUTOR-SPECIFICATION.md`).

## How to propose a change

1. **Open an issue first** for anything beyond a typo or minor wording fix. Describe the risk or ambiguity and the outcome you want. This avoids duplicate work and lets review start before drafting.
2. **Submit a pull request** referencing the issue. Keep PRs focused — one change of substance per PR.
3. **Update source files, then regenerate projections.** Structured rule facts
   belong in
   [`AI-CONTRIBUTOR-RULE-CATALOG.json`](AI-CONTRIBUTOR-RULE-CATALOG.json).
   Long-form prose and placement belong in the relevant Markdown template under
   `tools/spec-authoring/templates/`. Do not hand-edit generated specification,
   coverage, checklist, root audit summary, or audit-log output to make a
   normative change.
4. **Keep generated artifacts aligned.** If the catalog or a source template
   changes, run the matching generator: `generate:rule-catalog`,
   `generate:specification`, `generate:coverage`, `generate:checklist-assets`,
   or `generate:audit-templates`. The PR should include both the source edit
   and the regenerated projection.
5. **Bump versions for normative changes.** Update `specVersion` in
   `AI-CONTRIBUTOR-RULE-CATALOG.json`; rerun the generators so generated
   `Version` and `spec_version` fields update from the catalog. Update the
   hand-authored **Version** fields in `AI-CONTRIBUTOR-GUIDE.md` and
   `README.md`. Add a matching [`CHANGELOG.md`](CHANGELOG.md) entry with the
   release date and a short summary. Specification versions use the compact
   notation defined in [`CHANGELOG.md`](CHANGELOG.md): patch-zero releases are
   `MAJOR.MINOR`, while real patch releases are `MAJOR.MINOR.PATCH`. Purely
   editorial changes do not need a version bump. Adopter-filled frontmatter
   fields stay empty in this repository, with their inline hint comments
   preserved.

   `specVersion` is the adopter-facing specification release. `schemaVersion`
   is the catalog JSON shape version used by tooling. Patch releases may update
   `specVersion` without changing `schemaVersion` when the specification bundle
   changes but the catalog JSON shape remains compatible.

## Publication metadata

Specification Markdown is source content, not a website manifest. Do not add
frontmatter blocks for titles, slugs, sidebar sections, ordering, or publication
paths to spec documents. The spec revision is the git tag at `HEAD`; consumers
that need to display a version should use `git describe` (or an equivalent
pinned commit/tag lookup) instead of parsing Markdown fields.

Consumer-specific publication metadata belongs in the consumer. For example,
the public docs site owns its sidebar grouping, route paths, labels, and
view-source mapping in its own `docs.config.json`. Adding a new spec document
here only requires committing the Markdown body and any relevant source-template
or catalog changes; each publisher decides whether and where to surface it.

## Local validation

Before opening a pull request, use Node.js 24.x and install the
repository-check tooling:

```sh
npm ci --prefix tools
```

The installed Husky hooks run two local gates:

- `pre-commit` runs staged-file formatting and linting.
- `pre-push` runs `npm --prefix tools run check:ci-local`, which covers the
  locally reproducible PR gates before code leaves the workstation.

To run the pre-push gate directly:

```sh
npm --prefix tools run check:ci-local
```

That command runs the aggregate repository check, the strict audit-runtime
coverage gate, and the TypeScript pnpm scaffold verification. GitHub-hosted
checks such as CodeQL, dependency review, and immutable release-tag creation
still run in CI because they depend on GitHub services.

The aggregate repository check is still available on its own:

```sh
npm --prefix tools run check
```

It typechecks scripts, checks Markdown links and anchors, validates clause
references, stack hints, checklist metadata, pillar tables, and evergreen
wording, and fails if generated projections are stale.

For the architecture behind the script layer and the purpose of each tooling
directory, see [`TOOLING.md`](TOOLING.md).

To refresh generated projections after editing catalog or template sources, run
the relevant generator:

```sh
npm --prefix tools run generate:rule-catalog
npm --prefix tools run generate:specification
npm --prefix tools run generate:coverage
npm --prefix tools run generate:checklist-assets
npm --prefix tools run generate:audit-templates
```

## AI-authored contributions

This repository accepts AI-assisted contributions when they are disclosed, reviewable, and compatible with the license for the path being changed:

- **CC BY 4.0** for documentation and specification content (see [`LICENSE`](LICENSE)).
- **Apache License 2.0** for the reusable starter template under [`examples/typescript-pnpm/template/`](examples/typescript-pnpm/template/) (see [`examples/typescript-pnpm/template/LICENSE`](examples/typescript-pnpm/template/LICENSE)).
- **Apache License 2.0** for repository tooling under [`tools/`](tools/) and shipped audit runtime scripts under [`skills/ai-contributor-audit/scripts/`](skills/ai-contributor-audit/scripts/).

See [License](#license) below.

A pull request is **materially AI-authored** when an AI tool or agent produced substantial text, code, tests, examples, or high-level design. Minor autocomplete, spelling, grammar, or formatting suggestions do not need disclosure.

For materially AI-authored pull requests, complete the **AI Authorship & Agent Trace** block in the PR body using the template at [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md):

- `AI-Authored: yes (<tool/agent>, <model>)` — name the tool/agent and model when known.
- `Prompt-Audit: AGENTS.md@<commit-or-working-tree>; skill:<skills/.../SKILL.md>@<sha-or-local>; transcript:<location-or-none>` — cite the agent instruction sources used. When a change was driven by a skill in this repository, the skill citation MUST include its commit SHA so the prompt is pinned.
- `Subagent-Trace: none` _or_ `<subagent name + brief role>` — list subagents invoked by the primary agent.
- License confirmation — confirm that any AI-generated material may be contributed under the license for the changed path: CC BY 4.0 for docs/spec content; Apache-2.0 for the starter template under `examples/typescript-pnpm/template/`, repository tooling under `tools/`, and audit runtime scripts under `skills/ai-contributor-audit/scripts/`.

Each commit in a materially AI-authored PR MUST also include a `Co-Authored-By:` trailer naming the model/variant.

The trace block is intentionally short. AI-authored scope, validation evidence, and the reviewer name are visible elsewhere in the PR (the diff, the "How validated" section, reviewer assignment + CODEOWNERS) and are not duplicated here.

Pull requests with missing, unclear, or incorrect AI-authorship disclosure are held until the PR body is corrected. For normative policy changes, maintainers may require more validation evidence before review continues.

## Maintainer playbook

This section is for maintainers merging a PR. It answers two questions: *"is this change normative?"* and *"which version bump applies?"*.

### When to bump, and by how much

The versioning policy defined in [`CHANGELOG.md`](CHANGELOG.md) applies to the specification and its companion templates. Specification versions use SemVer bump semantics with compact patch-zero notation: normal spec releases are written as `MAJOR.MINOR` (`0.1`, `1.2`), and patch releases are written with a third component only when a real patch exists (`0.1.1`, `1.2.1`). Prefer minor releases for meaningful specification changes; reserve patch releases for narrow corrections to an already published minor line.

A release tag such as `v0.1` is the specification release and pins the whole adopter-facing bundle at that commit. Tooling versions such as `BOOTSTRAP_VERSION`, `collector_version`, and `validator_version` are separate implementation versions used for audit evidence and debugging; they do not define separate public release lines unless this repository later publishes packages.

| Change | Version bump | Examples |
|---|---|---|
| Typo, formatting, broken link, non-semantic reflow | None | Fix a dead link, convert curly quote to straight quote. |
| Clarify existing wording without changing what a conforming repo must do | Patch (`0.1` → `0.1.1`) when a tagged correction is needed | Add a "for example" to an existing rule; split a long sentence; reword for readability. |
| Add a new `MUST` / `SHOULD` / `MAY`, tighten an existing rule, or add a frontmatter field tooling can opt into | Minor (`0.1` → `0.2`) | New `MUST` row; promote a `SHOULD` to `MUST`; add `assessment_duration`. |
| Remove a rule, loosen a rule, rename or remove a frontmatter field, or change Status vocabulary so old audits no longer parse | Major (`1.2` → `2.0`) — **breaks existing conformance claims** | Drop `MUST when applicable`; rename `assessment_date` → `assessment_started_at` after `1.0`; change `Fulfilled` label. |

If a PR is a mix, such as a typo fix plus a new `MUST`, pick the highest bump it contains. Do not split a PR only to avoid a minor bump.

Before version `1.0`, breaking changes may be released in minor versions. SemVer allows this below `1.0`. From `1.0` onward, breaking changes use a major bump only. Every release MUST be tagged so adopters can pin the audit skill and specification to an immutable version.

### Source files and projections for every normative PR

Keep this list in the PR checklist — drift between source files and generated
projections is the most common maintenance failure.

- [`AI-CONTRIBUTOR-RULE-CATALOG.json`](AI-CONTRIBUTOR-RULE-CATALOG.json) —
  canonical structured facts: specification version, pillars, clauses,
  conformance levels, `AIC-*` IDs, normative text, checklist row metadata,
  coverage projections, and detector linkage.
- [`tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template`](tools/spec-authoring/templates/AI-CONTRIBUTOR-SPECIFICATION.md.template)
  — hand-authored specification prose and placement directives.
- [`tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template`](tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template)
  — hand-authored coverage-map prose and placement directives.
- [`tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template`](tools/spec-authoring/templates/AI-CONTRIBUTOR-CHECKLIST.md.template)
  — checklist instructions, frontmatter comments, template-only auditor blocks,
  and placement directives.
- [`tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT.md.template`](tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT.md.template)
  and
  [`tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT-LOG.md.template`](tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT-LOG.md.template)
  — root audit summary and audit-log prose, frontmatter comments, stamped-block
  markers, and placement directives.
- Generated projections:
  [`AI-CONTRIBUTOR-SPECIFICATION.md`](AI-CONTRIBUTOR-SPECIFICATION.md),
  [`AI-CONTRIBUTOR-COVERAGE.md`](AI-CONTRIBUTOR-COVERAGE.md),
  [`AI-CONTRIBUTOR-AUDIT.md`](AI-CONTRIBUTOR-AUDIT.md),
  [`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`](.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md),
  and
  [`.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`](.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md).
  Regenerate these from catalog and templates; do not hand-edit generated
  content.
- [`AI-CONTRIBUTOR-GUIDE.md`](AI-CONTRIBUTOR-GUIDE.md) — bump the
  hand-authored **Version** field and update any step that references the
  changed clause.
- [`README.md`](README.md) — bump the hand-authored **Version** field when the
  specification version changes.
- [`CHANGELOG.md`](CHANGELOG.md) — add an entry under the next version heading with the release date (ISO `YYYY-MM-DD`) and a short summary of the normative change.
- [`skills/ai-contributor-audit/SKILL.md`](skills/ai-contributor-audit/SKILL.md) — update the runbook if the change affects the audit workflow (new frontmatter field, new Status value, etc.). No `spec_version` to bump here; the skill references the spec repo at runtime.

`spec_version` in generated audit templates comes from catalog `specVersion`.
`spec_source`, `audited_commit`, `auditor`, `runner_agent`, and `runner_model`
are supplied once through `audit-stamp.ts` flags or environment variables and
then stamped into both audit files. `assessment_started_at`,
`assessment_completed_at`, `assessment_duration`, `validator_version`,
`collector_version`, and `conformance_level` are stamped automatically by
`audit-stamp.ts` (timestamps from the collector's evidence JSON and current
stamp run; versions from the running scripts; conformance level from the
just-stamped Conformance level summary table). Keep stamper-owned frontmatter
empty in this repository and preserve the inline hint comments.

`audit-stamp.ts` also owns: collector-derived row `Status` + `Comment` cells in the checklist, the Backlog derived columns (`Priority` / `Level` / `Rule` / `Scope` / `Current status`), the Conformance level summary `Status` cells, the root `AI-CONTRIBUTOR-AUDIT.md` summary, the audit-log evidence rows between `<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->` and `<!-- END:STAMPED-COLLECTOR-ROWS -->`, the verification-gaps rows between `<!-- BEGIN:STAMPED-VERIFICATION-GAPS -->` and `<!-- END:STAMPED-VERIFICATION-GAPS -->`, and cross-file equality for stamper-owned frontmatter fields between the checklist and audit log. `Date reached` is hybrid: the auditor enters it when a level is first claimed as `✅ Yes`, and the stamper preserves it while the level remains reached or clears it when the level drops. Do not hand-edit stamper-owned cells or marker blocks — the next stamp run overwrites them.

The canonical artifact and field ownership table lives in [`AI-CONTRIBUTOR-AUDIT-MODEL.md`](AI-CONTRIBUTOR-AUDIT-MODEL.md#artifact-and-field-ownership). The audit lifecycle runbook lives in [`skills/ai-contributor-audit/references/audit-protocol.md`](skills/ai-contributor-audit/references/audit-protocol.md#audit-lifecycle-and-field-ownership). Agent-run audits can produce valid artifacts, but external conformance claims need human or named accountable-owner acceptance of those artifacts.

### Merge order of operations

1. Review the PR against the rows above and the Drafting conventions below.
2. Confirm the version bump is correct (use the decision table). If the PR author did not bump, ask them to; do not land it yourself unless the change is purely editorial.
3. Confirm `CHANGELOG.md` has a matching entry with today's date.
4. Decide whether the reviewed PR is also the release-trigger PR. If it is,
   squash-merge to `main` with a message of the form
   `spec vX.Y: <short description>` or
   `spec vX.Y.Z: <short description>` for an actual patch release. If the PR
   is only the patch/content PR, merge it with a descriptive non-`spec v...`
   subject and use the empty release-trigger PR flow below. CHANGELOG entries
   cover only normative changes (see [`CHANGELOG.md`](CHANGELOG.md) "Scope"),
   so `git log` is broader than the CHANGELOG, but every CHANGELOG entry maps
   to a reviewed release or release-trigger merge commit.
5. Let the `Tag Spec Release` workflow tag the reviewed release-trigger merge
   commit `vX.Y` or `vX.Y.Z` for an actual patch release. Required for every
   release, including pre-`1.0` releases. The audit skill pins `spec_source` to
   this tag. Do not push release-trigger commits directly to `main`, even if
   the actor can bypass rulesets.

### Release runbook

Use this process for every specification release. Do not commit release work or
release-trigger commits directly on `main`; prepare them on branches and review
them as PRs. A ruleset bypass push does not satisfy the release process, even
when the pushed commit changes no files.

1. Start from current `main`:

   ```sh
   git switch main
   git pull --ff-only
   git switch -c release/vX.Y
   ```

   Use `release/vX.Y.Z` for a real patch release. Use a feature branch name for non-release work, then let the release PR collect the final version and changelog updates.

2. Make the release changes on the branch. Normative releases update the source
   files and projections listed in "Source files and projections for every
   normative PR"; editorial releases skip version and changelog bumps.

3. Run the full local guardrail suite:

   ```sh
   npm --prefix tools run check:ci-local
   ```

4. Push the branch and open a PR. The PR body must include the standard AI
   Authorship & Agent Trace block when applicable. Human CODEOWNER review is
   required for protected paths and normative changes.

5. Squash-merge the reviewed PR into `main`. If this PR is both the release
   content PR and the release trigger, use a squash message of the form
   `spec vX.Y: <short description>` or `spec vX.Y.Z: <short description>`.
   If the PR is only the patch/content PR, use a descriptive non-`spec v...`
   subject so the tag workflow does not run yet.

6. If the release content already landed under a non-release subject, open a
   separate empty release-trigger PR. This PR has no file changes; its purpose
   is to make the human-approved release decision visible before the tag
   workflow runs.

   ```sh
   git switch main
   git pull --ff-only
   git switch -c release/vX.Y-trigger
   git commit --allow-empty \
     -m "spec vX.Y: <short release summary>" \
     -m "Release-trigger commit for vX.Y. Release content landed in #NN at <merge-sha>."
   git push -u origin release/vX.Y-trigger
   ```

   For a patch release, use `vX.Y.Z` in the branch name, commit subject, and
   commit body.

   Use a PR title that exactly starts with the release subject, for example
   `spec vX.Y.Z: <short release summary>`. The PR body should state:

   - the version being released;
   - the content PR number and merge commit SHA;
   - that the PR intentionally has no file changes;
   - that merging it will let `Tag Spec Release` create `vX.Y.Z`.

   Human review is still required. When merging, preserve the
   `spec vX.Y.Z: ...` squash subject because the workflow reads the pushed
   `main` commit subject.

7. Fetch the updated `main` locally and identify the merge commit:

   ```sh
   git switch main
   git pull --ff-only
   git log -1 --oneline
   ```

8. Let the `Tag Spec Release` workflow create the release tag. The workflow runs on pushes to `main`, reads the squash-merge subject, and creates an annotated tag when the subject starts with `spec vX.Y:` or `spec vX.Y.Z:`. It also checks that `CHANGELOG.md` has a matching release heading and refuses to move an existing tag.

   If the workflow is unavailable, create and push the release tag manually on the merge commit. Prefer an annotated tag; use a signed tag when the maintainer has signing configured.

   ```sh
   git tag -a vX.Y -m "AI Contributor Specification vX.Y"
   git push origin vX.Y
   ```

   For a patch release, use `vX.Y.Z`. Do not tag the release branch tip before merge, do not retag an existing release, and do not move a pushed tag. If a release tag is wrong, publish a new patch release instead.

9. Verify the pushed tag resolves on the remote:

   ```sh
   git ls-remote --tags origin vX.Y
   ```

10. After the tag exists, use that tag in adopter-facing audit instructions and `spec_source` examples for released audits. Installed skills may be refreshed with `npx skills update ai-contributor-audit`, but actual audits still materialize the runbook from a pinned release tag or full commit SHA.

The release-tagging workflow preserves the same boundaries as the manual
fallback: all release content lands through a reviewed PR, the release-trigger
commit also lands through a reviewed PR when it is separate from the content
change, CI passes before merge, and the tag points at the protected `main`
merge commit.

### When not to bump

- PR is pure editorial: typo, formatting, link fix, whitespace, comment in a code sample, renaming a variable in the reference template.
- PR updates adopter-filled example content in the example scaffold but does not
  change catalog-owned rule semantics, generated projections, guide, or skill.
- PR updates dependency versions in the reference template's `package.json` without touching any normative clause.

Editorial PRs merge with a single reviewer, skip the version bump, and do not need a CHANGELOG entry.

## Drafting conventions

- Use RFC 2119 normative language: `MUST`, `MUST NOT`, `SHOULD`, `MAY`, `MUST when applicable`. Wrap the keyword in backticks.
- Prefer specific, auditable wording over general principles. "Lockfiles include integrity hashes and CI fails on verification errors" is useful; "dependencies are secure" is not.
- Keep each clause self-contained and short. If a clause needs long justification, consider whether it belongs in the specification at all.
- Use vendor-neutral language. Reference concepts (`CODEOWNERS`-style ownership, OIDC-style federation) rather than specific platforms.
- Avoid restating requirements already covered elsewhere in the document. Cross-reference instead.
- Use UK or US English consistently within a PR (the existing document uses US English).
- **Write evergreen text.** Documents and code comments are read by people who did not see the discussion that produced the change. Do not embed temporary context.

  Banned phrasing includes: `TODO`, `FIXME`, `XXX`, `HACK`, `WIP`; "the recent rename / renumber / reshuffle / move"; "we just moved/renamed/added/fixed/changed/removed X"; "in this repo's history"; "now-fixed", "just fixed", and "after the recent rename".

  State what is true now. Do not narrate what changed last sprint. CI runs `npm --prefix tools run check:evergreen` and fails the PR on banned phrases. To allow one legitimate occurrence, add `evergreen-skip: <reason>` on the same line in a comment (`<!-- evergreen-skip: ... -->`, `# evergreen-skip: ...`, or `// evergreen-skip: ...`). CHANGELOG.md is exempt because it is historical by design.

## Contributing a parallel guide for another stack

[`AI-CONTRIBUTOR-GUIDE.md`](AI-CONTRIBUTOR-GUIDE.md) is GitHub + TypeScript + web. Parallel guides for other stacks are welcome.

Use the same four phases:

1. Before AI touches your repo.
2. Before AI assists shipped changes.
3. Before AI materially authors code or uses governed tooling.
4. Before the full Level 4 audit.

Use the same step shape: Do / Why / How / Verify / Spec reference. In the PR, propose the new guide filename, such as `AI-CONTRIBUTOR-GUIDE-python-uv.md`, and the deep-link targets inside your stack's `examples/` subdirectory.

## Review

- Normative changes require review before merge.
- Editorial changes (typos, formatting, link fixes) can be merged with a single reviewer.
- The document owner (set per adopting repository, tracked in `AI-CONTRIBUTOR-SPECIFICATION.md`) has final call on normative changes to the upstream copy.

## License

By contributing, you agree that your contributions use the license for the part of the repository they modify:

- Documentation and specification content is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (see [`LICENSE`](LICENSE)).
- The reusable starter template under [`examples/typescript-pnpm/template/`](examples/typescript-pnpm/template/) is licensed under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). See [`examples/typescript-pnpm/template/LICENSE`](examples/typescript-pnpm/template/LICENSE).
- Repository tooling and helper scripts under [`tools/`](tools/), plus shipped
  audit runtime scripts under
  [`skills/ai-contributor-audit/scripts/`](skills/ai-contributor-audit/scripts/),
  are licensed under
  [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0); each file
  carries an `SPDX-License-Identifier: Apache-2.0` header.

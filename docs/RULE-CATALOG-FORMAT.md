# Rule Catalog Format

`AI-CONTRIBUTOR-RULE-CATALOG.json` is the machine-readable canon of the
spec — the single source of truth that every other artifact (the prose
specification, the checklist, the coverage map, the collector registry)
is projected from. If you build linters, dashboards, IDE integrations,
badges, or your own auditor, you target this file.

## Why a separate catalog?

The prose specification
([`AI-CONTRIBUTOR-SPECIFICATION.md`](../AI-CONTRIBUTOR-SPECIFICATION.md))
is what humans read. The catalog is what machines read. Every clause,
level, and rule appears in *exactly one* place — the catalog — and four
downstream artifacts are **generated** from it on every release:

| Projection          | Path                                                                | Audience                                   |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------ |
| `specification`     | `AI-CONTRIBUTOR-SPECIFICATION.md`                                   | Humans reading the spec.                   |
| `checklist`         | `.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`                 | Auditors filling out evidence rows.        |
| `coverage`          | `AI-CONTRIBUTOR-COVERAGE.md`                                        | Adopters planning their climb.             |
| `collectorRegistry` | `skills/ai-contributor-audit/scripts/internal/collector-registry.ts` | The audit runtime that fills evidence.     |

If you are building any tool that needs to know "which rules apply at
L2", "what's the human-readable text of `AIC-lockfile-committed`", or
"is this a `MUST` or a `SHOULD`", read the catalog. Never scrape the
Markdown.

## Top-level structure

The root document is a single object with nine required keys.

```jsonc
{
  "$schema":       "./AI-CONTRIBUTOR-RULE-CATALOG.schema.json",
  "schemaVersion": "0.1",
  "specVersion":   "0.1.2",
  "sourceOfTruth": "AI-CONTRIBUTOR-RULE-CATALOG.json",
  "projections":   { /* paths to the four generated artifacts */ },
  "pillars":       [ /* 7 entries */ ],
  "levels":        [ /* L0–L4 + a sentinel "—" Optional level */ ],
  "clauses":       [ /* 29 entries, indexed by number */ ],
  "rules":         [ /* one entry per stable AIC rule ID */ ]
}
```

| Field           | Type                | Notes                                                                                                |
| --------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `$schema`       | const               | Always `"./AI-CONTRIBUTOR-RULE-CATALOG.schema.json"`. Use this to validate.                          |
| `schemaVersion` | const `"0.1"`       | The shape of the file. Bumps independently of `specVersion`. See "Versioning" below.                 |
| `specVersion`   | string              | SemVer of the spec content (e.g. `0.1.1`). What clauses say.                                         |
| `sourceOfTruth` | const               | Self-identifier. Reminds tools the catalog is canonical, not the Markdown.                           |
| `projections`   | object              | Paths to the four generated files. Tools can verify a projection matches the catalog by re-running the generator. |
| `pillars`       | array               | The seven pillar headings, with icons and descriptions.                                              |
| `levels`        | array               | Six entries: `L0`–`L4` plus the sentinel `—` for rules that don't gate any level.                    |
| `clauses`       | array               | 29 entries — each carries `number`, `pillar`, and `title`. Rules reference clauses by `number`. |
| `rules`         | array               | The atoms. One entry per stable `AIC-*` rule ID; checklist row metadata is nested on each rule.       |

## The shape of a rule

Every entry in `rules[]` is a single stable `AIC-*` rule. The nested
`checklist` object says which rendered checklist row the rule contributes
to; several rule entries may share the same checklist row.

```jsonc
{
  "id":     "AIC-lockfile-committed",
  "clause": 1,
  "pillar": 1,
  "scope":  "MUST",
  "level":  "L0",
  "text":   "The dependency lockfile `MUST` be committed to version control.",
  "checklist": {
    "rule":        "Pinned Toolchain",
    "scope":       "MUST",
    "requirement": "Runtime version, package manager version, and lockfile are pinned."
  },
  "detectors": [
    {
      "id":             "manual-review",
      "kind":           "manual",
      "manualEvidence": "Review checklist row \"Pinned Toolchain\" and record current-run evidence."
    }
  ],
  "detectorConfidence": "manual"
}
```

| Field                    | Domain                                                          | Notes                                                                                              |
| ------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                     | `^AIC-[a-z0-9][a-z0-9-]*$`                                      | Stable identifier. Treat as primary key. Within a major schema bump, IDs do not change meaning.    |
| `clause`                 | integer 1–29                                                    | Reference into `clauses[]` by `number`.                                                            |
| `pillar`                 | integer 1–7                                                     | Denormalised from clause for fast filtering.                                                       |
| `scope`                  | `MUST` · `MUST when applicable` · `SHOULD` · `MAY`              | RFC-2119-style obligation. `MUST when applicable` means the row's applicability comes from the Profile. |
| `level`                  | `L0`–`L4` · `—`                                                 | The lowest level at which this rule is evaluated. `—` means optional / never gates.                |
| `text`                   | string                                                          | The normative sentence as it appears in the prose spec.                                            |
| `checklist.rule`         | string                                                          | The human-friendly row name in `AI-CONTRIBUTOR-CHECKLIST.md`; several rule IDs can share a row name. |
| `checklist.requirement`  | string                                                          | The plain-English "what good looks like" that auditors fill evidence against. Together with `checklist.rule` and `checklist.scope`, this identifies the rendered checklist row. |
| `detectors[]`            | array                                                           | How automation can detect compliance. At least one detector is required.                           |
| `detectorConfidence`     | `indicative` · `manual`                                         | `indicative` = automation can suggest a status; `manual` = a human is needed regardless.           |

### Detector kinds

Each detector is one of two shapes (validated by `oneOf` in the schema):

```jsonc
// Detector A — handled by a typed routine in the audit runtime
{
  "id":   "clean-clone-bootstrap",
  "kind": "collector-rule",
  "path": "skills/ai-contributor-audit/scripts/internal/collector-registry.ts"
}

// Detector B — no automation possible; the auditor records evidence
{
  "id":             "manual-review",
  "kind":           "manual",
  "manualEvidence": "Review checklist row \"X\" and record current-run evidence."
}
```

Tooling that wants to mirror what the official audit runtime does should
look up the `collector-rule`'s `id` in the published collector registry.
`manual` detectors are explicitly out-of-band — your tool can surface the
`manualEvidence` string as a prompt.

## Versioning: `schemaVersion` vs `specVersion`

Two version fields, two stability promises. Don't conflate them.

- **`schemaVersion`** — the JSON shape. Bumps when the structure of the
  catalog changes: fields added or removed, enum values changed,
  validation rules tightened. Tools *parse* against this. A
  `schemaVersion` bump means "your reader probably needs an update".
- **`specVersion`** — the content. Bumps when clauses, levels, or rules
  change *meaning*. Tools *display* this. A `specVersion` bump means
  "the rules your dashboard shows have changed" — the parser still
  works.

## The stability promise

The catalog is stable within a minor release. Concretely:

| Change kind                                        | Within minor (e.g. `0.1.x`) | Minor bump (`0.2`)        | Major bump (`1.0`) |
| -------------------------------------------------- | :-------------------------: | :-----------------------: | :----------------: |
| Add a new rule                                     | no                          | yes                       | yes                |
| Remove a rule                                      | no                          | deprecate first           | yes                |
| Rename a rule `id`                                 | no                          | no                        | yes                |
| Tighten `scope` (`SHOULD` → `MUST`)                | no                          | yes                       | yes                |
| Loosen `scope` (`MUST` → `SHOULD`)                 | no                          | yes                       | yes                |
| Move a rule's `level`                              | no                          | yes                       | yes                |
| Edit a rule's `text` (typos / clarification)       | yes                         | yes                       | yes                |
| Add a new detector to an existing rule             | yes                         | yes                       | yes                |
| Add a new optional schema field                    | no                          | yes                       | yes                |
| Change `schemaVersion`                             | no                          | only on shape change      | yes                |

Bottom line: a tool pinned to a spec rev **and** a schema version is
stable for the lifetime of that minor release. New rules and
reclassifications wait for the next minor.

## Consuming the catalog

Three patterns we see in the wild.

### Pin and fetch

For dashboards, badges, and IDE integrations:

```sh
# Pin a tag, never main
SPEC_REV=v0.1.2
URL="https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec/$SPEC_REV/AI-CONTRIBUTOR-RULE-CATALOG.json"

curl -sSL "$URL" -o catalog.json
jq -e '.schemaVersion == "0.1"' catalog.json   # defensive check
jq -e '.specVersion  == "0.1.2"' catalog.json
```

### Vendor and validate

For tools that need to ship offline:

```sh
# Drop both files in your repo and validate at build time
ajv validate \
  -s ./AI-CONTRIBUTOR-RULE-CATALOG.schema.json \
  -d ./AI-CONTRIBUTOR-RULE-CATALOG.json
```

### Filter for a level

The most common query — "what rules apply at L2?":

```sh
# All rules evaluated at L2 (cumulative: L0 + L1 + L2)
jq '[.rules[] | select(.level | IN("L0","L1","L2"))] | length' catalog.json

# Just the MUSTs at L2
jq '[.rules[]
     | select(.level | IN("L0","L1","L2"))
     | select(.scope == "MUST")
     | {id, clause, text}]' catalog.json
```

## What you can build

- **An IDE inline-hint** that surfaces the matching rule when a developer
  opens a file the audit flagged.
- **A Slack bot** that posts the diff between two specVersions when the
  project bumps.
- **A second-source auditor** in a different language — the schema is
  enough to round-trip the data model.
- **A "goals" dashboard** showing how many rules a repo has closed,
  week-over-week.
- **A vendor-neutral badge service** that validates a stamped audit.md
  against the catalog at the right rev.

If you build something with the catalog, open a PR adding it to
[`CONTRIBUTING.md`](../CONTRIBUTING.md)'s "Tools using the catalog"
section.

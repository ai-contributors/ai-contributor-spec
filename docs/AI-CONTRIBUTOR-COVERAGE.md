# AI Contributor Specification — Coverage map

> **Version:** 0.1.3 · **Source catalog:** [`AI-CONTRIBUTOR-RULE-CATALOG.json`](../AI-CONTRIBUTOR-RULE-CATALOG.json)

**Non-normative.** This file shows how [`AI-CONTRIBUTOR-CHECKLIST.md`](../.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md) is distributed across pillars, scopes (`MUST` / `MUST when applicable` / `SHOULD` / `MAY`), and minimum levels. Use it to estimate audit effort. Use the checklist itself for scoring.

This generated projection is rendered from `tools/spec-authoring/templates/AI-CONTRIBUTOR-COVERAGE.md.template` plus `AI-CONTRIBUTOR-RULE-CATALOG.json`. The template owns explanatory prose and placement; the catalog owns row grouping, scope, level, pillar, and display metadata. Regenerate it with `tools/spec-authoring/generate-coverage.ts`; do not edit the generated output by hand.

## How to read the numbers

Use this file for planning, not for scoring. It tells you how many checklist rows exist at each level and pillar so you can estimate effort before an audit.

For a conformance claim, use [`AI-CONTRIBUTOR-CHECKLIST.md`](../.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md). If this file and the checklist disagree, rerun the catalog-backed generators; both files are projections of `AI-CONTRIBUTOR-RULE-CATALOG.json`.

## At a glance

- **207** total rows
- **34** unconditional `MUST` + **57** `MUST when applicable` + **76** `SHOULD` + **40** `MAY`
- **6** rows at L0 — Baseline Hygiene; **40** rows at L1 — Hardened; **28** rows at L2 — AI Assisted; **14** rows at L3 — AI Authored; **79** rows at L4 — AI Autonomous
- **40** optional `MAY` rows

## By scope

| Scope | Rows |
|---|---:|
| `MUST` | 34 |
| `MUST when applicable` | 57 |
| `SHOULD` | 76 |
| `MAY` | 40 |
| **Total** | **207** |

## By pillar

| Pillar | Total | `MUST` | `MwA` | `SHOULD` | `MAY` |
|---|---:|---:|---:|---:|---:|
| 1 · 🏗️ Engineering Foundation | 26 | 11 | 1 | 10 | 4 |
| 2 · 🛡️ Security | 34 | 5 | 9 | 12 | 8 |
| 3 · 🎯 Quality & Reliability | 29 | 3 | 6 | 14 | 6 |
| 4 · 🚀 Release | 13 | 2 | 3 | 5 | 3 |
| 5 · 🤖 AI Agents | 39 | 3 | 13 | 14 | 9 |
| 6 · ⚠️ AI Risk | 26 | 2 | 14 | 7 | 3 |
| 7 · 🧭 Oversight | 40 | 8 | 11 | 14 | 7 |

## By minimum conformance level

| Level | Rows | `MUST` | `MwA` | `SHOULD` |
|---|---:|---:|---:|---:|
| L0 — Baseline Hygiene | 6 | 5 | 1 | 0 |
| L1 — Hardened | 40 | 22 | 18 | 0 |
| L2 — AI Assisted | 28 | 7 | 21 | 0 |
| L3 — AI Authored | 14 | 0 | 14 | 0 |
| L4 — AI Autonomous | 79 | 0 | 3 | 76 |
| — (`MAY` — never required) | 40 | — | — | — |

## Cumulative closure bar

This table shows how many `MUST` and `MUST when applicable` rows a repository must close, or mark `Not relevant` with evidence, to claim each level. The "worst case" column assumes every `MUST when applicable` trigger applies. Many repositories will trigger fewer rows.

| Claiming level | Cumulative `MUST` + `MwA` (worst case) | New rows over previous level |
|---|---:|---:|
| L0 | 6 | — |
| L1 | 46 | +40 |
| L2 | 74 | +28 |
| L3 | 88 | +14 |
| L4 | 91 (plus 76 `SHOULD` rows resolved) | +3 `MUST`/`MwA`, +76 `SHOULD` |

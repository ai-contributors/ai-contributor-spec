# Authoring Docs Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update contributor-facing authoring guidance so maintainers edit the catalog and templates instead of generated Markdown projections.

**Architecture:** Keep this branch documentation-only. `CONTRIBUTING.md` owns the human maintainer workflow; `AGENTS.md`, `TOOLING.md`, and `AI-CONTRIBUTOR-AUDIT-MODEL.md` already define the generated-artifact architecture and should only receive stale wording fixes.

**Tech Stack:** Markdown docs, existing repository checks under `tools/`.

---

## Task 1: Align Contributor Authoring Workflow

**Files:**
- Modify: `CONTRIBUTING.md`
- Modify: `AGENTS.md`
- Create: `docs/superpowers/plans/2026-05-05-authoring-docs-cleanup.md`

- [x] **Step 1: Scan current authoring docs**

Run:

```sh
rg -n "edit|update|bump|hand|manual|regenerate|generator|generated|source of truth|AI-CONTRIBUTOR-SPECIFICATION|AI-CONTRIBUTOR-CHECKLIST|AI-CONTRIBUTOR-AUDIT\\.md|AI-CONTRIBUTOR-AUDIT-LOG|AI-CONTRIBUTOR-RULE-CATALOG|template" README.md AI-CONTRIBUTOR-GUIDE.md AI-CONTRIBUTOR-AUDIT-MODEL.md TOOLING.md AGENTS.md CONTRIBUTING.md
```

Expected: stale manual-update wording is concentrated in `CONTRIBUTING.md`; generated-artifact docs are already current elsewhere except for narrow wording cleanup.

- [x] **Step 2: Update normative authoring instructions**

Replace direct-edit guidance in `CONTRIBUTING.md` with the current source split:

- structured facts and normative rules belong in `AI-CONTRIBUTOR-RULE-CATALOG.json`;
- prose and placement belong in `tools/spec-authoring/templates/*.template`;
- generated projections are refreshed with `generate:rule-catalog`, `generate:specification`, `generate:coverage`, `generate:checklist-assets`, and `generate:audit-templates`;
- `AI-CONTRIBUTOR-GUIDE.md`, `README.md`, `CHANGELOG.md`, and runbook docs remain hand-authored companion docs.

- [x] **Step 3: Remove one-off generated-output wording**

Update `AGENTS.md` so the forbidden action covers all generated projections, not only `AI-CONTRIBUTOR-COVERAGE.md`.

- [x] **Step 4: Verify docs**

Run:

```sh
npm --prefix tools run check:markdown
npm --prefix tools run check:links
npm --prefix tools run check:evergreen
npm --prefix tools run check:tooling-command-coverage
```

Expected: all commands exit 0.

- [x] **Step 5: Commit**

Run:

```sh
git add CONTRIBUTING.md AGENTS.md docs/superpowers/plans/2026-05-05-authoring-docs-cleanup.md
git commit -m "docs: clarify catalog authoring workflow" -m "Co-Authored-By: OpenAI Codex (GPT-5) <noreply@openai.com>"
```

Expected: one local commit on `issue-4-authoring-docs-cleanup`; no push.

# Glossary

Terms used across the spec, the audit pipeline, the rule catalog, and the conformance ladder — defined once so the rest of the docs can be terse. Words like _profile_, _stamp_, and _evidence_ have specific load-bearing meanings here; this page is the index.

## A · Spec structure

**Specification** (`AI-CONTRIBUTOR-SPECIFICATION.md`). The single normative document. 29 clauses across 7 pillars, with a 5-rung conformance ladder. Within a major version, a clause id (e.g. `P03.C2`) is stable. See [`AI-CONTRIBUTOR-SPECIFICATION.md`](../AI-CONTRIBUTOR-SPECIFICATION.md).

**Pillar** (P01 … P07). A named group of clauses sharing a concern: _Engineering Foundation_, _Security_, _Quality & Reliability_, _Release_, _AI Agents_, _AI Risk_, _Oversight_. Pillars are organisational, not normative — the clauses are.

**Clause** (`P<pillar>.C<n>`). A single normative statement: an obligation, prohibition, or recommendation. Each clause has a stable id, a strength (`MUST` / `MUST when applicable` / `SHOULD` / `MAY`), an applicability scope, and an evidence path. Clause ids are pinned within a major version.

**Conformance level** (L0 … L4). A cumulative tier on the autonomy ladder: **L0** baseline hygiene, **L1** hardened, **L2** AI-assisted, **L3** AI-authored, **L4** AI-autonomous. L_n_ includes every requirement of L_n−1_. Pick the level that matches what AI is actually doing in the repo today, not the aspiration.

**`MUST` / `MUST when applicable` / `SHOULD` / `MAY`.** RFC 2119 keywords. **`MUST`** is unconditional. **`MUST when applicable`** is unconditional inside a stated scope (e.g. "MUST when the project ships a UI"). **`SHOULD`** is recommended; deviating needs a documented reason. **`MAY`** is permitted; the audit doesn't penalise its absence.

**Applicability scope.** The condition under which a `MUST when applicable` clause applies — usually answered by a _Profile_ question. Examples: _processes regulated data_, _publishes artifacts_, _allows AI to merge_. Out-of-scope clauses are marked _Not relevant_ in the audit, never _Fail_.

**Domain overlay.** An additional set of obligations layered on top of the base spec when the project handles regulated data — HIPAA, PCI-DSS, FedRAMP, GDPR, COPPA. Activated by Profile answers, not selected manually.

**Spec rev.** The version of the spec a given audit was stamped against (SemVer at the doc level). Patch (typo / clarification), minor (added or refined clauses), major (clause renumbering or breaking semantics). Audits remain valid against the rev they were stamped against, even after newer revs ship.

## B · Audit pipeline

**Audit.** The five-phase loop that turns a repo state into stamped audit artifacts: **profile → collect → stamp → judge → validate**. Producible by three skills, by the no-install prompt, or by hand. Output is a root summary plus the detailed checklist, audit log, evidence JSON, and optional owner profile under `.ai-contributor-audit/`.

**Profile** (`.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-PROFILE.md`). The owner-confirmed applicability table. Answers the canonical questions (UI? regulated data? autonomous AI?) so the collector can mark out-of-scope rows _Not relevant_. Skipping the profile is the largest source of avoidable `Warning` rows.

**Collect.** Phase 2. Walks the worktree and gathers evidence per clause — file paths, hashes, command outputs, parsed configs, hosted settings when available, and profile answers. Produces `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`. Read-only on the repo.

**Preflight** (audit-collect setup rows). Setup activity that runs _before_ evidence collection proper — bootstrapping the collector from `spec_source`, recording original worktree status, disclosing tokens. Preflight rows in the audit log carry `<preflight>` in the _Rules_ column and may leave _Spec IDs_ blank. Distinguishing preflight from evidence keeps the rule-citation contract clean.

**Evidence** (`.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`). A structured machine-readable record of what the collector saw: rules, commands, input paths, profile answers, hosted settings, raw signals, and verification gaps. The stamper reads this to fill mechanical rows; auditors read it before judging rows automation cannot decide.

**Stamp.** Phase 3. Runs `audit-stamp.ts` to write derivable audit metadata and projections: synchronized checklist/audit-log frontmatter, collector-derived checklist rows, stamped audit-log rows, verification-gap blocks, conformance summary, backlog, and the root summary. Non-empty stamped blocks carry checksums so hand edits are detectable.

**Judge.** Phase 4. Maps evidence to a per-clause status: _Fulfilled_, _Warning_, _Fail_, _Not relevant_, _Verification gap_. Deterministic — same evidence + same rule catalog produces the same verdicts.

**Validate.** Phase 5. Cross-checks the stamped report against the rule catalog and the audit log. Catches bypassed phases, hand-edited stamps, profile drift, and out-of-spec status values. Exits non-zero if anything is off.

**Audit report** (`AI-CONTRIBUTOR-AUDIT.md`). The root-level summary projection of the current checklist conformance summary and backlog. It is for readers who do not need the full evidence trail; detailed row status lives in the checklist and audit log.

**Audit log** (`.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md`). An append-only record of audit runs — who, when, what spec rev, which phases, which commands, and which manual judgments. Lets you see the trajectory of the repo's level over time.

**Checklist** (`.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md`). The detailed conformance and scoring surface. Collector-derived cells are stamped from evidence JSON; judgment-required rows are filled by the auditor and then validated against the audit log.

## C · Row statuses

**Fulfilled.** The evidence shows the clause is satisfied. The clause won't block the target level.

**Warning.** The evidence is ambiguous or partial. The audit can't conclude either way without owner input or extra signals. Most first-time audits open with a stack of these — the Profile is the main fix.

**Fail** (also: 🚨 Alarm). The evidence shows the clause is not satisfied at the target level. Blocks conformance. Resolve by either changing the repo or, where applicable, lowering the target level. The audit toolchain renders this status as **Alarm** with the 🚨 emoji in the checklist; _Fail_ is the colloquial name in the docs and the JSON catalog. Both names refer to the same status.

**Alarm** (🚨 — checklist status). The checklist's spelling of _Fail_. Requires a specific negative finding (e.g. `.env` tracked in git, default branch unprotected, dependency audit reports critical CVEs) — not absence of evidence. Sorted to the top of the backlog: `MUST`-at-Alarm is priority tier 1.

**Not relevant.** The clause's applicability scope evaluates to false for this repo (e.g. accessibility clauses on a no-UI library). Doesn't block the level. Only assigned when the checklist row explicitly permits it — never as a silent waiver.

**Verification gap.** The evidence is missing in a way the collector can't repair from the worktree alone — usually because a tool wasn't installed, a network resource wasn't reachable, or an owner-only fact wasn't supplied. Treated like a soft _Warning_.

**Evidence row.** A rule-level entry in `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json` describing what the collector saw: rule id, input paths, raw command output, derived status, and reason such as `collector`, `judgment-required`, or `no collector coverage`. Read by the stamper, never edited by hand.

**Judgment row** (judgment-required). A checklist row whose status the collector cannot decide mechanically — it needs auditor reasoning over the evidence (e.g. "is this remediation note adequate?"). After the initial stamp, the auditor fills the Status/Comment, then re-runs stamp + validate. The stamper's `needs-status:` stderr advisory enumerates these in one batch.

## D · Tooling & artifacts

**Skill** (`skills/ai-contributor-audit*`). A self-contained set of instructions plus scripts that an AI tool can load to run a phase of the audit. Three are shipped: `ai-contributor-audit-profile` (Profile), `ai-contributor-audit` (collect → stamp → judge → validate), `ai-contributor-audit-fix` (remediate flagged rows).

**Collector** (`audit-collect.ts`, `COLLECTOR_VERSION`). The script that performs the _collect_ phase. Extracts `audited_commit` into a temporary `git worktree`, runs the canonical evidence commands there, and writes `AI-CONTRIBUTOR-EVIDENCE.json`. Its baked-in `COLLECTOR_VERSION` is stamped into both the checklist and audit-log frontmatter.

**Stamper** (`audit-stamp.ts`). The script that performs the _stamp_ phase. Rewrites mechanical frontmatter (`spec_source`, `audited_commit`, timestamps), automated checklist _Status_/_Comment_ cells, the conformance-level summary, the backlog, the verification-gap stamped rows, and the root `AI-CONTRIBUTOR-AUDIT.md` projection — all from the evidence JSON. It owns specific stamped blocks; hand-edits inside them fail validation by checksum.

**Validator** (`audit-validate.ts`, `VALIDATOR_VERSION`). The script that performs the _validate_ phase. Read-only structural cross-check: every checklist `command` citation must match an audit-log _Command_ cell, every stamped block's checksum must hold, every _Spec IDs_ entry must reference a real `AIC-*` ID, frontmatter must be in sync between the two files. Exit 0 means mechanically consistent; exit 1 prints every defect with a stable `AUDITxxx` code.

**Fix loop** (`ai-contributor-audit-fix`). The remediation skill. Reads the stamped backlog, confirms the batch of rows blocking the target conformance level with the user (fix-next-level mode; naming a rule scopes it to that one row — fix-one mode), applies a minimal change per row in priority order, then re-runs collect → stamp → validate once at the end to confirm the blockers cleared. The loop never edits stamped blocks directly — it edits source files and lets the stamper rewrite the projection.

**No-install prompt.** A single self-contained prompt you paste into any tool-using agent. Produces the same artifacts as the skills, with no `npx`, no clone, no toolchain. Slower and slightly less precise than the skill flow, but works anywhere. See [`AI-CONTRIBUTOR-AUDIT-PROMPT.md`](../AI-CONTRIBUTOR-AUDIT-PROMPT.md).

**Rule catalog** (`AI-CONTRIBUTOR-RULE-CATALOG.json`). The machine-readable canon. Each rule entry represents one stable `AIC-*` rule ID and carries the checklist metadata used to render and score audit rows; multiple rule IDs can contribute to the same checklist row. Generated projections consume this file — never scrape generated Markdown. Tool authors pin a rev and integrate against this.

**Coverage map** (`AI-CONTRIBUTOR-COVERAGE.md`). A grid of clauses × audit phases showing which clauses the collector evaluates mechanically, which need owner attestation, and which are out of audit scope. The map is regenerated, not authored.

**Stamp** (verb · the act of). As a verb: to run `audit-stamp.ts`, which rewrites every mechanical cell, frontmatter field, conformance summary line, backlog row, and root `AI-CONTRIBUTOR-AUDIT.md` projection from the evidence JSON. As a noun, stamped content means the mechanical frontmatter fields, status/comment cells, and checksum-protected blocks written by the stamper. Reproducibility is pinned by `spec_source`, `audited_commit`, tool versions, timestamps, and `.ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json`.

**`spec_source`** (frontmatter · audit log). The pinned URL of the specification revision the audit was run against — either a release tag (`.../tree/v0.1.2`) or a full commit SHA (`.../tree/<sha>`). Set once at the start of an audit; every fetch of templates, validators, and rule catalog uses this exact ref. Mixing refs inside one audit is forbidden.

**`audited_commit`** (frontmatter · audit log). The full commit SHA of the target repository the audit was stamped against. The collector extracts this commit into a temporary `git worktree` and runs every evidence command there — so the audit is reproducible at the same SHA forever, regardless of subsequent worktree state.

**`runner_agent`** (`--runner-agent` flag). The name of the AI agent that drove this audit run (e.g. `claude-code`, `cursor`, `copilot-cli`). Recorded in the audit log so a reader of the stamped artifact can see _which_ agent's interpretation produced the judgment-row verdicts.

**`runner_model`** (`--runner-model` flag). The model id behind the runner agent (e.g. `claude-sonnet-4.5`, `gpt-4.1`). Pairs with `runner_agent` in the audit-log frontmatter so a future re-audit can compare verdicts across models or detect a model swap mid-stream.

**Doc-check suite.** The set of TypeScript scripts under `tools/doc-checks/` that gate every PR — link integrity, clause refs, version coherence, evergreen text, stamped-block freshness, and so on. Run via `npm --prefix tools run check`.

**Golden audit.** A synthetic repo plus expected outputs at `examples/golden-audit/`. Locks audit behaviour against regressions: every spec or tooling change must keep the golden run reproducing byte-for-byte.

## E · Repo governance

**Accountable owner.** The named human (or rotating role) who owns the repo's audit answers and is reachable when the audit raises a question. Not necessarily the most active contributor — the one whose attestation the audit treats as authoritative.

**`AGENTS.md`** (a.k.a. authoritative AI instruction file). The single file in the repo that tells AI agents how to behave: scope, capabilities, allowlists, formatting rules, escalation paths. Other tool-specific files (`CLAUDE.md`, `.cursorrules`, `GEMINI.md`) should be short pointers to this one — see _Single AI Source_.

**Single AI Source.** The principle that AI instructions live in exactly one authoritative file. Competing non-trivial instruction files in the same repo are a foot-gun the spec flags (`AIC-tool-specific-pointer-only`) — agents pick whichever they were configured for and behave inconsistently.

**Capability scoping.** Restricting what an AI agent can do — file paths, network endpoints, shell commands, tools — to the minimum needed for its task. Spec requires explicit scoping at L2 and tightens at higher levels.

**Allowlist.** An explicit, enumerated list of what an AI agent is permitted to do (commands it can run, hosts it can fetch, dependencies it can add). Default-deny. The opposite is a denylist; the spec prefers allowlists.

**Cost ceiling.** A hard upper bound on tokens, requests, or wall-clock time an AI agent may consume per task or per day. Required at L3+ to bound autonomous-loop blast radius.

**Untrusted input.** Any text an AI agent reads that originated outside the codebase or trusted contributors — PR descriptions, issue bodies, customer messages, fetched web pages. Treated as adversarial; the AI Risk pillar specifies how it must be handled.

**Prompt injection.** An attack where untrusted input contains instructions intended to override the AI agent's actual instructions. Mitigations include capability scoping, content sandboxing in prompts, and human approval on side-effects.

**DCO** (Developer Certificate of Origin). A lightweight contributor sign-off some projects require via `Signed-off-by:` trailers. This repo's required AI-authorship metadata is the `Co-Authored-By:` trailer plus the PR trace block; DCO-style sign-off is not required for every commit here.

**RFC** (request for comments). A numbered Markdown proposal in `rfcs/` describing a non-trivial spec change before it lands. Spec PRs that bypass the RFC step are usually asked to start one.

**Attribution.** Recording, in the commit or PR, that AI participated in a change and how (suggested, drafted, authored, merged). Required from L2; the form is repo-defined but the presence is mandatory.

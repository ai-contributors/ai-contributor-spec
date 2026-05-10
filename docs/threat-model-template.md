# Threat model template

A starter `docs/threat-model.md` for repos approaching L3 / L4. The spec calls a threat model out as optional but recommended — this page gives you a structure to copy and fill in, plus the rows on the checklist that point at it.

> [!NOTE]
> **Why this exists.** At L1 / L2 the controls speak for themselves: secret scanning, branch protection, signed commits, lint gates. At L3 — where AI authors PRs and humans review — and L4 — where AI can merge or release — you need a written model of _which actor can do what, against which assets, and how you'd notice_. The threat model is the document that connects the dots so reviewers and incident responders share a mental model. The spec leaves it optional because tiny repos genuinely don't need one; everything above a single repo with one maintainer probably does.

## §1 — When you need this {#when-you-need-this}

- **Required-ish at L3+.** The L3 SHOULD list and L4 MUST list both reference threat-model evidence in several rows (capability scoping, prompt-injection resistance, AI incident response). You can defer with a documented reason, but a written model is the most defensible evidence.
- **Required for any domain overlay.** HIPAA, PCI-DSS, FedRAMP, GDPR, COPPA — every overlay assumes a threat model exists. The overlays add specific threats; they don't replace the base document.
- **Useful at L2 if you have any AI authorship.** Even when not normatively required, having a one-page model of "what an agent could do badly" makes Single AI Source, MCP scoping, and authorship rows easier to reason about.

## §2 — The template {#the-template}

Copy this into `docs/threat-model.md`. Replace the bracketed placeholders. Keep the section headings — the audit rule catalog references them by name.

````markdown
# Threat model — <repo name>

> Spec rev: v0.1 · Last reviewed: YYYY-MM-DD · Reviewer: <name> / <role>

## 1. System under model

One paragraph. What does this repo produce? Who consumes it?
What's the deployment surface (hosted service, library on npm, internal tool)?
What's explicitly out of scope (e.g. a sibling repo, a vendor SaaS)?

## 2. Assets

Bulleted list of things worth protecting. For each, name the impact of
loss / leak / corruption.

- Source code & build pipeline — supply-chain integrity
- Secrets & tokens — <list classes; e.g. deploy keys, third-party API keys>
- Production data — <PII? regulated? synthetic-only?>
- AI session transcripts & prompts — <retained where, redacted how>
- Customer-facing endpoints — <auth boundary, rate-limit posture>

## 3. Actors

| Actor                      | Trust   | Can read           | Can write              | Can merge / release |
| -------------------------- | ------- | ------------------ | ---------------------- | ------------------- |
| Maintainer                 | high    | repo + secrets     | any branch             | yes (with review)   |
| External contributor       | low     | public source only | fork PR only           | no                  |
| AI agent (assisted, L2)    | medium  | repo source        | PR via human request   | no                  |
| AI agent (authoring, L3)   | medium  | repo source        | PR on its own branch   | no                  |
| AI agent (autonomous, L4)  | scoped  | repo + scoped APIs | scoped paths only      | yes (scoped)        |
| MCP server <name>          | scoped  | <tool surface>     | <tool surface>         | n/a                 |

Replace rows that don't apply. Add rows for any other agent or service.

## 4. Threats

For each threat: name it, name the asset it targets, name the actor most
likely to trigger it, and name the control that catches or mitigates it.
Use STRIDE or LINDDUN if your team already knows them; otherwise free-form
is fine — being concrete matters more than being formal.

- **T-1 Prompt injection via untrusted input.** Attacker plants instructions
  in a fetched URL / issue comment / dependency README. Agent acts on them.
  *Mitigation:* <capability scoping, allowlist for tool calls, no shell
  execution from agent context, ...>
- **T-2 Secret exfiltration via agent action.** Agent reads a secret from
  the environment and writes it into a PR description, log, or external
  call. *Mitigation:* <redaction layer, secret scanning on PR, env scoping>
- **T-3 Supply-chain compromise via agent-merged PR.** Agent merges a PR
  whose dependency change adds malicious transitive code.
  *Mitigation:* <dependency review action, lockfile audit, branch protection>
- **T-4 Cost runaway from autonomous loop.** Agent retries a failing tool
  call indefinitely or fans out unbounded requests to a paid API.
  *Mitigation:* <cost ceiling, retry budget, alarm at <threshold>>
- **T-5 Misattribution of authorship.** AI-authored change is committed
  without provenance, masking who (or what) wrote it.
  *Mitigation:* <commit trailer / sig, AGENTS.md entry, audit record>

Add domain-specific rows below for HIPAA / PCI / GDPR / COPPA / FedRAMP
overlays where applicable.

## 5. Trust boundaries

A short list — one bullet per crossing point. For each, name what data
crosses, in which direction, and what validates the cross.

- <User browser> → <API>: TLS + auth header; payload validated against
  schema X.
- <CI runner> → <npm registry>: lockfile-pinned; no post-install scripts.
- <Agent context> → <MCP tool>: capability allowlist in
  `.mcp/<name>.json`; rooted at <path>.

## 6. Detection & response

Where would you notice each threat firing?

- Code path:           <CI step / lint rule / test that fails>
- Operational signal:  <dashboard / alert / log query>
- Audit signal:        <rule X in `AI-CONTRIBUTOR-CHECKLIST.md`>

Incident process: see `SECURITY.md` for the report-and-response timeline.

## 7. Out of scope (deliberate)

Things you considered and chose not to model. Naming them prevents
"why didn't you cover X" later.

- <e.g. nation-state attacker on the maintainer's laptop — out of scope
  for this repo's posture>

## 8. Review cadence

This document is reviewed:

- on every level promotion (L2 → L3, L3 → L4),
- after any AI incident,
- otherwise annually on <month>.

Last reviewed: YYYY-MM-DD by <name> / <role>.
````

## §3 — Field-by-field guidance {#field-by-field-guidance}

| Field | Guidance |
| ----- | -------- |
| **System under model** | Keep it to a paragraph. The audit doesn't grade prose; it just needs to know what's in scope. Naming the deployment surface explicitly is what matters — "library on npm" and "hosted SaaS" have very different threat profiles. |
| **Assets** | Bullet form is fine. Be concrete about regulated data — "production data" is too coarse; "production data including patient identifiers" is what HIPAA reviewers want to see. If you have _no_ regulated data, say so explicitly. |
| **Actors** | The matrix is the highest-leverage section. The spec's MCP scoping, capability allowlist, and Single AI Source rules all assume there's a clear answer to "what can the agent actually do". The matrix is that answer. |
| **Threats** | Aim for 5–10 named threats. More than 15 is usually performative and gets stale quickly. Each threat names an asset, an actor, and a mitigation — three concrete cells, not a paragraph of hedging. |
| **Trust boundaries** | List the crossings; don't try to draw a diagram. Diagrams date instantly and don't survive being copy-pasted across repos. A bulleted list of "what crosses, which way, and what validates" is what reviewers actually use. |
| **Detection & response** | Connect each threat to something you can grep, query, or check. If a threat has no detection signal, it's a backlog item — note it and add an issue. The audit's _Failure handling_ and _Observability_ rows look here for evidence at L3+. |
| **Out of scope** | A small section, but it punches above its weight. Naming what you didn't model prevents future debates about whether something was overlooked vs. deliberately deprioritized. |
| **Review cadence** | A threat model with no review date drifts within months. The spec's audit re-runs naturally re-surface this — but writing the cadence into the document itself anchors the discipline. |

## §4 — Domain overlays {#domain-overlays}

If your repo handles regulated data, the spec's domain overlays add specific threats and controls. The overlays don't replace this template — they extend §4 (Threats) and §5 (Trust boundaries):

- **HIPAA / HITECH** — add threats around PHI exposure in agent transcripts, audit-trail completeness, and minimum-necessary access for AI agents acting on patient data.
- **PCI-DSS** — add threats around cardholder-data exposure, scope creep into the CDE, and agent access to systems within scope.
- **FedRAMP** — add threats around control inheritance, boundary changes triggered by AI agents, and continuous monitoring evidence.
- **GDPR** — add threats around personal-data minimization, lawful-basis for AI processing, retention of prompt logs, and DSAR completeness when transcripts are involved.
- **COPPA** — add threats around verifying parental consent paths and what an agent must _not_ infer or store about minors.

> [!IMPORTANT]
> **Lowest-priority deliverable.** The spec leaves this optional and the audit rule catalog accepts a documented deferral as evidence at L3 SHOULD. If you're at L1 or L2, this template is informational — fill it when you start the climb to L3, not before. Time spent on a threat model for a single-maintainer L0 repo is time not spent on the controls that actually move the audit needle.

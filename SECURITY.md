# Security Policy

If you have found a security issue in this repository — a checklist tool
that exfiltrates repository contents, a runbook script that executes
untrusted input, a bootstrap path that fetches code from an unintended
source — please report it privately rather than opening a public issue.

## Report a vulnerability

The **preferred channel** is a private GitHub security advisory.
Maintainers receive these directly and they stay private until coordinated
disclosure. Public issues for security findings are reflowed to advisories
anyway, so going straight to the advisory form saves a round-trip.

- [Open a private advisory](https://github.com/ai-contributors/ai-contributor-spec/security/advisories/new)

### What to include

A reproduction package, three lines:

- **Affected file(s).** Path, plus a commit SHA or release tag so the
  maintainer can pin the report to an exact tree.
- **Minimal reproduction.** A short trace, command sequence, or test case
  that triggers the issue. Smaller is better — a 20-line repro is far more
  actionable than a fork of the project.
- **Impact you believe it has.** Data exposure, code execution,
  supply-chain risk, etc. Your assessment is not binding — maintainers
  will triage — but it sets context.

## Response timeline

| Milestone       | Target              | Detail                                                                                       |
| --------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| Acknowledgement | 5 business days     | A maintainer confirms receipt and assigns a tracking ID.                                     |
| Triage update   | 10 business days    | Confirms in-scope/out-of-scope, severity assessment, and likely fix path.                    |
| Disclosure      | Coordinated         | Once a fix is available, reporters who request it are credited in the advisory.              |

## Scope

This policy covers what the *spec project itself* ships. Adopter
repositories that copy the templates are governed by their own security
policy.

**In scope:**

- The specification document, checklist, and audit-log templates.
- Runbook scripts under `skills/ai-contributor-audit/scripts/` —
  collector, stamper, validator, bootstrap.
- Verification tooling under `tools/`.
- CI workflows under `.github/workflows/`.

**Out of scope:**

- Adopter repositories that copy the templates — report those to the
  adopter.
- Findings against archived or sample fixtures under
  `tools/test-fixtures/` and `examples/` unless they affect the live
  tooling.
- Issues in upstream dependencies — report to the upstream project; open a
  tracking issue here referencing the upstream advisory.

The spec is downloaded and copied into many adopter repos. A vulnerability
"in the audit checklist" only matters here if it is *inherent* to what we
ship — e.g. a stamper bug that mis-applies status. A misconfiguration in
an adopter's copy is the adopter's policy domain; we will happily help
them, but it is not our advisory to coordinate.

## Supported versions

This repository follows the spec versioning declared in
[`AI-CONTRIBUTOR-SPECIFICATION.md`](AI-CONTRIBUTOR-SPECIFICATION.md).
Security fixes land on `main` and the most recent `vN.N` release tag.

In practice that means: report against any release tag, but the fix you
receive will be against current `main` and the latest tag. Older tags are
immutable; we cut a new patch tag rather than rewriting history.

## AI-specific considerations

Because the audit runtime is itself an AI-adjacent tool, three classes of
report are especially welcome:

- **Prompt-injection paths in the audit prompt.** If you can craft a
  target-repository file that causes the agent running the audit to
  deviate from the runbook (e.g. exfiltrate secrets, disclose them, or
  skip checks), that is in scope.
- **Bootstrap supply-chain.** The bootstrap fetches pinned runbook files.
  Any way to make it fetch unintended code, downgrade the pin silently, or
  bypass the staleness advisory is in scope.
- **Untrusted input via collector.** The collector runs commands on the
  target repo. Any way to make it execute commands the auditor did not
  approve (e.g. via crafted config files) is in scope.

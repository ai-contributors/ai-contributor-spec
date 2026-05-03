# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in this repository — for example,
a checklist tool that exfiltrates repository contents, a runbook script that
executes untrusted input, or a bootstrap path that fetches code from an
unintended source — please report it privately rather than opening a public
issue.

- **Preferred channel:** [GitHub private security advisory](https://github.com/ai-contributors/ai-contributor-spec/security/advisories/new).

Please include:

- Affected file(s), commit SHA, or release tag.
- A minimal reproduction or trace.
- The impact you believe it has (data exposure, code execution, supply-chain risk).

You can expect an acknowledgement within **5 business days** and a triage update
within **10 business days**. Coordinated disclosure: once a fix is available, we
will credit reporters who request it.

## Scope

In scope:

- The specification document, checklist, and audit log templates.
- The runbook scripts under `skills/ai-contributor-audit/scripts/` (collector,
  stamper, validator, bootstrap).
- The verification tooling under `tools/`.
- CI workflows under `.github/workflows/`.

Out of scope:

- Adopter repositories that copy the templates — report those to the adopter.
- Findings against archived or sample fixtures under
  `tools/test-fixtures/` and `examples/` unless they affect the live tooling.
- Issues in upstream dependencies; report those to the upstream project and
  open a tracking issue here referencing the upstream advisory.

## Supported versions

This repository follows the spec versioning declared in
`AI-CONTRIBUTOR-SPECIFICATION.md`. Security fixes land on `main` and the most
recent `vN.N` release tag.

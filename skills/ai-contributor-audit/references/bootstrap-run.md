# Running the Audit Without Vendored Tooling

Use this flow when the target repository has not vendored the audit tooling under `tools/`. The installed skill (or the copy-and-paste prompt) bootstraps the full runbook from one pinned `SPEC_SHA`, and every script then runs from that bootstrapped directory.

Do not run installed scripts with manually fetched templates; that mixes script and template refs and can reproduce stale collector behavior.

## Bootstrap From the Installed Skill

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
RUNBOOK="/tmp/ai-contributor-audit-${SPEC_SHA}"
npx --yes tsx@4.21.0 <path-to-this-skill>/scripts/bootstrap.ts "${SPEC_SHA}" --out="${RUNBOOK}"
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-run.ts" . \
  --reset-templates \
  --template-root "${RUNBOOK}" \
  --spec-source "https://github.com/ai-contributors/ai-contributor-spec/tree/${SPEC_SHA}" \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

The `npx --yes tsx@4.21.0` invocation acquires the TypeScript executor for
bootstrap/startup. Once `audit-run.ts` is running, its collect/stamp/validate
child phases invoke `tsx` from `PATH` and do not invoke `npm` or `npx` again.

## Run the Phases Directly From the Bootstrapped Runbook

```sh
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-collect.ts" .
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-stamp.ts" \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --spec-source "https://github.com/ai-contributors/ai-contributor-spec/tree/${SPEC_SHA}" \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
git show HEAD:.ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md > /tmp/previous-checklist.md
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-validate.ts" \
  .ai-contributor-audit/AI-CONTRIBUTOR-CHECKLIST.md .ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md \
  --previous /tmp/previous-checklist.md
```

On a re-audit, `--previous` enables the `AUDIT070`–`AUDIT072` status-change rationale check; omit the `git show` line and the flag on a first audit (no checklist committed at `HEAD` yet).

## Bootstrap From the Copy-and-Paste Prompt

When using the copy-and-paste prompt instead of an installed skill, fetch `bootstrap.ts` from the same pinned `spec_source` and let it materialize the runbook:

```sh
SPEC_SHA="<the same SHA recorded in spec_source>"
curl -fsSL \
  "https://raw.githubusercontent.com/ai-contributors/ai-contributor-spec/${SPEC_SHA}/skills/ai-contributor-audit/scripts/bootstrap.ts" \
  -o /tmp/aic-bootstrap.ts
RUNBOOK="/tmp/ai-contributor-audit-${SPEC_SHA}"
npx --yes tsx@4.21.0 /tmp/aic-bootstrap.ts "${SPEC_SHA}" --out="${RUNBOOK}"
npx --yes tsx@4.21.0 "${RUNBOOK}/skills/ai-contributor-audit/scripts/audit-run.ts" . \
  --reset-templates \
  --template-root "${RUNBOOK}" \
  --spec-source "https://github.com/ai-contributors/ai-contributor-spec/tree/${SPEC_SHA}" \
  --auditor "AGENT | MODEL | REASONING_EFFORT" \
  --runner-agent "<runner>" \
  --runner-model "<model>"
```

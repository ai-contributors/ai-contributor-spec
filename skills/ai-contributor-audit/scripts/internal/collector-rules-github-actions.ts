// SPDX-License-Identifier: Apache-2.0
//
// GitHub Actions workflow rules for audit-collect.

import { RULE_AIC_IDS } from './collector-registry.ts';
import type { RuleEvidence, RuleStatus } from './collector-types.ts';

type WorkflowFile = { rel: string; content: string };

export interface GithubActionsRuleDeps {
  readWorkflows: () => WorkflowFile[];
  yamlBlockAfterKey: (content: string, keyPattern: string) => string | null;
}

export interface WorkflowActionFacts {
  rel: string;
  uses_refs: Array<{ ref: string; line: number }>;
  step_runs: Array<{ run: string; line: number }>;
}

type GhaPermissionsKind = 'absent' | 'write-all' | 'read-all' | 'mapping';

interface GhaJobFacts {
  id: string;
  block_text: string;
  permissions_kind: GhaPermissionsKind;
  if_expr: string | null;
  uses_refs: Array<{ ref: string; line: number }>;
  step_runs: Array<{ run: string; line: number }>;
}

interface GhaWorkflowFacts {
  rel: string;
  raw: string;
  events: Set<string>;
  push_tag_filter: boolean;
  release_event: boolean;
  permissions_kind: GhaPermissionsKind;
  jobs: GhaJobFacts[];
  uses_refs: Array<{ ref: string; line: number }>;
  step_runs: Array<{ run: string; line: number }>;
}

const GHA_USES_LINE = /^(\s*)-?\s*uses\s*:\s*(?:['"])?([^\s'"#]+)(?:['"])?\s*(?:#.*)?$/;
const GHA_RUN_LINE = /^(\s*)-?\s*run\s*:\s*(.*)$/;
const GHA_SHA_PIN = /^[0-9a-f]{40}$/;
const GHA_LOCAL_ACTION = /^\.\.?\/[^@]*$/;
const GHA_DOCKER_DIGEST = /^docker:\/\/[^@]+@sha256:[0-9a-f]{64}$/i;
const GHA_TAG_GATE = /startsWith\s*\(\s*github\.ref\s*,\s*['"]refs\/tags\//;

const SBOM_ACTION_REFS = [
  'cyclonedx/',
  'anchore/sbom-action',
  'anchore/syft-action',
  'microsoft/sbom-action',
  'aquasecurity/trivy-action',
  'actions/dependency-submission',
];
const SIGN_ACTION_REFS = [
  'sigstore/cosign-installer',
  'sigstore/gh-action-sigstore-python',
  'slsa-framework/slsa-github-generator',
  'actions/attest-build-provenance',
];
const PROVENANCE_ACTION_REFS = [
  'slsa-framework/slsa-github-generator',
  'actions/attest-build-provenance',
];
const PUBLISH_ACTION_REFS = [
  'softprops/action-gh-release',
  'ncipollo/release-action',
  'cycjimmy/semantic-release-action',
  'goreleaser/goreleaser-action',
  'JS-DevTools/npm-publish',
  'pypa/gh-action-pypi-publish',
];
const PUBLISH_RUN_PATTERN =
  /\b(?:npm|pnpm|yarn)\s+publish\b|\bcargo\s+publish\b|\bgh\s+release\s+create\b|\bdocker\s+push\b/i;

export function createGithubActionsRules(deps: GithubActionsRuleDeps): {
  workflowActionFacts: () => WorkflowActionFacts[];
  ruleGateEnforcement: () => RuleEvidence;
  ruleBuildImmutableRefs: () => RuleEvidence;
  ruleWorkflowTokenLeastPrivilege: () => RuleEvidence;
  ruleSbomGeneration: () => RuleEvidence;
  ruleArtifactSigning: () => RuleEvidence;
  ruleBuildProvenanceAttestation: () => RuleEvidence;
  ruleReleaseFromCi: () => RuleEvidence;
} {
  let parsedWorkflowsCache: GhaWorkflowFacts[] | null = null;

  function classifyInlinePermissions(value: string): GhaPermissionsKind {
    const v = value.trim();
    if (v === 'write-all') return 'write-all';
    if (v === 'read-all') return 'read-all';
    if (v === '') return 'mapping';
    return 'mapping';
  }

  function parseWorkflowFacts(rel: string, raw: string): GhaWorkflowFacts {
    const events = new Set<string>();
    let push_tag_filter = false;
    let release_event = false;

    const inlineOn = raw.match(/^on\s*:\s*([^\n#]+?)(?:\s*#.*)?$/m);
    if (inlineOn) {
      const v = inlineOn[1]!.trim();
      if (v.startsWith('[')) {
        for (const e of v.replace(/^\[|\]$/g, '').split(',')) {
          const x = e.trim().replace(/^['"]|['"]$/g, '');
          if (x) events.add(x);
        }
      } else if (v && !v.endsWith(':')) {
        events.add(v.replace(/^['"]|['"]$/g, ''));
      }
    }

    const onBlock = deps.yamlBlockAfterKey(raw, 'on');
    if (onBlock) {
      for (const ln of onBlock.split(/\r?\n/)) {
        const m1 = ln.match(/^\s+([A-Za-z_][\w-]*)\s*:/);
        if (m1) events.add(m1[1]!);
        const m2 = ln.match(/^\s+-\s+([A-Za-z_][\w-]*)\s*$/);
        if (m2) events.add(m2[1]!);
      }
      if (events.has('push')) {
        const pushBlock = deps.yamlBlockAfterKey(onBlock, 'push');
        if (pushBlock && /^\s+tags\s*:/m.test(pushBlock)) push_tag_filter = true;
      }
    }
    release_event = events.has('release');

    let permissions_kind: GhaPermissionsKind = 'absent';
    const topPerm = raw.match(/^permissions\s*:\s*([^\n#]*?)(?:\s*#.*)?$/m);
    if (topPerm) permissions_kind = classifyInlinePermissions(topPerm[1]!);

    const jobs: GhaJobFacts[] = [];
    const jobsBlock = deps.yamlBlockAfterKey(raw, 'jobs');
    if (jobsBlock) {
      const lines = jobsBlock.split(/\r?\n/);
      let i = 0;
      while (i < lines.length) {
        const ln = lines[i]!;
        if (/^\s*(#|$)/.test(ln)) {
          i++;
          continue;
        }
        const m = ln.match(/^(\s+)([A-Za-z_][\w-]*)\s*:\s*(?:#.*)?$/);
        if (!m) {
          i++;
          continue;
        }
        const jobIndent = m[1]!.length;
        const jobId = m[2]!;
        const blockLines: string[] = [];
        i++;
        while (i < lines.length) {
          const cur = lines[i]!;
          if (/^\s*(#|$)/.test(cur)) {
            blockLines.push(cur);
            i++;
            continue;
          }
          const ind = cur.match(/^(\s*)/)![1]!.length;
          if (ind <= jobIndent) break;
          blockLines.push(cur);
          i++;
        }
        const blockText = blockLines.join('\n');

        let job_perm: GhaPermissionsKind = 'absent';
        const jp = blockText.match(/^\s*permissions\s*:\s*([^\n#]*?)(?:\s*#.*)?$/m);
        if (jp) job_perm = classifyInlinePermissions(jp[1]!);

        const ifMatch = blockText.match(/^\s*if\s*:\s*([^\n#]+?)(?:\s*#.*)?$/m);

        const uses_refs: GhaJobFacts['uses_refs'] = [];
        const step_runs: GhaJobFacts['step_runs'] = [];
        blockText.split(/\r?\n/).forEach((bl, idx) => {
          const um = bl.match(GHA_USES_LINE);
          if (um) uses_refs.push({ ref: um[2]!, line: idx + 1 });
          const rm = bl.match(GHA_RUN_LINE);
          if (
            rm &&
            rm[2]!.trim() !== '|' &&
            rm[2]!.trim() !== '>' &&
            rm[2]!.trim() !== '|-' &&
            rm[2]!.trim() !== '>-'
          ) {
            step_runs.push({ run: rm[2]!, line: idx + 1 });
          }
        });

        jobs.push({
          id: jobId,
          block_text: blockText,
          permissions_kind: job_perm,
          if_expr: ifMatch ? ifMatch[1]!.trim() : null,
          uses_refs,
          step_runs,
        });
      }
    }

    const all_uses: GhaWorkflowFacts['uses_refs'] = [];
    const all_runs: GhaWorkflowFacts['step_runs'] = [];
    raw.split(/\r?\n/).forEach((ln, idx) => {
      const um = ln.match(GHA_USES_LINE);
      if (um) all_uses.push({ ref: um[2]!, line: idx + 1 });
      const rm = ln.match(GHA_RUN_LINE);
      if (
        rm &&
        rm[2]!.trim() !== '|' &&
        rm[2]!.trim() !== '>' &&
        rm[2]!.trim() !== '|-' &&
        rm[2]!.trim() !== '>-'
      ) {
        all_runs.push({ run: rm[2]!, line: idx + 1 });
      }
    });

    return {
      rel,
      raw,
      events,
      push_tag_filter,
      release_event,
      permissions_kind,
      jobs,
      uses_refs: all_uses,
      step_runs: all_runs,
    };
  }

  function parseAllWorkflows(): GhaWorkflowFacts[] {
    if (parsedWorkflowsCache) return parsedWorkflowsCache;
    parsedWorkflowsCache = deps.readWorkflows().map((wf) => parseWorkflowFacts(wf.rel, wf.content));
    return parsedWorkflowsCache;
  }

  function workflowActionFacts(): WorkflowActionFacts[] {
    return parseAllWorkflows().map((wf) => ({
      rel: wf.rel,
      uses_refs: wf.uses_refs,
      step_runs: wf.step_runs,
    }));
  }

  function isImmutableActionRef(ref: string): boolean {
    if (GHA_LOCAL_ACTION.test(ref)) return true;
    if (GHA_DOCKER_DIGEST.test(ref)) return true;
    const m = ref.match(/^[^\s@]+@([^\s@]+)$/);
    if (!m) return false;
    return GHA_SHA_PIN.test(m[1]!);
  }

  function actionRefMatches(ref: string, prefixes: readonly string[]): boolean {
    const owner = ref.split('@')[0]!;
    return prefixes.some((p) => owner === p || owner.startsWith(p));
  }

  function noWorkflowsEvidence(specRuleName: string, aicIds: string[]): RuleEvidence {
    return {
      spec_rule_name: specRuleName,
      applicability: {
        verdict: 'not_applicable',
        trigger_evidence: 'no .github/workflows present',
      },
      commands: [],
      derived_status: 'Not relevant',
      derivation_reason: 'no GitHub Actions workflows in tracked inventory',
      judgment_required: false,
      aic_ids: aicIds,
    };
  }

  function ruleGateEnforcement(): RuleEvidence {
    const wfs = deps.readWorkflows();
    if (wfs.length === 0) {
      return {
        spec_rule_name: 'Gate Enforcement',
        applicability: {
          verdict: 'not_applicable',
          trigger_evidence: 'no .github/workflows present',
        },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no GitHub Actions workflows in tracked inventory',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['gate-enforcement'],
      };
    }
    const offenders: string[] = [];
    for (const wf of wfs) {
      if (/^\s*continue-on-error\s*:\s*true\b/m.test(wf.content)) offenders.push(wf.rel);
    }
    return {
      spec_rule_name: 'Gate Enforcement',
      applicability: { verdict: 'applicable', trigger_evidence: `${wfs.length} workflow file(s)` },
      commands: [],
      derived_status: offenders.length === 0 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        offenders.length === 0
          ? 'no `continue-on-error: true` in any workflow'
          : `\`continue-on-error: true\` present in: ${offenders.join(', ')} — pair with required-status-checks payload to confirm severity`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['gate-enforcement'],
    };
  }

  function ruleBuildImmutableRefs(): RuleEvidence {
    const wfs = parseAllWorkflows();
    if (wfs.length === 0)
      return noWorkflowsEvidence('Build Immutable Refs', RULE_AIC_IDS['build-immutable-refs']!);
    const offenders: string[] = [];
    let total = 0;
    for (const wf of wfs) {
      for (const u of wf.uses_refs) {
        total++;
        if (!isImmutableActionRef(u.ref)) offenders.push(`${wf.rel}:${u.line} ${u.ref}`);
      }
    }
    if (total === 0) {
      return {
        spec_rule_name: 'Build Immutable Refs',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${wfs.length} workflow file(s)`,
        },
        commands: [],
        derived_status: 'Fulfilled',
        derivation_reason: 'no third-party `uses:` references in workflows',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['build-immutable-refs']!,
      };
    }
    return {
      spec_rule_name: 'Build Immutable Refs',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${total} \`uses:\` reference(s) across ${wfs.length} workflow(s)`,
      },
      commands: [],
      derived_status: offenders.length === 0 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        offenders.length === 0
          ? `all ${total} \`uses:\` reference(s) pinned to immutable refs (40-char SHA, local action, or docker digest)`
          : `${offenders.length}/${total} \`uses:\` reference(s) not pinned to immutable refs: ${offenders.slice(0, 5).join(', ')}${offenders.length > 5 ? ` (+${offenders.length - 5} more)` : ''}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['build-immutable-refs']!,
    };
  }

  function ruleWorkflowTokenLeastPrivilege(): RuleEvidence {
    const wfs = parseAllWorkflows();
    if (wfs.length === 0)
      return noWorkflowsEvidence(
        'Workflow Token Least Privilege',
        RULE_AIC_IDS['workflow-token-least-privilege']!,
      );
    const writeAll: string[] = [];
    const missing: string[] = [];
    for (const wf of wfs) {
      if (wf.permissions_kind === 'write-all') {
        writeAll.push(wf.rel);
        continue;
      }
      if (wf.permissions_kind !== 'absent') continue;
      const everyJobScoped =
        wf.jobs.length > 0 &&
        wf.jobs.every((j) => j.permissions_kind === 'mapping' || j.permissions_kind === 'read-all');
      if (!everyJobScoped) missing.push(wf.rel);
    }
    let status: RuleStatus;
    let reason: string;
    if (writeAll.length > 0) {
      status = 'Alarm';
      reason = `\`permissions: write-all\` granted in: ${writeAll.join(', ')}`;
    } else if (missing.length > 0) {
      status = 'Warning';
      reason = `workflows without an explicit \`permissions:\` block (workflow- or all-jobs-level): ${missing.join(', ')}`;
    } else {
      status = 'Fulfilled';
      reason = `all ${wfs.length} workflow(s) declare scoped \`permissions:\` (workflow- or every-job-level)`;
    }
    return {
      spec_rule_name: 'Workflow Token Least Privilege',
      applicability: { verdict: 'applicable', trigger_evidence: `${wfs.length} workflow file(s)` },
      commands: [],
      derived_status: status,
      derivation_reason: reason,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['workflow-token-least-privilege']!,
    };
  }

  function actionMatches(
    prefixes: readonly string[],
  ): { workflow: string; ref: string; line: number }[] {
    const hits: { workflow: string; ref: string; line: number }[] = [];
    for (const wf of parseAllWorkflows()) {
      for (const u of wf.uses_refs) {
        if (actionRefMatches(u.ref, prefixes))
          hits.push({ workflow: wf.rel, ref: u.ref, line: u.line });
      }
    }
    return hits;
  }

  function ruleSbomGeneration(): RuleEvidence {
    const wfs = parseAllWorkflows();
    if (wfs.length === 0)
      return noWorkflowsEvidence('SBOM Generation', RULE_AIC_IDS['sbom-generation']!);
    const hits = actionMatches(SBOM_ACTION_REFS);
    const formatHits: string[] = [];
    for (const wf of wfs) {
      if (/format\s*:\s*['"]?(?:cyclonedx|spdx)/i.test(wf.raw)) formatHits.push(wf.rel);
    }
    if (hits.length > 0) {
      return {
        spec_rule_name: 'SBOM Generation',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${wfs.length} workflow file(s)`,
        },
        commands: [],
        derived_status: 'Fulfilled',
        derivation_reason: `SBOM-generating action(s) detected: ${hits
          .map((h) => `${h.workflow}:${h.line} ${h.ref}`)
          .slice(0, 3)
          .join('; ')}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['sbom-generation']!,
      };
    }
    if (formatHits.length > 0) {
      return {
        spec_rule_name: 'SBOM Generation',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${wfs.length} workflow file(s)`,
        },
        commands: [],
        derived_status: 'Fulfilled',
        derivation_reason: `SBOM format declared (cyclonedx/spdx) in: ${formatHits.join(', ')}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['sbom-generation']!,
      };
    }
    return {
      spec_rule_name: 'SBOM Generation',
      applicability: { verdict: 'applicable', trigger_evidence: `${wfs.length} workflow file(s)` },
      commands: [],
      derived_status: 'Warning',
      derivation_reason:
        'no recognized SBOM-generating action or format directive detected in workflows',
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['sbom-generation']!,
    };
  }

  function ruleArtifactSigning(): RuleEvidence {
    const wfs = parseAllWorkflows();
    if (wfs.length === 0)
      return noWorkflowsEvidence('Artifact Signing', RULE_AIC_IDS['artifact-signing']!);
    const hits = actionMatches(SIGN_ACTION_REFS);
    return {
      spec_rule_name: 'Artifact Signing',
      applicability: { verdict: 'applicable', trigger_evidence: `${wfs.length} workflow file(s)` },
      commands: [],
      derived_status: hits.length > 0 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        hits.length > 0
          ? `signing/attestation action(s) detected: ${hits
              .map((h) => `${h.workflow}:${h.line} ${h.ref}`)
              .slice(0, 3)
              .join('; ')}`
          : 'no recognized signing or attestation action detected in workflows',
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['artifact-signing']!,
    };
  }

  function ruleBuildProvenanceAttestation(): RuleEvidence {
    const wfs = parseAllWorkflows();
    if (wfs.length === 0)
      return noWorkflowsEvidence(
        'Build Provenance Attestation',
        RULE_AIC_IDS['build-provenance-attestation']!,
      );
    const hits = actionMatches(PROVENANCE_ACTION_REFS);
    return {
      spec_rule_name: 'Build Provenance Attestation',
      applicability: { verdict: 'applicable', trigger_evidence: `${wfs.length} workflow file(s)` },
      commands: [],
      derived_status: hits.length > 0 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        hits.length > 0
          ? `provenance attestation action(s) detected: ${hits
              .map((h) => `${h.workflow}:${h.line} ${h.ref}`)
              .slice(0, 3)
              .join('; ')}`
          : 'no recognized provenance attestation action detected in workflows',
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['build-provenance-attestation']!,
    };
  }

  function ruleReleaseFromCi(): RuleEvidence {
    const wfs = parseAllWorkflows();
    if (wfs.length === 0)
      return noWorkflowsEvidence('Release from CI', RULE_AIC_IDS['release-from-ci']!);

    const publishWorkflows: Array<{ rel: string; gated: boolean; reason: string }> = [];
    for (const wf of wfs) {
      const publishUses = wf.uses_refs.filter((u) => actionRefMatches(u.ref, PUBLISH_ACTION_REFS));
      const publishRuns = wf.step_runs.filter((r) => PUBLISH_RUN_PATTERN.test(r.run));
      if (publishUses.length === 0 && publishRuns.length === 0) continue;
      const gated = wf.release_event || wf.push_tag_filter || GHA_TAG_GATE.test(wf.raw);
      const sigs: string[] = [];
      if (publishUses.length > 0) sigs.push(`uses ${publishUses[0]!.ref}`);
      if (publishRuns.length > 0) sigs.push(`run \`${publishRuns[0]!.run.slice(0, 40)}\``);
      publishWorkflows.push({
        rel: wf.rel,
        gated,
        reason: `${sigs.join(' / ')}; ${
          gated
            ? wf.release_event
              ? 'gated by `on.release`'
              : wf.push_tag_filter
                ? 'gated by `on.push.tags`'
                : "gated by `if: startsWith(github.ref, 'refs/tags/')`"
            : 'no tag/release gate detected'
        }`,
      });
    }
    if (publishWorkflows.length === 0) {
      return {
        spec_rule_name: 'Release from CI',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${wfs.length} workflow file(s)`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          'no recognized publish action or `*publish*` run step detected in workflows',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['release-from-ci']!,
      };
    }
    const ungated = publishWorkflows.filter((p) => !p.gated);
    return {
      spec_rule_name: 'Release from CI',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${publishWorkflows.length} workflow(s) with publish steps`,
      },
      commands: [],
      derived_status: ungated.length === 0 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        ungated.length === 0
          ? `every publish workflow is tag/release-gated: ${publishWorkflows.map((p) => `${p.rel} (${p.reason})`).join('; ')}`
          : `publish workflow(s) without tag/release gating: ${ungated.map((p) => `${p.rel} (${p.reason})`).join('; ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['release-from-ci']!,
    };
  }

  return {
    workflowActionFacts,
    ruleGateEnforcement,
    ruleBuildImmutableRefs,
    ruleWorkflowTokenLeastPrivilege,
    ruleSbomGeneration,
    ruleArtifactSigning,
    ruleBuildProvenanceAttestation,
    ruleReleaseFromCi,
  };
}

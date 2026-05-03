// SPDX-License-Identifier: Apache-2.0
//
// GitHub-hosted security settings and rules for audit-collect.

import fs from 'node:fs';
import path from 'node:path';
import {
  buildHostedSettings as collectHostedSettings,
  type HostedSettings,
} from './collector-hosted-settings.ts';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { CommandRun, ProfileAnswer, RuleEvidence, RuleStatus } from './collector-types.ts';
import type { WorkflowFile } from './collector-workflow-helpers.ts';

export interface GithubHostedRuleDeps {
  owner: string | null;
  repo: string | null;
  defaultBranch: string | null;
  noNetwork: boolean;
  startedAtIso: string;
  workTreeRoot: string;
  tools: Record<string, string | null>;
  inventoryUnits: () => Array<{ id: string; path: string }>;
  ghApiCall: (endpoint: string) => CommandRun;
  run: (cmd: string, args: string[], cwd: string, timeoutMs?: number) => CommandRun;
  withTokenTierCaveat: (
    reason: string,
    status: RuleStatus,
    hostedEvidence?: boolean | null,
  ) => string;
  readWorkflows: () => WorkflowFile[];
  workflowTriggersPullRequest: (content: string) => boolean;
  workflowTriggersDefaultBranchPush: (content: string) => boolean;
  hasDependencyManifest: () => boolean;
  hasSastSupportedSource: () => boolean;
  requiredChecksFromRulesetSummary: (summary: unknown) => string[];
  requiredChecksInclude: (requiredChecks: string[], pattern: RegExp) => boolean;
  profileNoAnswerForAic: (aicId: string) => ProfileAnswer | null;
  profileNotRelevantReason: (answer: ProfileAnswer) => string;
  documentedPushProtectionPlanExclusion: () => string | null;
  documentedDeployApprovalsPlanExclusion: () => string | null;
}

export function createGithubHostedRules(deps: GithubHostedRuleDeps): {
  buildHostedSettings: () => HostedSettings;
  ruleBranchProtection: () => RuleEvidence;
  ruleCiGates: () => RuleEvidence;
  ruleHumanReviewRequired: () => RuleEvidence;
  ruleSecretScanning: () => RuleEvidence;
  rulePushProtection: () => RuleEvidence;
  ruleDependencySecurity: () => RuleEvidence;
  ruleSastInCi: () => RuleEvidence;
  ruleDependencyReviewVisibility: () => RuleEvidence;
  ruleDeployEnvApprovals: () => RuleEvidence;
} {
  let hostedSettingsCache: HostedSettings | null = null;

  function buildHostedSettings(): HostedSettings {
    hostedSettingsCache ??= collectHostedSettings({
      owner: deps.owner,
      repo: deps.repo,
      defaultBranch: deps.defaultBranch,
      lastChecked: deps.startedAtIso,
      ghApiCall: deps.ghApiCall,
      requiredChecksFromRulesetSummary: deps.requiredChecksFromRulesetSummary,
    });
    return hostedSettingsCache;
  }

  function ruleBranchProtection(): RuleEvidence {
    if (!deps.owner || !deps.repo) {
      return {
        spec_rule_name: 'Branch Protection',
        applicability: { verdict: 'unknown', trigger_evidence: 'no GitHub remote detected' },
        commands: [],
        derived_status: null,
        derivation_reason: 'host not GitHub or no remote configured',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['branch-protection'],
      };
    }
    if (!deps.defaultBranch) {
      return {
        spec_rule_name: 'Branch Protection',
        applicability: { verdict: 'applicable', trigger_evidence: 'GitHub remote present' },
        commands: [],
        derived_status: null,
        derivation_reason: 'default branch could not be resolved',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['branch-protection'],
      };
    }
    const cmds: CommandRun[] = [];
    const rulesetCmd = deps.ghApiCall(
      `repos/${deps.owner}/${deps.repo}/rules/branches/${deps.defaultBranch}`,
    );
    cmds.push(rulesetCmd);
    let active = false;
    let permissiveBypass = false;
    const raw: unknown = rulesetCmd.response_summary;
    if (rulesetCmd.exit_code === 0 && Array.isArray(raw)) active = raw.length > 0;
    if (!active) {
      const protCmd = deps.ghApiCall(
        `repos/${deps.owner}/${deps.repo}/branches/${deps.defaultBranch}/protection`,
      );
      cmds.push(protCmd);
      if (protCmd.exit_code === 0 && protCmd.response_summary) {
        active = true;
        const bypass = (protCmd.response_summary as { restrictions?: unknown }).restrictions;
        permissiveBypass = !bypass;
      }
    }
    if (cmds.every((c) => c.exit_code !== 0 && c.kind === 'gh_api' && c.exit_code === null)) {
      return {
        spec_rule_name: 'Branch Protection',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `default branch: ${deps.defaultBranch}`,
        },
        commands: cmds,
        derived_status: null,
        derivation_reason: 'no host API access; recorded as Verification gap',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['branch-protection'],
      };
    }
    let status: RuleStatus;
    let reason: string;
    if (active && !permissiveBypass) {
      status = 'Fulfilled';
      reason = `default branch '${deps.defaultBranch}' has active rules/protection`;
    } else if (active && permissiveBypass) {
      status = 'Warning';
      reason = 'rules active but permissive bypass detected';
    } else {
      status = 'Alarm';
      reason = `no branch protection on '${deps.defaultBranch}'`;
    }
    return {
      spec_rule_name: 'Branch Protection',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `default branch: ${deps.defaultBranch}`,
      },
      commands: cmds,
      derived_status: status,
      derivation_reason: deps.withTokenTierCaveat(reason, status),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['branch-protection'],
    };
  }

  function ruleCiGates(): RuleEvidence {
    if (!deps.owner || !deps.repo || !deps.defaultBranch) {
      return {
        spec_rule_name: 'CI Gates',
        applicability: {
          verdict: 'unknown',
          trigger_evidence: 'GitHub remote / default branch unresolved',
        },
        commands: [],
        derived_status: null,
        derivation_reason: 'host or default branch unknown',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['ci-gates'],
      };
    }
    const cmds: CommandRun[] = [];
    const ruleset = deps.ghApiCall(
      `repos/${deps.owner}/${deps.repo}/rules/branches/${deps.defaultBranch}`,
    );
    cmds.push(ruleset);
    const requiredChecks: string[] = [];
    if (ruleset.exit_code === 0 && Array.isArray(ruleset.response_summary)) {
      requiredChecks.push(...deps.requiredChecksFromRulesetSummary(ruleset.response_summary));
    }
    if (cmds[0]!.exit_code === null) {
      return {
        spec_rule_name: 'CI Gates',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `default branch: ${deps.defaultBranch}`,
        },
        commands: cmds,
        derived_status: null,
        derivation_reason: 'no host API access; recorded as Verification gap',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['ci-gates'],
      };
    }
    const status: RuleStatus = requiredChecks.length === 0 ? 'Alarm' : 'Fulfilled';
    const reason =
      requiredChecks.length === 0
        ? `no required status checks on '${deps.defaultBranch}'`
        : `${requiredChecks.length} required status check(s): ${requiredChecks.join(', ')}`;
    return {
      spec_rule_name: 'CI Gates',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `default branch: ${deps.defaultBranch}`,
      },
      commands: cmds,
      derived_status: status,
      derivation_reason: deps.withTokenTierCaveat(reason, status),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['ci-gates'],
    };
  }

  function ruleHumanReviewRequired(): RuleEvidence {
    if (!deps.owner || !deps.repo || !deps.defaultBranch) {
      return {
        spec_rule_name: 'Human Review Required',
        applicability: {
          verdict: 'unknown',
          trigger_evidence: 'GitHub remote / default branch unresolved',
        },
        commands: [],
        derived_status: null,
        derivation_reason: 'host or default branch unknown',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['human-review-required'],
      };
    }
    const cmds: CommandRun[] = [];
    const ruleset = deps.ghApiCall(
      `repos/${deps.owner}/${deps.repo}/rules/branches/${deps.defaultBranch}`,
    );
    cmds.push(ruleset);
    let approvals = -1;
    let dismiss = false;
    if (ruleset.exit_code === 0 && Array.isArray(ruleset.response_summary)) {
      for (const r of ruleset.response_summary as Array<Record<string, unknown>>) {
        if (r.type === 'pull_request') {
          const params = r.parameters as
            | { required_approving_review_count?: number; dismiss_stale_reviews_on_push?: boolean }
            | undefined;
          approvals = Math.max(approvals, params?.required_approving_review_count ?? 0);
          dismiss = dismiss || !!params?.dismiss_stale_reviews_on_push;
        }
      }
    }
    if (cmds[0]!.exit_code === null) {
      return {
        spec_rule_name: 'Human Review Required',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `default branch: ${deps.defaultBranch}`,
        },
        commands: cmds,
        derived_status: null,
        derivation_reason: 'no host API access; recorded as Verification gap',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['human-review-required'],
      };
    }
    let status: RuleStatus;
    let reason: string;
    if (approvals >= 1 && dismiss) {
      status = 'Fulfilled';
      reason = `required_approving_review_count=${approvals}; dismiss_stale_reviews_on_push=true`;
    } else if (approvals >= 1) {
      status = 'Warning';
      reason = `required_approving_review_count=${approvals} but dismiss_stale_reviews_on_push not set`;
    } else {
      status = 'Alarm';
      reason = `required_approving_review_count=${approvals < 0 ? 0 : approvals} (must be >=1)`;
    }
    return {
      spec_rule_name: 'Human Review Required',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `default branch: ${deps.defaultBranch}`,
      },
      commands: cmds,
      derived_status: status,
      derivation_reason: deps.withTokenTierCaveat(reason, status),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['human-review-required'],
    };
  }

  function ruleSecretScanning(): RuleEvidence {
    const cmds: CommandRun[] = [];
    const wfs = deps.readWorkflows();
    const husky = fs.existsSync(path.join(deps.workTreeRoot, '.husky/pre-commit'))
      ? fs.readFileSync(path.join(deps.workTreeRoot, '.husky/pre-commit'), 'utf8')
      : '';
    const detectorRe = /(secretlint|gitleaks|trufflehog|ggshield)/i;
    const localDetectors: string[] = [];
    for (const wf of wfs) if (detectorRe.test(wf.content)) localDetectors.push(wf.rel);
    if (detectorRe.test(husky)) localDetectors.push('.husky/pre-commit');

    let hostedEnabled: boolean | null = null;
    if (deps.owner && deps.repo) {
      const cr = deps.ghApiCall(`repos/${deps.owner}/${deps.repo}/secret-scanning/alerts`);
      cmds.push(cr);
      if (cr.exit_code === 0) hostedEnabled = true;
      else if (cr.exit_code !== null && /404|disabled/i.test(cr.stderr_excerpt ?? ''))
        hostedEnabled = false;
    }
    let status: RuleStatus;
    let reason: string;
    if (hostedEnabled || localDetectors.length > 0) {
      status = 'Fulfilled';
      reason = hostedEnabled
        ? `GitHub secret scanning enabled${localDetectors.length ? `; also local: ${localDetectors.join(', ')}` : ''}`
        : `local detector(s) wired in: ${localDetectors.join(', ')}`;
    } else if (hostedEnabled === false && localDetectors.length === 0) {
      status = 'Alarm';
      reason = 'hosted secret scanning disabled and no local detector found';
    } else {
      status = 'Warning';
      reason = 'no detector found locally; hosted state could not be confirmed';
    }
    return {
      spec_rule_name: 'Secret Scanning',
      applicability: { verdict: 'applicable', trigger_evidence: 'repository tracks source code' },
      commands: cmds,
      derived_status: status,
      derivation_reason: deps.withTokenTierCaveat(reason, status, hostedEnabled),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['secret-scanning'],
    };
  }

  function rulePushProtection(): RuleEvidence {
    if (!deps.owner || !deps.repo) {
      return {
        spec_rule_name: 'Push Protection',
        applicability: { verdict: 'unknown', trigger_evidence: 'no GitHub remote' },
        commands: [],
        derived_status: null,
        derivation_reason: 'host not GitHub or remote unresolved',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['push-protection'],
      };
    }
    const cmds: CommandRun[] = [];
    const profileNo = deps.profileNoAnswerForAic('AIC-push-protection-enabled');
    const planExclusion = profileNo
      ? deps.profileNotRelevantReason(profileNo)
      : deps.documentedPushProtectionPlanExclusion();
    const cr = deps.ghApiCall(`repos/${deps.owner}/${deps.repo}`);
    cmds.push(cr);
    if (cr.exit_code === null) {
      if (planExclusion) {
        return {
          spec_rule_name: 'Push Protection',
          applicability: { verdict: 'not_applicable', trigger_evidence: planExclusion },
          commands: cmds,
          derived_status: 'Not relevant',
          derivation_reason: planExclusion,
          judgment_required: false,
          aic_ids: RULE_AIC_IDS['push-protection'],
        };
      }
      return {
        spec_rule_name: 'Push Protection',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `repo: ${deps.owner}/${deps.repo}`,
        },
        commands: cmds,
        derived_status: null,
        derivation_reason: 'no host API access; recorded as Verification gap',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['push-protection'],
      };
    }
    const sa = (
      cr.response_summary as
        | { security_and_analysis?: { secret_scanning_push_protection?: { status?: string } } }
        | undefined
    )?.security_and_analysis?.secret_scanning_push_protection?.status;
    let status: RuleStatus;
    let reason: string;
    if (sa === 'enabled') {
      status = 'Fulfilled';
      reason = 'security_and_analysis.secret_scanning_push_protection.status=enabled';
    } else if (planExclusion) {
      status = 'Not relevant';
      reason = planExclusion;
    } else if (sa === 'disabled') {
      status = 'Alarm';
      reason = 'push protection disabled on the GitHub side';
    } else {
      status = 'Warning';
      reason = `push protection status not reported (token may lack admin scope; observed=${sa ?? 'undefined'})`;
    }
    return {
      spec_rule_name: 'Push Protection',
      applicability:
        planExclusion && status === 'Not relevant'
          ? { verdict: 'not_applicable', trigger_evidence: planExclusion }
          : { verdict: 'applicable', trigger_evidence: `repo: ${deps.owner}/${deps.repo}` },
      commands: cmds,
      derived_status: status,
      derivation_reason: deps.withTokenTierCaveat(reason, status),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['push-protection'],
    };
  }

  function ruleDependencySecurity(): RuleEvidence {
    const cmds: CommandRun[] = [];
    if (deps.owner && deps.repo) {
      const cr = deps.ghApiCall(
        `repos/${deps.owner}/${deps.repo}/dependabot/alerts?state=open&severity=high&per_page=1`,
      );
      cmds.push(cr);
      if (cr.exit_code === 0) {
        const open = Array.isArray(cr.response_summary) ? cr.response_summary.length : 0;
        const status: RuleStatus = open === 0 ? 'Fulfilled' : 'Alarm';
        return {
          spec_rule_name: 'Dependency Security',
          applicability: { verdict: 'applicable', trigger_evidence: 'dependency manifest present' },
          commands: cmds,
          derived_status: status,
          derivation_reason: deps.withTokenTierCaveat(
            open === 0
              ? 'Dependabot alerts: no open high-severity vulnerabilities'
              : `${open}+ open high-severity Dependabot alert(s)`,
            status,
          ),
          judgment_required: false,
          aic_ids: RULE_AIC_IDS['dependency-security'],
        };
      }
    }
    if (deps.tools.pnpm) {
      const lockUnits: Array<{ id: string; path: string }> = [];
      for (const unit of deps.inventoryUnits()) {
        if (fs.existsSync(path.join(deps.workTreeRoot, unit.path, 'pnpm-lock.yaml'))) {
          lockUnits.push({ id: unit.id, path: unit.path });
        }
      }
      if (lockUnits.length > 0) {
        const failures: string[] = [];
        let timedOut = false;
        let allClean = true;
        for (const unit of lockUnits) {
          const cwd = path.join(deps.workTreeRoot, unit.path);
          const cr = deps.run('pnpm', ['audit', '--prod', '--json'], cwd, 120_000);
          cmds.push(cr);
          if (cr.exit_code === 0) continue;
          if (cr.exit_code === null) {
            timedOut = true;
            allClean = false;
          } else {
            failures.push(`${unit.id} (exit ${cr.exit_code})`);
            allClean = false;
          }
        }
        let status: RuleStatus;
        let reason: string;
        if (allClean) {
          status = 'Fulfilled';
          reason = `pnpm audit --prod exit 0 in ${lockUnits.length} unit(s): ${lockUnits.map((u) => u.id).join(', ')}`;
        } else if (timedOut && failures.length === 0) {
          status = null;
          reason = 'pnpm audit timed out or failed to spawn in at least one unit';
        } else {
          status = 'Alarm';
          reason = `pnpm audit --prod failed in ${failures.length} unit(s): ${failures.join('; ')}`;
        }
        return {
          spec_rule_name: 'Dependency Security',
          applicability: {
            verdict: 'applicable',
            trigger_evidence: `pnpm-lock.yaml in ${lockUnits.length} unit(s)`,
          },
          commands: cmds,
          derived_status: status,
          derivation_reason: reason,
          judgment_required: status === null,
          aic_ids: RULE_AIC_IDS['dependency-security'],
        };
      }
    }
    return {
      spec_rule_name: 'Dependency Security',
      applicability: { verdict: 'applicable', trigger_evidence: 'dependency manifest present' },
      commands: cmds,
      derived_status: null,
      derivation_reason:
        'no host API access and no supported lockfile (root or nested) for local audit',
      judgment_required: true,
      aic_ids: RULE_AIC_IDS['dependency-security'],
    };
  }

  function ruleSastInCi(): RuleEvidence {
    const wfs = deps.readWorkflows();
    if (!deps.hasSastSupportedSource()) {
      return {
        spec_rule_name: 'SAST',
        applicability: {
          verdict: 'not_applicable',
          trigger_evidence: 'no supported source language in tracked inventory',
        },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason:
          'no TS/JS/Python/Go/Java/C#/Ruby/Rust/PHP/Kotlin/Scala/Swift source files found',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['sast-in-ci'],
      };
    }
    const sastWorkflows = wfs.filter((wf) =>
      /\b(semgrep|github\/codeql-action|codeql|snyk|trivy|bearer|sonarcloud|sonarsource|gosec|bandit|brakeman)\b/i.test(
        wf.content,
      ),
    );
    if (sastWorkflows.length === 0) {
      return {
        spec_rule_name: 'SAST',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: 'supported source language present',
        },
        commands: [],
        derived_status: 'Alarm',
        derivation_reason: 'no recognized SAST workflow found under `.github/workflows`',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['sast-in-ci'],
      };
    }
    const prOrMain = sastWorkflows.filter(
      (wf) =>
        deps.workflowTriggersPullRequest(wf.content) ||
        deps.workflowTriggersDefaultBranchPush(wf.content),
    );
    const status: RuleStatus = prOrMain.length > 0 ? 'Fulfilled' : 'Warning';
    const workflows = (prOrMain.length > 0 ? prOrMain : sastWorkflows)
      .map((wf) => wf.rel)
      .join(', ');
    return {
      spec_rule_name: 'SAST',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: 'supported source language present',
      },
      commands: [],
      derived_status: status,
      derivation_reason:
        status === 'Fulfilled'
          ? `recognized SAST workflow(s) run on pull requests or default branch: ${workflows}`
          : `recognized SAST workflow(s) found but not on pull requests or default branch: ${workflows}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['sast-in-ci'],
    };
  }

  function ruleDependencyReviewVisibility(): RuleEvidence {
    if (!deps.hasDependencyManifest()) {
      return {
        spec_rule_name: 'Dependency Review',
        applicability: {
          verdict: 'not_applicable',
          trigger_evidence: 'no dependency manifest in tracked inventory',
        },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no dependency manifest or lockfile found',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['dependency-review-visibility'],
      };
    }
    const cmds: CommandRun[] = [];
    const wfs = deps.readWorkflows();
    const reviewWorkflows = wfs.filter((wf) =>
      /actions\/dependency-review-action|dependency[-_ ]review|renovate|dependabot|pnpm\s+audit|npm\s+audit|yarn\s+audit|audit-ci|grype|anchore\/scan-action|oss-review-toolkit|ort\b/i.test(
        wf.content,
      ),
    );
    let requiredChecks: string[] = [];
    if (deps.owner && deps.repo && deps.defaultBranch && !deps.noNetwork) {
      const ruleset = deps.ghApiCall(
        `repos/${deps.owner}/${deps.repo}/rules/branches/${deps.defaultBranch}`,
      );
      cmds.push(ruleset);
      if (ruleset.exit_code === 0)
        requiredChecks = deps.requiredChecksFromRulesetSummary(ruleset.response_summary);
    }
    if (reviewWorkflows.length === 0) {
      return {
        spec_rule_name: 'Dependency Review',
        applicability: { verdict: 'applicable', trigger_evidence: 'dependency manifest present' },
        commands: cmds,
        derived_status: 'Alarm',
        derivation_reason: 'no dependency review or dependency-audit workflow found',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['dependency-review-visibility'],
      };
    }
    const activeOnPr = reviewWorkflows.filter((wf) => deps.workflowTriggersPullRequest(wf.content));
    const skippedForPrivate = reviewWorkflows.filter(
      (wf) =>
        /actions\/dependency-review-action/i.test(wf.content) &&
        /repository\.visibility\s*==\s*['"]public['"]|visibility\s*==\s*['"]public['"]/i.test(
          wf.content,
        ),
    );
    const failBuildFalse = reviewWorkflows.filter((wf) =>
      /fail-build\s*:\s*false|continue-on-error\s*:\s*true/i.test(wf.content),
    );
    const equivalentScanner = activeOnPr.filter((wf) =>
      /pnpm\s+audit|npm\s+audit|yarn\s+audit|audit-ci|grype|anchore\/scan-action|oss-review-toolkit|ort\b|trivy|snyk/i.test(
        wf.content,
      ),
    );
    const requiredCheckEvidenceAvailable = cmds.some((cmd) => cmd.exit_code === 0);
    const dependencyGateRequired =
      requiredCheckEvidenceAvailable &&
      deps.requiredChecksInclude(
        requiredChecks,
        /\b(dependency review|dependency[-_ ]?audit|security scan|grype|trivy|snyk|sbom|vulnerabilit)/i,
      );
    const requiredCheckSummary = requiredCheckEvidenceAvailable
      ? `required checks: ${requiredChecks.length > 0 ? requiredChecks.join(', ') : '(none)'}`
      : 'required-check evidence unavailable';
    const blockingPr = activeOnPr.filter(
      (wf) => !skippedForPrivate.includes(wf) && !failBuildFalse.includes(wf),
    );
    let status: RuleStatus;
    let reason: string;
    if (equivalentScanner.length > 0 && dependencyGateRequired) {
      status = 'Fulfilled';
      reason = `required dependency security gate runs on pull requests: ${equivalentScanner.map((wf) => wf.rel).join(', ')}; ${requiredCheckSummary}`;
    } else if (blockingPr.length > 0 && dependencyGateRequired) {
      status = 'Fulfilled';
      reason = `required dependency review or dependency-audit workflow runs on pull requests: ${blockingPr.map((wf) => wf.rel).join(', ')}; ${requiredCheckSummary}`;
    } else if (equivalentScanner.length > 0) {
      status = 'Warning';
      reason = `dependency security scanner runs on pull requests but is not visibly required by branch protection: ${equivalentScanner.map((wf) => wf.rel).join(', ')}; ${requiredCheckSummary}`;
    } else if (blockingPr.length > 0) {
      status = 'Warning';
      reason = `dependency review/audit workflow runs on pull requests but is not visibly required by branch protection: ${blockingPr.map((wf) => wf.rel).join(', ')}; ${requiredCheckSummary}`;
    } else if (activeOnPr.length === 0) {
      status = 'Warning';
      reason = `dependency review workflow(s) found but not on pull requests: ${reviewWorkflows.map((wf) => wf.rel).join(', ')}`;
    } else if (skippedForPrivate.length > 0) {
      status = 'Warning';
      reason = `dependency review action is public-repo gated in: ${skippedForPrivate.map((wf) => wf.rel).join(', ')}; private fallback must run a blocking scanner or branch protection must require an equivalent dependency security gate`;
    } else if (failBuildFalse.length > 0) {
      status = 'Warning';
      reason = `dependency review/audit workflow is non-blocking in: ${failBuildFalse.map((wf) => wf.rel).join(', ')}`;
    } else {
      status = 'Warning';
      reason = `dependency review workflow is present but blocking behavior could not be derived: ${activeOnPr.map((wf) => wf.rel).join(', ')}`;
    }
    return {
      spec_rule_name: 'Dependency Review',
      applicability: { verdict: 'applicable', trigger_evidence: 'dependency manifest present' },
      commands: cmds,
      derived_status: status,
      derivation_reason: reason,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['dependency-review-visibility'],
    };
  }

  function ruleDeployEnvApprovals(): RuleEvidence {
    const settings = buildHostedSettings();
    const envs = settings.deployment_environments.value;
    if (!deps.owner || !deps.repo) {
      return {
        spec_rule_name: 'Deployment Environment Approvals',
        applicability: { verdict: 'unknown', trigger_evidence: 'no GitHub remote' },
        commands: [],
        derived_status: null,
        derivation_reason: 'host not GitHub or remote unresolved',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['deploy-env-approvals']!,
      };
    }
    const profileNo = deps.profileNoAnswerForAic('AIC-deploy-env-approvals');
    const planExclusion = profileNo
      ? deps.profileNotRelevantReason(profileNo)
      : deps.documentedDeployApprovalsPlanExclusion();
    if (planExclusion) {
      return {
        spec_rule_name: 'Deployment Environment Approvals',
        applicability: { verdict: 'not_applicable', trigger_evidence: planExclusion },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: planExclusion,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['deploy-env-approvals']!,
      };
    }
    if (envs === null) {
      return {
        spec_rule_name: 'Deployment Environment Approvals',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `repo: ${deps.owner}/${deps.repo}`,
        },
        commands: [],
        derived_status: null,
        derivation_reason: 'no host API access for environments; recorded as Verification gap',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['deploy-env-approvals']!,
      };
    }
    if (envs.length === 0) {
      return {
        spec_rule_name: 'Deployment Environment Approvals',
        applicability: {
          verdict: 'not_applicable',
          trigger_evidence: 'no GitHub deployment environments configured',
        },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no deployment environments configured',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['deploy-env-approvals']!,
      };
    }
    const unprotected = envs.filter((e) => !e.has_required_reviewers);
    let status: RuleStatus;
    let reason: string;
    if (unprotected.length === 0) {
      status = 'Fulfilled';
      reason = `every deployment environment has required reviewers: ${envs.map((e) => `${e.name} (${e.required_reviewer_count ?? '?'})`).join(', ')}`;
    } else if (unprotected.some((e) => /^prod|production/i.test(e.name))) {
      status = 'Alarm';
      reason = `production-named environment(s) lack required reviewers: ${unprotected.map((e) => e.name).join(', ')}`;
    } else {
      status = 'Warning';
      reason = `environment(s) without required reviewers: ${unprotected.map((e) => e.name).join(', ')}`;
    }
    return {
      spec_rule_name: 'Deployment Environment Approvals',
      applicability: { verdict: 'applicable', trigger_evidence: `${envs.length} environment(s)` },
      commands: [],
      derived_status: status,
      derivation_reason: deps.withTokenTierCaveat(reason, status),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['deploy-env-approvals']!,
    };
  }

  return {
    buildHostedSettings,
    ruleBranchProtection,
    ruleCiGates,
    ruleHumanReviewRequired,
    ruleSecretScanning,
    rulePushProtection,
    ruleDependencySecurity,
    ruleSastInCi,
    ruleDependencyReviewVisibility,
    ruleDeployEnvApprovals,
  };
}

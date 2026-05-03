// SPDX-License-Identifier: Apache-2.0
//
// Normalized GitHub-hosted repository settings for audit-collect.
//
// Every GitHub REST response we consume is run through a validator from
// `github-api-schemas.ts` at this boundary (closes
// AIC-boundary-schema-validation). Validation failures downgrade the field to
// the verification-gap shape with the reason recorded on the underlying
// CommandRun, rather than coercing through a TypeScript assertion that lies.

import {
  validateBranchProtection,
  validateDependabotAlertsList,
  validateEnvironmentsList,
  validateRepoMetadata,
  validateRulesetSummary,
} from './github-api-schemas.ts';

interface HostedCommandRun {
  exit_code: number | null;
  stderr_excerpt?: string;
  response_summary?: unknown;
}

export interface HostedField<T> {
  value: T | null;
  source: string;
  last_checked: string;
}

export interface DeploymentEnvironmentFact {
  name: string;
  has_required_reviewers: boolean;
  required_reviewer_count: number | null;
}

export interface HostedSettings {
  branch_protection: HostedField<{ active: boolean; permissive_bypass: boolean }>;
  required_status_checks: HostedField<string[]>;
  required_reviews: HostedField<{ count: number; dismiss_stale: boolean }>;
  codeowners_enforced: HostedField<boolean>;
  secret_scanning: HostedField<'enabled' | 'disabled'>;
  push_protection: HostedField<'enabled' | 'disabled'>;
  dependency_alerts: HostedField<{ open_high: number }>;
  deployment_environments: HostedField<DeploymentEnvironmentFact[]>;
}

export interface HostedSettingsInput {
  owner: string | null;
  repo: string | null;
  defaultBranch: string | null;
  lastChecked: string;
  ghApiCall: (endpoint: string) => HostedCommandRun;
  requiredChecksFromRulesetSummary: (summary: unknown) => string[];
}

const NO_HOST_ACCESS = 'no-host-access';

function gap<T>(lastChecked: string): HostedField<T> {
  return { value: null, source: NO_HOST_ACCESS, last_checked: lastChecked };
}

function field<T>(value: T, source: string, lastChecked: string): HostedField<T> {
  return { value, source, last_checked: lastChecked };
}

// Surface every GitHub-API-derived signal in one normalized evidence shape so
// rules and auditors can read from one place. `source` is one of:
// - "gh:rules-api" / "gh:protection-api" for branch rules
// - "gh:repo" for repository security_and_analysis fields
// - "gh:secret-scanning", "gh:dependabot", or "gh:environments"
// - "no-host-access" for the verification-gap shape
export function buildHostedSettings(input: HostedSettingsInput): HostedSettings {
  const { owner, repo, defaultBranch, lastChecked, ghApiCall, requiredChecksFromRulesetSummary } =
    input;
  const out: HostedSettings = {
    branch_protection: gap(lastChecked),
    required_status_checks: gap(lastChecked),
    required_reviews: gap(lastChecked),
    codeowners_enforced: gap(lastChecked),
    secret_scanning: gap(lastChecked),
    push_protection: gap(lastChecked),
    dependency_alerts: gap(lastChecked),
    deployment_environments: gap(lastChecked),
  };
  if (!owner || !repo) return out;

  // Branch / PR rules: prefer the new rules API, fall back to legacy protection.
  if (defaultBranch) {
    const ruleset = ghApiCall(`repos/${owner}/${repo}/rules/branches/${defaultBranch}`);
    const rulesetValidation =
      ruleset.exit_code === 0 ? validateRulesetSummary(ruleset.response_summary) : null;
    if (rulesetValidation && !rulesetValidation.ok) {
      ruleset.stderr_excerpt = `wire-shape validation failed: ${rulesetValidation.reason}`;
    }
    if (rulesetValidation?.ok) {
      const summary = rulesetValidation.value;
      out.branch_protection = field(
        { active: summary.length > 0, permissive_bypass: false },
        'gh:rules-api',
        lastChecked,
      );
      const requiredChecks = requiredChecksFromRulesetSummary(summary);
      out.required_status_checks = field(requiredChecks, 'gh:rules-api', lastChecked);
      let approvals = 0;
      let dismiss = false;
      let codeowners = false;
      for (const r of summary) {
        if (r.type === 'pull_request') {
          const params = r.parameters as
            | {
                required_approving_review_count?: number;
                dismiss_stale_reviews_on_push?: boolean;
                require_code_owner_review?: boolean;
              }
            | undefined;
          approvals = Math.max(approvals, params?.required_approving_review_count ?? 0);
          dismiss = dismiss || !!params?.dismiss_stale_reviews_on_push;
          codeowners = codeowners || !!params?.require_code_owner_review;
        }
      }
      out.required_reviews = field(
        { count: approvals, dismiss_stale: dismiss },
        'gh:rules-api',
        lastChecked,
      );
      out.codeowners_enforced = field(codeowners, 'gh:rules-api', lastChecked);
    } else if (ruleset.exit_code !== null) {
      // Rules endpoint reachable but no rules; try the legacy protection API.
      const prot = ghApiCall(`repos/${owner}/${repo}/branches/${defaultBranch}/protection`);
      const protValidation =
        prot.exit_code === 0 ? validateBranchProtection(prot.response_summary) : null;
      if (protValidation && !protValidation.ok) {
        prot.stderr_excerpt = `wire-shape validation failed: ${protValidation.reason}`;
      }
      if (protValidation?.ok) {
        const sum = protValidation.value;
        out.branch_protection = field(
          { active: true, permissive_bypass: !sum.restrictions },
          'gh:protection-api',
          lastChecked,
        );
        const checks: string[] = Array.isArray(sum.required_status_checks?.contexts)
          ? (sum.required_status_checks.contexts as string[])
          : [];
        out.required_status_checks = field(checks, 'gh:protection-api', lastChecked);
        const reviews = sum.required_pull_request_reviews;
        out.required_reviews = field(
          {
            count: reviews?.required_approving_review_count ?? 0,
            dismiss_stale: !!reviews?.dismiss_stale_reviews,
          },
          'gh:protection-api',
          lastChecked,
        );
        out.codeowners_enforced = field(
          !!reviews?.require_code_owner_reviews,
          'gh:protection-api',
          lastChecked,
        );
      } else if (prot.exit_code !== null) {
        // Both endpoints reachable but no protection.
        out.branch_protection = field(
          { active: false, permissive_bypass: false },
          'gh:protection-api',
          lastChecked,
        );
        out.required_status_checks = field([], 'gh:protection-api', lastChecked);
        out.required_reviews = field(
          { count: 0, dismiss_stale: false },
          'gh:protection-api',
          lastChecked,
        );
        out.codeowners_enforced = field(false, 'gh:protection-api', lastChecked);
      }
    }
  }

  // secret_scanning + push_protection from the repo metadata response.
  const repoMeta = ghApiCall(`repos/${owner}/${repo}`);
  const repoMetaValidation =
    repoMeta.exit_code === 0 ? validateRepoMetadata(repoMeta.response_summary) : null;
  if (repoMetaValidation && !repoMetaValidation.ok) {
    repoMeta.stderr_excerpt = `wire-shape validation failed: ${repoMetaValidation.reason}`;
  }
  if (repoMetaValidation?.ok) {
    const sa = repoMetaValidation.value.security_and_analysis;
    const ss = sa?.secret_scanning?.status;
    const pp = sa?.secret_scanning_push_protection?.status;
    if (ss === 'enabled' || ss === 'disabled')
      out.secret_scanning = field(ss, 'gh:repo', lastChecked);
    if (pp === 'enabled' || pp === 'disabled')
      out.push_protection = field(pp, 'gh:repo', lastChecked);
  }

  // Secret-scanning alerts endpoint as a secondary signal: returning 0 means
  // the feature is on (the listing endpoint requires it enabled).
  if (out.secret_scanning.value === null) {
    const alerts = ghApiCall(`repos/${owner}/${repo}/secret-scanning/alerts`);
    if (alerts.exit_code === 0)
      out.secret_scanning = field('enabled', 'gh:secret-scanning', lastChecked);
    else if (alerts.exit_code !== null && /404|disabled/i.test(alerts.stderr_excerpt ?? '')) {
      out.secret_scanning = field('disabled', 'gh:secret-scanning', lastChecked);
    }
  }

  // Dependabot alerts open-high probe.
  const deps = ghApiCall(
    `repos/${owner}/${repo}/dependabot/alerts?state=open&severity=high&per_page=1`,
  );
  const depsValidation =
    deps.exit_code === 0 ? validateDependabotAlertsList(deps.response_summary) : null;
  if (depsValidation && !depsValidation.ok) {
    deps.stderr_excerpt = `wire-shape validation failed: ${depsValidation.reason}`;
  }
  if (depsValidation?.ok) {
    out.dependency_alerts = field(
      { open_high: depsValidation.value.length },
      'gh:dependabot',
      lastChecked,
    );
  }

  // Deployment environments (only probe when the repo metadata succeeded to
  // avoid a likely 404 round-trip on tiny repos).
  if (repoMeta.exit_code === 0) {
    const envs = ghApiCall(`repos/${owner}/${repo}/environments`);
    const envsValidation =
      envs.exit_code === 0 ? validateEnvironmentsList(envs.response_summary) : null;
    if (envsValidation && !envsValidation.ok) {
      envs.stderr_excerpt = `wire-shape validation failed: ${envsValidation.reason}`;
    }
    if (envsValidation?.ok) {
      const list = envsValidation.value.environments ?? [];
      const facts: DeploymentEnvironmentFact[] = [];
      for (const e of list) {
        const name = typeof e.name === 'string' ? e.name : '<unknown>';
        const protectionRules = Array.isArray(e.protection_rules) ? e.protection_rules : [];
        let reviewerCount: number | null = null;
        let hasReviewers = false;
        for (const pr of protectionRules) {
          if (pr.type === 'required_reviewers') {
            hasReviewers = true;
            const reviewers = Array.isArray(pr.reviewers) ? pr.reviewers : [];
            reviewerCount = reviewers.length;
          }
        }
        facts.push({
          name,
          has_required_reviewers: hasReviewers,
          required_reviewer_count: reviewerCount,
        });
      }
      out.deployment_environments = field(facts, 'gh:environments', lastChecked);
    }
  }

  return out;
}

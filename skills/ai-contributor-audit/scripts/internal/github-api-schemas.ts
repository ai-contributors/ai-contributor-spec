// SPDX-License-Identifier: Apache-2.0
//
// Runtime validators for the GitHub REST responses the collector consumes.
//
// Why hand-rolled and not zod / @sinclair/typebox: the runbook scripts MUST
// stay Node-builtin-only (see `bootstrap.ts`'s top-of-file contract). Adding a
// validation library would force every adopter to install it before running
// the audit, breaking the "fetch-by-SHA-and-run" property.
//
// Closes the AI Contributor `Boundary Schema Validation`
// (AIC-boundary-schema-validation) rule for AI-authored collectors that read
// GitHub REST responses. Each `validate*` returns either the value or a
// reason; callers downgrade to a verification gap with the reason recorded
// when validation fails — they do not silently coerce.

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export interface RuleSummaryEntry {
  type: string;
  parameters?: Record<string, unknown>;
}

export interface BranchProtectionShape {
  required_status_checks?: { contexts?: unknown };
  required_pull_request_reviews?: {
    required_approving_review_count?: number;
    dismiss_stale_reviews?: boolean;
    require_code_owner_reviews?: boolean;
  };
  restrictions?: unknown;
}

export interface RepoMetadataShape {
  security_and_analysis?: Record<string, { status?: string } | undefined>;
}

export interface DeploymentEnvironmentShape {
  name?: string;
  protection_rules?: Array<{ type?: string; reviewers?: unknown[] }>;
}

export interface DeploymentEnvironmentsShape {
  environments?: DeploymentEnvironmentShape[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateRulesetSummary(input: unknown): ValidationResult<RuleSummaryEntry[]> {
  if (!Array.isArray(input)) {
    return { ok: false, reason: `rulesetSummary: expected array, got ${typeof input}` };
  }
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    if (!isPlainObject(raw)) {
      return { ok: false, reason: `rulesetSummary[${i}]: expected object` };
    }
    if (typeof raw.type !== 'string') {
      return { ok: false, reason: `rulesetSummary[${i}]: missing string field "type"` };
    }
    if (raw.parameters !== undefined && !isPlainObject(raw.parameters)) {
      return { ok: false, reason: `rulesetSummary[${i}]: "parameters" must be object` };
    }
  }
  return { ok: true, value: input as RuleSummaryEntry[] };
}

export function validateBranchProtection(input: unknown): ValidationResult<BranchProtectionShape> {
  if (!isPlainObject(input)) {
    return { ok: false, reason: `branchProtection: expected object, got ${typeof input}` };
  }
  if (input.required_status_checks !== undefined && !isPlainObject(input.required_status_checks)) {
    return { ok: false, reason: 'branchProtection: required_status_checks must be object' };
  }
  if (
    input.required_pull_request_reviews !== undefined &&
    !isPlainObject(input.required_pull_request_reviews)
  ) {
    return {
      ok: false,
      reason: 'branchProtection: required_pull_request_reviews must be object',
    };
  }
  return { ok: true, value: input as BranchProtectionShape };
}

export function validateRepoMetadata(input: unknown): ValidationResult<RepoMetadataShape> {
  if (!isPlainObject(input)) {
    return { ok: false, reason: `repoMetadata: expected object, got ${typeof input}` };
  }
  if (input.security_and_analysis !== undefined && !isPlainObject(input.security_and_analysis)) {
    return { ok: false, reason: 'repoMetadata: security_and_analysis must be object' };
  }
  return { ok: true, value: input as RepoMetadataShape };
}

export function validateDependabotAlertsList(input: unknown): ValidationResult<unknown[]> {
  if (!Array.isArray(input)) {
    return { ok: false, reason: `dependabotAlerts: expected array, got ${typeof input}` };
  }
  return { ok: true, value: input };
}

export function validateEnvironmentsList(
  input: unknown,
): ValidationResult<DeploymentEnvironmentsShape> {
  if (!isPlainObject(input)) {
    return { ok: false, reason: `environments: expected object, got ${typeof input}` };
  }
  if (input.environments !== undefined && !Array.isArray(input.environments)) {
    return { ok: false, reason: 'environments: "environments" field must be array' };
  }
  if (Array.isArray(input.environments)) {
    for (let i = 0; i < input.environments.length; i++) {
      const e = input.environments[i];
      if (!isPlainObject(e)) {
        return { ok: false, reason: `environments[${i}]: expected object` };
      }
      if (e.protection_rules !== undefined && !Array.isArray(e.protection_rules)) {
        return { ok: false, reason: `environments[${i}].protection_rules: expected array` };
      }
    }
  }
  return { ok: true, value: input as DeploymentEnvironmentsShape };
}

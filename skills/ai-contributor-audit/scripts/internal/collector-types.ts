// SPDX-License-Identifier: Apache-2.0
//
// Shared evidence and rule contracts for audit-collect.

import type { HostedSettings } from './collector-hosted-settings.ts';

export type RuleStatus = 'Fulfilled' | 'Warning' | 'Alarm' | 'Not relevant' | null;

export interface CommandRun {
  cmd: string;
  cwd?: string;
  exit_code: number | null;
  duration_ms: number;
  stdout_excerpt: string;
  stderr_excerpt?: string;
  kind?: 'shell' | 'gh_api';
  response_summary?: unknown;
}

export interface RuleEvidence {
  spec_rule_name: string;
  applicability: {
    verdict: 'applicable' | 'not_applicable' | 'unknown';
    trigger_evidence: string;
  };
  commands: CommandRun[];
  derived_status: RuleStatus;
  derivation_reason: string;
  judgment_required: boolean;
  // AIC IDs whose checklist row Status is determined by this rule's
  // `derived_status` when `judgment_required: false`. The validator joins
  // on these IDs directly (no naming heuristic). Empty array when the rule
  // does not deterministically map to any specific AIC ID.
  aic_ids: string[];
  raw_artefact_refs?: string[];
  errors?: string[];
}

export type ProfileAnswerValue = 'yes' | 'no' | '';

export interface ProfileAnswer {
  question_id: string;
  question: string;
  answer: ProfileAnswerValue;
  owner_evidence: string;
  evidence_kind: 'owner_attestation' | 'collector_default';
  evidence_use: 'applicability';
  affected_aic_ids: string[];
  source_line: number;
}

export interface ProfileEvidence {
  path: string;
  present: boolean;
  default_policy: 'owner_profile' | 'all_checks_on_when_missing' | 'all_checks_on_when_empty';
  answers: ProfileAnswer[];
  warnings: string[];
  errors: string[];
}

export interface AiSurfaceInventory {
  instruction_files: string[];
  rule_files: string[];
  skill_files: string[];
  prompt_files: string[];
  mcp_config_files: string[];
  ai_sdk_deps: Array<{ name: string; manifest: string }>;
}

export type ApplicabilityShape =
  | 'package'
  | 'service'
  | 'web-ui'
  | 'cli'
  | 'library'
  | 'containerized'
  | 'deploying';

export interface ApplicabilityHints {
  shapes: ApplicabilityShape[];
  signals_by_shape: Record<ApplicabilityShape, string[]>;
}

export interface InstructionPointerFact {
  path: string;
  classification: 'pointer-only' | 'divergent' | 'ambiguous';
  similarity_to_canonical: number;
  char_count: number;
  links_to_canonical: boolean;
}

export interface InstructionQualityHints {
  canonical_file: string | null;
  canonical_referenced_in_doc: string | null;
  pointer_files: InstructionPointerFact[];
  forbidden_actions_present: boolean;
  forbidden_actions_evidence: string | null;
}

export interface McpServerFact {
  name: string;
  source_file: string;
  command: string | null;
  args: string[];
  package: string | null;
  package_version: string | null;
  version_pinned: boolean;
  roots: string[];
  env_refs: string[];
  transport: string | null;
  read_only_signal: boolean;
}

export interface McpInventory {
  servers: McpServerFact[];
}

export interface PromptSkillEntry {
  path: string;
  kind: 'prompt' | 'skill';
  tracked: boolean;
  under_reviewable_path: boolean;
  version_pinned: boolean;
  has_usage_doc: boolean;
}

export interface AiAuthorshipTrailEntry {
  sha: string;
  matched_authors: string[];
}

export interface AiAuthorshipTrail {
  window: number;
  total_commits_scanned: number;
  ai_authored: AiAuthorshipTrailEntry[];
  ratio: number;
  most_recent_ai_sha: string | null;
}

export interface BootstrapSmokeStep {
  label: string;
  cmd: string;
  exit_code: number | null;
  duration_ms: number;
  stdout_excerpt: string;
  stderr_excerpt: string;
  timed_out: boolean;
}

export interface BootstrapSmokeEvidence {
  enabled: boolean;
  ran: boolean;
  reason: string;
  clone_dir: string | null;
  total_duration_ms: number;
  steps: BootstrapSmokeStep[];
}

export interface Evidence {
  $schema_version: '1';
  audit_collect_version: string;
  spec_version: string | null;
  spec_source: string | null;
  // ISO 8601 timestamp captured at the very start of the collector run.
  // The validator reads this back when stamping audit-log frontmatter so
  // the LLM agent never has to invent `assessment_started_at`.
  assessment_started_at: string;
  target: {
    path: string;
    audited_commit: string;
    default_branch: string | null;
    host: { kind: string; owner: string | null; repo: string | null };
    mode: 'sha-pinned' | 'working-tree';
  };
  preflight: {
    started_at: string;
    completed_at?: string;
    extracted_to: string | null;
    original_worktree_status: string;
    node_modules_cache_hit: boolean | null;
    tools_available: Record<string, string | null>;
    executor: {
      package: string;
      version: string;
      pin: string;
      pin_kind: 'npm-exact-version';
      invocation: string;
      node_version: string;
      entrypoint: string;
    };
  };
  stack: {
    detected: string[];
    evidence: Array<{ file: string; field?: string; value?: string }>;
  };
  scope_inventory: {
    units: Array<{ id: string; path: string; manifest: string }>;
    deliberately_excluded: string[];
  };
  profile: ProfileEvidence;
  github_api: {
    token_tier:
      | 'none'
      | 'api_identity_verified_scopes_unknown'
      | 'audit_read_only'
      | 'broad_write_capable';
    active_login: string | null;
    scopes_observed: string[];
    auth_status_excerpt: string;
  };
  ai_surface_inventory: AiSurfaceInventory;
  applicability_hints: ApplicabilityHints;
  instruction_quality_hints: InstructionQualityHints;
  mcp_inventory: McpInventory;
  prompt_skill_inventory: PromptSkillEntry[];
  ai_authorship_trail: AiAuthorshipTrail;
  hosted_settings: HostedSettings;
  bootstrap_smoke: BootstrapSmokeEvidence;
  rules: Record<string, RuleEvidence>;
  errors: Array<{ stage: string; detail: string }>;
}

#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect.ts — deterministic evidence collector for the AI Contributor
// Specification audit. Pins a commit, extracts it via `git worktree add`, runs
// canonical commands, and emits .ai-contributor-audit/AI-CONTRIBUTOR-EVIDENCE.json. The audit skill
// consumes that file to fill the checklist; rules with derived_status set are
// not re-judged.
//
// Reproducibility property: two runs against the same audited_commit produce
// byte-identical AI-CONTRIBUTOR-EVIDENCE.json modulo `started_at`,
// `completed_at`, and per-command `duration_ms`. Differences anywhere else
// are bugs.
//
// The audit skill bootstraps this script and its shipped sibling modules from
// the pinned `spec_source` ref, then runs it via `npx --yes tsx@4.21.0`.
// Keep imports limited to node:* builtins and shipped sibling modules; npm
// dependencies silently break that bootstrap path.
//
// Usage:
//   tsx audit-collect.ts <target-repo-path> \
//     [--commit <sha>] [--out <path>] [--working-tree] \
//     [--no-network] [--authorship-window <n>] \
//     [--enable-bootstrap-smoke] [--bootstrap-smoke-timeout-ms <n>]
//
// Exit codes:
//   0  collection complete (any rule status fine, including derivation errors)
//   2  CLI / preflight failed (target not a repo, sha resolve failed)
//   3  partial collection (any rule's commands errored or timed out)

import path from 'node:path';
import { readJsoncOrNull } from './internal/collector-runtime.ts';
import { COLLECTOR_RULE_IDS, type CollectorRuleId } from './internal/collector-registry.ts';
import type { Evidence, RuleEvidence } from './internal/collector-types.ts';
import {
  COLLECTOR_USAGE,
  evidenceSummary,
  parseCollectorCliArgs,
  runCollectorRules,
  writeEvidence,
  type CollectorRule,
} from './internal/collector-run.ts';
import { createGithubActionsRules } from './internal/collector-rules-github-actions.ts';
import { createBootstrapRules } from './internal/collector-rules-bootstrap.ts';
import { createAuthorshipRules } from './internal/collector-rules-authorship.ts';
import { createMcpRules } from './internal/collector-rules-mcp.ts';
import { createPromptRules } from './internal/collector-rules-prompt.ts';
import { createCodeownersRules } from './internal/collector-rules-codeowners.ts';
import { createTestRules } from './internal/collector-rules-tests.ts';
import { createFormattingRules } from './internal/collector-rules-formatting.ts';
import { createGuardrailDocRules } from './internal/collector-rules-guardrail-doc.ts';
import { createAiInstructionRules } from './internal/collector-rules-ai-instructions.ts';
import { createSecretHygieneRules } from './internal/collector-rules-secret-hygiene.ts';
import { createCodeQualityRules } from './internal/collector-rules-code-quality.ts';
import { createPolicyDocsRules } from './internal/collector-rules-policy-docs.ts';
import { createPackageBaselineRules } from './internal/collector-rules-package-baseline.ts';
import { createSurfaceInventory } from './internal/collector-surface-inventory.ts';
import { createWorkflowHelpers } from './internal/collector-workflow-helpers.ts';
import { createProfileEvidence } from './internal/collector-profile.ts';
import { createGithubApiContext } from './internal/collector-github-api.ts';
import { createGithubHostedRules } from './internal/collector-rules-github-hosted.ts';
import { discoverStackScope } from './internal/collector-stack-scope.ts';
import { createCollectorLocalRuntime } from './internal/collector-local-runtime.ts';
import { setupCollectorWorktree } from './internal/collector-worktree.ts';

// Bumped whenever the collector's evidence shape or rule set changes.
// Recorded in audit frontmatter as `collector_version` so two runs can be
// compared knowing they were produced by the same evidence shape.
export const COLLECTOR_VERSION = '0.1.0';
const TSX_EXECUTOR_PACKAGE = 'tsx';
const TSX_EXECUTOR_VERSION = '4.21.0';
const TSX_EXECUTOR_PIN = `${TSX_EXECUTOR_PACKAGE}@${TSX_EXECUTOR_VERSION}`;

// --------------------------------------------------------------------------
// CLI

const DEFAULT_AUDIT_DIR = '.ai-contributor-audit';
const parsedCli = parseCollectorCliArgs(process.argv.slice(2), DEFAULT_AUDIT_DIR);
if ('error' in parsedCli) {
  console.error(COLLECTOR_USAGE);
  process.exit(2);
}

const TARGET = parsedCli.target;
const PROFILE_REL = path.join(DEFAULT_AUDIT_DIR, 'AI-CONTRIBUTOR-AUDIT-PROFILE.md');
const OUT = parsedCli.out;
const COMMIT_OPT = parsedCli.commit;
const WORKING_TREE_MODE = parsedCli.workingTree;
const NO_NETWORK = parsedCli.noNetwork;
const AUTHORSHIP_WINDOW = parsedCli.authorshipWindow;
const BOOTSTRAP_SMOKE_ENABLED = parsedCli.bootstrapSmokeEnabled;
const BOOTSTRAP_SMOKE_TIMEOUT_MS = parsedCli.bootstrapSmokeTimeoutMs;

// --------------------------------------------------------------------------
// Helpers

const VERSION = COLLECTOR_VERSION;
const STARTED_AT = new Date();
const COLLECTION_ERRORS: Evidence['errors'] = [];
let activeWorkTreeRoot: string | null = null;
const localRuntime = createCollectorLocalRuntime({
  defaultAuditDir: DEFAULT_AUDIT_DIR,
  getWorkTreeRoot: () => activeWorkTreeRoot,
});
const {
  run,
  runQuiet,
  detectTools,
  trackedFiles,
  readTrackedFile,
  lineNumberFor,
  readSpecVersionFromChecklist,
} = localRuntime;

function fail(code: number, msg: string): never {
  console.error(`[audit-collect] ${msg}`);
  process.exit(code);
}

// --------------------------------------------------------------------------
// Preflight: pin commit, extract worktree

const worktreeSetup = setupCollectorWorktree({
  target: TARGET,
  commitOpt: COMMIT_OPT,
  workingTreeMode: WORKING_TREE_MODE,
  runQuiet,
});
if ('error' in worktreeSetup) fail(2, worktreeSetup.error);
const { auditedCommit, originalStatus, workTreeRoot, extractedTo, linkNodeModulesCache } =
  worktreeSetup;
activeWorkTreeRoot = workTreeRoot;

process.on('exit', worktreeSetup.cleanup);
process.on('SIGINT', () => {
  worktreeSetup.cleanup();
  process.exit(130);
});

// --------------------------------------------------------------------------
// Tools available

const tools: Record<string, string | null> = detectTools(
  ['node', 'pnpm', 'npm', 'gh', 'git'] as const,
  workTreeRoot,
);

// --------------------------------------------------------------------------
// Stack detection and scope inventory

const stackScope = discoverStackScope({ workTreeRoot, runQuiet });
const { detected, stackEvidence, inventoryUnits } = stackScope;

// Pnpm workspaces often materialize package-local executable links under
// apps/<name>/node_modules or packages/<name>/node_modules. Reuse those caches
// in the extracted SHA-pinned tree too; otherwise `pnpm -r type-check` can fail
// only because package-local binaries are absent from the temporary worktree.
for (const unit of inventoryUnits) {
  if (unit.path !== '.') linkNodeModulesCache(unit.path);
}

const profileContext = createProfileEvidence({
  workTreeRoot,
  defaultAuditDir: DEFAULT_AUDIT_DIR,
  profileRel: PROFILE_REL,
});
const profile = profileContext.profile;
for (const warning of profile.warnings) {
  console.error(`[audit-collect] profile warning: ${warning}`);
}
for (const error of profile.errors) {
  console.error(`[audit-collect] profile error: ${error}`);
  COLLECTION_ERRORS.push({ stage: 'profile', detail: error });
}

// --------------------------------------------------------------------------
// GitHub API: token-tier detection + repo metadata

const githubContext = createGithubApiContext({
  target: TARGET,
  tools,
  noNetwork: NO_NETWORK,
  runQuiet,
});
const { ghApi, owner, repo, defaultBranch, ghApiCall, withTokenTierCaveat } = githubContext;

// --------------------------------------------------------------------------
// Run rules

const workflowHelpers = createWorkflowHelpers({
  workTreeRoot,
  defaultBranch: () => defaultBranch,
  trackedFiles,
});
const {
  readWorkflows,
  yamlBlockAfterKey,
  workflowTriggersPullRequest,
  workflowTriggersDefaultBranchPush,
  hasDependencyManifest,
  hasSastSupportedSource,
  requiredChecksFromRulesetSummary,
  requiredChecksInclude,
} = workflowHelpers;
const githubActionsRules = createGithubActionsRules({ readWorkflows, yamlBlockAfterKey });
const surfaceInventory = createSurfaceInventory({
  trackedFiles,
  readTrackedFile,
  readPackageJson: (rel) => readJsoncOrNull(path.join(workTreeRoot, rel)),
});
const bootstrapRules = createBootstrapRules({
  workTreeRoot,
  tools,
  enabled: BOOTSTRAP_SMOKE_ENABLED,
  timeoutMs: BOOTSTRAP_SMOKE_TIMEOUT_MS,
});
const authorshipRules = createAuthorshipRules({
  workTreeRoot,
  authorshipWindow: AUTHORSHIP_WINDOW,
  runQuiet,
});
const mcpRules = createMcpRules({
  workTreeRoot,
  mcpConfigFiles: () => surfaceInventory.buildAiSurfaceInventory().mcp_config_files,
  readTrackedFile,
});
const promptRules = createPromptRules({
  promptFiles: () => surfaceInventory.buildAiSurfaceInventory().prompt_files,
  skillFiles: () => surfaceInventory.buildAiSurfaceInventory().skill_files,
  trackedFiles,
  readTrackedFile,
});
const codeownersRules = createCodeownersRules({ trackedFiles, readTrackedFile });
const testRules = createTestRules({ trackedFiles, readTrackedFile });
const codeQualityRules = createCodeQualityRules({
  trackedFiles,
  readTrackedFile,
  readPackageJson: (rel) => readJsoncOrNull(path.join(workTreeRoot, rel)),
  workflowActionFacts: githubActionsRules.workflowActionFacts,
});
const formattingRules = createFormattingRules({
  trackedFiles,
  trackedDeps: codeQualityRules.trackedDeps,
  workflowActionFacts: githubActionsRules.workflowActionFacts,
  readTrackedFile,
  readPackageJson: (rel) => readJsoncOrNull(path.join(workTreeRoot, rel)),
});
const aiInstructionRules = createAiInstructionRules({
  instructionFiles: () => surfaceInventory.buildAiSurfaceInventory().instruction_files,
  readTrackedFile,
});
const guardrailDocRules = createGuardrailDocRules({
  trackedFiles,
  readTrackedFile,
  buildInstructionQualityHints: aiInstructionRules.buildInstructionQualityHints,
});
const secretHygieneRules = createSecretHygieneRules({
  trackedFiles,
  readTrackedFile,
  lineNumberFor,
});
const policyDocsRules = createPolicyDocsRules({
  trackedFiles,
  readTrackedFile,
  lineNumberFor,
});
const packageBaselineRules = createPackageBaselineRules({
  workTreeRoot,
  inventoryUnits: () => inventoryUnits,
  detected: () => detected,
  run,
  readJsoncFile: readJsoncOrNull,
});
const githubHostedRules = createGithubHostedRules({
  owner,
  repo,
  defaultBranch,
  noNetwork: NO_NETWORK,
  startedAtIso: STARTED_AT.toISOString(),
  workTreeRoot,
  tools,
  inventoryUnits: () => inventoryUnits,
  ghApiCall,
  run,
  withTokenTierCaveat,
  readWorkflows,
  workflowTriggersPullRequest,
  workflowTriggersDefaultBranchPush,
  hasDependencyManifest,
  hasSastSupportedSource,
  requiredChecksFromRulesetSummary,
  requiredChecksInclude,
  profileNoAnswerForAic: profileContext.profileNoAnswerForAic,
  profileNotRelevantReason: profileContext.profileNotRelevantReason,
  documentedPushProtectionPlanExclusion: profileContext.documentedPushProtectionPlanExclusion,
  documentedDeployApprovalsPlanExclusion: profileContext.documentedDeployApprovalsPlanExclusion,
});
const RULE_FUNCTIONS: Record<CollectorRuleId, () => RuleEvidence> = {
  'lockfile-integrity': packageBaselineRules.ruleLockfileIntegrity,
  'lint-rules': packageBaselineRules.ruleLintRules,
  'strict-types': packageBaselineRules.ruleStrictTypes,
  'pinned-toolchain': packageBaselineRules.rulePinnedToolchain,
  'pre-commit': packageBaselineRules.rulePreCommit,
  'automated-dependency-updates': packageBaselineRules.ruleAutomatedDependencyUpdates,
  'gate-enforcement': githubActionsRules.ruleGateEnforcement,
  'branch-protection': githubHostedRules.ruleBranchProtection,
  'ci-gates': githubHostedRules.ruleCiGates,
  'human-review-required': githubHostedRules.ruleHumanReviewRequired,
  'secret-scanning': githubHostedRules.ruleSecretScanning,
  'push-protection': githubHostedRules.rulePushProtection,
  'dependency-security': githubHostedRules.ruleDependencySecurity,
  'dependency-review-visibility': githubHostedRules.ruleDependencyReviewVisibility,
  'sast-in-ci': githubHostedRules.ruleSastInCi,
  'security-policy-documented': policyDocsRules.ruleSecurityPolicyDocumented,
  'threat-model-documented': policyDocsRules.ruleThreatModelDocumented,
  'build-immutable-refs': githubActionsRules.ruleBuildImmutableRefs,
  'workflow-token-least-privilege': githubActionsRules.ruleWorkflowTokenLeastPrivilege,
  'sbom-generation': githubActionsRules.ruleSbomGeneration,
  'artifact-signing': githubActionsRules.ruleArtifactSigning,
  'build-provenance-attestation': githubActionsRules.ruleBuildProvenanceAttestation,
  'release-from-ci': githubActionsRules.ruleReleaseFromCi,
  'dead-code-and-cycles-surfaced': codeQualityRules.ruleDeadCodeAndCyclesSurfaced,
  'architecture-rules-automated': codeQualityRules.ruleArchitectureRulesAutomated,
  'credential-leakage-checks': codeQualityRules.ruleCredentialLeakageChecks,
  'secret-vcs-exclude': secretHygieneRules.ruleSecretVcsExclude,
  'credential-handling-documented': secretHygieneRules.ruleCredentialHandlingDocumented,
  'env-example-placeholders': secretHygieneRules.ruleEnvExamplePlaceholders,
  'ai-instruction-authoritative': aiInstructionRules.ruleAiInstructionAuthoritative,
  'tool-specific-pointer-only': aiInstructionRules.ruleToolSpecificPointerOnly,
  'ai-forbidden-actions': aiInstructionRules.ruleAiForbiddenActions,
  'mcp-root-scoping': mcpRules.ruleMcpRootScoping,
  'mcp-pinned-versions': mcpRules.ruleMcpPinnedVersions,
  'mcp-read-only-default': mcpRules.ruleMcpReadOnlyDefault,
  'prompt-audit-trail': promptRules.rulePromptAuditTrail,
  'sensitive-path-ownership': codeownersRules.ruleSensitivePathOwnership,
  'multiple-test-layers': testRules.ruleMultipleTestLayers,
  'coverage-as-minimum': testRules.ruleCoverageAsMinimum,
  'formatting-automated': formattingRules.ruleFormattingAutomated,
  'authoritative-guardrail-doc': guardrailDocRules.ruleAuthoritativeGuardrailDoc,
  'ai-authorship-traceability': authorshipRules.ruleAiAuthorshipTraceability,
  'deploy-env-approvals': githubHostedRules.ruleDeployEnvApprovals,
  'clean-clone-bootstrap': bootstrapRules.ruleCleanCloneBootstrap,
};
const ruleEntries: CollectorRule[] = COLLECTOR_RULE_IDS.map(
  (id) => [id, RULE_FUNCTIONS[id]] as const,
);
const rules = runCollectorRules(ruleEntries, (stage, detail) => {
  COLLECTION_ERRORS.push({ stage, detail });
});

// --------------------------------------------------------------------------
// Emit AI-CONTRIBUTOR-EVIDENCE.json

const evidence: Evidence = {
  $schema_version: '1',
  audit_collect_version: VERSION,
  spec_version: readSpecVersionFromChecklist(workTreeRoot),
  spec_source: null,
  assessment_started_at: STARTED_AT.toISOString(),
  target: {
    path: TARGET,
    audited_commit: WORKING_TREE_MODE ? `working-tree:HEAD=${auditedCommit}+dirty` : auditedCommit,
    default_branch: defaultBranch,
    host: { kind: githubContext.hostKind, owner, repo },
    mode: WORKING_TREE_MODE ? 'working-tree' : 'sha-pinned',
  },
  preflight: {
    started_at: STARTED_AT.toISOString(),
    completed_at: new Date().toISOString(),
    extracted_to: extractedTo,
    original_worktree_status: originalStatus,
    // Only meaningful in sha-pinned mode where the collector links the
    // original worktree's node_modules into the extracted tree. In
    // --working-tree mode the field is N/A (the working tree's
    // node_modules is whatever the developer has, not a "cache hit"),
    // so we report null instead of misleading-false.
    node_modules_cache_hit: extractedTo ? worktreeSetup.nodeModulesCacheLinks() > 0 : null,
    tools_available: tools,
    executor: {
      package: TSX_EXECUTOR_PACKAGE,
      version: TSX_EXECUTOR_VERSION,
      pin: TSX_EXECUTOR_PIN,
      pin_kind: 'npm-exact-version',
      invocation: `npx --yes ${TSX_EXECUTOR_PIN}`,
      node_version: process.version,
      entrypoint: path.basename(process.argv[1] ?? 'audit-collect.ts'),
    },
  },
  stack: { detected, evidence: stackEvidence },
  scope_inventory: { units: inventoryUnits, deliberately_excluded: [] },
  profile,
  github_api: ghApi,
  ai_surface_inventory: surfaceInventory.buildAiSurfaceInventory(),
  applicability_hints: surfaceInventory.buildApplicabilityHints(),
  instruction_quality_hints: aiInstructionRules.buildInstructionQualityHints(),
  mcp_inventory: mcpRules.buildMcpInventory(),
  prompt_skill_inventory: promptRules.buildPromptSkillInventory(),
  ai_authorship_trail: authorshipRules.buildAiAuthorshipTrail(),
  hosted_settings: githubHostedRules.buildHostedSettings(),
  bootstrap_smoke: bootstrapRules.buildBootstrapSmoke(),
  rules,
  errors: COLLECTION_ERRORS,
};

writeEvidence(OUT, evidence);

// Summary to stderr (stdout reserved for future machine-readable summary).
console.error(
  evidenceSummary({
    out: OUT,
    rules,
    auditedCommit,
    mode: evidence.target.mode,
    tokenTier: ghApi.token_tier,
  }),
);

process.exit(COLLECTION_ERRORS.length ? 3 : 0);

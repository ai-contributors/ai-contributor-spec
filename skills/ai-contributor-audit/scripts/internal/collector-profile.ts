// SPDX-License-Identifier: Apache-2.0
//
// Owner audit profile parsing for audit-collect.

import fs from 'node:fs';
import path from 'node:path';
import type { ProfileAnswer, ProfileAnswerValue, ProfileEvidence } from './collector-types.ts';

export interface CollectorProfileDeps {
  workTreeRoot: string;
  defaultAuditDir: string;
  profileRel: string;
}

export interface ProfileQuestion {
  id: string;
  area: string;
  question: string;
  affectedAicIds: readonly string[];
  affectedRender: string;
}

export const PROFILE_QUESTIONS: ReadonlyArray<ProfileQuestion> = [
  {
    id: 'env-required',
    area: 'Technology shape',
    question: 'Apply environment-variable template checks?',
    affectedAicIds: ['AIC-env-example-placeholders'],
    affectedRender: '`Env Template` - `AIC-env-example-placeholders`',
  },
  {
    id: 'ui-a11y',
    area: 'Technology shape',
    question: 'Apply user-interface and accessibility checks?',
    affectedAicIds: [
      'AIC-a11y-component-checks',
      'AIC-a11y-review-testing',
      'AIC-a11y-helpers',
      'AIC-a11y-keyboard-focus',
      'AIC-a11y-extra-gates',
      'AIC-performance-budgets',
      'AIC-budgets-automated',
    ],
    affectedRender:
      '`Accessibility` - `AIC-a11y-component-checks`, `AIC-a11y-review-testing`; `A11y Helpers` - `AIC-a11y-helpers`; `A11y Keyboard Focus` - `AIC-a11y-keyboard-focus`; `Additional A11y Gates` - `AIC-a11y-extra-gates`; `Performance Budget` - `AIC-performance-budgets`; `Performance Budgets Automated` - `AIC-budgets-automated`',
  },
  {
    id: 'runtime-critical',
    area: 'Technology shape',
    question: 'Apply backend, proxy, worker, or critical-runtime checks?',
    affectedAicIds: [
      'AIC-reliability-expectations',
      'AIC-reliability-consequences',
      'AIC-observability-redaction',
      'AIC-failure-handling-explicit',
      'AIC-retries-backoff-deliberate',
    ],
    affectedRender:
      '`Reliability Targets` - `AIC-reliability-expectations`; `Error Budgets` - `AIC-reliability-consequences`; `Observability` - `AIC-observability-redaction`; `Failure Handling` - `AIC-failure-handling-explicit`, `AIC-retries-backoff-deliberate`',
  },
  {
    id: 'persistence-layer',
    area: 'Technology shape',
    question: 'Apply database schema and persistence-layer checks?',
    affectedAicIds: ['AIC-data-integrity-constraints'],
    affectedRender: '`Data Integrity Constraints` - `AIC-data-integrity-constraints`',
  },
  {
    id: 'host-push-protection',
    area: 'Hosting shape',
    question: 'Apply hosted push-time secret blocking checks?',
    affectedAicIds: ['AIC-push-protection-enabled'],
    affectedRender: '`Push Protection` - `AIC-push-protection-enabled`',
  },
  {
    id: 'host-deploy-env-approvals',
    area: 'Hosting shape',
    question: 'Apply hosted deployment-environment required-reviewer checks?',
    affectedAicIds: ['AIC-deploy-env-approvals'],
    affectedRender: '`Deployment Protection Rules` - `AIC-deploy-env-approvals`',
  },
  {
    id: 'build-sbom-discipline',
    area: 'Use case',
    question: 'Apply build/release dependency identification and SBOM checks?',
    affectedAicIds: ['AIC-sbom-generation', 'AIC-release-dependency-identification'],
    affectedRender: '`SBOM` - `AIC-sbom-generation`, `AIC-release-dependency-identification`',
  },
  {
    id: 'external-supply-chain-trust',
    area: 'Use case',
    question:
      'Apply external-consumer supply-chain trust checks (provenance attestations, artifact signing, immutable build linkage)?',
    affectedAicIds: [
      'AIC-build-provenance-attestation',
      'AIC-artifact-signing',
      'AIC-build-immutable-refs',
    ],
    affectedRender:
      '`Build Origin Records` - `AIC-build-provenance-attestation`, `AIC-build-immutable-refs`; `Artifact Signing` - `AIC-artifact-signing`',
  },
  {
    id: 'ci-cd-deploy-creds',
    area: 'Use case',
    question: 'Apply CI/CD workflow and deployment-credential checks?',
    affectedAicIds: [
      'AIC-workflow-token-least-privilege',
      'AIC-short-lived-deploy-creds',
      'AIC-prod-deploy-protected',
      'AIC-deploy-env-approvals',
      'AIC-deployment-separation',
      'AIC-release-from-ci',
    ],
    affectedRender:
      '`Workflow Security` - `AIC-workflow-token-least-privilege`, `AIC-short-lived-deploy-creds`; `Deployment Protection` - `AIC-prod-deploy-protected`; `Deployment Protection Rules` - `AIC-deploy-env-approvals`; `Deployment Separation` - `AIC-deployment-separation`; `Release from CI` - `AIC-release-from-ci`',
  },
  {
    id: 'external-contrib-disclosure',
    area: 'Collaboration shape',
    question: 'Apply external-contribution disclosure checks?',
    affectedAicIds: ['AIC-ai-authorship-disclosure-policy'],
    affectedRender: '`AI Authorship Disclosure` - `AIC-ai-authorship-disclosure-policy`',
  },
  {
    id: 'ai-provider-allowlist',
    area: 'AI shape',
    question: 'Apply external AI provider and model allowlist checks?',
    affectedAicIds: [
      'AIC-ai-provider-allowlist',
      'AIC-regulated-data-provider-gate',
      'AIC-provider-deprecation-procedure',
      'AIC-no-routing-past-eol',
      'AIC-allowlist-rescope-on-terms-change',
    ],
    affectedRender:
      '`AI Provider Allowlist` - `AIC-ai-provider-allowlist`; `AI Provider Data Gate` - `AIC-regulated-data-provider-gate`; `Provider Deprecation Procedure` - `AIC-provider-deprecation-procedure`; `No Routing Past EOL` - `AIC-no-routing-past-eol`; `Allowlist Rescope on Terms Change` - `AIC-allowlist-rescope-on-terms-change`',
  },
  {
    id: 'ai-context-retention',
    area: 'AI shape',
    question: 'Apply retained AI prompt, transcript, and tool-output checks?',
    affectedAicIds: [
      'AIC-ai-context-retention',
      'AIC-prompt-audit-trail',
      'AIC-ai-input-retention',
    ],
    affectedRender:
      '`AI Context Retention` - `AIC-ai-context-retention`; `Prompt Audit Trail` - `AIC-prompt-audit-trail`; `AI Input Retention` - `AIC-ai-input-retention`',
  },
  {
    id: 'mcp-servers',
    area: 'AI shape',
    question: 'Apply MCP server checks?',
    affectedAicIds: [
      'AIC-mcp-root-scoping',
      'AIC-mcp-read-only-default',
      'AIC-mcp-pinned-versions',
      'AIC-mcp-env-separation',
      'AIC-mcp-root-prompt',
      'AIC-mcp-prompt-review',
      'AIC-mcp-auditability',
    ],
    affectedRender:
      '`MCP Root Scoping` - `AIC-mcp-root-scoping`; `MCP Read-Only Default` - `AIC-mcp-read-only-default`; `MCP Pinned Versions` - `AIC-mcp-pinned-versions`; `MCP Env Separation` - `AIC-mcp-env-separation`; `MCP Root Prompt` - `AIC-mcp-root-prompt`; `MCP Prompt Review` - `AIC-mcp-prompt-review`; `MCP Auditability` - `AIC-mcp-auditability`',
  },
  {
    id: 'autonomous-runners',
    area: 'AI shape',
    question: 'Apply autonomous-agent and scheduled-runner checks?',
    affectedAicIds: [
      'AIC-agent-escalation-trigger-enforcement',
      'AIC-agent-kill-switch',
      'AIC-agent-rollback-procedure',
      'AIC-agent-behavior-monitoring',
      'AIC-agent-cost-ceiling',
    ],
    affectedRender:
      '`Agent Escalation Triggers` - `AIC-agent-escalation-trigger-enforcement`; `Agent Kill Switch` - `AIC-agent-kill-switch`; `Agent Rollback Procedure` - `AIC-agent-rollback-procedure`; `Agent Behavior Monitoring` - `AIC-agent-behavior-monitoring`; `Agent Cost Ceiling` - `AIC-agent-cost-ceiling`',
  },
  {
    id: 'ai-dependency',
    area: 'AI shape',
    question: 'Apply AI-introduced dependency checks?',
    affectedAicIds: ['AIC-ai-dependency-verification', 'AIC-strict-new-dep-policy'],
    affectedRender:
      '`AI Dependency Verification` - `AIC-ai-dependency-verification`; `Strict New Dependency Policy` - `AIC-strict-new-dep-policy`',
  },
  {
    id: 'regulated-ai-data',
    area: 'Data and risk shape',
    question: 'Apply regulated, secret, customer, or production-data AI workflow checks?',
    affectedAicIds: [
      'AIC-ai-data-classification',
      'AIC-regulated-data-provider-gate',
      'AIC-ai-prod-data-readonly',
      'AIC-data-minimization-techniques',
    ],
    affectedRender:
      '`AI Data Classification` - `AIC-ai-data-classification`; `AI Provider Data Gate` - `AIC-regulated-data-provider-gate`; `AI Prod Data Read-Only` - `AIC-ai-prod-data-readonly`; `Data Minimization Techniques` - `AIC-data-minimization-techniques`',
  },
];

const PROFILE_QUESTION_BY_TEXT = new Map(PROFILE_QUESTIONS.map((q) => [q.question, q]));
const PROFILE_AFFECTED_IDS = new Set(PROFILE_QUESTIONS.flatMap((q) => [...q.affectedAicIds]));

function normalizeProfileAnswer(answer: string): ProfileAnswerValue | null {
  const normalized = answer.trim().toLowerCase();
  if (normalized === '') return '';
  if (normalized === 'yes' || normalized === 'no') return normalized;
  return null;
}

function splitMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const inner = trimmed.slice(1, -1);
  const cells: string[] = [];
  let cell = '';
  let escaped = false;
  for (const ch of inner) {
    if (escaped) {
      cell += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '|') {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

function idsFromMarkdown(cell: string): string[] {
  const out: string[] = [];
  const re = /\bAIC-[a-z0-9-]+\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cell))) {
    if (!out.includes(m[0])) out.push(m[0]);
  }
  return out;
}

export function createProfileEvidence(deps: CollectorProfileDeps): {
  profile: ProfileEvidence;
  profileNoAnswerForAic: (aicId: string) => ProfileAnswer | null;
  profileNotRelevantReason: (answer: ProfileAnswer) => string;
  documentedPushProtectionPlanExclusion: () => string | null;
  documentedDeployApprovalsPlanExclusion: () => string | null;
} {
  function checklistAicIds(): Set<string> | null {
    const checklistPath = path.join(
      deps.workTreeRoot,
      deps.defaultAuditDir,
      'AI-CONTRIBUTOR-CHECKLIST.md',
    );
    if (!fs.existsSync(checklistPath)) return null;
    return new Set(idsFromMarkdown(fs.readFileSync(checklistPath, 'utf8')));
  }

  function readProfileEvidence(): ProfileEvidence {
    const profile: ProfileEvidence = {
      path: deps.profileRel.split(path.sep).join('/'),
      present: false,
      default_policy: 'owner_profile',
      answers: [],
      warnings: [],
      errors: [],
    };
    const abs = path.join(deps.workTreeRoot, deps.profileRel);
    if (!fs.existsSync(abs)) {
      profile.default_policy = 'all_checks_on_when_missing';
      profile.answers = PROFILE_QUESTIONS.map((q) => ({
        question_id: q.id,
        question: q.question,
        answer: 'yes',
        owner_evidence: `Collector default: ${profile.path} is missing, so all profile-controlled checks remain enabled.`,
        evidence_kind: 'collector_default',
        evidence_use: 'applicability',
        affected_aic_ids: [...q.affectedAicIds],
        source_line: 0,
      }));
      profile.warnings.push(
        `applicability profile not found at ${profile.path}; all profile-controlled checks remain enabled`,
      );
      return profile;
    }

    profile.present = true;
    const checklistIds = checklistAicIds();
    const text = fs.readFileSync(abs, 'utf8');
    const seenQuestions = new Set<string>();

    for (const [idx, line] of text.split(/\r?\n/).entries()) {
      const sourceLine = idx + 1;
      const cells = splitMarkdownTableRow(line);
      if (!cells || cells.length < 5) continue;
      const [dimension, question, answerRaw, ownerEvidence, affectedCell] = cells;
      if (dimension === 'Dimension' || /^-+$/.test(dimension.replace(/\s/g, ''))) continue;
      if (!question || question === 'Question') continue;

      const canonical = PROFILE_QUESTION_BY_TEXT.get(question);
      if (!canonical) {
        profile.warnings.push(`line ${sourceLine}: unsupported profile question "${question}"`);
        continue;
      }
      if (seenQuestions.has(question)) {
        profile.warnings.push(`line ${sourceLine}: duplicate profile question "${question}"`);
      }
      seenQuestions.add(question);

      const answer = normalizeProfileAnswer(answerRaw);
      if (answer === null) {
        profile.errors.push(
          `line ${sourceLine}: invalid answer "${answerRaw}" for "${question}"; use "yes", "no", or blank`,
        );
        continue;
      }

      let affectedAicIds = idsFromMarkdown(affectedCell);
      if (affectedAicIds.length === 0) {
        profile.warnings.push(
          `line ${sourceLine}: no affected AIC IDs listed for "${question}"; using canonical mapping`,
        );
        affectedAicIds = [...canonical.affectedAicIds];
      }

      const expected = new Set(canonical.affectedAicIds);
      const extra = affectedAicIds.filter((id) => !expected.has(id));
      const missing = [...expected].filter((id) => !affectedAicIds.includes(id));
      if (extra.length || missing.length) {
        profile.warnings.push(
          `line ${sourceLine}: affected IDs for "${question}" differ from canonical mapping` +
            `${extra.length ? `; extra=${extra.join(',')}` : ''}` +
            `${missing.length ? `; missing=${missing.join(',')}` : ''}`,
        );
      }

      for (const id of affectedAicIds) {
        const presentInChecklist = checklistIds
          ? checklistIds.has(id)
          : PROFILE_AFFECTED_IDS.has(id);
        if (!presentInChecklist) {
          profile.errors.push(
            `line ${sourceLine}: affected AIC ID ${id} is not present in the checklist`,
          );
        }
      }

      profile.answers.push({
        question_id: canonical.id,
        question,
        answer,
        owner_evidence: ownerEvidence,
        evidence_kind: 'owner_attestation',
        evidence_use: 'applicability',
        affected_aic_ids: affectedAicIds,
        source_line: sourceLine,
      });
    }

    const explicitAnswers = profile.answers.filter((a) => a.answer === 'yes' || a.answer === 'no');
    if (explicitAnswers.length === 0) {
      profile.default_policy = 'all_checks_on_when_empty';
      profile.answers = PROFILE_QUESTIONS.map((q) => ({
        question_id: q.id,
        question: q.question,
        answer: 'yes',
        owner_evidence: `Collector default: ${profile.path} has no explicit yes/no answers, so all profile-controlled checks remain enabled.`,
        evidence_kind: 'collector_default',
        evidence_use: 'applicability',
        affected_aic_ids: [...q.affectedAicIds],
        source_line: 0,
      }));
      profile.warnings.push(
        `applicability profile at ${profile.path} has no explicit yes/no answers; all profile-controlled checks remain enabled`,
      );
      return profile;
    }

    const answered = new Set(profile.answers.map((a) => a.question));
    for (const q of PROFILE_QUESTIONS) {
      if (!answered.has(q.question)) {
        profile.warnings.push(`missing profile question "${q.question}"`);
      }
    }

    return profile;
  }

  const profile = readProfileEvidence();

  function profileNoAnswerForAic(aicId: string): ProfileAnswer | null {
    return (
      profile.answers
        .filter(
          (answer) =>
            answer.answer === 'no' &&
            answer.evidence_use === 'applicability' &&
            answer.affected_aic_ids.includes(aicId),
        )
        .sort((a, b) => a.question_id.localeCompare(b.question_id))[0] ?? null
    );
  }

  function profileNotRelevantReason(answer: ProfileAnswer): string {
    const evidence = answer.owner_evidence.trim();
    return (
      `owner profile \`${profile.path}:${answer.source_line}\` answers "no" to "${answer.question}", ` +
      `so this check is not applicable` +
      (evidence ? `; profile evidence: "${evidence}"` : '; profile evidence: none provided')
    );
  }

  function documentedPushProtectionPlanExclusion(): string | null {
    const candidates = [
      'AGENTS.md',
      path.join('.github', 'AGENTS.md'),
      'SECURITY.md',
      path.join('.github', 'SECURITY.md'),
    ];
    for (const rel of candidates) {
      const abs = path.join(deps.workTreeRoot, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf8');
      const saysPushProtection =
        /push[- ]?(time )?(secret )?(protection|blocking)|push protection/i.test(content);
      const saysPlanExclusion =
        /plan[- ]tier|GitHub Secret Protection|GitHub Advanced Security|GHAS/i.test(content) ||
        /(private|personal|user-owned).{0,80}(cannot|can't|unavailable|not available|not supported|unsupported)/i.test(
          content,
        ) ||
        /(cannot|can't|unavailable|not available|not supported|unsupported).{0,80}(private|personal|user-owned)/i.test(
          content,
        );
      const saysFallback = /secretlint|gitleaks|trufflehog|ggshield|blocking fallback/i.test(
        content,
      );
      if (saysPushProtection && saysPlanExclusion && saysFallback) {
        return (
          `policy document \`${rel.replace(/\\/g, '/')}\` states hosted push protection is unavailable ` +
          'because of hosting plan or account tier and names a local blocking secret-scan fallback'
        );
      }
    }
    return null;
  }

  function documentedDeployApprovalsPlanExclusion(): string | null {
    const candidates = [
      'AGENTS.md',
      path.join('.github', 'AGENTS.md'),
      'SECURITY.md',
      path.join('.github', 'SECURITY.md'),
    ];
    for (const rel of candidates) {
      const abs = path.join(deps.workTreeRoot, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf8');
      const saysDeployApprovals =
        /deployment[- ]?(environment )?(required )?reviewers?|environment (protection|reviewers?)|deployment protection rules/i.test(
          content,
        );
      const saysPlanExclusion =
        /plan[- ]tier|GitHub Team|GitHub Enterprise|GHE/i.test(content) ||
        /(private|personal|user-owned).{0,80}(cannot|can't|unavailable|not available|not supported|unsupported)/i.test(
          content,
        ) ||
        /(cannot|can't|unavailable|not available|not supported|unsupported).{0,80}(private|personal|user-owned)/i.test(
          content,
        );
      const saysCompensatingControl =
        /workflow_dispatch[- ]only|tag[- ]only deploy|sole[- ]owner|repository_owner|github\.actor\s*==|branch protection .{0,40}(default|main|production)/i.test(
          content,
        );
      if (saysDeployApprovals && saysPlanExclusion && saysCompensatingControl) {
        return (
          `policy document \`${rel.replace(/\\/g, '/')}\` states hosted deployment-environment required reviewers are unavailable ` +
          'because of hosting plan or account tier and names a compensating control'
        );
      }
    }
    return null;
  }

  return {
    profile,
    profileNoAnswerForAic,
    profileNotRelevantReason,
    documentedPushProtectionPlanExclusion,
    documentedDeployApprovalsPlanExclusion,
  };
}

// SPDX-License-Identifier: Apache-2.0
//
// Prompt/skill inventory and prompt audit trail rule for audit-collect.

import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { PromptSkillEntry, RuleEvidence } from './collector-types.ts';

export interface PromptRuleDeps {
  promptFiles: () => string[];
  skillFiles: () => string[];
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
}

const NON_REVIEWABLE_PREFIXES: readonly string[] = [
  '.archive/',
  '__archive__/',
  'vendor/',
  'node_modules/',
  '.git/',
];

const PROMPT_AUDIT_KEYWORDS =
  /(prompt\s+log|prompt\s+audit\s+trail|transcript\s+(?:log|location|path|directory)|co-?authored-?by|model\s+identifier|prompt\s+version|skill\s+version)/i;
const PROMPT_AUDIT_PATHS = [
  '.ai-prompts/',
  'docs/prompt-log',
  'docs/ai-prompt',
  '.claude/transcripts/',
  '.codex/transcripts/',
  'audit/prompts',
];

export function createPromptRules(deps: PromptRuleDeps): {
  buildPromptSkillInventory: () => PromptSkillEntry[];
  rulePromptAuditTrail: () => RuleEvidence;
} {
  let promptSkillInventoryCache: PromptSkillEntry[] | null = null;

  function collectDocCorpus(): Array<{ rel: string; text: string }> {
    const candidates = [
      'README.md',
      'CONTRIBUTING.md',
      '.github/CONTRIBUTING.md',
      'AGENTS.md',
      '.github/AGENTS.md',
      'CLAUDE.md',
      'GEMINI.md',
      'SECURITY.md',
    ];
    const out: Array<{ rel: string; text: string }> = [];
    for (const rel of candidates) {
      const text = deps.readTrackedFile(rel);
      if (text) out.push({ rel, text });
    }
    for (const rel of deps.trackedFiles()) {
      if (rel.startsWith('docs/') && rel.endsWith('.md')) {
        const text = deps.readTrackedFile(rel);
        if (text) out.push({ rel, text });
      }
    }
    return out;
  }

  function buildPromptSkillInventory(): PromptSkillEntry[] {
    if (promptSkillInventoryCache) return promptSkillInventoryCache;
    const promptFiles = deps.promptFiles();
    const promptSet = new Set(promptFiles);
    const tracked = new Set(deps.trackedFiles());
    const entries: PromptSkillEntry[] = [];
    const docCorpus = collectDocCorpus();
    for (const f of [...promptFiles, ...deps.skillFiles()]) {
      const kind: PromptSkillEntry['kind'] = promptSet.has(f) ? 'prompt' : 'skill';
      const isTracked = tracked.has(f);
      const under_reviewable_path = !NON_REVIEWABLE_PREFIXES.some((p) => f.startsWith(p));
      const text = deps.readTrackedFile(f) ?? '';
      const version_pinned =
        /\b(?:version|skill[_-]?version|prompt[_-]?version)\s*[:=]\s*['"]?[\d.]+/i.test(
          text.slice(0, 800),
        ) || /v\d+\.\d+/.test(path.basename(f));
      const has_usage_doc = docCorpus.some((doc) => doc.text.includes(f));
      entries.push({
        path: f,
        kind,
        tracked: isTracked,
        under_reviewable_path,
        version_pinned,
        has_usage_doc,
      });
    }
    promptSkillInventoryCache = entries.sort((a, b) => a.path.localeCompare(b.path));
    return promptSkillInventoryCache;
  }

  function rulePromptAuditTrail(): RuleEvidence {
    const docCorpus = collectDocCorpus();
    const docHits: Array<{ rel: string; snippet: string }> = [];
    for (const doc of docCorpus) {
      const m = doc.text.match(PROMPT_AUDIT_KEYWORDS);
      if (m) docHits.push({ rel: doc.rel, snippet: m[0]! });
    }
    const trackedPathHits: string[] = [];
    for (const rel of deps.trackedFiles()) {
      for (const p of PROMPT_AUDIT_PATHS) {
        if (rel.startsWith(p) || rel === p.replace(/\/$/, '')) {
          if (!trackedPathHits.includes(p)) trackedPathHits.push(p);
        }
      }
    }
    const inv = buildPromptSkillInventory();
    const untrackedPrompts = inv.filter((e) => e.kind === 'prompt' && !e.tracked);
    if (docHits.length === 0 && trackedPathHits.length === 0) {
      return {
        spec_rule_name: 'Prompt Audit Trail',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${inv.length} prompt/skill file(s); ${docCorpus.length} doc(s) scanned`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          'no doc-corpus mention of prompt/transcript audit trail and no tracked path under known audit-trail locations',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['prompt-audit-trail']!,
      };
    }
    if (untrackedPrompts.length > 0) {
      return {
        spec_rule_name: 'Prompt Audit Trail',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${inv.length} prompt/skill file(s)`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `${docHits.length > 0 ? `${docHits[0]!.rel} mentions audit trail ("${docHits[0]!.snippet}")` : `tracked path: ${trackedPathHits.join(', ')}`}; but ${untrackedPrompts.length} prompt file(s) untracked`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['prompt-audit-trail']!,
      };
    }
    const reasons: string[] = [];
    if (docHits.length > 0)
      reasons.push(
        `doc references: ${docHits
          .slice(0, 2)
          .map((h) => `${h.rel} ("${h.snippet}")`)
          .join('; ')}`,
      );
    if (trackedPathHits.length > 0) reasons.push(`tracked path(s): ${trackedPathHits.join(', ')}`);
    return {
      spec_rule_name: 'Prompt Audit Trail',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${inv.length} prompt/skill file(s); ${docCorpus.length} doc(s) scanned`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: reasons.join('; '),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['prompt-audit-trail']!,
    };
  }

  return { buildPromptSkillInventory, rulePromptAuditTrail };
}

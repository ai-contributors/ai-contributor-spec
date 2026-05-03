// SPDX-License-Identifier: Apache-2.0
//
// AI authorship traceability evidence and rule for audit-collect.

import { RULE_AIC_IDS } from './collector-registry.ts';
import type { AiAuthorshipTrail, AiAuthorshipTrailEntry, RuleEvidence } from './collector-types.ts';

export interface AuthorshipRuleDeps {
  workTreeRoot: string;
  authorshipWindow: number;
  runQuiet: (cmd: string, args: string[], cwd: string) => string;
}

const AI_AUTHOR_RES: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: 'Claude', re: /\bclaude\b/i },
  { label: 'GPT/ChatGPT/OpenAI', re: /\b(?:openai|chatgpt|gpt[-_ ]?\d*)\b/i },
  { label: 'GitHub Copilot', re: /\b(?:github[-\s]?copilot|copilot[-\s]?(?:agent|coding))\b/i },
  { label: 'Gemini', re: /\bgemini\b/i },
  { label: 'Cursor', re: /\bcursor\b/i },
  { label: 'Codex', re: /\bcodex\b/i },
  { label: 'Devin', re: /\bdevin\b/i },
];

export function createAuthorshipRules(deps: AuthorshipRuleDeps): {
  buildAiAuthorshipTrail: () => AiAuthorshipTrail;
  ruleAiAuthorshipTraceability: () => RuleEvidence;
} {
  let aiAuthorshipTrailCache: AiAuthorshipTrail | null = null;

  function buildAiAuthorshipTrail(): AiAuthorshipTrail {
    if (aiAuthorshipTrailCache) return aiAuthorshipTrailCache;
    // `git log --no-color --pretty=format:%H%x00%B%x1e -n <N>` produces
    // SHA, NUL, full commit message body, RS — easy to split deterministically.
    const raw = deps.runQuiet(
      'git',
      [
        '-C',
        deps.workTreeRoot,
        'log',
        '--no-color',
        '-n',
        String(deps.authorshipWindow),
        '--pretty=format:%H%x00%B%x1e',
        'HEAD',
      ],
      deps.workTreeRoot,
    );
    const ai_authored: AiAuthorshipTrailEntry[] = [];
    let total = 0;
    if (raw) {
      for (const block of raw.split('\x1e')) {
        const trimmed = block.replace(/^\n/, '');
        if (!trimmed) continue;
        const sep = trimmed.indexOf('\x00');
        if (sep < 0) continue;
        total++;
        const sha = trimmed.slice(0, sep);
        const body = trimmed.slice(sep + 1);
        const trailers: string[] = [];
        for (const ln of body.split(/\r?\n/)) {
          const m = ln.match(/^Co-Authored-By:\s*(.+?)\s*$/i);
          if (m) trailers.push(m[1]!);
        }
        const matched = new Set<string>();
        for (const t of trailers) {
          for (const a of AI_AUTHOR_RES) {
            if (a.re.test(t)) matched.add(a.label);
          }
        }
        if (matched.size > 0) {
          ai_authored.push({ sha, matched_authors: [...matched].sort() });
        }
      }
    }
    const ratio = total > 0 ? Math.round((ai_authored.length / total) * 1000) / 1000 : 0;
    aiAuthorshipTrailCache = {
      window: deps.authorshipWindow,
      total_commits_scanned: total,
      ai_authored,
      ratio,
      most_recent_ai_sha: ai_authored[0]?.sha ?? null,
    };
    return aiAuthorshipTrailCache;
  }

  function ruleAiAuthorshipTraceability(): RuleEvidence {
    const trail = buildAiAuthorshipTrail();
    if (trail.total_commits_scanned === 0) {
      return {
        spec_rule_name: 'AI Authorship Traceability',
        applicability: {
          verdict: 'unknown',
          trigger_evidence: 'no commits reachable from audited_commit',
        },
        commands: [],
        derived_status: null,
        derivation_reason: 'git log returned no commits',
        judgment_required: true,
        aic_ids: RULE_AIC_IDS['ai-authorship-traceability']!,
      };
    }
    if (trail.ai_authored.length === 0) {
      return {
        spec_rule_name: 'AI Authorship Traceability',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `last ${trail.total_commits_scanned} commit(s)`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `no \`Co-Authored-By:\` trailer matching known AI authors (Claude, GPT, Copilot, Gemini, Cursor, Codex, Devin) across last ${trail.total_commits_scanned} commit(s); if AI materially authors here, the traceability mechanism is not exercised`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['ai-authorship-traceability']!,
      };
    }
    const labels = new Set<string>();
    for (const e of trail.ai_authored) for (const a of e.matched_authors) labels.add(a);
    return {
      spec_rule_name: 'AI Authorship Traceability',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `last ${trail.total_commits_scanned} commit(s)`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `${trail.ai_authored.length}/${trail.total_commits_scanned} commits carry an AI Co-Authored-By trailer (ratio=${trail.ratio}); models: ${[...labels].sort().join(', ')}; most recent: ${trail.most_recent_ai_sha?.slice(0, 8) ?? 'n/a'}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['ai-authorship-traceability']!,
    };
  }

  return { buildAiAuthorshipTrail, ruleAiAuthorshipTraceability };
}

// SPDX-License-Identifier: Apache-2.0
//
// AI instruction quality hints and rules for audit-collect.

import { RULE_AIC_IDS } from './collector-registry.ts';
import type { InstructionQualityHints, RuleEvidence } from './collector-types.ts';

export interface AiInstructionRuleDeps {
  instructionFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
}

type InstructionClassification = 'pointer-only' | 'divergent' | 'ambiguous';

function shingleSet(text: string, n = 5): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) {
    out.add(words.slice(i, i + n).join(' '));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const FORBIDDEN_ACTIONS_RE =
  /(^|\n)\s*(?:#+\s*)?(?:do not|never|must not|forbidden|don'?t|do\snot\s+run|disallowed|prohibited)\b[^\n]{0,200}/i;

export function createAiInstructionRules(deps: AiInstructionRuleDeps): {
  buildInstructionQualityHints: () => InstructionQualityHints;
  ruleAiInstructionAuthoritative: () => RuleEvidence;
  ruleToolSpecificPointerOnly: () => RuleEvidence;
  ruleAiForbiddenActions: () => RuleEvidence;
} {
  let instructionQualityCache: InstructionQualityHints | null = null;

  function buildInstructionQualityHints(): InstructionQualityHints {
    if (instructionQualityCache) return instructionQualityCache;
    const files = deps.instructionFiles();
    const out: InstructionQualityHints = {
      canonical_file: null,
      canonical_referenced_in_doc: null,
      pointer_files: [],
      forbidden_actions_present: false,
      forbidden_actions_evidence: null,
    };
    if (files.length === 0) {
      instructionQualityCache = out;
      return out;
    }
    const contents = new Map<string, string>();
    for (const f of files) {
      contents.set(f, deps.readTrackedFile(f) ?? '');
    }
    const ranked = [...files].sort((a, b) => {
      const la = (contents.get(a) ?? '').length;
      const lb = (contents.get(b) ?? '').length;
      if (la !== lb) return lb - la;
      return a.localeCompare(b);
    });
    out.canonical_file = ranked[0]!;
    const canonicalText = contents.get(out.canonical_file) ?? '';
    const canonicalShingles = shingleSet(canonicalText);

    for (const f of files) {
      if (f === out.canonical_file) continue;
      const text = contents.get(f) ?? '';
      const sim = jaccard(canonicalShingles, shingleSet(text));
      const linksToCanonical = canonicalText.length > 0 && text.includes(out.canonical_file);
      let classification: InstructionClassification;
      if (text.length <= 800 && (linksToCanonical || /see\s+(?:also\s+)?\S+\.md/i.test(text))) {
        classification = 'pointer-only';
      } else if (sim >= 0.4) {
        classification = 'divergent';
      } else {
        classification = 'ambiguous';
      }
      out.pointer_files.push({
        path: f,
        classification,
        similarity_to_canonical: Math.round(sim * 1000) / 1000,
        char_count: text.length,
        links_to_canonical: linksToCanonical,
      });
    }

    for (const rel of ['README.md', 'CONTRIBUTING.md', '.github/CONTRIBUTING.md']) {
      const text = deps.readTrackedFile(rel);
      if (text && out.canonical_file && text.includes(out.canonical_file)) {
        out.canonical_referenced_in_doc = rel;
        break;
      }
    }

    if (canonicalText) {
      const m = canonicalText.match(FORBIDDEN_ACTIONS_RE);
      if (m) {
        out.forbidden_actions_present = true;
        out.forbidden_actions_evidence = m[0]!.trim().slice(0, 160);
      }
    }
    instructionQualityCache = out;
    return out;
  }

  function ruleAiInstructionAuthoritative(): RuleEvidence {
    const hints = buildInstructionQualityHints();
    if (!hints.canonical_file) {
      return {
        spec_rule_name: 'AI Instruction Authoritative',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: 'no AI instruction files detected',
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          'no AGENTS.md / CLAUDE.md / GEMINI.md / copilot-instructions / .cursorrules in tracked tree',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['ai-instruction-authoritative']!,
      };
    }
    const divergent = hints.pointer_files.filter((p) => p.classification === 'divergent');
    if (divergent.length > 0) {
      return {
        spec_rule_name: 'AI Instruction Authoritative',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `canonical: ${hints.canonical_file}`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `multiple canonical-length instruction file(s) detected: ${divergent.map((d) => `${d.path} (sim=${d.similarity_to_canonical})`).join(', ')}; collapse to one authoritative source`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['ai-instruction-authoritative']!,
      };
    }
    return {
      spec_rule_name: 'AI Instruction Authoritative',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `canonical: ${hints.canonical_file}`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason:
        `single authoritative instruction file: ${hints.canonical_file}` +
        (hints.pointer_files.length > 0 ? `; ${hints.pointer_files.length} pointer file(s)` : ''),
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['ai-instruction-authoritative']!,
    };
  }

  function ruleToolSpecificPointerOnly(): RuleEvidence {
    const hints = buildInstructionQualityHints();
    if (!hints.canonical_file) {
      return {
        spec_rule_name: 'Tool-Specific Pointer Only',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: 'no AI instruction files detected',
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: 'cannot evaluate pointer-only without a canonical instruction file',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['tool-specific-pointer-only']!,
      };
    }
    const ambiguous = hints.pointer_files.filter((p) => p.classification !== 'pointer-only');
    if (ambiguous.length > 0) {
      return {
        spec_rule_name: 'Tool-Specific Pointer Only',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `canonical: ${hints.canonical_file}`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `non-pointer instruction file(s) alongside ${hints.canonical_file}: ${ambiguous.map((p) => `${p.path} (${p.classification}, sim=${p.similarity_to_canonical})`).join(', ')}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['tool-specific-pointer-only']!,
      };
    }
    if (!hints.canonical_referenced_in_doc) {
      return {
        spec_rule_name: 'Tool-Specific Pointer Only',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `canonical: ${hints.canonical_file}`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `${hints.canonical_file} is canonical but not referenced from README.md or CONTRIBUTING.md`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['tool-specific-pointer-only']!,
      };
    }
    return {
      spec_rule_name: 'Tool-Specific Pointer Only',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `canonical: ${hints.canonical_file}`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `${hints.canonical_file} referenced from ${hints.canonical_referenced_in_doc}; ${hints.pointer_files.length} pointer file(s) all classified pointer-only`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['tool-specific-pointer-only']!,
    };
  }

  function ruleAiForbiddenActions(): RuleEvidence {
    const hints = buildInstructionQualityHints();
    if (!hints.canonical_file) {
      return {
        spec_rule_name: 'AI Forbidden Actions',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: 'no AI instruction files detected',
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          'no canonical instruction file; cannot evaluate forbidden-actions section',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['ai-forbidden-actions']!,
      };
    }
    return {
      spec_rule_name: 'AI Forbidden Actions',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `canonical: ${hints.canonical_file}`,
      },
      commands: [],
      derived_status: hints.forbidden_actions_present ? 'Fulfilled' : 'Warning',
      derivation_reason: hints.forbidden_actions_present
        ? `${hints.canonical_file} contains forbidden-actions language: "${hints.forbidden_actions_evidence}"`
        : `${hints.canonical_file} does not contain "do not" / "never" / "must not" forbidden-action directives`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['ai-forbidden-actions']!,
    };
  }

  return {
    buildInstructionQualityHints,
    ruleAiInstructionAuthoritative,
    ruleToolSpecificPointerOnly,
    ruleAiForbiddenActions,
  };
}

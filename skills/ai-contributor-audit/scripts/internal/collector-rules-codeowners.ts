// SPDX-License-Identifier: Apache-2.0
//
// CODEOWNERS-sensitive-path ownership rule for audit-collect.

import { RULE_AIC_IDS } from './collector-registry.ts';
import type { RuleEvidence } from './collector-types.ts';

export interface CodeownersRuleDeps {
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
}

interface CodeownersRule {
  pattern: string;
  owners: string[];
  line: number;
}

const SENSITIVE_PATH_PATTERNS: ReadonlyArray<{
  label: string;
  rePattern: RegExp;
  matchTracked: (rel: string) => boolean;
}> = [
  {
    label: '.github/workflows',
    rePattern: /^(\/?\.github\/workflows\/?\*?\*?|\/?workflows\/)/,
    matchTracked: (rel) => rel.startsWith('.github/workflows/'),
  },
  {
    label: 'infra/',
    rePattern: /^\/?(infra|infrastructure)\/?/,
    matchTracked: (rel) => rel.startsWith('infra/') || rel.startsWith('infrastructure/'),
  },
  {
    label: 'terraform/',
    rePattern: /^\/?terraform\/?/,
    matchTracked: (rel) => rel.startsWith('terraform/'),
  },
  {
    label: 'migrations/',
    rePattern: /^\/?(migrations|db\/migrations)\/?/,
    matchTracked: (rel) => /(^|\/)migrations\//.test(rel),
  },
  { label: 'db/', rePattern: /^\/?db\/?/, matchTracked: (rel) => rel.startsWith('db/') },
  {
    label: 'charts/',
    rePattern: /^\/?(charts|helm)\/?/,
    matchTracked: (rel) => rel.startsWith('charts/') || rel.startsWith('helm/'),
  },
  {
    label: 'Dockerfile*',
    rePattern: /Dockerfile/,
    matchTracked: (rel) => /(^|\/)Dockerfile(\..+)?$/.test(rel),
  },
];

export function createCodeownersRules(deps: CodeownersRuleDeps): {
  ruleSensitivePathOwnership: () => RuleEvidence;
} {
  function parseCodeowners(content: string): CodeownersRule[] {
    const rules: CodeownersRule[] = [];
    content.split(/\r?\n/).forEach((line, idx) => {
      const noComment = line.replace(/(^|\s)#.*$/, '').trim();
      if (!noComment) return;
      const parts = noComment.split(/\s+/);
      const pattern = parts[0]!;
      const owners = parts.slice(1).filter(Boolean);
      rules.push({ pattern, owners, line: idx + 1 });
    });
    return rules;
  }

  function findCodeownersFile(): { rel: string; content: string } | null {
    for (const rel of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
      const content = deps.readTrackedFile(rel);
      if (content) return { rel, content };
    }
    return null;
  }

  function ruleSensitivePathOwnership(): RuleEvidence {
    const file = findCodeownersFile();
    if (!file) {
      return {
        spec_rule_name: 'Sensitive Path Ownership',
        applicability: { verdict: 'applicable', trigger_evidence: 'no CODEOWNERS file' },
        commands: [],
        derived_status: 'Alarm',
        derivation_reason:
          'no CODEOWNERS file found at .github/CODEOWNERS, CODEOWNERS, or docs/CODEOWNERS',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['sensitive-path-ownership']!,
      };
    }
    const rules = parseCodeowners(file.content).filter((r) => r.owners.length > 0);
    const tracked = deps.trackedFiles();
    const uncovered: string[] = [];
    for (const sp of SENSITIVE_PATH_PATTERNS) {
      const trackedHasIt = tracked.some((rel) => sp.matchTracked(rel));
      if (!trackedHasIt) continue;
      const covered = rules.some((r) => sp.rePattern.test(r.pattern));
      if (!covered) uncovered.push(sp.label);
    }
    if (uncovered.length === 0) {
      return {
        spec_rule_name: 'Sensitive Path Ownership',
        applicability: { verdict: 'applicable', trigger_evidence: `${file.rel}` },
        commands: [],
        derived_status: 'Fulfilled',
        derivation_reason: `${file.rel} covers every tracked sensitive path with at least one owner`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['sensitive-path-ownership']!,
      };
    }
    return {
      spec_rule_name: 'Sensitive Path Ownership',
      applicability: { verdict: 'applicable', trigger_evidence: `${file.rel}` },
      commands: [],
      derived_status: 'Warning',
      derivation_reason: `${file.rel} does not assign owners for tracked sensitive path(s): ${uncovered.join(', ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['sensitive-path-ownership']!,
    };
  }

  return { ruleSensitivePathOwnership };
}

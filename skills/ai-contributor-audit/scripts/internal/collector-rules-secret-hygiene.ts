// SPDX-License-Identifier: Apache-2.0
//
// Repository secret hygiene rules for audit-collect.

import { RULE_AIC_IDS } from './collector-registry.ts';
import type { RuleEvidence } from './collector-types.ts';

export interface SecretHygieneRuleDeps {
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
  lineNumberFor: (text: string, pattern: RegExp) => number | null;
}

const SECRET_FILE_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /(^|\/)\.env$/, label: '.env' },
  { re: /(^|\/)\.env\.(?!example$|sample$|template$|dist$)[^/]+$/, label: '.env.<env>' },
  { re: /\.pem$/, label: '*.pem' },
  { re: /\.pfx$/, label: '*.pfx' },
  { re: /\.p12$/, label: '*.p12' },
  { re: /(^|\/)id_rsa(\.pub)?$/, label: 'id_rsa' },
  { re: /(^|\/)id_ed25519(\.pub)?$/, label: 'id_ed25519' },
  { re: /(^|\/)service-account[^/]*\.json$/, label: 'service-account*.json' },
  { re: /(^|\/)gcp-key[^/]*\.json$/, label: 'gcp-key*.json' },
];

const GITIGNORE_PROTECTIVE_PATTERNS: readonly string[] = [
  '.env',
  '*.pem',
  'id_rsa',
  '*.pfx',
  'service-account',
];

export function createSecretHygieneRules(deps: SecretHygieneRuleDeps): {
  ruleSecretVcsExclude: () => RuleEvidence;
  ruleCredentialHandlingDocumented: () => RuleEvidence;
  ruleEnvExamplePlaceholders: () => RuleEvidence;
} {
  function ruleSecretVcsExclude(): RuleEvidence {
    const tracked = deps.trackedFiles();
    const offenders: Array<{ rel: string; label: string }> = [];
    for (const rel of tracked) {
      for (const p of SECRET_FILE_PATTERNS) {
        if (p.re.test(rel)) {
          offenders.push({ rel, label: p.label });
          break;
        }
      }
    }

    const gitignore = deps.readTrackedFile('.gitignore') ?? '';
    const protective: string[] = [];
    for (const pat of GITIGNORE_PROTECTIVE_PATTERNS) {
      const re = new RegExp(`(^|\\n)\\s*${pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
      if (re.test(gitignore)) protective.push(pat);
    }

    if (offenders.length > 0) {
      return {
        spec_rule_name: 'Secret VCS Exclude',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${tracked.length} tracked file(s)`,
        },
        commands: [],
        derived_status: 'Alarm',
        derivation_reason: `tracked secret-bearing file(s): ${offenders
          .slice(0, 5)
          .map((o) => `${o.rel} (${o.label})`)
          .join('; ')}${offenders.length > 5 ? ` (+${offenders.length - 5} more)` : ''}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['secret-vcs-exclude']!,
      };
    }
    if (protective.length === 0) {
      return {
        spec_rule_name: 'Secret VCS Exclude',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${tracked.length} tracked file(s)`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          '.gitignore lacks protective patterns for `.env`, keys, service accounts; no tracked secrets but defense-in-depth missing',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['secret-vcs-exclude']!,
      };
    }
    return {
      spec_rule_name: 'Secret VCS Exclude',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${tracked.length} tracked file(s)`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `no tracked secret-bearing files; .gitignore protects ${protective.join(', ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['secret-vcs-exclude']!,
    };
  }

  function ruleCredentialHandlingDocumented(): RuleEvidence {
    const candidates = [
      'README.md',
      'CONTRIBUTING.md',
      '.github/CONTRIBUTING.md',
      'SECURITY.md',
      '.github/SECURITY.md',
      'AGENTS.md',
      '.github/AGENTS.md',
      'docs/credentials.md',
      'docs/secrets.md',
      'docs/onboarding.md',
    ];
    const subjectRe =
      /\b(secret(s)?|credential(s)?|api[ -]?key|env(?:ironment)?\s+variable|auth\s+token)\b/i;
    const guidanceRe =
      /\b(do not commit|never commit|store|rotate|share|secrets?\s+manager|vault|1password|doppler|aws\s+secrets|azure\s+key\s*vault|\.env\.example|placeholder)\b/i;
    for (const rel of candidates) {
      const content = deps.readTrackedFile(rel);
      if (!content) continue;
      if (subjectRe.test(content) && guidanceRe.test(content)) {
        const subject = content.match(subjectRe)?.[0] ?? 'credential';
        const guidance = content.match(guidanceRe)?.[0] ?? 'guidance';
        const line = deps.lineNumberFor(content, subjectRe) ?? 1;
        return {
          spec_rule_name: 'Credential Handling Documented',
          applicability: { verdict: 'applicable', trigger_evidence: 'docs corpus' },
          commands: [],
          derived_status: 'Fulfilled',
          derivation_reason: `${rel}:${line} documents credential handling (subject: "${subject}"; guidance: "${guidance}")`,
          judgment_required: false,
          raw_artefact_refs: [rel],
          aic_ids: RULE_AIC_IDS['credential-handling-documented']!,
        };
      }
    }
    return {
      spec_rule_name: 'Credential Handling Documented',
      applicability: { verdict: 'applicable', trigger_evidence: 'docs corpus' },
      commands: [],
      derived_status: 'Warning',
      derivation_reason:
        'no doc (README/CONTRIBUTING/SECURITY/AGENTS/docs) documents credential handling with both subject and operational guidance',
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['credential-handling-documented']!,
    };
  }

  function ruleEnvExamplePlaceholders(): RuleEvidence {
    const tracked = deps.trackedFiles();
    const examples = tracked.filter((rel) =>
      /(^|\/)\.env\.(example|sample|template|dist)$/.test(rel),
    );
    if (examples.length === 0) {
      return {
        spec_rule_name: 'Env Example Placeholders',
        applicability: { verdict: 'applicable', trigger_evidence: 'tracked files' },
        commands: [],
        derived_status: 'Warning',
        derivation_reason:
          'no `.env.example` / `.env.sample` / `.env.template` tracked; profile may mark Not relevant if env vars are not contributor-supplied',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['env-example-placeholders']!,
      };
    }
    const placeholderRe =
      /^[A-Z][A-Z0-9_]*\s*=\s*$|=\s*$|=\s*<[^>]*>|=\s*your[_-]|=\s*['"]?(?:placeholder|todo|change[-_]?me|example|xxx+|\.{3,})/i;
    const suspectRe = /=\s*[A-Za-z0-9+/_-]{16,}\s*$/;
    const offenders: Array<{ rel: string; line: number; sample: string }> = [];
    for (const rel of examples) {
      const text = deps.readTrackedFile(rel) ?? '';
      text.split(/\r?\n/).forEach((ln, idx) => {
        const trimmed = ln.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        if (!/=/.test(trimmed)) return;
        if (placeholderRe.test(trimmed)) return;
        if (suspectRe.test(trimmed)) {
          offenders.push({ rel, line: idx + 1, sample: trimmed.slice(0, 60) });
        }
      });
    }
    if (offenders.length > 0) {
      return {
        spec_rule_name: 'Env Example Placeholders',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${examples.length} env example file(s)`,
        },
        commands: [],
        derived_status: 'Warning',
        derivation_reason: `non-placeholder values in env example(s): ${offenders
          .slice(0, 3)
          .map((o) => `${o.rel}:${o.line}`)
          .join(', ')}${offenders.length > 3 ? ` (+${offenders.length - 3} more)` : ''}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['env-example-placeholders']!,
      };
    }
    return {
      spec_rule_name: 'Env Example Placeholders',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${examples.length} env example file(s)`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `every value in ${examples.join(', ')} matches a placeholder shape`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['env-example-placeholders']!,
    };
  }

  return { ruleSecretVcsExclude, ruleCredentialHandlingDocumented, ruleEnvExamplePlaceholders };
}

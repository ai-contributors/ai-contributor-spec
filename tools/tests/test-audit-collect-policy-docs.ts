#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for policy-docs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, REPO_ROOT } from './audit-collect-test-utils.ts';

let failed = 0;

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-l1-docs-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'SECURITY.md'),
      [
        '# Security Policy',
        '',
        'Report suspected vulnerabilities by opening a private GitHub Security Advisory or contacting security@example.invalid.',
        'We triage vulnerability reports within two business days.',
        '',
      ].join('\n'),
    );
    fs.mkdirSync(path.join(target, 'docs', 'security'), { recursive: true });
    fs.writeFileSync(
      path.join(target, 'docs', 'security', 'threat-model.md'),
      [
        '# Threat Model',
        '',
        'Review owner: security@example.invalid',
        'Last reviewed: 2026-05-01',
        '',
        '## Trust Boundaries',
        '',
        '- Browser to backend API boundary.',
        '',
        '## Threat Scenarios',
        '',
        '- Forged requests are mitigated by input validation controls.',
        '- Residual risk is reviewed during security changes.',
        '',
      ].join('\n'),
    );
    run('git', ['add', 'SECURITY.md', 'docs/security/threat-model.md'], target);
    run(
      'git',
      [
        '-c',
        'user.name=Audit Test',
        '-c',
        'user.email=audit@example.invalid',
        'commit',
        '-m',
        'add level 1 policy docs',
      ],
      target,
    );

    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      rules?: {
        'security-policy-documented'?: {
          derived_status?: string;
          judgment_required?: boolean;
          derivation_reason?: string;
          aic_ids?: string[];
        };
        'threat-model-documented'?: {
          derived_status?: string;
          judgment_required?: boolean;
          derivation_reason?: string;
          aic_ids?: string[];
        };
      };
    };
    const securityPolicy = evidence.rules?.['security-policy-documented'];
    const threatModel = evidence.rules?.['threat-model-documented'];
    if (
      securityPolicy?.derived_status !== 'Fulfilled' ||
      securityPolicy.judgment_required !== false ||
      !securityPolicy.derivation_reason?.includes('SECURITY.md:') ||
      !securityPolicy.aic_ids?.includes('AIC-vuln-disclosure-path')
    ) {
      failed++;
      console.error(
        `FAIL security policy doc was not collector-derived Fulfilled: ${JSON.stringify(securityPolicy)}`,
      );
    } else if (
      threatModel?.derived_status !== 'Fulfilled' ||
      threatModel.judgment_required !== false ||
      !threatModel.derivation_reason?.includes('docs/security/threat-model.md:') ||
      !threatModel.aic_ids?.includes('AIC-threat-model-review-date')
    ) {
      failed++;
      console.error(
        `FAIL threat model doc was not collector-derived Fulfilled: ${JSON.stringify(threatModel)}`,
      );
    } else {
      console.log('OK   level-1 policy docs are collector-derived Fulfilled');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-collect test(s) failed`);
  process.exit(1);
}
console.log('All audit-collect tests passed');

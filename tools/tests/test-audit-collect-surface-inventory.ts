#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for surface-inventory.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, initRepo, REPO_ROOT } from './audit-collect-test-utils.ts';

let failed = 0;

// ai-surface-inventory + applicability-hints (evidence-only)
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-surface-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    fs.mkdirSync(target, { recursive: true });
    run('git', ['init', '-b', 'main'], target);

    fs.writeFileSync(path.join(target, 'README.md'), '# surface fixture\n');
    fs.writeFileSync(path.join(target, 'AGENTS.md'), '# Agent instructions\n');
    fs.writeFileSync(path.join(target, 'CLAUDE.md'), '# Claude instructions\n');
    fs.mkdirSync(path.join(target, '.github'), { recursive: true });
    fs.writeFileSync(path.join(target, '.github', 'copilot-instructions.md'), '# copilot\n');
    fs.mkdirSync(path.join(target, '.cursor', 'rules'), { recursive: true });
    fs.writeFileSync(path.join(target, '.cursor', 'rules', 'strict.md'), 'rules\n');
    fs.mkdirSync(path.join(target, '.claude', 'skills', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(target, '.claude', 'skills', 'demo', 'SKILL.md'), 'skill\n');
    fs.mkdirSync(path.join(target, 'prompts'), { recursive: true });
    fs.writeFileSync(path.join(target, 'prompts', 'triage.md'), 'prompt\n');
    fs.writeFileSync(
      path.join(target, '.mcp.json'),
      JSON.stringify({ servers: { demo: { command: 'node' } } }),
    );
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({
        name: 'fixture-app',
        bin: { fixture: './bin/cli.js' },
        dependencies: { '@anthropic-ai/sdk': '^0.30.0', express: '^4.19.0', react: '^18.0.0' },
      }),
    );
    fs.writeFileSync(path.join(target, 'Dockerfile'), 'FROM node:24\n');
    fs.mkdirSync(path.join(target, 'terraform'), { recursive: true });
    fs.writeFileSync(path.join(target, 'terraform', 'main.tf'), '# tf\n');
    fs.mkdirSync(path.join(target, '.github', 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(target, '.github', 'workflows', 'deploy-prod.yml'),
      'name: deploy-prod\non: push\njobs: {}\n',
    );

    run('git', ['add', '-A'], target);
    run(
      'git',
      [
        '-c',
        'user.name=Audit Test',
        '-c',
        'user.email=audit@example.invalid',
        'commit',
        '-m',
        'init',
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
      ai_surface_inventory?: {
        instruction_files?: string[];
        rule_files?: string[];
        skill_files?: string[];
        prompt_files?: string[];
        mcp_config_files?: string[];
        ai_sdk_deps?: Array<{ name: string; manifest: string }>;
      };
      applicability_hints?: {
        shapes?: string[];
        signals_by_shape?: Record<string, string[]>;
      };
    };

    const inv = evidence.ai_surface_inventory;
    const expectInstr = ['.github/copilot-instructions.md', 'AGENTS.md', 'CLAUDE.md'];
    if (!inv) {
      failed++;
      console.error('FAIL ai_surface_inventory missing');
    } else if (JSON.stringify(inv.instruction_files) !== JSON.stringify(expectInstr)) {
      failed++;
      console.error(`FAIL instruction_files mismatch: ${JSON.stringify(inv.instruction_files)}`);
    } else if (!inv.rule_files?.includes('.cursor/rules/strict.md')) {
      failed++;
      console.error(
        `FAIL rule_files did not include cursor rule: ${JSON.stringify(inv.rule_files)}`,
      );
    } else if (!inv.skill_files?.includes('.claude/skills/demo/SKILL.md')) {
      failed++;
      console.error(
        `FAIL skill_files did not include claude skill: ${JSON.stringify(inv.skill_files)}`,
      );
    } else if (!inv.prompt_files?.includes('prompts/triage.md')) {
      failed++;
      console.error(
        `FAIL prompt_files did not include prompts/triage.md: ${JSON.stringify(inv.prompt_files)}`,
      );
    } else if (!inv.mcp_config_files?.includes('.mcp.json')) {
      failed++;
      console.error(
        `FAIL mcp_config_files missing .mcp.json: ${JSON.stringify(inv.mcp_config_files)}`,
      );
    } else if (
      !inv.ai_sdk_deps?.some((d) => d.name === '@anthropic-ai/sdk' && d.manifest === 'package.json')
    ) {
      failed++;
      console.error(
        `FAIL ai_sdk_deps missing @anthropic-ai/sdk: ${JSON.stringify(inv.ai_sdk_deps)}`,
      );
    } else {
      console.log('OK   ai_surface_inventory captured every file type and AI SDK dep');
    }

    const hints = evidence.applicability_hints;
    const expectShapes = ['cli', 'containerized', 'deploying', 'package', 'service', 'web-ui'];
    if (!hints) {
      failed++;
      console.error('FAIL applicability_hints missing');
    } else if (JSON.stringify(hints.shapes) !== JSON.stringify(expectShapes)) {
      failed++;
      console.error(`FAIL applicability_hints.shapes mismatch: ${JSON.stringify(hints.shapes)}`);
    } else {
      const sigs = hints.signals_by_shape ?? {};
      const missingSignal = expectShapes.find((s) => !sigs[s] || sigs[s]!.length === 0);
      if (missingSignal) {
        failed++;
        console.error(
          `FAIL shape ${missingSignal} asserted without signals: ${JSON.stringify(sigs)}`,
        );
      } else if (!sigs.containerized?.includes('Dockerfile')) {
        failed++;
        console.error(
          `FAIL containerized signal did not cite Dockerfile: ${JSON.stringify(sigs.containerized)}`,
        );
      } else if (!sigs.deploying?.includes('terraform/')) {
        failed++;
        console.error(
          `FAIL deploying signal did not cite terraform/: ${JSON.stringify(sigs.deploying)}`,
        );
      } else {
        console.log('OK   applicability_hints reports multi-shape repo with cited signals');
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Empty-repo case: missing AI surface files yield empty arrays, never errors.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-surface-empty-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
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
      ai_surface_inventory?: {
        instruction_files?: string[];
        rule_files?: string[];
        skill_files?: string[];
        prompt_files?: string[];
        mcp_config_files?: string[];
        ai_sdk_deps?: unknown[];
      };
      applicability_hints?: { shapes?: string[] };
    };
    const inv = evidence.ai_surface_inventory;
    const allEmpty =
      Array.isArray(inv?.instruction_files) &&
      inv!.instruction_files!.length === 0 &&
      Array.isArray(inv?.rule_files) &&
      inv!.rule_files!.length === 0 &&
      Array.isArray(inv?.skill_files) &&
      inv!.skill_files!.length === 0 &&
      Array.isArray(inv?.prompt_files) &&
      inv!.prompt_files!.length === 0 &&
      Array.isArray(inv?.mcp_config_files) &&
      inv!.mcp_config_files!.length === 0 &&
      Array.isArray(inv?.ai_sdk_deps) &&
      inv!.ai_sdk_deps!.length === 0;
    if (!allEmpty) {
      failed++;
      console.error(
        `FAIL empty repo did not yield empty ai_surface_inventory arrays: ${JSON.stringify(inv)}`,
      );
    } else if (
      !Array.isArray(evidence.applicability_hints?.shapes) ||
      evidence.applicability_hints!.shapes!.length !== 0
    ) {
      failed++;
      console.error(
        `FAIL empty repo did not yield empty applicability_hints.shapes: ${JSON.stringify(evidence.applicability_hints)}`,
      );
    } else {
      console.log('OK   empty repo yields empty ai_surface_inventory and applicability_hints');
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

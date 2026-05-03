// SPDX-License-Identifier: Apache-2.0
//
// Evidence-only AI surface inventory and applicability hints for audit-collect.

import path from 'node:path';
import type {
  AiSurfaceInventory,
  ApplicabilityHints,
  ApplicabilityShape,
} from './collector-types.ts';

export interface SurfaceInventoryDeps {
  trackedFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
  readPackageJson: (rel: string) => unknown;
}

const AI_INSTRUCTION_PATHS: ReadonlySet<string> = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.github/copilot-instructions.md',
  '.cursorrules',
]);
const AI_RULE_PREFIXES: readonly string[] = ['.cursor/rules/'];
const AI_SKILL_PREFIXES: readonly string[] = ['.claude/skills/', '.agents/skills/', 'skills/'];
const AI_PROMPT_PREFIXES: readonly string[] = ['.claude/prompts/', '.agents/prompts/', 'prompts/'];
const AI_MCP_PATHS: ReadonlySet<string> = new Set([
  '.mcp.json',
  '.claude/mcp.json',
  '.cursor/mcp.json',
  '.codex/mcp.json',
]);
const AI_SDK_NPM_DEPS: ReadonlySet<string> = new Set([
  'anthropic',
  '@anthropic-ai/sdk',
  'openai',
  '@google/generative-ai',
  '@google/genai',
  '@aws-sdk/client-bedrock-runtime',
  'langchain',
  'langchain-core',
  '@langchain/core',
  'llamaindex',
  'cohere-ai',
  'replicate',
  'mistralai',
]);
const AI_SDK_PY_DEPS: ReadonlySet<string> = new Set([
  'anthropic',
  'openai',
  'google-generativeai',
  'google-genai',
  'langchain',
  'langchain-core',
  'llama-index',
  'cohere',
  'replicate',
  'mistralai',
]);

const SERVICE_NPM_DEPS: ReadonlySet<string> = new Set([
  'express',
  'fastify',
  'koa',
  'hono',
  '@nestjs/core',
  '@hapi/hapi',
  'restify',
]);
const SERVICE_PY_DEPS: ReadonlySet<string> = new Set([
  'fastapi',
  'flask',
  'django',
  'starlette',
  'uvicorn',
  'gunicorn',
]);
const WEB_UI_NPM_DEPS: ReadonlySet<string> = new Set([
  'react',
  'next',
  'vue',
  '@angular/core',
  '@sveltejs/kit',
  'svelte',
  'vite',
  'remix',
  'gatsby',
  'astro',
  'solid-js',
]);
const DEPLOY_DIR_PREFIXES: readonly string[] = [
  'terraform/',
  'pulumi/',
  'infrastructure/',
  'infra/',
  'helm/',
  'charts/',
  'k8s/',
  'kubernetes/',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pyDepMentioned(text: string, name: string): boolean {
  const re = new RegExp(`(^|[\\s"'\\[,])${escapeRegExp(name)}([\\s=<>!~"',\\]]|$)`, 'mi');
  return re.test(text);
}

export function createSurfaceInventory(deps: SurfaceInventoryDeps): {
  buildAiSurfaceInventory: () => AiSurfaceInventory;
  buildApplicabilityHints: () => ApplicabilityHints;
} {
  let aiSurfaceInventoryCache: AiSurfaceInventory | null = null;

  function buildAiSurfaceInventory(): AiSurfaceInventory {
    if (aiSurfaceInventoryCache) return aiSurfaceInventoryCache;
    const tracked = deps.trackedFiles();
    const instruction_files: string[] = [];
    const rule_files: string[] = [];
    const skill_files: string[] = [];
    const prompt_files: string[] = [];
    const mcp_config_files: string[] = [];

    for (const rel of tracked) {
      if (AI_INSTRUCTION_PATHS.has(rel)) instruction_files.push(rel);
      else if (AI_MCP_PATHS.has(rel)) mcp_config_files.push(rel);
      else if (AI_RULE_PREFIXES.some((p) => rel.startsWith(p))) rule_files.push(rel);
      else if (AI_SKILL_PREFIXES.some((p) => rel.startsWith(p))) skill_files.push(rel);
      else if (AI_PROMPT_PREFIXES.some((p) => rel.startsWith(p))) prompt_files.push(rel);
    }

    const ai_sdk_deps: Array<{ name: string; manifest: string }> = [];
    const seen = new Set<string>();
    function record(name: string, manifest: string): void {
      const key = `${name}\x00${manifest}`;
      if (seen.has(key)) return;
      seen.add(key);
      ai_sdk_deps.push({ name, manifest });
    }

    for (const rel of tracked) {
      const base = path.basename(rel);
      if (base === 'package.json') {
        const pkg = deps.readPackageJson(rel);
        if (!pkg || typeof pkg !== 'object') continue;
        const pkgObj = pkg as Record<string, unknown>;
        for (const field of [
          'dependencies',
          'devDependencies',
          'peerDependencies',
          'optionalDependencies',
        ] as const) {
          const block = pkgObj[field];
          if (!block || typeof block !== 'object') continue;
          for (const dep of Object.keys(block)) {
            if (AI_SDK_NPM_DEPS.has(dep)) record(dep, rel);
          }
        }
      } else if (base === 'pyproject.toml') {
        const text = deps.readTrackedFile(rel) ?? '';
        for (const dep of AI_SDK_PY_DEPS) {
          if (pyDepMentioned(text, dep)) record(dep, rel);
        }
      } else if (/^requirements[^/]*\.txt$/.test(base)) {
        const text = deps.readTrackedFile(rel) ?? '';
        for (const line of text.split(/\r?\n/)) {
          const m = line.trim().match(/^([A-Za-z0-9_\-.]+)/);
          if (!m) continue;
          const name = m[1]!.toLowerCase();
          if (AI_SDK_PY_DEPS.has(name)) record(name, rel);
        }
      }
    }

    instruction_files.sort();
    rule_files.sort();
    skill_files.sort();
    prompt_files.sort();
    mcp_config_files.sort();
    ai_sdk_deps.sort(
      (a, b) => a.name.localeCompare(b.name) || a.manifest.localeCompare(b.manifest),
    );

    aiSurfaceInventoryCache = {
      instruction_files,
      rule_files,
      skill_files,
      prompt_files,
      mcp_config_files,
      ai_sdk_deps,
    };
    return aiSurfaceInventoryCache;
  }

  function buildApplicabilityHints(): ApplicabilityHints {
    const tracked = deps.trackedFiles();
    const signals: Record<ApplicabilityShape, string[]> = {
      package: [],
      service: [],
      'web-ui': [],
      cli: [],
      library: [],
      containerized: [],
      deploying: [],
    };

    for (const rel of tracked) {
      const base = path.basename(rel);
      if (base === 'package.json') {
        const pkg = deps.readPackageJson(rel);
        if (!pkg || typeof pkg !== 'object') continue;
        const pkgObj = pkg as Record<string, unknown>;
        if (typeof pkgObj.name === 'string') signals.package.push(`${rel}: name=${pkgObj.name}`);
        const hasBin = pkgObj.bin !== undefined && pkgObj.bin !== null;
        if (hasBin) signals.cli.push(`${rel}: bin field`);
        if (!hasBin && (pkgObj.main || pkgObj.exports || pkgObj.module)) {
          signals.library.push(`${rel}: main/exports field`);
        }
        const allDeps: Record<string, unknown> = {
          ...(pkgObj.dependencies && typeof pkgObj.dependencies === 'object'
            ? (pkgObj.dependencies as Record<string, unknown>)
            : {}),
          ...(pkgObj.devDependencies && typeof pkgObj.devDependencies === 'object'
            ? (pkgObj.devDependencies as Record<string, unknown>)
            : {}),
          ...(pkgObj.peerDependencies && typeof pkgObj.peerDependencies === 'object'
            ? (pkgObj.peerDependencies as Record<string, unknown>)
            : {}),
        };
        for (const dep of Object.keys(allDeps)) {
          if (SERVICE_NPM_DEPS.has(dep)) signals.service.push(`${rel}: dep ${dep}`);
          if (WEB_UI_NPM_DEPS.has(dep)) signals['web-ui'].push(`${rel}: dep ${dep}`);
        }
      } else if (base === 'pyproject.toml') {
        signals.package.push(`${rel}: pyproject.toml`);
        const text = deps.readTrackedFile(rel) ?? '';
        if (/\[project\.scripts\]|\[tool\.poetry\.scripts\]/.test(text)) {
          signals.cli.push(`${rel}: scripts table`);
        }
        for (const dep of SERVICE_PY_DEPS) {
          if (pyDepMentioned(text, dep)) signals.service.push(`${rel}: dep ${dep}`);
        }
      } else if (base === 'Cargo.toml' || base === 'go.mod') {
        signals.package.push(`${rel}: ${base}`);
      }

      if (/^Dockerfile(\..+)?$/.test(base) || /^(docker-)?compose\.ya?ml$/.test(base)) {
        signals.containerized.push(rel);
      }

      for (const prefix of DEPLOY_DIR_PREFIXES) {
        if (rel.startsWith(prefix)) {
          if (!signals.deploying.includes(prefix)) signals.deploying.push(prefix);
          break;
        }
      }
      if (/^\.github\/workflows\/[^/]*deploy[^/]*\.ya?ml$/i.test(rel)) {
        signals.deploying.push(rel);
      }
    }

    for (const k of Object.keys(signals) as ApplicabilityShape[]) {
      signals[k] = [...new Set(signals[k])].sort();
    }
    const shapes = (Object.keys(signals) as ApplicabilityShape[])
      .filter((s) => signals[s].length > 0)
      .sort();

    return { shapes, signals_by_shape: signals };
  }

  return { buildAiSurfaceInventory, buildApplicabilityHints };
}

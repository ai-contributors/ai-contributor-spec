// SPDX-License-Identifier: Apache-2.0
//
// Workflow and security-surface helper predicates for audit-collect.

import fs from 'node:fs';
import path from 'node:path';

export interface WorkflowHelpersDeps {
  workTreeRoot: string;
  defaultBranch: () => string | null;
  trackedFiles: () => string[];
}

export type WorkflowFile = { rel: string; content: string };

export function createWorkflowHelpers(deps: WorkflowHelpersDeps): {
  readWorkflows: () => WorkflowFile[];
  yamlBlockAfterKey: (content: string, keyPattern: string) => string | null;
  workflowTriggersPullRequest: (content: string) => boolean;
  workflowTriggersDefaultBranchPush: (content: string) => boolean;
  hasDependencyManifest: () => boolean;
  hasSastSupportedSource: () => boolean;
  requiredChecksFromRulesetSummary: (summary: unknown) => string[];
  requiredChecksInclude: (requiredChecks: string[], pattern: RegExp) => boolean;
} {
  function readWorkflows(): WorkflowFile[] {
    const dir = path.join(deps.workTreeRoot, '.github', 'workflows');
    if (!fs.existsSync(dir)) return [];
    const out: WorkflowFile[] = [];
    for (const name of fs.readdirSync(dir)) {
      if (/\.ya?ml$/.test(name)) {
        out.push({
          rel: path.join('.github', 'workflows', name),
          content: fs.readFileSync(path.join(dir, name), 'utf8'),
        });
      }
    }
    return out;
  }

  function yamlBlockAfterKey(content: string, keyPattern: string): string | null {
    const lines = content.split(/\r?\n/);
    const keyRe = new RegExp(`^(\\s*)${keyPattern}\\s*:\\s*(.*)$`);
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(keyRe);
      if (!match) continue;
      const indent = match[1].length;
      const block = [match[2]];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        if (line.trim() === '' || line.trimStart().startsWith('#')) {
          block.push(line);
          continue;
        }
        const childIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
        if (childIndent <= indent) break;
        block.push(line);
      }
      return block.join('\n');
    }
    return null;
  }

  function workflowTriggersPullRequest(content: string): boolean {
    return (
      /^\s*pull_request(?:_target)?\s*:/m.test(content) ||
      /^\s*on\s*:\s*pull_request(?:_target)?\s*(?:#.*)?$/m.test(content) ||
      /^\s*on\s*:\s*\[[^\]]*\bpull_request(?:_target)?\b/m.test(content)
    );
  }

  function workflowTriggersDefaultBranchPush(content: string): boolean {
    const branch = deps.defaultBranch();
    if (!branch) return false;
    if (
      /^\s*on\s*:\s*push\s*(?:#.*)?$/m.test(content) ||
      /^\s*on\s*:\s*\[[^\]]*\bpush\b/m.test(content)
    )
      return true;
    const pushBlock = yamlBlockAfterKey(content, 'push');
    if (!pushBlock) return false;
    if (!/\bbranches\s*:/.test(pushBlock)) return true;
    const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
      `branches\\s*:\\s*(?:\\[[^\\]]*\\b${escaped}\\b|[\\s\\S]{0,160}\\b${escaped}\\b)`,
      'm',
    ).test(pushBlock);
  }

  function hasDependencyManifest(): boolean {
    return deps
      .trackedFiles()
      .some((rel) =>
        /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|requirements.*\.txt|pyproject\.toml|poetry\.lock|Pipfile\.lock|go\.mod|go\.sum|Cargo\.toml|Cargo\.lock|pom\.xml|build\.gradle(?:\.kts)?|Gemfile(?:\.lock)?|composer\.json|composer\.lock)$/i.test(
          rel,
        ),
      );
  }

  function hasSastSupportedSource(): boolean {
    return deps
      .trackedFiles()
      .some(
        (rel) =>
          !/(^|\/)(node_modules|dist|coverage|vendor)\//.test(rel) &&
          /\.(?:[cm]?[jt]sx?|py|go|java|cs|rb|rs|php|kt|kts|scala|swift)$/i.test(rel),
      );
  }

  function requiredChecksFromRulesetSummary(summary: unknown): string[] {
    const requiredChecks: string[] = [];
    if (!Array.isArray(summary)) return requiredChecks;
    for (const r of summary as Array<Record<string, unknown>>) {
      if (r.type !== 'required_status_checks') continue;
      const params = r.parameters as
        | { required_status_checks?: Array<{ context?: string }> }
        | undefined;
      for (const c of params?.required_status_checks ?? [])
        if (c.context) requiredChecks.push(c.context);
    }
    return requiredChecks;
  }

  function requiredChecksInclude(requiredChecks: string[], pattern: RegExp): boolean {
    return requiredChecks.some((check) => pattern.test(check));
  }

  return {
    readWorkflows,
    yamlBlockAfterKey,
    workflowTriggersPullRequest,
    workflowTriggersDefaultBranchPush,
    hasDependencyManifest,
    hasSastSupportedSource,
    requiredChecksFromRulesetSummary,
    requiredChecksInclude,
  };
}

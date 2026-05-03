// SPDX-License-Identifier: Apache-2.0
//
// MCP inventory and rules for audit-collect.

import path from 'node:path';
import { RULE_AIC_IDS } from './collector-registry.ts';
import type { McpInventory, McpServerFact, RuleEvidence } from './collector-types.ts';

export interface McpRuleDeps {
  workTreeRoot: string;
  mcpConfigFiles: () => string[];
  readTrackedFile: (rel: string) => string | null;
}

const NPX_LAUNCHERS = new Set(['npx', 'npm', 'pnpm', 'yarn', 'bunx']);
const PY_LAUNCHERS = new Set(['uvx', 'uv', 'pipx', 'python', 'python3']);

export function createMcpRules(deps: McpRuleDeps): {
  buildMcpInventory: () => McpInventory;
  ruleMcpRootScoping: () => RuleEvidence;
  ruleMcpPinnedVersions: () => RuleEvidence;
  ruleMcpReadOnlyDefault: () => RuleEvidence;
} {
  let mcpInventoryCache: McpInventory | null = null;

  function classifyNpxPackageRef(ref: string): {
    name: string | null;
    version: string | null;
    pinned: boolean;
  } {
    // shapes: `@org/pkg`, `@org/pkg@1.2.3`, `pkg@latest`, `pkg`
    if (ref.startsWith('-')) return { name: null, version: null, pinned: false };
    if (ref.startsWith('.') || ref.startsWith('/'))
      return { name: null, version: null, pinned: true };
    const at = ref.lastIndexOf('@');
    if (at <= 0) return { name: ref, version: null, pinned: false };
    const name = ref.slice(0, at);
    const version = ref.slice(at + 1);
    if (!version || /^(latest|next|canary|beta)$/i.test(version)) {
      return { name, version: version || null, pinned: false };
    }
    if (/^\^|^~|^>/.test(version)) return { name, version, pinned: false };
    return { name, version, pinned: true };
  }

  function rootsLookSafe(root: string): boolean {
    if (/\$HOME|^~\/?|^~$/.test(root)) return false;
    const r = root.replace(/\$\{[^}]+\}|\$[A-Z_]+/g, '').trim();
    if (r === '' || r === '.') return true;
    if (r === '/' || r.startsWith('/etc') || r.startsWith('/usr') || r.startsWith('/var'))
      return false;
    if (r.startsWith('/')) return r === deps.workTreeRoot || r.startsWith(deps.workTreeRoot + '/');
    return !r.startsWith('..');
  }

  function parseMcpServers(rel: string, raw: string): McpServerFact[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!parsed || typeof parsed !== 'object') return [];
    const obj = parsed as Record<string, unknown>;
    const block = (obj.mcpServers ?? obj.servers ?? null) as unknown;
    if (!block || typeof block !== 'object') return [];
    const out: McpServerFact[] = [];
    for (const [name, def] of Object.entries(block)) {
      if (!def || typeof def !== 'object') continue;
      const d = def as Record<string, unknown>;
      const command = typeof d.command === 'string' ? d.command : null;
      const args = Array.isArray(d.args)
        ? d.args.filter((x): x is string => typeof x === 'string')
        : [];
      const env =
        d.env && typeof d.env === 'object' ? Object.keys(d.env as Record<string, unknown>) : [];
      const transport =
        typeof d.transport === 'string' ? d.transport : typeof d.type === 'string' ? d.type : null;

      let pkgName: string | null = null;
      let pkgVersion: string | null = null;
      let pinned = false;
      if (command && NPX_LAUNCHERS.has(path.basename(command))) {
        const pkgArg = args.find((a) => !a.startsWith('-'));
        if (pkgArg) {
          const c = classifyNpxPackageRef(pkgArg);
          pkgName = c.name;
          pkgVersion = c.version;
          pinned = c.pinned;
        }
      } else if (command && PY_LAUNCHERS.has(path.basename(command))) {
        const pkgArg = args.find((a) => !a.startsWith('-'));
        if (pkgArg) {
          const at = pkgArg.lastIndexOf('==');
          if (at > 0) {
            pkgName = pkgArg.slice(0, at);
            pkgVersion = pkgArg.slice(at + 2);
            pinned = true;
          } else {
            pkgName = pkgArg;
            pinned = false;
          }
        }
      } else if (command) {
        pinned = true;
      }

      let roots: string[] = [];
      if (Array.isArray(d.roots)) {
        roots = d.roots.filter((x): x is string => typeof x === 'string');
      } else if (
        pkgName === '@modelcontextprotocol/server-filesystem' ||
        pkgName?.includes('server-filesystem')
      ) {
        roots = args.filter(
          (a) =>
            (!a.startsWith('-') &&
              !a.startsWith('@') &&
              a !== pkgName &&
              !/^[A-Za-z0-9_-]+$/.test(a)) ||
            a.startsWith('/') ||
            a.startsWith('~') ||
            a.startsWith('$'),
        );
      }

      const argsBlob = args.join(' ');
      const envBlob = JSON.stringify(d.env ?? {});
      const read_only_signal =
        /(--read-only|--readonly|"?READ_ONLY"?\s*[:=]\s*"?true|"?READONLY"?\s*[:=]\s*"?true)/i.test(
          `${argsBlob} ${envBlob}`,
        );

      out.push({
        name,
        source_file: rel,
        command,
        args,
        package: pkgName,
        package_version: pkgVersion,
        version_pinned: pinned,
        roots,
        env_refs: env,
        transport,
        read_only_signal,
      });
    }
    return out;
  }

  function buildMcpInventory(): McpInventory {
    if (mcpInventoryCache) return mcpInventoryCache;
    const servers: McpServerFact[] = [];
    for (const rel of deps.mcpConfigFiles()) {
      const text = deps.readTrackedFile(rel);
      if (!text) continue;
      servers.push(...parseMcpServers(rel, text));
    }
    mcpInventoryCache = { servers };
    return mcpInventoryCache;
  }

  function ruleMcpRootScoping(): RuleEvidence {
    const inv = buildMcpInventory();
    if (inv.servers.length === 0) {
      return {
        spec_rule_name: 'MCP Root Scoping',
        applicability: { verdict: 'not_applicable', trigger_evidence: 'no MCP servers configured' },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no MCP server entries found in tracked config files',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['mcp-root-scoping']!,
      };
    }
    const offenders: Array<{ server: string; root: string; source: string }> = [];
    for (const s of inv.servers) {
      for (const r of s.roots) {
        if (!rootsLookSafe(r)) offenders.push({ server: s.name, root: r, source: s.source_file });
      }
    }
    if (offenders.length > 0) {
      return {
        spec_rule_name: 'MCP Root Scoping',
        applicability: {
          verdict: 'applicable',
          trigger_evidence: `${inv.servers.length} MCP server(s)`,
        },
        commands: [],
        derived_status: 'Alarm',
        derivation_reason: `MCP root(s) scoped outside the workspace: ${offenders
          .slice(0, 5)
          .map((o) => `${o.source}:${o.server} → ${o.root}`)
          .join('; ')}`,
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['mcp-root-scoping']!,
      };
    }
    return {
      spec_rule_name: 'MCP Root Scoping',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${inv.servers.length} MCP server(s)`,
      },
      commands: [],
      derived_status: 'Fulfilled',
      derivation_reason: `every configured MCP root is workspace-scoped or relative across ${inv.servers.length} server(s)`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['mcp-root-scoping']!,
    };
  }

  function ruleMcpPinnedVersions(): RuleEvidence {
    const inv = buildMcpInventory();
    if (inv.servers.length === 0) {
      return {
        spec_rule_name: 'MCP Pinned Versions',
        applicability: { verdict: 'not_applicable', trigger_evidence: 'no MCP servers configured' },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no MCP server entries found in tracked config files',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['mcp-pinned-versions']!,
      };
    }
    const unpinned = inv.servers.filter((s) => !s.version_pinned);
    return {
      spec_rule_name: 'MCP Pinned Versions',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${inv.servers.length} MCP server(s)`,
      },
      commands: [],
      derived_status: unpinned.length === 0 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        unpinned.length === 0
          ? `every MCP server pins its version (or runs from a controlled local binary)`
          : `MCP server(s) without a pinned version: ${unpinned.map((s) => `${s.source_file}:${s.name}${s.package ? ` (${s.package}@${s.package_version ?? 'unpinned'})` : ''}`).join(', ')}`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['mcp-pinned-versions']!,
    };
  }

  function ruleMcpReadOnlyDefault(): RuleEvidence {
    const inv = buildMcpInventory();
    if (inv.servers.length === 0) {
      return {
        spec_rule_name: 'MCP Read-Only Default',
        applicability: { verdict: 'not_applicable', trigger_evidence: 'no MCP servers configured' },
        commands: [],
        derived_status: 'Not relevant',
        derivation_reason: 'no MCP server entries found in tracked config files',
        judgment_required: false,
        aic_ids: RULE_AIC_IDS['mcp-read-only-default']!,
      };
    }
    const writable = inv.servers.filter((s) => !s.read_only_signal);
    return {
      spec_rule_name: 'MCP Read-Only Default',
      applicability: {
        verdict: 'applicable',
        trigger_evidence: `${inv.servers.length} MCP server(s)`,
      },
      commands: [],
      derived_status: writable.length === 0 ? 'Fulfilled' : 'Warning',
      derivation_reason:
        writable.length === 0
          ? `every MCP server declares a read-only signal (\`--read-only\` arg or \`READ_ONLY=true\` env)`
          : `MCP server(s) without an explicit read-only signal: ${writable.map((s) => `${s.source_file}:${s.name}`).join(', ')}; verify the protocol/tool surface is read-only by default`,
      judgment_required: false,
      aic_ids: RULE_AIC_IDS['mcp-read-only-default']!,
    };
  }

  return { buildMcpInventory, ruleMcpRootScoping, ruleMcpPinnedVersions, ruleMcpReadOnlyDefault };
}

// SPDX-License-Identifier: Apache-2.0
//
// Importable model of AI-CONTRIBUTOR-SPECIFICATION.md.

export type SpecScope = 'MUST' | 'MUST when applicable' | 'SHOULD' | 'MAY';

const SPEC_SCOPES: ReadonlySet<SpecScope> = new Set([
  'MUST',
  'MUST when applicable',
  'SHOULD',
  'MAY',
]);

export function isSpecScope(value: string): value is SpecScope {
  return (SPEC_SCOPES as ReadonlySet<string>).has(value);
}

export interface SpecId {
  id: string;
  clause: number;
  scope: SpecScope;
  line: number;
}

export interface UntaggedNormativeBullet {
  clause: number;
  scope: SpecScope;
  line: number;
  preview: string;
}

export interface NormativeIdParseResult {
  ids: SpecId[];
  bullets: number;
  untagged: UntaggedNormativeBullet[];
}

const ID_PATTERN = /<sup>`(AIC-[a-z0-9][a-z0-9-]*)`<\/sup>/g;

export function parseNormativeIds(specContent: string): NormativeIdParseResult {
  const ids: SpecId[] = [];
  const untagged: UntaggedNormativeBullet[] = [];
  let bullets = 0;
  let inClauses = false;
  let clause = 0;
  let scope: SpecScope | null = null;

  const lines = specContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## Specification clauses\s*$/.test(line)) {
      inClauses = true;
      continue;
    }
    if (!inClauses) continue;

    const cm = line.match(/^##\s+(\d+)\.\s+/);
    if (cm) {
      clause = Number(cm[1]);
      scope = null;
      continue;
    }

    if (/^##\s+/.test(line)) {
      inClauses = false;
      clause = 0;
      scope = null;
      continue;
    }

    const sm = line.match(/^###\s+`(MUST|MUST when applicable|SHOULD|MAY)`\s*$/);
    if (sm && isSpecScope(sm[1])) {
      scope = sm[1];
      continue;
    }

    if (/^###\s+/.test(line)) {
      scope = null;
      continue;
    }

    if (scope && /^- /.test(line)) {
      bullets++;
      const found: string[] = [];
      let m: RegExpExecArray | null;
      ID_PATTERN.lastIndex = 0;
      while ((m = ID_PATTERN.exec(line))) found.push(m[1]);
      if (found.length === 0) {
        untagged.push({ clause, scope, line: i + 1, preview: line.slice(0, 90) });
      } else {
        for (const id of found) ids.push({ id, clause, scope, line: i + 1 });
      }
    }
  }
  return { ids, bullets, untagged };
}

export function specIdMap(specContent: string): Map<string, SpecId> {
  const out = new Map<string, SpecId>();
  for (const id of parseNormativeIds(specContent).ids) out.set(id.id, id);
  return out;
}

export function specScopeById(specContent: string): Map<string, SpecScope> {
  const out = new Map<string, SpecScope>();
  for (const specId of parseNormativeIds(specContent).ids) {
    const prior = out.get(specId.id);
    if (prior && prior !== specId.scope) {
      throw new Error(
        `spec ID ${specId.id} appears under both "${prior}" and "${specId.scope}" subheadings`,
      );
    }
    out.set(specId.id, specId.scope);
  }
  return out;
}

export function clauseToPillar(specContent: string): Map<number, number> {
  const out = new Map<number, number>();
  let pillar: number | null = null;
  for (const line of specContent.split(/\r?\n/)) {
    const pm = line.match(/^###\s+Pillar\s+(\d+)\b/);
    if (pm) {
      pillar = Number(pm[1]);
      continue;
    }
    const cm = line.match(/^##\s+(\d+)\.\s+/);
    if (cm && pillar !== null) out.set(Number(cm[1]), pillar);
  }
  return out;
}

export function pillarNames(specContent: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const line of specContent.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*§/);
    if (m) out[Number(m[1])] = m[2];
  }
  if (Object.keys(out).length === 0) {
    throw new Error(
      'No pillar rows parsed from specification — pillar table format may have changed.',
    );
  }
  return out;
}

export function levelLabels(specContent: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of specContent.split(/\r?\n/)) {
    const m = line.match(/^-\s+\*\*Level\s+(\d)\s+—\s+([^.*]+?)\.\*\*/);
    if (m) out[`L${m[1]}`] = `L${m[1]} — ${m[2].trim()}`;
  }
  if (Object.keys(out).length === 0) {
    throw new Error(
      'No conformance-level bullets parsed from specification — Conformance levels format may have changed.',
    );
  }
  return out;
}

export function validMinLevels(specContent: string): Set<string> {
  return new Set(['—', ...Object.keys(levelLabels(specContent))]);
}

// SPDX-License-Identifier: Apache-2.0
//
// Importable model of AI-CONTRIBUTOR-SPECIFICATION.md.

export type SpecScope = 'MUST' | 'MUST when applicable' | 'SHOULD' | 'MAY';

function isSpecScope(value: string): value is SpecScope {
  switch (value) {
    case 'MUST':
    case 'MUST when applicable':
    case 'SHOULD':
    case 'MAY':
      return true;
    default:
      return false;
  }
}

export interface SpecId {
  id: string;
  clause: number;
  scope: SpecScope;
  line: number;
}

interface UntaggedNormativeBullet {
  clause: number;
  scope: SpecScope;
  line: number;
  preview: string;
}

interface NormativeIdParseResult {
  ids: SpecId[];
  bullets: number;
  untagged: UntaggedNormativeBullet[];
}

export interface PillarDetail {
  number: number;
  icon: string;
  title: string;
  description: string;
}

export interface ClauseDetail {
  number: number;
  pillar: number;
  title: string;
}

export interface LevelDetail {
  id: string;
  order: number;
  label: string;
  description: string;
  workflowSummary?: string;
}

const ID_PATTERN = /<sup>`(AIC-[a-z0-9][a-z0-9-]*)`<\/sup>/g;
const SPECIFICATION_CLAUSES_HEADING = /^## Specification clauses\s*$/;
const TOP_LEVEL_HEADING = /^##\s+/;
const CLAUSE_HEADING = /^#{2,4}\s+(\d+)\.\s+/;
const SCOPE_HEADING = /^#{3,6}\s+`(MUST|MUST when applicable|SHOULD|MAY)`\s*$/;
const ANY_HEADING = /^#{1,6}\s+/;
const PILLAR_HEADING = /^###\s+Pillar\s+(\d+)\b/;

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
    if (SPECIFICATION_CLAUSES_HEADING.test(line)) {
      inClauses = true;
      continue;
    }
    if (!inClauses) continue;

    const cm = line.match(CLAUSE_HEADING);
    if (cm) {
      clause = Number(cm[1]);
      scope = null;
      continue;
    }

    if (TOP_LEVEL_HEADING.test(line)) {
      inClauses = false;
      clause = 0;
      scope = null;
      continue;
    }

    const sm = line.match(SCOPE_HEADING);
    if (sm && isSpecScope(sm[1])) {
      scope = sm[1];
      continue;
    }

    if (ANY_HEADING.test(line)) {
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

export function clauseToPillar(specContent: string): Map<number, number> {
  const out = new Map<number, number>();
  let pillar: number | null = null;
  for (const line of specContent.split(/\r?\n/)) {
    const pm = line.match(PILLAR_HEADING);
    if (pm) {
      pillar = Number(pm[1]);
      continue;
    }
    const cm = line.match(CLAUSE_HEADING);
    if (cm && pillar !== null) out.set(Number(cm[1]), pillar);
  }
  return out;
}

export function validMinLevels(specContent: string): Set<string> {
  const out = new Set<string>(['—']);
  for (const line of specContent.split(/\r?\n/)) {
    const m = line.match(/^-\s+\*\*Level\s+(\d+)\s+—\s+/);
    if (!m) continue;
    out.add(`L${m[1]}`);
  }
  if (out.size === 1) {
    throw new Error(
      'No conformance-level bullets parsed from specification — Conformance levels format may have changed.',
    );
  }
  return out;
}

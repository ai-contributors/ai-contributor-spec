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

export interface NormativeRule {
  id: string;
  clause: number;
  scope: SpecScope;
  line: number;
  text: string;
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
}

const ID_PATTERN = /<sup>`(AIC-[a-z0-9][a-z0-9-]*)`<\/sup>/g;
const SPECIFICATION_CLAUSES_HEADING = /^## Specification clauses\s*$/;
const TOP_LEVEL_HEADING = /^##\s+/;
const CLAUSE_HEADING = /^#{2,4}\s+(\d+)\.\s+/;
const CLAUSE_DETAIL_HEADING = /^#{2,4}\s+(\d+)\.\s+(.+?)\s*$/;
const SCOPE_HEADING = /^#{3,6}\s+`(MUST|MUST when applicable|SHOULD|MAY)`\s*$/;
const ANY_HEADING = /^#{1,6}\s+/;
const PILLAR_HEADING = /^###\s+Pillar\s+(\d+)\b/;
const OPTIONAL_LEVEL: LevelDetail = {
  id: '—',
  order: 99,
  label: 'Optional',
  description: 'Optional rules are not required for any conformance level.',
};

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

export function parseNormativeRules(specContent: string): NormativeRule[] {
  const out: NormativeRule[] = [];
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
      const found: string[] = [];
      let m: RegExpExecArray | null;
      ID_PATTERN.lastIndex = 0;
      while ((m = ID_PATTERN.exec(line))) found.push(m[1]);
      if (found.length === 0) continue;
      const text = normativeBulletText(line);
      for (const id of found) out.push({ id, clause, scope, line: i + 1, text });
    }
  }
  return out;
}

export function normativeRuleMap(specContent: string): Map<string, NormativeRule> {
  const out = new Map<string, NormativeRule>();
  for (const rule of parseNormativeRules(specContent)) out.set(rule.id, rule);
  return out;
}

function normativeBulletText(line: string): string {
  ID_PATTERN.lastIndex = 0;
  return line.replace(/^- /, '').replace(ID_PATTERN, '').replace(/\s+/g, ' ').trim();
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

export function pillarNames(specContent: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const pillar of pillarDetails(specContent)) {
    out[pillar.number] = pillar.icon ? `${pillar.icon} ${pillar.title}` : pillar.title;
  }
  return out;
}

export function pillarDetails(specContent: string): PillarDetail[] {
  const out: PillarDetail[] = [];
  for (const line of specContent.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*§[^|]+?\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const displayName = splitPillarDisplayName(m[2]!.trim());
    out.push({
      number: Number(m[1]),
      icon: displayName.icon,
      title: displayName.title,
      description: m[3]!.trim(),
    });
  }
  if (out.length === 0) {
    throw new Error(
      'No pillar rows parsed from specification — pillar table format may have changed.',
    );
  }
  return out;
}

function splitPillarDisplayName(value: string): { icon: string; title: string } {
  const m = value.match(/^(\S+)\s+(.+)$/u);
  if (m && !/^[A-Za-z0-9]/.test(m[1]!)) return { icon: m[1]!, title: m[2]!.trim() };
  return { icon: '', title: value };
}

export function clauseDetails(specContent: string): ClauseDetail[] {
  const out: ClauseDetail[] = [];
  let inClauses = false;
  let pillar: number | null = null;
  const lines = specContent.split(/\r?\n/);
  for (const line of lines) {
    if (SPECIFICATION_CLAUSES_HEADING.test(line)) {
      inClauses = true;
      continue;
    }
    if (!inClauses) continue;

    const pm = line.match(PILLAR_HEADING);
    if (pm) {
      pillar = Number(pm[1]);
      continue;
    }

    const cm = line.match(CLAUSE_DETAIL_HEADING);
    if (cm && pillar !== null) {
      out.push({ number: Number(cm[1]), pillar, title: cm[2]!.trim() });
      continue;
    }

    if (TOP_LEVEL_HEADING.test(line)) break;
  }
  if (out.length === 0) {
    throw new Error(
      'No clause headings parsed from specification — clause heading format may have changed.',
    );
  }
  return out;
}

export function levelLabels(specContent: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const level of levelDetails(specContent)) {
    if (level.id === '—') continue;
    out[level.id] = `${level.id} — ${level.label}`;
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

export function levelDetails(specContent: string): LevelDetail[] {
  const out: LevelDetail[] = [];
  for (const line of specContent.split(/\r?\n/)) {
    const m = line.match(/^-\s+\*\*Level\s+(\d+)\s+—\s+([^.*]+?)\.\*\*\s+(.+?)\s*$/);
    if (!m) continue;
    const order = Number(m[1]);
    out.push({
      id: `L${order}`,
      order,
      label: m[2]!.trim(),
      description: m[3]!.trim(),
    });
  }
  if (out.length === 0) {
    throw new Error(
      'No conformance-level bullets parsed from specification — Conformance levels format may have changed.',
    );
  }
  return [...out, OPTIONAL_LEVEL];
}

export function specVersion(specContent: string): string {
  const m = specContent.match(/^>\s+\*\*Version:\*\*\s+([^·\s]+)/m);
  if (!m) throw new Error('No specification version parsed from specification header.');
  return m[1]!.trim();
}

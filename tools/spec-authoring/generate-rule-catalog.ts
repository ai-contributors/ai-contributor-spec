#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Validates and canonicalizes AI-CONTRIBUTOR-RULE-CATALOG.json.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClauseDetail, LevelDetail, PillarDetail, SpecScope } from './shared/spec-model.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const CATALOG_SCHEMA = './AI-CONTRIBUTOR-RULE-CATALOG.schema.json';
const VALID_SCOPES = new Set(['MUST', 'MUST when applicable', 'SHOULD', 'MAY']);
const VALID_DETECTOR_CONFIDENCE = new Set(['indicative', 'manual']);

export interface RuleCatalog {
  $schema: string;
  schemaVersion: '0.2';
  specVersion: string;
  sourceOfTruth: string;
  projections: {
    specification: string;
    checklist: string;
    coverage: string;
    collectorRegistry: string;
  };
  pillars: RuleCatalogPillar[];
  levels: RuleCatalogLevel[];
  clauses: RuleCatalogClause[];
  rules: RuleCatalogEntry[];
}

export type RuleCatalogPillar = PillarDetail;

export type RuleCatalogLevel = LevelDetail;

export type RuleCatalogClause = ClauseDetail;

export interface RuleCatalogEntry {
  id: string;
  clause: number;
  pillar: number;
  scope: SpecScope;
  level: string;
  text: string;
  checklist: {
    rule: string;
    scope: SpecScope;
    requirement: string;
  };
  detectors: RuleCatalogDetector[];
  detectorConfidence: 'indicative' | 'manual';
}

export type RuleCatalogDetector =
  | {
      id: string;
      kind: 'collector-rule';
      path: string;
    }
  | {
      id: string;
      kind: 'manual';
      manualEvidence: string;
    };

export function renderRuleCatalog(catalog: RuleCatalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export function canonicalizeRuleCatalog(catalog: RuleCatalog): RuleCatalog {
  return {
    ...catalog,
    pillars: [...(catalog.pillars ?? [])].sort((a, b) => a.number - b.number),
    levels: [...(catalog.levels ?? [])].sort(
      (a, b) => a.order - b.order || a.id.localeCompare(b.id),
    ),
    clauses: [...(catalog.clauses ?? [])].sort((a, b) => a.number - b.number),
    rules: [...catalog.rules].sort(compareCatalogEntries),
  };
}

export function collectorAicIdsFromCatalog(catalog: RuleCatalog): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entry of catalog.rules) {
    for (const detector of entry.detectors) {
      if (detector.kind !== 'collector-rule') continue;
      out[detector.id] ??= [];
      out[detector.id]!.push(entry.id);
    }
  }
  for (const ids of Object.values(out)) ids.sort();
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export function validateRuleCatalog(catalog: RuleCatalog): string[] {
  const problems: string[] = [];
  if (catalog.$schema !== CATALOG_SCHEMA) problems.push('$schema must point to the local schema');
  if (catalog.schemaVersion !== '0.2') problems.push('schemaVersion must be "0.2"');
  if (catalog.specVersion.trim() === '') problems.push('specVersion must not be blank');
  if (catalog.sourceOfTruth !== CATALOG) {
    problems.push(`sourceOfTruth must be "${CATALOG}"`);
  }
  if (catalog.projections.specification.trim() === '') {
    problems.push('projections.specification must not be blank');
  }
  if (catalog.projections.checklist.trim() === '') {
    problems.push('projections.checklist must not be blank');
  }
  if (catalog.projections.coverage.trim() === '') {
    problems.push('projections.coverage must not be blank');
  }
  if (catalog.projections.collectorRegistry.trim() === '') {
    problems.push('projections.collectorRegistry must not be blank');
  }
  validatePillars(catalog.pillars, problems);
  validateLevels(catalog.levels, problems);
  validateClauses(catalog.clauses, catalog.pillars, problems);
  if (catalog.rules.length === 0) problems.push('rules must contain at least one entry');

  const knownClauses = new Map(catalog.clauses.map((clause) => [clause.number, clause]));
  const knownLevels = new Set(catalog.levels.map((level) => level.id));
  const seen = new Set<string>();
  for (const [i, rule] of catalog.rules.entries()) {
    const prefix = `rules[${i}]`;
    if (!/^AIC-[a-z0-9][a-z0-9-]*$/.test(rule.id)) problems.push(`${prefix}.id is invalid`);
    if (seen.has(rule.id)) problems.push(`${prefix}.id duplicates ${rule.id}`);
    seen.add(rule.id);
    if (!Number.isInteger(rule.clause) || rule.clause < 1) {
      problems.push(`${prefix}.clause must be a positive integer`);
    }
    if (!Number.isInteger(rule.pillar) || rule.pillar < 1) {
      problems.push(`${prefix}.pillar must be a positive integer`);
    }
    const clause = knownClauses.get(rule.clause);
    if (!clause) {
      problems.push(`${prefix} references missing clause ${rule.clause}`);
    } else if (clause.pillar !== rule.pillar) {
      problems.push(
        `${prefix}.pillar ${rule.pillar} does not match clause ${rule.clause} pillar ${clause.pillar}`,
      );
    }
    if (!VALID_SCOPES.has(rule.scope)) problems.push(`${prefix}.scope is invalid`);
    if (!/^L\d+$/.test(rule.level) && rule.level !== '—')
      problems.push(`${prefix}.level is invalid`);
    if (!knownLevels.has(rule.level)) {
      problems.push(`${prefix} references missing level ${rule.level}`);
    }
    if (rule.text.trim() === '') problems.push(`${prefix}.text must not be blank`);
    if (rule.checklist.rule.trim() === '')
      problems.push(`${prefix}.checklist.rule must not be blank`);
    if (!VALID_SCOPES.has(rule.checklist.scope))
      problems.push(`${prefix}.checklist.scope is invalid`);
    if (rule.checklist.requirement.trim() === '') {
      problems.push(`${prefix}.checklist.requirement must not be blank`);
    }
    if (rule.detectors.length === 0) problems.push(`${prefix}.detectors must not be empty`);
    if (!VALID_DETECTOR_CONFIDENCE.has(rule.detectorConfidence)) {
      problems.push(`${prefix}.detectorConfidence is invalid`);
    }
    for (const [j, detector] of rule.detectors.entries()) {
      const detectorPrefix = `${prefix}.detectors[${j}]`;
      if (detector.id.trim() === '') problems.push(`${detectorPrefix}.id must not be blank`);
      if (detector.kind === 'collector-rule') {
        if (detector.path.trim() === '') problems.push(`${detectorPrefix}.path must not be blank`);
      } else if (detector.kind === 'manual') {
        if (detector.manualEvidence.trim() === '') {
          problems.push(`${detectorPrefix}.manualEvidence must not be blank`);
        }
      } else {
        problems.push(`${detectorPrefix}.kind is invalid`);
      }
    }
  }

  return problems;
}

function validatePillars(pillars: readonly RuleCatalogPillar[], problems: string[]): void {
  if (pillars.length === 0) problems.push('pillars must contain at least one entry');
  const seen = new Set<number>();
  for (const [i, pillar] of pillars.entries()) {
    const prefix = `pillars[${i}]`;
    if (!Number.isInteger(pillar.number) || pillar.number < 1) {
      problems.push(`${prefix}.number must be a positive integer`);
    }
    if (seen.has(pillar.number)) problems.push(`${prefix}.number duplicates ${pillar.number}`);
    seen.add(pillar.number);
    if (pillar.title.trim() === '') problems.push(`${prefix}.title must not be blank`);
    if (pillar.description.trim() === '') problems.push(`${prefix}.description must not be blank`);
  }
}

function validateLevels(levels: readonly RuleCatalogLevel[], problems: string[]): void {
  if (levels.length === 0) problems.push('levels must contain at least one entry');
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  for (const [i, level] of levels.entries()) {
    const prefix = `levels[${i}]`;
    if (!/^L\d+$/.test(level.id) && level.id !== '—') problems.push(`${prefix}.id is invalid`);
    if (seenIds.has(level.id)) problems.push(`${prefix}.id duplicates ${level.id}`);
    seenIds.add(level.id);
    if (!Number.isInteger(level.order) || level.order < 0) {
      problems.push(`${prefix}.order must be a non-negative integer`);
    }
    if (seenOrders.has(level.order)) problems.push(`${prefix}.order duplicates ${level.order}`);
    seenOrders.add(level.order);
    if (level.label.trim() === '') problems.push(`${prefix}.label must not be blank`);
    if (level.description.trim() === '') problems.push(`${prefix}.description must not be blank`);
    if (level.workflowSummary !== undefined && level.workflowSummary.trim() === '') {
      problems.push(`${prefix}.workflowSummary must not be blank when present`);
    }
  }
}

function validateClauses(
  clauses: readonly RuleCatalogClause[],
  pillars: readonly RuleCatalogPillar[],
  problems: string[],
): void {
  if (clauses.length === 0) problems.push('clauses must contain at least one entry');
  const seen = new Set<number>();
  const knownPillars = new Set(pillars.map((pillar) => pillar.number));
  for (const [i, clause] of clauses.entries()) {
    const prefix = `clauses[${i}]`;
    if (!Number.isInteger(clause.number) || clause.number < 1) {
      problems.push(`${prefix}.number must be a positive integer`);
    }
    if (seen.has(clause.number)) problems.push(`${prefix}.number duplicates ${clause.number}`);
    seen.add(clause.number);
    if (!knownPillars.has(clause.pillar)) {
      problems.push(`${prefix} references missing pillar ${clause.pillar}`);
    }
    if (clause.title.trim() === '') problems.push(`${prefix}.title must not be blank`);
  }
}

function compareCatalogEntries(a: RuleCatalogEntry, b: RuleCatalogEntry): number {
  return (
    a.clause - b.clause ||
    levelSortValue(a.level) - levelSortValue(b.level) ||
    a.checklist.rule.localeCompare(b.checklist.rule) ||
    a.id.localeCompare(b.id)
  );
}

function levelSortValue(level: string): number {
  if (level === '—') return Number.MAX_SAFE_INTEGER;
  const m = level.match(/^L(\d+)$/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER - 1;
}

function catalogFromDisk(): RuleCatalog {
  return JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as RuleCatalog;
}

function main(): void {
  const catalog = canonicalizeRuleCatalog(catalogFromDisk());
  const problems = validateRuleCatalog(catalog);
  if (problems.length > 0) {
    console.error('Rule catalog validation failed:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  const rendered = renderRuleCatalog(catalog);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(CATALOG) ? fs.readFileSync(CATALOG, 'utf8') : '';
    if (rendered !== current) {
      console.error(`${CATALOG} is stale. Run 'npm --prefix tools run generate:rule-catalog'.`);
      process.exit(1);
    }
    console.log(`OK — ${CATALOG} is current with ${catalog.rules.length} rule entries`);
    return;
  }

  fs.writeFileSync(CATALOG, rendered);
  console.log(`OK — regenerated ${CATALOG} with ${catalog.rules.length} rule entries`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

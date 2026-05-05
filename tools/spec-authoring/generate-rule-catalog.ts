#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Validates and canonicalizes AI-CONTRIBUTOR-RULE-CATALOG.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { AnySchema, ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import type { ClauseDetail, LevelDetail, PillarDetail, SpecScope } from './shared/spec-model.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const CATALOG_SCHEMA_FILE = 'AI-CONTRIBUTOR-RULE-CATALOG.schema.json';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const CATALOG_SCHEMA_PATH = path.join(REPO_ROOT, CATALOG_SCHEMA_FILE);
let cachedCatalogSchemaValidator: ValidateFunction<RuleCatalog> | null = null;

export interface RuleCatalog {
  $schema: string;
  schemaVersion: '0.1';
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

declare const validatedRuleCatalogBrand: unique symbol;

export type ValidatedRuleCatalog = RuleCatalog & {
  readonly [validatedRuleCatalogBrand]: true;
};

export type RuleCatalogValidationResult =
  | {
      ok: true;
      catalog: ValidatedRuleCatalog;
    }
  | {
      ok: false;
      problems: string[];
    };

function renderRuleCatalog(catalog: RuleCatalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

function canonicalizeRuleCatalog(catalog: RuleCatalog): RuleCatalog {
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

export function collectorAicIdsFromCatalog(
  catalog: ValidatedRuleCatalog,
): Record<string, string[]> {
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

export function validateRuleCatalog(catalog: unknown): RuleCatalogValidationResult {
  const validate = catalogSchemaValidator();
  if (!validate(catalog)) {
    return {
      ok: false,
      problems: (validate.errors ?? []).map(formatSchemaError),
    };
  }

  const problems = validateRuleCatalogSemantics(catalog);
  if (problems.length > 0) {
    return {
      ok: false,
      problems,
    };
  }
  return {
    ok: true,
    catalog: catalog as ValidatedRuleCatalog,
  };
}

export function assertRuleCatalog(catalog: unknown, label = CATALOG): ValidatedRuleCatalog {
  const result = validateRuleCatalog(catalog);
  if (!result.ok) {
    throw new Error(
      `Invalid ${label}:\n${result.problems.map((problem) => `- ${problem}`).join('\n')}`,
    );
  }
  return result.catalog;
}

function validateRuleCatalogSemantics(catalog: RuleCatalog): string[] {
  const problems: string[] = [];
  validatePillars(catalog.pillars, problems);
  validateLevels(catalog.levels, problems);
  validateClauses(catalog.clauses, catalog.pillars, problems);

  const knownClauses = new Map(catalog.clauses.map((clause) => [clause.number, clause]));
  const knownLevels = new Set(catalog.levels.map((level) => level.id));
  const seen = new Set<string>();
  for (const [i, rule] of catalog.rules.entries()) {
    const prefix = `rules[${i}]`;
    if (seen.has(rule.id)) problems.push(`${prefix}.id duplicates ${rule.id}`);
    seen.add(rule.id);
    const clause = knownClauses.get(rule.clause);
    if (!clause) {
      problems.push(`${prefix} references missing clause ${rule.clause}`);
    } else if (clause.pillar !== rule.pillar) {
      problems.push(
        `${prefix}.pillar ${rule.pillar} does not match clause ${rule.clause} pillar ${clause.pillar}`,
      );
    }
    if (!knownLevels.has(rule.level)) {
      problems.push(`${prefix} references missing level ${rule.level}`);
    }
  }

  return problems;
}

function catalogSchemaValidator(): ValidateFunction<RuleCatalog> {
  if (cachedCatalogSchemaValidator) return cachedCatalogSchemaValidator;
  const schema = JSON.parse(fs.readFileSync(CATALOG_SCHEMA_PATH, 'utf8')) as AnySchema;
  const ajv = new Ajv2020({ allErrors: true });
  const validate = ajv.compile<RuleCatalog>(schema);
  cachedCatalogSchemaValidator = validate;
  return validate;
}

function formatSchemaError(error: ErrorObject): string {
  const location = jsonPointerToPath(error.instancePath);
  if (error.keyword === 'required') {
    const missingProperty = String(error.params.missingProperty);
    return `${location} must have required property "${missingProperty}"`;
  }
  if (error.keyword === 'additionalProperties') {
    const additionalProperty = String(error.params.additionalProperty);
    return `${location} must not have additional property "${additionalProperty}"`;
  }
  return `${location} ${error.message ?? 'is invalid'}`;
}

function jsonPointerToPath(pointer: string): string {
  if (pointer === '') return CATALOG;
  const parts = pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  return `${CATALOG}.${parts.join('.')}`;
}

function validatePillars(pillars: readonly RuleCatalogPillar[], problems: string[]): void {
  const seen = new Set<number>();
  for (const [i, pillar] of pillars.entries()) {
    const prefix = `pillars[${i}]`;
    if (seen.has(pillar.number)) problems.push(`${prefix}.number duplicates ${pillar.number}`);
    seen.add(pillar.number);
  }
}

function validateLevels(levels: readonly RuleCatalogLevel[], problems: string[]): void {
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  for (const [i, level] of levels.entries()) {
    const prefix = `levels[${i}]`;
    if (seenIds.has(level.id)) problems.push(`${prefix}.id duplicates ${level.id}`);
    seenIds.add(level.id);
    if (seenOrders.has(level.order)) problems.push(`${prefix}.order duplicates ${level.order}`);
    seenOrders.add(level.order);
  }
}

function validateClauses(
  clauses: readonly RuleCatalogClause[],
  pillars: readonly RuleCatalogPillar[],
  problems: string[],
): void {
  const seen = new Set<number>();
  const knownPillars = new Set(pillars.map((pillar) => pillar.number));
  for (const [i, clause] of clauses.entries()) {
    const prefix = `clauses[${i}]`;
    if (seen.has(clause.number)) problems.push(`${prefix}.number duplicates ${clause.number}`);
    seen.add(clause.number);
    if (!knownPillars.has(clause.pillar)) {
      problems.push(`${prefix} references missing pillar ${clause.pillar}`);
    }
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

function main(): void {
  const parsedCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as unknown;
  const result = validateRuleCatalog(parsedCatalog);
  if (!result.ok) {
    console.error('Rule catalog validation failed:');
    for (const problem of result.problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  const catalog = canonicalizeRuleCatalog(result.catalog);
  const rendered = renderRuleCatalog(catalog);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(CATALOG_PATH) ? fs.readFileSync(CATALOG_PATH, 'utf8') : '';
    if (rendered !== current) {
      console.error(`${CATALOG} is stale. Run 'npm --prefix tools run generate:rule-catalog'.`);
      process.exit(1);
    }
    console.log(`OK — ${CATALOG} is current with ${catalog.rules.length} rule entries`);
    return;
  }

  fs.writeFileSync(CATALOG_PATH, rendered);
  console.log(`OK — regenerated ${CATALOG} with ${catalog.rules.length} rule entries`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

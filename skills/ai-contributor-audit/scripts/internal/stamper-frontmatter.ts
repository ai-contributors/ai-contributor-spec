// SPDX-License-Identifier: Apache-2.0
//
// Mechanical frontmatter and audit metadata stamping for audit-stamp.ts.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatDuration, stripInlineComment } from './audit-markdown.ts';

export interface StamperOptions {
  auditor?: string;
  runnerAgent?: string;
  runnerModel?: string;
  specSource?: string;
  summary?: string;
}

interface EvidenceFrontmatterSource {
  spec_source?: unknown;
  target?: {
    audited_commit?: unknown;
  };
}

const CROSS_FILE_KEYS = [
  'spec_source',
  'audited_commit',
  'auditor',
  'runner_agent',
  'runner_model',
] as const;

const CLEAN_FRONTMATTER_COMMENT_KEYS = new Set([
  'spec_version',
  'spec_source',
  'assessment_started_at',
  'assessment_completed_at',
  'assessment_duration',
  'audited_commit',
  'auditor',
  'validator_version',
  'collector_version',
  'runner_agent',
  'runner_model',
  'conformance_level',
]);

export function stampMechanicalFrontmatter(paths: {
  checklistPath: string;
  auditPath: string;
  evidencePath: string;
  originalAuditDir: string;
  options: StamperOptions;
}): string | null {
  const evidence = readEvidenceForFrontmatter(paths.evidencePath);
  const values: Record<string, string> = {};

  const auditedCommit = evidenceAuditedCommit(evidence) ?? gitHeadForAuditDirectory(paths);
  if (auditedCommit) values.audited_commit = auditedCommit;

  const specSource =
    paths.options.specSource ??
    envValue('AI_CONTRIBUTOR_SPEC_SOURCE') ??
    evidenceSpecSource(evidence) ??
    bootstrapManifestSpecSource(paths) ??
    specSourceFromRunbookPath();
  if (specSource) values.spec_source = specSource;

  const auditor = paths.options.auditor ?? envValue('AI_CONTRIBUTOR_AUDITOR');
  if (auditor) values.auditor = auditor;

  const runnerAgent = paths.options.runnerAgent ?? envValue('AI_CONTRIBUTOR_RUNNER_AGENT');
  if (runnerAgent) values.runner_agent = runnerAgent;

  const runnerModel = paths.options.runnerModel ?? envValue('AI_CONTRIBUTOR_RUNNER_MODEL');
  if (runnerModel) values.runner_model = runnerModel;

  for (const [key, value] of Object.entries(values)) {
    const cErr = writeFrontmatterKey(paths.checklistPath, key, value);
    if (cErr) return cErr;
    const aErr = writeFrontmatterKey(paths.auditPath, key, value);
    if (aErr) return aErr;
  }
  return null;
}

export function stampAuditTimestamps(paths: {
  checklistPath: string;
  auditPath: string;
  evidencePath: string;
}): string | null {
  let evidenceRaw: string;
  try {
    evidenceRaw = fs.readFileSync(paths.evidencePath, 'utf8');
  } catch {
    return (
      `Cannot stamp assessment timestamps: evidence JSON at ${paths.evidencePath} is missing. ` +
      `Run audit-collect.ts before audit-stamp.ts.`
    );
  }
  let evidence: { assessment_started_at?: unknown };
  try {
    evidence = JSON.parse(evidenceRaw);
  } catch (e) {
    return (
      `Cannot stamp assessment timestamps: evidence JSON at ${paths.evidencePath} is not valid JSON ` +
      `(${(e as Error).message}). Re-run audit-collect.ts.`
    );
  }
  const started = evidence.assessment_started_at;
  if (typeof started !== 'string' || started === '') {
    return (
      `Cannot stamp assessment timestamps: evidence JSON at ${paths.evidencePath} is missing assessment_started_at. ` +
      `Run audit-collect.ts before audit-stamp.ts.`
    );
  }
  const startedMs = Date.parse(started);
  if (!Number.isFinite(startedMs)) {
    return (
      `Cannot stamp assessment timestamps: evidence JSON at ${paths.evidencePath} has unparseable ` +
      `assessment_started_at "${started}". Re-run audit-collect.ts.`
    );
  }
  const now = new Date();
  const completed = now.toISOString();
  const durationSec = Math.max(0, Math.floor((now.getTime() - startedMs) / 1000));
  const duration = formatDuration(durationSec);

  const stamps: Record<string, string> = {
    assessment_started_at: started,
    assessment_completed_at: completed,
    assessment_duration: duration,
  };
  for (const filePath of [paths.checklistPath, paths.auditPath]) {
    const original = fs.readFileSync(filePath, 'utf8');
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    const lines = original.split(/\r?\n/);
    if (lines[0] !== '---') continue; // malformed — let the validator surface AUDIT002
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        end = i;
        break;
      }
    }
    if (end === -1) continue;
    for (let i = 1; i < end; i++) {
      const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (!m) continue;
      const key = m[1];
      if (key in stamps) {
        lines[i] = `${key}: ${stamps[key]}`;
      }
    }
    const out = lines.join(eol);
    if (out !== original) fs.writeFileSync(filePath, out);
  }
  return null;
}

export function stampFrontmatterVersions(paths: {
  filePath: string;
  validatorVersion: string;
  collectorVersion: string;
}): string | null {
  const original = fs.readFileSync(paths.filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  const stamps: Record<string, string> = {
    validator_version: `"${paths.validatorVersion}"`,
    collector_version: `"${paths.collectorVersion}"`,
  };
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (!(key in stamps)) continue;
    lines[i] = `${key}: ${stamps[key]}`;
  }
  const out = lines.join(eol);
  if (out === original) return null;
  fs.writeFileSync(paths.filePath, out);
  return null;
}

export function stampCrossFileEquality(paths: {
  checklistPath: string;
  auditPath: string;
}): string | null {
  const checklistRaw = fs.readFileSync(paths.checklistPath, 'utf8');
  const cLines = checklistRaw.split(/\r?\n/);
  if (cLines[0] !== '---') return null;
  let cEnd = -1;
  for (let i = 1; i < cLines.length; i++) {
    if (cLines[i] === '---') {
      cEnd = i;
      break;
    }
  }
  if (cEnd === -1) return null;

  const checklistValues = new Map<string, string>();
  for (let i = 1; i < cEnd; i++) {
    const m = cLines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (!(CROSS_FILE_KEYS as readonly string[]).includes(key)) continue;
    let v = m[2];
    v = stripInlineComment(v).trim();
    // Preserve quoted form for fields where the spec template uses quotes.
    checklistValues.set(key, v);
  }

  for (const key of CROSS_FILE_KEYS) {
    const v = checklistValues.get(key);
    if (v === undefined || v === '') continue;
    const err = writeFrontmatterKey(paths.auditPath, key, v);
    if (err) return err;
  }
  return null;
}

export function stripPopulatedFrontmatterComments(filePath: string): string | null {
  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (!CLEAN_FRONTMATTER_COMMENT_KEYS.has(key)) continue;
    const value = stripInlineComment(m[2]).trim();
    if (value === '') continue;
    lines[i] = `${key}: ${value}`;
  }

  const out = lines.join(eol);
  if (out === original) return null;
  fs.writeFileSync(filePath, out);
  return null;
}

export function normalizeAuditLogMarkerProse(auditPath: string): string | null {
  const original = fs.readFileSync(auditPath, 'utf8');
  const normalized = original.replace(
    /Rows between `<!-- BEGIN:STAMPED-COLLECTOR-ROWS -->\s*<!-- END:STAMPED-COLLECTOR-ROWS -->` are written by/g,
    'Rows between the `BEGIN:STAMPED-COLLECTOR-ROWS` and `END:STAMPED-COLLECTOR-ROWS` markers are written by',
  );
  if (normalized === original) return null;
  fs.writeFileSync(auditPath, normalized);
  return null;
}

function readEvidenceForFrontmatter(evidencePath: string): EvidenceFrontmatterSource | null {
  try {
    return JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as EvidenceFrontmatterSource;
  } catch {
    // stampAuditTimestamps surfaces missing or invalid evidence as a hard
    // error. Mechanical frontmatter stamping should not produce a duplicate
    // diagnostic before that pass runs.
    return null;
  }
}

function evidenceAuditedCommit(evidence: EvidenceFrontmatterSource | null): string | null {
  const v = evidence?.target?.audited_commit;
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function evidenceSpecSource(evidence: EvidenceFrontmatterSource | null): string | null {
  const v = evidence?.spec_source;
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function envValue(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function gitHeadForAuditDirectory(paths: {
  originalAuditDir: string;
  auditPath: string;
}): string | null {
  try {
    const cwd = paths.originalAuditDir || path.dirname(path.resolve(paths.auditPath));
    return (
      execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

function bootstrapManifestSpecSource(paths: {
  originalAuditDir: string;
  auditPath: string;
}): string | null {
  for (const base of manifestSearchRoots(paths)) {
    const found = findUp(base, 'AI-CONTRIBUTOR-RUNBOOK-MANIFEST.json');
    if (!found) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(found, 'utf8')) as { spec_source?: unknown };
      if (typeof raw.spec_source === 'string' && raw.spec_source.trim() !== '') {
        return raw.spec_source.trim();
      }
    } catch {
      continue;
    }
  }
  return null;
}

function manifestSearchRoots(paths: { originalAuditDir: string; auditPath: string }): string[] {
  const roots = [
    paths.originalAuditDir || path.dirname(path.resolve(paths.auditPath)),
    process.cwd(),
    path.dirname(fileURLToPath(import.meta.url)),
  ];
  return Array.from(new Set(roots));
}

function findUp(start: string, filename: string): string | null {
  let dir = path.resolve(start);
  while (true) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function specSourceFromRunbookPath(): string | null {
  const scriptPath = fileURLToPath(import.meta.url);
  const parts = scriptPath.split(path.sep);
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i] !== '.ai-contributor-audit') continue;
    const ref = parts[i + 1];
    if (/^[0-9a-f]{40}$/.test(ref) || /^v\d+\.\d+(?:\.\d+)?$/.test(ref)) {
      return `https://github.com/ai-contributors/ai-contributor-spec/tree/${ref}`;
    }
  }
  return null;
}

function writeFrontmatterKey(filePath: string, key: string, value: string): string | null {
  const original = fs.readFileSync(filePath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  for (let i = 1; i < end; i++) {
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:(.*)$/);
    if (!m) continue;
    if (m[1] !== key) continue;
    lines[i] = `${key}: ${value}`;
    break;
  }
  const out = lines.join(eol);
  if (out === original) return null;
  fs.writeFileSync(filePath, out);
  return null;
}

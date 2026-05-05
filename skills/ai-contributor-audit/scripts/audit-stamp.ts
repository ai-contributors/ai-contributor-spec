#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-stamp.ts — pure file mutator for the AI Contributor audit pair.
//
// Reads:
//   - AI-CONTRIBUTOR-CHECKLIST.md (positional 1)
//   - AI-CONTRIBUTOR-AUDIT-LOG.md  (positional 2)
//   - AI-CONTRIBUTOR-EVIDENCE.json (next to the audit log; override with
//                                   --evidence <path>)
//
// Writes derivable content into the checklist and audit log:
//   - assessment_started_at / assessment_completed_at / assessment_duration
//   - spec_source / audited_commit / auditor / runner_agent / runner_model
//   - validator_version / collector_version
//   - collector-derived row A + Status + Comment cells (modern-shape rows)
//   - Conformance level summary table Status plus Date reached preservation
//   - conformance_level frontmatter key (both files)
//   - Root Backlog table derived columns
//     (Priority/Level/Rule/Scope/Current status)
//   - Root AI-CONTRIBUTOR-AUDIT.md summary report
//
// The audit skill bootstraps this script and its sibling audit-markdown.ts
// from the pinned `spec_source` ref and runs it via `npx --yes tsx@4.21.0`
// when the target repository has not vendored the audit runtime. Keep
// imports limited to node:* builtins and shipped sibling modules.
//
// Usage:
//   tsx audit-stamp.ts --help
//   tsx audit-stamp.ts <checklist.md> <audit-log.md> [--evidence <path>]
//     [--auditor <name>] [--runner-agent <id>] [--runner-model <id>]
//     [--spec-source <immutable-source>] [--diff | --check]
//
// `--check` is a CI-friendly read-only dry run: it stamps into a temp copy,
// compares with the on-disk files, prints a one-line summary listing any
// files that would change, and exits 3 when stamping would mutate anything.
// Use it to gate "audit out of date" without depending on the validator.
//
// Exit codes:
//   0  stamping completed (or, in --check mode, no changes would be made)
//   1  stamping failed (evidence JSON missing/invalid, malformed table)
//   2  CLI / parser error
//   3  --check found pending changes (audit artifacts are out of date)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  commentHasDirectEvidence,
  looksLikeCommand,
  normalizeMarkdownTablesInFile,
  parseChecklistRules,
} from './internal/audit-markdown.ts';
import {
  stampAuditTimestamps,
  stampCrossFileEquality,
  stampFrontmatterVersions,
  stampMechanicalFrontmatter,
  stripPopulatedFrontmatterComments,
  type StamperOptions,
} from './internal/stamper-frontmatter.ts';
import {
  stampBacklog,
  stampConformanceLevel,
  stampRootAuditSummary,
  stampSummary,
} from './internal/stamper-audit-summary.ts';
import {
  ensureDerivedEvidenceArtifactCitations,
  stampDerivedRuleStatuses,
} from './internal/stamper-checklist-status.ts';
import {
  stampAuditLogCollectorRows,
  stampVerificationGaps,
} from './internal/stamper-evidence-blocks.ts';

// Bumped whenever validator behaviour or the required frontmatter shape
// changes. Recorded in audit frontmatter as `validator_version` so two
// audits of the same repo can be compared knowing which validator they
// were run against.
export const VALIDATOR_VERSION = '0.1.0';

// Mirror of the `COLLECTOR_VERSION` constant exported by audit-collect.ts.
// Kept in this file so audit-run.ts can read the version without executing
// imports. When bumping audit-collect.ts's COLLECTOR_VERSION, bump this
// constant in lockstep.
export const COLLECTOR_VERSION = '0.1.0';

interface StamperContext {
  checklistPath: string;
  auditPath: string;
  evidencePath: string;
  summaryPath: string;
  originalAuditDir: string;
  options: StamperOptions;
}

const USAGE =
  'Usage: audit-stamp.ts <checklist.md> <audit-log.md> [--evidence <path>] [--summary <path>] [--auditor <name>] [--runner-agent <id>] [--runner-model <id>] [--spec-source <immutable-source>] [--diff | --check]';

// --------------------------------------------------------------------------
// Programmatic entry point

export interface StamperResult {
  exitCode: 0 | 1 | 2 | 3;
  stdout: string;
  stderr: string;
}

// After stamping, scan the checklist for Warning/Alarm rows whose Comment
// lacks an evidence citation (the AUDIT034 condition). The validator catches
// these too, but surfacing them up-front in one batch lets auditors fix all
// of them in a single pass instead of discovering them one validate call at
// a time.
function collectNeedsEvidenceAdvisory(checklistPath: string): string[] {
  if (!fs.existsSync(checklistPath)) return [];
  const lines = fs.readFileSync(checklistPath, 'utf8').split('\n');
  const rules = parseChecklistRules(lines);
  const out: string[] = [];
  for (const r of rules) {
    if (r.status !== '⚠️ Warning' && r.status !== '🚨 Alarm') continue;
    if (commentHasDirectEvidence(r.comment)) continue;
    if (hasCommandLikeBacktick(r.comment)) continue;
    out.push(
      `  ${checklistPath}:${r.line}: ${r.status} "${r.rule}" — Comment lacks a backticked file/path/command citation`,
    );
  }
  return out;
}

// Sibling advisory: list every non-optional row whose Status is still empty
// after stamping. The validator (AUDIT015) eventually catches these one row
// at a time, but in real audits the count is dozens, and the agent ends up
// writing ad-hoc node scripts to scrape the table. Surfacing the list here,
// each row annotated with the collector's reason for not deciding, lets the
// agent batch-fill in a single pass.
function collectNeedsStatusAdvisory(
  checklistPath: string,
  evidencePath: string,
): { lines: string[]; count: number } {
  if (!fs.existsSync(checklistPath)) return { lines: [], count: 0 };
  const checklistLines = fs.readFileSync(checklistPath, 'utf8').split('\n');
  const rules = parseChecklistRules(checklistLines);

  // Build aic_id -> evidence rule reverse index, plus a name->reason map for
  // rows whose checklist rule name matches an evidence rule name (collector
  // rules that the checklist hosts under a stable rule label).
  const reasonByAic = new Map<string, string>();
  const reasonByRuleName = new Map<string, string>();
  if (fs.existsSync(evidencePath)) {
    try {
      const ev = JSON.parse(fs.readFileSync(evidencePath, 'utf8')) as {
        rules?: Record<
          string,
          {
            aic_ids?: string[];
            spec_rule_name?: string;
            judgment_required?: boolean;
            derivation_reason?: string;
            applicability?: { verdict?: string };
          }
        >;
      };
      for (const rule of Object.values(ev.rules ?? {})) {
        const reason =
          rule.derivation_reason && rule.derivation_reason.trim() !== ''
            ? rule.derivation_reason
            : `applicability=${rule.applicability?.verdict ?? 'unknown'}`;
        const tag =
          rule.judgment_required === true ? `judgment-required: ${reason}` : `collector: ${reason}`;
        for (const id of rule.aic_ids ?? []) reasonByAic.set(id, tag);
        if (rule.spec_rule_name) reasonByRuleName.set(rule.spec_rule_name, tag);
      }
    } catch {
      // Invalid JSON — earlier stamp passes would have failed already; just
      // proceed without collector hints.
    }
  }

  const out: string[] = [];
  let count = 0;
  for (const r of rules) {
    if (r.scope === 'MAY') continue;
    if (r.status !== '') continue;
    count++;
    let hint = 'no collector coverage';
    for (const id of r.ids) {
      const found = reasonByAic.get(id);
      if (found) {
        hint = found;
        break;
      }
    }
    if (hint === 'no collector coverage') {
      const byName = reasonByRuleName.get(r.rule);
      if (byName) hint = byName;
    }
    const ids = r.ids.length > 0 ? ` IDs=[${r.ids.join(', ')}]` : '';
    out.push(
      `  ${checklistPath}:${r.line}: [${r.minLevel}] ${r.scope} "${r.rule}" —${ids} ${hint}`,
    );
  }
  return { lines: out, count };
}

// audit-stamp re-derives `assessment_completed_at` and `assessment_duration`
// from wall-clock time on every run, so a literal byte comparison would
// always report drift. --check is meant to gate "stamped artifacts are out
// of date with the evidence JSON", not "the file timestamps have advanced",
// so we strip the wall-clock-derived frontmatter fields before comparing.
function sideBySideTmpPath(target: string): string {
  const resolved = path.resolve(target);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved);
  const rand = Math.random().toString(36).slice(2, 10);
  return path.join(dir, `.${base}.audit-stamp-check-${rand}`);
}

function normalizeForCheck(text: string): string {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return text;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end < 0) return text;
  const skip = /^(assessment_completed_at|assessment_duration):/;
  const out = lines
    .slice(0, end + 1)
    .filter((line, idx) => idx === 0 || idx === end || !skip.test(line));
  out.push(...lines.slice(end + 1));
  return out.join('\n');
}

function hasCommandLikeBacktick(comment: string): boolean {
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(comment))) {
    if (looksLikeCommand(m[1].trim())) return true;
  }
  return false;
}

function runStampPasses(ctx: StamperContext): string | null {
  // 1. Mechanical frontmatter fields (both files).
  let err = stampMechanicalFrontmatter({
    checklistPath: ctx.checklistPath,
    auditPath: ctx.auditPath,
    evidencePath: ctx.evidencePath,
    originalAuditDir: ctx.originalAuditDir,
    options: ctx.options,
  });
  if (err !== null) return err;

  // 2. Timestamps (audit log frontmatter).
  err = stampAuditTimestamps({
    checklistPath: ctx.checklistPath,
    auditPath: ctx.auditPath,
    evidencePath: ctx.evidencePath,
  });
  if (err !== null) return err;

  // 3. validator_version / collector_version (both files).
  err = stampFrontmatterVersions({
    filePath: ctx.checklistPath,
    validatorVersion: VALIDATOR_VERSION,
    collectorVersion: COLLECTOR_VERSION,
  });
  if (err !== null) return err;
  err = stampFrontmatterVersions({
    filePath: ctx.auditPath,
    validatorVersion: VALIDATOR_VERSION,
    collectorVersion: COLLECTOR_VERSION,
  });
  if (err !== null) return err;

  // 4. Collector-derived row A + Status + Comment (checklist).
  err = stampDerivedRuleStatuses({
    checklistPath: ctx.checklistPath,
    evidencePath: ctx.evidencePath,
  });
  if (err !== null) return err;

  // 4b. Defensive citation: rows the validator (AUDIT039) requires to cite
  //     AI-CONTRIBUTOR-EVIDENCE.json get the citation appended if an
  //     auditor-edited Comment dropped it. Auto-stamped comments already
  //     contain it via AUTO_STAMP_PREFIX; this only mutates auditor-edited
  //     Fulfilled comments that are missing the citation.
  err = ensureDerivedEvidenceArtifactCitations({
    checklistPath: ctx.checklistPath,
  });
  if (err !== null) return err;

  // 5. Audit-log evidence rows for collector-derived rules. No dependency
  // on the checklist row statuses; placed before summary/backlog so the
  // audit log is settled before the run-summary stdout line is produced.
  err = stampAuditLogCollectorRows({
    auditPath: ctx.auditPath,
    evidencePath: ctx.evidencePath,
  });
  if (err !== null) return err;

  // 6. Backlog table (depends on row statuses, so runs after step 4).
  err = stampBacklog({
    checklistPath: ctx.checklistPath,
    summaryPath: ctx.summaryPath,
  });
  if (err !== null) return err;

  // 7. Conformance summary table (also depends on row statuses).
  err = stampSummary({
    checklistPath: ctx.checklistPath,
  });
  if (err !== null) return err;

  // 8. conformance_level frontmatter (depends on the just-stamped summary).
  err = stampConformanceLevel({
    checklistPath: ctx.checklistPath,
    auditPath: ctx.auditPath,
  });
  if (err !== null) return err;

  // 9. Verification gaps (depends on row statuses written in step 4).
  err = stampVerificationGaps({
    checklistPath: ctx.checklistPath,
    evidencePath: ctx.evidencePath,
  });
  if (err !== null) return err;

  // 10. Cross-file equality (last — copies values that earlier stamps may
  // have written, including conformance_level, auditor, etc.).
  err = stampCrossFileEquality({
    checklistPath: ctx.checklistPath,
    auditPath: ctx.auditPath,
  });
  if (err !== null) return err;

  // 11. Filled audit output should not retain template guidance in populated
  // frontmatter lines.
  err = stripPopulatedFrontmatterComments(ctx.checklistPath);
  if (err !== null) return err;
  err = stripPopulatedFrontmatterComments(ctx.auditPath);
  if (err !== null) return err;

  // 12. Root summary report (copies the just-stamped checklist summary and
  // backlog sections, plus the badge matching conformance_level).
  err = stampRootAuditSummary({
    checklistPath: ctx.checklistPath,
    auditPath: ctx.auditPath,
    evidencePath: ctx.evidencePath,
    summaryPath: ctx.summaryPath,
    originalAuditDir: ctx.originalAuditDir,
  });
  if (err !== null) return err;

  // 13. Normalize ordinary Markdown table blocks after all stamping passes so
  // generated audit output is stable under project-level Prettier checks.
  err = normalizeMarkdownTablesInFile(ctx.checklistPath);
  if (err !== null) return err;
  err = normalizeMarkdownTablesInFile(ctx.auditPath);
  if (err !== null) return err;
  err = normalizeMarkdownTablesInFile(ctx.summaryPath);
  if (err !== null) return err;

  return null;
}

function diffFiles(pairs: Array<[string, string]>): string {
  const chunks: string[] = [];
  for (const [currentPath, stampedPath] of pairs) {
    const current = fs.existsSync(currentPath) ? fs.readFileSync(currentPath, 'utf8') : '';
    const stamped = fs.readFileSync(stampedPath, 'utf8');
    if (current === stamped) continue;
    const res = spawnSync(
      'git',
      ['diff', '--no-index', '--no-color', '--', currentPath, stampedPath],
      { encoding: 'utf8' },
    );
    let out = res.stdout;
    if (!out) {
      out =
        `diff -- ${currentPath} ${currentPath} (stamped)\n` +
        `--- ${currentPath}\n` +
        `+++ ${currentPath} (stamped)\n` +
        `@@ files differ; git diff --no-index did not produce output @@\n`;
    }
    out = out
      .split(stampedPath)
      .join(`${currentPath} (stamped)`)
      .split(currentPath)
      .join(currentPath);
    chunks.push(out.trimEnd());
  }
  return chunks.join('\n');
}

function defaultSummaryPath(checklistPath: string): string {
  const full = path.resolve(checklistPath);
  const dir = path.dirname(full);
  if (path.basename(dir) === '.ai-contributor-audit') {
    return path.join(path.dirname(dir), 'AI-CONTRIBUTOR-AUDIT.md');
  }
  return path.join(dir, 'AI-CONTRIBUTOR-AUDIT.md');
}

export function runStamper(argv: string[]): StamperResult {
  const stdoutBuf: string[] = [];
  const stderrBuf: string[] = [];

  const POSITIONAL: string[] = [];
  let evidenceOverride: string | null = null;
  let diffMode = false;
  let checkMode = false;
  const opts: StamperOptions = {};
  if (argv.includes('--help') || argv.includes('-h')) {
    stdoutBuf.push(USAGE);
    return { exitCode: 0, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--evidence') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--evidence requires a path argument');
        return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      evidenceOverride = v;
      i++;
      continue;
    }
    if (a === '--diff') {
      diffMode = true;
      continue;
    }
    if (a === '--check') {
      checkMode = true;
      continue;
    }
    if (a === '--auditor') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--auditor requires a value');
        return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      opts.auditor = v;
      i++;
      continue;
    }
    if (a === '--runner-agent') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--runner-agent requires a value');
        return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      opts.runnerAgent = v;
      i++;
      continue;
    }
    if (a === '--runner-model') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--runner-model requires a value');
        return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      opts.runnerModel = v;
      i++;
      continue;
    }
    if (a === '--spec-source') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--spec-source requires a value');
        return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      opts.specSource = v;
      i++;
      continue;
    }
    if (a === '--summary') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        stderrBuf.push('--summary requires a path argument');
        return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      opts.summary = v;
      i++;
      continue;
    }
    if (a.startsWith('--')) {
      stderrBuf.push(`unknown flag: ${a}`);
      return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
    }
    POSITIONAL.push(a);
  }

  if (POSITIONAL.length !== 2) {
    stderrBuf.push(USAGE);
    return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
  }
  if (diffMode && checkMode) {
    stderrBuf.push('--diff and --check are mutually exclusive');
    return { exitCode: 2, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
  }

  const originalChecklistPath = POSITIONAL[0];
  const originalAuditPath = POSITIONAL[1];
  const ctx: StamperContext = {
    checklistPath: originalChecklistPath,
    auditPath: originalAuditPath,
    evidencePath: evidenceOverride
      ? path.resolve(evidenceOverride)
      : path.join(path.dirname(path.resolve(originalAuditPath)), 'AI-CONTRIBUTOR-EVIDENCE.json'),
    summaryPath: opts.summary
      ? path.resolve(opts.summary)
      : defaultSummaryPath(originalChecklistPath),
    originalAuditDir: path.dirname(path.resolve(originalAuditPath)),
    options: opts,
  };

  // Sanity-check the input files exist before mutating anything.
  for (const p of [originalChecklistPath, originalAuditPath]) {
    if (!fs.existsSync(p)) {
      stderrBuf.push(`audit-stamp: cannot read ${p}: file does not exist`);
      return { exitCode: 1, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
    }
  }

  if (checkMode) {
    // Stamp into temp files placed in the SAME directories as the real
    // artifacts. The stamper resolves cross-file relative paths against
    // each file's own dirname (notably the root summary's artifact links
    // and any path-rel computation), so a separate tmp tree would diverge
    // on layout-only fields and report false drift.
    const checklistTmp = sideBySideTmpPath(originalChecklistPath);
    const auditTmp = sideBySideTmpPath(originalAuditPath);
    const summaryTmp = sideBySideTmpPath(ctx.summaryPath);
    const cleanup = () => {
      for (const p of [checklistTmp, auditTmp, summaryTmp]) {
        try {
          fs.rmSync(p, { force: true });
        } catch {
          /* best effort */
        }
      }
    };
    try {
      fs.copyFileSync(originalChecklistPath, checklistTmp);
      fs.copyFileSync(originalAuditPath, auditTmp);
      const summaryExisted = fs.existsSync(ctx.summaryPath);
      if (summaryExisted) fs.copyFileSync(ctx.summaryPath, summaryTmp);
      else fs.writeFileSync(summaryTmp, '');
      const stampedCtx: StamperContext = {
        ...ctx,
        checklistPath: checklistTmp,
        auditPath: auditTmp,
        summaryPath: summaryTmp,
      };
      const err = runStampPasses(stampedCtx);
      if (err !== null) {
        stderrBuf.push(err);
        return { exitCode: 1, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      // The stamper renders cross-file links using the paths it received. In
      // check mode those are tmp filenames, so before comparing we rewrite
      // each tmp basename back to the canonical one.
      const basenameMap: Array<[string, string]> = [
        [path.basename(checklistTmp), path.basename(originalChecklistPath)],
        [path.basename(auditTmp), path.basename(originalAuditPath)],
        [path.basename(summaryTmp), path.basename(ctx.summaryPath)],
      ];
      const restoreBasenames = (text: string): string => {
        let out = text;
        for (const [tmpName, realName] of basenameMap) {
          out = out.split(tmpName).join(realName);
        }
        return out;
      };
      const pairs: Array<[string, string, boolean]> = [
        [originalChecklistPath, checklistTmp, true],
        [originalAuditPath, auditTmp, true],
        [ctx.summaryPath, summaryTmp, summaryExisted],
      ];
      const changed: string[] = [];
      for (const [origPath, stampedPath, originalExists] of pairs) {
        const original = originalExists ? fs.readFileSync(origPath, 'utf8') : '';
        const stamped = restoreBasenames(fs.readFileSync(stampedPath, 'utf8'));
        if (normalizeForCheck(original) !== normalizeForCheck(stamped)) changed.push(origPath);
      }
      if (changed.length === 0) {
        stdoutBuf.push('OK — audit-stamp --check: no changes (audit artifacts are up to date)');
        return { exitCode: 0, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      stdoutBuf.push(
        `audit-stamp --check: ${changed.length} file${changed.length === 1 ? '' : 's'} would be rewritten by audit-stamp:`,
      );
      for (const f of changed) stdoutBuf.push(`  ${f}`);
      stdoutBuf.push(
        'Re-run audit-stamp.ts (or `npm --prefix tools run audit:stamp`) and commit the result. Use --diff to inspect the pending changes.',
      );
      return { exitCode: 3, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
    } finally {
      cleanup();
    }
  }

  if (diffMode) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-stamp-diff-'));
    try {
      const tmpChecklist = path.join(tmp, path.basename(originalChecklistPath));
      const tmpAudit = path.join(tmp, path.basename(originalAuditPath));
      const tmpSummary = path.join(tmp, path.basename(ctx.summaryPath));
      fs.copyFileSync(originalChecklistPath, tmpChecklist);
      fs.copyFileSync(originalAuditPath, tmpAudit);
      if (fs.existsSync(ctx.summaryPath)) fs.copyFileSync(ctx.summaryPath, tmpSummary);
      else fs.writeFileSync(tmpSummary, '');
      const stampedCtx: StamperContext = {
        ...ctx,
        checklistPath: tmpChecklist,
        auditPath: tmpAudit,
        summaryPath: tmpSummary,
      };
      const err = runStampPasses(stampedCtx);
      if (err !== null) {
        stderrBuf.push(err);
        return { exitCode: 1, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
      }
      const diff = diffFiles([
        [originalChecklistPath, tmpChecklist],
        [originalAuditPath, tmpAudit],
        [opts.summary ?? defaultSummaryPath(originalChecklistPath), tmpSummary],
      ]);
      stdoutBuf.push(diff || 'OK — audit-stamp --diff: no changes');
      return { exitCode: 0, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const err = runStampPasses(ctx);
  if (err !== null) {
    stderrBuf.push(err);
    return { exitCode: 1, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
  }

  const advisory = collectNeedsEvidenceAdvisory(ctx.checklistPath);
  if (advisory.length > 0) {
    stderrBuf.push(
      `[audit-stamp] needs-evidence: ${advisory.length} Warning/Alarm row${advisory.length === 1 ? '' : 's'} lack a backticked citation (validator AUDIT034 will fail until each Comment cites a file:line, file § Heading, backticked path, or backticked command):`,
    );
    for (const line of advisory) stderrBuf.push(line);
  }

  const statusAdvisory = collectNeedsStatusAdvisory(ctx.checklistPath, ctx.evidencePath);
  if (statusAdvisory.count > 0) {
    stderrBuf.push(
      `[audit-stamp] needs-status: ${statusAdvisory.count} non-optional row${statusAdvisory.count === 1 ? '' : 's'} have empty Status (validator AUDIT015 will fail until each is filled with a status + evidence). Hints come from the matching collector rule in AI-CONTRIBUTOR-EVIDENCE.json:`,
    );
    for (const line of statusAdvisory.lines) stderrBuf.push(line);
  }

  stdoutBuf.push(
    `OK — stamped checklist + audit log + summary (validator_version=${VALIDATOR_VERSION}, collector_version=${COLLECTOR_VERSION})`,
  );
  return { exitCode: 0, stdout: stdoutBuf.join('\n'), stderr: stderrBuf.join('\n') };
}

// CLI shim is below function declarations so direct imports can call
// runStamper() without executing the command.

const invokedAsScript =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  const result = runStamper(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout + '\n');
  if (result.stderr) process.stderr.write(result.stderr + '\n');
  process.exit(result.exitCode);
}

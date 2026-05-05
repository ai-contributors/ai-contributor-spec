#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// Renders the shipped root audit summary and audit-log template from Markdown
// templates and AI-CONTRIBUTOR-RULE-CATALOG.json. The templates own audit
// workflow prose and stamped markers; the catalog owns shared version and
// conformance-level facts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  validateRuleCatalog,
  type RuleCatalog,
  type RuleCatalogLevel,
} from './generate-rule-catalog.ts';
import { renderMarkdownTable } from '../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';

const CATALOG = 'AI-CONTRIBUTOR-RULE-CATALOG.json';
const AUDIT_SUMMARY = 'AI-CONTRIBUTOR-AUDIT.md';
const AUDIT_LOG = '.ai-contributor-audit/AI-CONTRIBUTOR-AUDIT-LOG.md';
const AUDIT_SUMMARY_TEMPLATE = 'tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT.md.template';
const AUDIT_LOG_TEMPLATE = 'tools/spec-authoring/templates/AI-CONTRIBUTOR-AUDIT-LOG.md.template';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CATALOG_PATH = path.join(REPO_ROOT, CATALOG);
const AUDIT_SUMMARY_PATH = path.join(REPO_ROOT, AUDIT_SUMMARY);
const AUDIT_LOG_PATH = path.join(REPO_ROOT, AUDIT_LOG);
const AUDIT_SUMMARY_TEMPLATE_PATH = path.join(REPO_ROOT, AUDIT_SUMMARY_TEMPLATE);
const AUDIT_LOG_TEMPLATE_PATH = path.join(REPO_ROOT, AUDIT_LOG_TEMPLATE);
const TEMPLATE_DIRECTIVE = /{{\s*([^{}]+?)\s*}}/g;

interface AuditTemplateOutput {
  summaryContent: string;
  auditLogContent: string;
}

interface AuditTemplateRenderResult extends AuditTemplateOutput {
  problems: string[];
}

type DirectiveRenderer = (catalog: RuleCatalog) => string;

const AUDIT_SUMMARY_DIRECTIVES = {
  'generated:conformance-level-summary-rows': renderConformanceLevelSummaryRows,
} satisfies Record<string, DirectiveRenderer>;

const AUDIT_LOG_DIRECTIVES = {
  specVersion: (catalog: RuleCatalog) => catalog.specVersion,
  'generated:conformance-level-values': renderConformanceLevelValues,
} satisfies Record<string, DirectiveRenderer>;

export function renderAuditTemplates(
  catalog: RuleCatalog,
  templates: {
    summaryTemplateContent: string;
    auditLogTemplateContent: string;
  },
): AuditTemplateOutput {
  const catalogProblems = validateRuleCatalog(catalog);
  if (catalogProblems.length > 0) {
    throw new Error(`Rule catalog validation failed:\n${catalogProblems.join('\n')}`);
  }

  const result = renderAuditTemplateResult(catalog, templates);
  if (result.problems.length > 0) {
    throw new Error(result.problems.join('\n'));
  }
  return {
    summaryContent: result.summaryContent,
    auditLogContent: result.auditLogContent,
  };
}

export function auditTemplateProblems(input: {
  catalog: RuleCatalog;
  summaryTemplateContent: string;
  auditLogTemplateContent: string;
  summaryContent: string;
  auditLogContent: string;
}): string[] {
  const problems = validateRuleCatalog(input.catalog);
  if (problems.length > 0) return problems;

  const result = renderAuditTemplateResult(input.catalog, {
    summaryTemplateContent: input.summaryTemplateContent,
    auditLogTemplateContent: input.auditLogTemplateContent,
  });
  problems.push(...result.problems);
  if (result.problems.length === 0 && result.summaryContent !== input.summaryContent) {
    problems.push(
      `${AUDIT_SUMMARY} does not match ${AUDIT_SUMMARY_TEMPLATE} and ${CATALOG}. Run 'npm --prefix tools run generate:audit-templates'.`,
    );
  }
  if (result.problems.length === 0 && result.auditLogContent !== input.auditLogContent) {
    problems.push(
      `${AUDIT_LOG} does not match ${AUDIT_LOG_TEMPLATE} and ${CATALOG}. Run 'npm --prefix tools run generate:audit-templates'.`,
    );
  }
  return problems;
}

function renderAuditTemplateResult(
  catalog: RuleCatalog,
  templates: {
    summaryTemplateContent: string;
    auditLogTemplateContent: string;
  },
): AuditTemplateRenderResult {
  const problems: string[] = [];
  const summaryContent = renderTemplate({
    catalog,
    templateContent: templates.summaryTemplateContent,
    templatePath: AUDIT_SUMMARY_TEMPLATE,
    label: 'audit summary template',
    directives: AUDIT_SUMMARY_DIRECTIVES,
    problems,
  });
  const auditLogContent = renderTemplate({
    catalog,
    templateContent: templates.auditLogTemplateContent,
    templatePath: AUDIT_LOG_TEMPLATE,
    label: 'audit log template',
    directives: AUDIT_LOG_DIRECTIVES,
    problems,
  });

  return {
    summaryContent,
    auditLogContent,
    problems,
  };
}

function renderTemplate(input: {
  catalog: RuleCatalog;
  templateContent: string;
  templatePath: string;
  label: string;
  directives: Record<string, DirectiveRenderer>;
  problems: string[];
}): string {
  const usedDirectives = new Map<string, number>();
  const content = input.templateContent.replace(TEMPLATE_DIRECTIVE, (marker, directive: string) => {
    const directiveName = directive.trim();
    const renderDirective = input.directives[directiveName];
    if (!renderDirective) {
      input.problems.push(
        `${input.templatePath} contains unknown audit template directive {{${directiveName}}}.`,
      );
      return marker;
    }
    usedDirectives.set(directiveName, (usedDirectives.get(directiveName) ?? 0) + 1);
    return renderDirective(input.catalog);
  });

  for (const directiveName of Object.keys(input.directives)) {
    const count = usedDirectives.get(directiveName) ?? 0;
    if (count === 0) {
      input.problems.push(`No ${input.label} directive found for ${directiveName}.`);
    } else if (count > 1) {
      input.problems.push(
        `${input.label} contains ${count} template directives for ${directiveName}.`,
      );
    }
  }

  if (TEMPLATE_DIRECTIVE.test(content)) {
    input.problems.push(
      `${input.templatePath} rendered output still contains unresolved directives.`,
    );
  }
  TEMPLATE_DIRECTIVE.lastIndex = 0;

  return ensureTrailingNewline(content);
}

function renderConformanceLevelValues(catalog: RuleCatalog): string {
  return conformanceLevelsFromCatalog(catalog).map(conformanceLevelValue).join(', ');
}

function renderConformanceLevelSummaryRows(catalog: RuleCatalog): string {
  return renderMarkdownTable(
    ['Level', 'Status', 'Date reached', 'Notes'],
    conformanceLevelsFromCatalog(catalog).map((level) => [
      `**${levelDisplayName(level)}**`,
      '<FILL_STATUS>',
      '<FILL_DATE>',
      '<FILL_NOTES>',
    ]),
  )
    .slice(2)
    .join('\n');
}

function conformanceLevelsFromCatalog(catalog: RuleCatalog): RuleCatalogLevel[] {
  return catalog.levels
    .filter((level) => level.id !== '—')
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function levelDisplayName(level: RuleCatalogLevel): string {
  const m = level.id.match(/^L(\d+)$/);
  return m ? `Level ${m[1]} — ${level.label}` : level.label;
}

function conformanceLevelValue(level: RuleCatalogLevel): string {
  const m = level.id.match(/^L(\d+)$/);
  return m ? m[1]! : level.id;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function loadCatalog(): RuleCatalog {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as RuleCatalog;
  const problems = validateRuleCatalog(catalog);
  if (problems.length > 0) {
    throw new Error(`Invalid ${CATALOG}:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  }
  return catalog;
}

function main(): void {
  const catalog = loadCatalog();
  const summaryTemplateContent = fs.readFileSync(AUDIT_SUMMARY_TEMPLATE_PATH, 'utf8');
  const auditLogTemplateContent = fs.readFileSync(AUDIT_LOG_TEMPLATE_PATH, 'utf8');

  if (process.argv.includes('--check')) {
    const problems = auditTemplateProblems({
      catalog,
      summaryTemplateContent,
      auditLogTemplateContent,
      summaryContent: fs.readFileSync(AUDIT_SUMMARY_PATH, 'utf8'),
      auditLogContent: fs.readFileSync(AUDIT_LOG_PATH, 'utf8'),
    });
    if (problems.length > 0) {
      console.error('Problems:');
      for (const problem of problems) console.error(`- ${problem}`);
      process.exit(1);
    }
    console.log(`OK — audit templates match source templates and ${CATALOG}`);
    return;
  }

  const rendered = renderAuditTemplates(catalog, {
    summaryTemplateContent,
    auditLogTemplateContent,
  });
  fs.writeFileSync(AUDIT_SUMMARY_PATH, rendered.summaryContent);
  fs.writeFileSync(AUDIT_LOG_PATH, rendered.auditLogContent);
  console.log(`OK — regenerated audit templates from source templates and ${CATALOG}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

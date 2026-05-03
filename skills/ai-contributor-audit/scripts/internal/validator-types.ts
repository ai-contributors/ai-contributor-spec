// SPDX-License-Identifier: Apache-2.0
//
// Shared validator types for audit-validate.ts and extracted validation modules.

export interface AuditLogRow {
  line: number;
  command: string;
  outputExcerpt: string;
  rulesEvidenced: string[];
  normativeIds: string[];
}

export interface BacklogRow {
  line: number;
  priority: string;
  blocksLevel: string;
  rule: string;
  scope: string;
  currentStatus: string;
  nextAction: string;
  owner: string;
  targetDate: string;
}

export interface Frontmatter {
  values: Map<string, string>;
  lines: Map<string, number>;
}

export interface Problem {
  code: string;
  file: string;
  line?: number;
  message: string;
}

export interface ValidatorContext {
  checklistPath: string;
  auditPath: string;
  evidencePath: string;
  summaryPath: string;
  templateMode: boolean;
  lenient: boolean;
  checklistLines: string[];
  auditLines: string[];
  summaryLines: string[];
}

export type ProblemReporter = (
  code: string,
  file: string,
  line: number | undefined,
  message: string,
) => void;

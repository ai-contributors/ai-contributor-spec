// SPDX-License-Identifier: Apache-2.0

import { parseChecklistRules } from '../../../skills/ai-contributor-audit/scripts/internal/audit-markdown.ts';

export type ChecklistScope = 'MUST' | 'MwA' | 'SHOULD' | 'MAY';

export interface ParsedChecklistRow {
  rule: string;
  ids: string[];
  pillar: number;
  level: string;
  scope: ChecklistScope;
  status: string;
}

export function parseChecklistRows(content: string): ParsedChecklistRow[] {
  return parseChecklistRules(content.split(/\r?\n/)).map((row) => ({
    rule: row.rule,
    ids: row.ids,
    pillar: row.pillar,
    level: row.minLevel,
    scope: row.scope === 'MUST when applicable' ? 'MwA' : row.scope,
    status: row.status,
  }));
}

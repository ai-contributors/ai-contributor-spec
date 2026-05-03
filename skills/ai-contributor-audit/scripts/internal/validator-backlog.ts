// SPDX-License-Identifier: Apache-2.0
//
// Backlog table parsing and consistency validation for audit-validate.ts.

import {
  LEVEL_ORDER,
  findSection,
  isSeparatorRow,
  splitRow,
  stripBackticks,
  type ChecklistRow,
} from './audit-markdown.ts';
import type { BacklogRow, ProblemReporter, ValidatorContext } from './validator-types.ts';

export function parseBacklog(lines: string[]): BacklogRow[] {
  const range = findSection(lines, /^##\s+Backlog\s+—\s+what to address first/);
  if (!range) return [];
  const out: BacklogRow[] = [];
  for (let i = range.start + 1; i < range.end; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 8) continue;
    if (cells[0] === 'Priority') continue;
    out.push({
      line: i + 1,
      priority: cells[0],
      blocksLevel: cells[1],
      rule: stripBackticks(cells[2]),
      scope: cells[3],
      currentStatus: cells[4],
      nextAction: cells[5],
      owner: cells[6],
      targetDate: cells[7],
    });
  }
  return out;
}

export function checkBacklog(
  backlog: BacklogRow[],
  rules: ChecklistRow[],
  context: ValidatorContext,
  fail: ProblemReporter,
): void {
  if (context.templateMode) return;

  const realBacklog = backlog.filter(
    (b) =>
      b.priority !== '' ||
      b.blocksLevel !== '' ||
      b.rule !== '' ||
      b.scope !== '' ||
      b.currentStatus !== '',
  );

  type Expected = {
    priority: number;
    blocksLevel: string;
    rule: string;
    scope: string;
    status: string;
  };
  const expected: Expected[] = [];
  for (const r of rules) {
    if (r.scope === 'MAY') continue;
    if (r.status !== '🚨 Alarm' && r.status !== '⚠️ Warning') continue;
    let priority: number;
    if (r.scope === 'MUST' && r.status === '🚨 Alarm') priority = 1;
    else if (r.scope === 'MUST when applicable' && r.status === '🚨 Alarm') priority = 2;
    else if (r.scope === 'MUST' && r.status === '⚠️ Warning') priority = 3;
    else if (r.scope === 'MUST when applicable' && r.status === '⚠️ Warning') priority = 4;
    else if (r.scope === 'SHOULD') priority = 5;
    else continue;
    const blocksLevel = r.scope === 'SHOULD' ? 'L4' : r.minLevel;
    if (!LEVEL_ORDER.includes(blocksLevel)) continue;
    expected.push({ priority, blocksLevel, rule: r.rule, scope: r.scope, status: r.status });
  }

  expected.sort((a, b) => {
    const al = LEVEL_ORDER.indexOf(a.blocksLevel);
    const bl = LEVEL_ORDER.indexOf(b.blocksLevel);
    if (al !== bl) return al - bl;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.rule.toLowerCase().localeCompare(b.rule.toLowerCase());
  });

  const backlogByRule = new Map<string, BacklogRow>();
  for (const b of realBacklog) {
    if (backlogByRule.has(b.rule)) {
      fail('AUDIT040', context.summaryPath, b.line, `backlog has duplicate rule "${b.rule}"`);
    } else {
      backlogByRule.set(b.rule, b);
    }
  }

  for (const e of expected) {
    const b = backlogByRule.get(e.rule);
    if (!b) {
      fail(
        'AUDIT041',
        context.summaryPath,
        undefined,
        `backlog missing "${e.rule}" at priority ${e.priority}`,
      );
      continue;
    }
    if (b.blocksLevel !== e.blocksLevel) {
      fail(
        'AUDIT042',
        context.summaryPath,
        b.line,
        `backlog row "${e.rule}": Level is "${b.blocksLevel}", expected "${e.blocksLevel}"`,
      );
    }
    if (Number(b.priority) !== e.priority) {
      fail(
        'AUDIT042',
        context.summaryPath,
        b.line,
        `backlog row "${e.rule}": Priority is "${b.priority}", expected ${e.priority}`,
      );
    }
    if (b.scope !== e.scope) {
      fail(
        'AUDIT043',
        context.summaryPath,
        b.line,
        `backlog row "${e.rule}": Scope is "${b.scope}", expected "${e.scope}"`,
      );
    }
    if (b.currentStatus !== e.status) {
      fail(
        'AUDIT044',
        context.summaryPath,
        b.line,
        `backlog row "${e.rule}": Current status is "${b.currentStatus}", expected "${e.status}"`,
      );
    }
  }

  const expectedRules = new Set(expected.map((e) => e.rule));
  for (const b of realBacklog) {
    if (!expectedRules.has(b.rule)) {
      fail(
        'AUDIT045',
        context.summaryPath,
        b.line,
        `backlog has row "${b.rule}" but no checklist rule with that name is at "🚨 Alarm" or "⚠️ Warning"`,
      );
    }
  }

  for (let i = 1; i < realBacklog.length; i++) {
    const prev = realBacklog[i - 1];
    const cur = realBacklog[i];
    const pl = LEVEL_ORDER.indexOf(prev.blocksLevel);
    const cl = LEVEL_ORDER.indexOf(cur.blocksLevel);
    const pp = Number(prev.priority);
    const cp = Number(cur.priority);
    if (pl !== -1 && cl !== -1) {
      if (cl < pl) {
        fail(
          'AUDIT046',
          context.summaryPath,
          cur.line,
          `backlog rows are not sorted by ascending Level (got ${prev.blocksLevel} then ${cur.blocksLevel})`,
        );
      } else if (cl === pl && Number.isFinite(pp) && Number.isFinite(cp)) {
        if (cp < pp) {
          fail(
            'AUDIT046',
            context.summaryPath,
            cur.line,
            `backlog rows within ${cur.blocksLevel} are not sorted by ascending Priority (got ${pp} then ${cp})`,
          );
        } else if (cp === pp) {
          if (prev.rule.toLowerCase().localeCompare(cur.rule.toLowerCase()) > 0) {
            fail(
              'AUDIT046',
              context.summaryPath,
              cur.line,
              `backlog rows within ${cur.blocksLevel} / Priority ${cp} are not sorted alphabetically by Rule`,
            );
          }
        }
      }
    }
  }
}

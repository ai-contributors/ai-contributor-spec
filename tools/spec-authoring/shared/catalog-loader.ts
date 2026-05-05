// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import { assertRuleCatalog, type ValidatedRuleCatalog } from '../generate-rule-catalog.ts';

export function loadValidatedCatalog(
  path: string,
  label = 'AI-CONTRIBUTOR-RULE-CATALOG.json',
): ValidatedRuleCatalog {
  const parsed = JSON.parse(fs.readFileSync(path, 'utf8')) as unknown;
  return assertRuleCatalog(parsed, label);
}

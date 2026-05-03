// ESLint flat config — correctness rules for TypeScript runbook scripts and
// verification tooling. Style is governed by Prettier; this config layers
// correctness-only rules on top so the two don't fight.
//
// Lives in `tools/` because ESLint resolves config-relative imports (like
// `typescript-eslint`) from this file's directory. `basePath` lifts the
// per-config base to the repo root so `files` globs cover the whole tree.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default [
  {
    basePath: REPO_ROOT,
    ignores: [
      'node_modules/**',
      'tools/node_modules/**',
      'tools/test-fixtures/**',
      'examples/golden-audit/synthetic-repo/**',
      'examples/typescript-pnpm/template/**',
      '___review/**',
      '_review/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    basePath: REPO_ROOT,
    files: ['tools/**/*.ts', 'skills/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        node: { extensions: ['.ts', '.js'] },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // Import hygiene — closes AI Contributor `Dependency Hygiene`
      // (AIC-dead-code-and-cycles-surfaced) for our TS code.
      'import/no-cycle': ['error', { maxDepth: 10, ignoreExternal: true }],
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'error',

      // Architecture boundaries — closes AI Contributor `Architecture Boundaries`
      // (AIC-layer-responsibilities-defined, AIC-dependency-directions-explicit,
      // AIC-shared-layer-import-protection, AIC-architecture-rules-automated).
      //
      // Allowed: tools/ -> skills/ (verification tooling reads runbook scripts
      // to keep the spec, checklist, and runbook in sync).
      // Forbidden: skills/ -> tools/ (the runbook adopters fetch via
      // bootstrap.ts MUST stay self-contained; depending on tools/ would drag
      // verification machinery into adopter audits and break isolated runs).
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './skills',
              from: './tools',
              message:
                'skills/ MUST NOT import from tools/. The runbook ships to adopters via bootstrap.ts; tools/ is verification machinery that stays in this repo.',
            },
          ],
        },
      ],

      'no-debugger': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
    },
  },
];

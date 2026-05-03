#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
//
// audit-collect smoke tests for package-baseline.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  run,
  initRepo,
  runCollect,
  REPO_ROOT,
  type GhaTestEvidence,
} from './audit-collect-test-utils.ts';

let failed = 0;

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-strict-types-missing-bin-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify(
        {
          packageManager: 'pnpm@10.19.0',
          scripts: {
            'type-check': 'missing-workspace-typecheck-bin --version',
          },
        },
        null,
        2,
      ) + '\n',
    );
    fs.writeFileSync(
      path.join(target, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true }, include: ['src/**/*.ts'] }, null, 2) +
        '\n',
    );
    fs.mkdirSync(path.join(target, 'src'), { recursive: true });
    fs.writeFileSync(path.join(target, 'src', 'index.ts'), 'export const value: string = "ok";\n');
    fs.mkdirSync(path.join(target, 'node_modules'), { recursive: true });
    run('git', ['add', 'package.json', 'tsconfig.json', 'src/index.ts'], target);
    run(
      'git',
      [
        '-c',
        'user.name=Audit Test',
        '-c',
        'user.email=audit@example.invalid',
        'commit',
        '-m',
        'add strict type fixture',
      ],
      target,
    );

    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--working-tree',
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      rules?: {
        'strict-types'?: {
          derived_status?: string;
          judgment_required?: boolean;
          derivation_reason?: string;
        };
      };
    };
    const strictTypes = evidence.rules?.['strict-types'];
    if (strictTypes?.derived_status !== 'Warning') {
      failed++;
      console.error(
        `FAIL missing type-check binary was not downgraded to Warning: ${JSON.stringify(strictTypes)}`,
      );
    } else if (strictTypes.judgment_required !== false) {
      failed++;
      console.error('FAIL strict-types missing binary warning should be collector-derived');
    } else if (!strictTypes.derivation_reason?.includes('missing-deps errors only')) {
      failed++;
      console.error('FAIL strict-types warning did not explain missing dependency limitation');
    } else {
      console.log('OK   strict types missing workspace binary is Warning, not Alarm');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-workspace-node-modules-'));
  try {
    const target = path.join(tmp, 'repo');
    const fakeBin = path.join(tmp, 'bin');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.mkdirSync(fakeBin);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@10.19.0', private: true }, null, 2) + '\n',
    );
    fs.writeFileSync(path.join(target, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n");
    fs.writeFileSync(
      path.join(target, 'pnpm-lock.yaml'),
      [
        'lockfileVersion: 10.0',
        'settings:',
        '  autoInstallPeers: true',
        '  excludeLinksFromLockfile: false',
        'importers:',
        '  .: {}',
        '  packages/app: {}',
        '',
      ].join('\n'),
    );
    fs.mkdirSync(path.join(target, 'packages', 'app', 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(target, 'packages', 'app', 'package.json'),
      JSON.stringify(
        {
          private: true,
          scripts: {
            'type-check': 'workspace-typecheck-bin --version',
          },
        },
        null,
        2,
      ) + '\n',
    );
    fs.writeFileSync(
      path.join(target, 'packages', 'app', 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true }, include: ['src/**/*.ts'] }, null, 2) +
        '\n',
    );
    fs.writeFileSync(
      path.join(target, 'packages', 'app', 'src', 'index.ts'),
      'export const value: string = "ok";\n',
    );
    fs.mkdirSync(path.join(target, 'node_modules'), { recursive: true });
    fs.mkdirSync(path.join(target, 'packages', 'app', 'node_modules', '.bin'), { recursive: true });
    const bin = path.join(
      target,
      'packages',
      'app',
      'node_modules',
      '.bin',
      'workspace-typecheck-bin',
    );
    fs.writeFileSync(bin, '#!/usr/bin/env sh\nprintf "workspace-typecheck-bin 1.0.0\\n"\n');
    fs.chmodSync(bin, 0o755);
    const pnpm = path.join(fakeBin, 'pnpm');
    fs.writeFileSync(
      pnpm,
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  echo "10.19.0"
  exit 0
fi
if [[ "\${1:-}" == "-r" && "\${2:-}" == "type-check" ]]; then
  packages/app/node_modules/.bin/workspace-typecheck-bin --version
  exit 0
fi
echo "unexpected pnpm invocation: $*" >&2
exit 1
`,
    );
    fs.chmodSync(pnpm, 0o755);
    run(
      'git',
      [
        'add',
        'package.json',
        'pnpm-workspace.yaml',
        'pnpm-lock.yaml',
        'packages/app/package.json',
        'packages/app/tsconfig.json',
        'packages/app/src/index.ts',
      ],
      target,
    );
    run(
      'git',
      [
        '-c',
        'user.name=Audit Test',
        '-c',
        'user.email=audit@example.invalid',
        'commit',
        '-m',
        'add workspace type fixture',
      ],
      target,
    );

    const env = { ...process.env, PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ''}` };
    run(
      'tsx',
      [
        'skills/ai-contributor-audit/scripts/audit-collect.ts',
        target,
        '--no-network',
        '--out',
        out,
      ],
      REPO_ROOT,
      env,
    );
    const evidence = JSON.parse(fs.readFileSync(out, 'utf8')) as {
      preflight?: { node_modules_cache_hit?: boolean | null };
      target?: { mode?: string };
      rules?: {
        'strict-types'?: {
          derived_status?: string;
          derivation_reason?: string;
        };
      };
    };
    const strictTypes = evidence.rules?.['strict-types'];
    if (evidence.target?.mode !== 'sha-pinned') {
      failed++;
      console.error(
        `FAIL workspace node_modules fixture did not use sha-pinned mode: ${JSON.stringify(evidence.target)}`,
      );
    } else if (evidence.preflight?.node_modules_cache_hit !== true) {
      failed++;
      console.error('FAIL workspace node_modules cache was not linked in sha-pinned mode');
    } else if (strictTypes?.derived_status !== 'Fulfilled') {
      failed++;
      console.error(
        `FAIL workspace package type-check was not fulfilled from linked cache: ${JSON.stringify(strictTypes)}`,
      );
    } else if (!strictTypes.derivation_reason?.includes('type-check exit 0')) {
      failed++;
      console.error('FAIL strict-types fulfillment did not cite executable type-check success');
    } else {
      console.log(
        'OK   sha-pinned workspace node_modules cache supports package type-check binaries',
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Strict Types when tsconfig explicitly has strict: false -> resolveTsconfigStrict
// returns false on the ownStrict-explicit-false branch.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-strict-false-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'r', packageManager: 'pnpm@10.0.0' }),
    );
    fs.writeFileSync(
      path.join(target, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: false } }),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'strict-false'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    if (ev.rules?.['strict-types'] !== undefined) {
      console.log('OK   strict-types collector ran against explicit strict:false');
    } else {
      failed++;
      console.error('FAIL strict-types not present in evidence (strict:false fixture)');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// tsconfig.extends -> non-existent file -> resolveTsconfigStrict returns false.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-strict-bad-extends-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'r', packageManager: 'pnpm@10.0.0' }),
    );
    fs.writeFileSync(
      path.join(target, 'tsconfig.json'),
      JSON.stringify({ extends: './does-not-exist' }),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-m', 'bad-extends'],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    if (ev.rules?.['strict-types'] !== undefined) {
      console.log('OK   strict-types collector handled missing extends target');
    } else {
      failed++;
      console.error('FAIL strict-types missing on bad-extends fixture');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Strict Types via tsconfig.extends chain: the package's own tsconfig
// has no `strict`, but it extends a base tsconfig that does. Exercises
// the resolveTsconfigStrict extends-resolution branch.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-collect-strict-extends-'));
  try {
    const target = path.join(tmp, 'repo');
    const out = path.join(tmp, 'AI-CONTRIBUTOR-EVIDENCE.json');
    initRepo(target);
    fs.writeFileSync(
      path.join(target, 'package.json'),
      JSON.stringify({ name: 'r', packageManager: 'pnpm@10.0.0' }),
    );
    fs.writeFileSync(
      path.join(target, 'tsconfig.base.json'),
      JSON.stringify({ compilerOptions: { strict: true } }),
    );
    fs.writeFileSync(
      path.join(target, 'tsconfig.json'),
      JSON.stringify({ extends: './tsconfig.base.json' }),
    );
    run('git', ['add', '-A'], target);
    run(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.invalid',
        'commit',
        '-m',
        'strict-via-extends',
      ],
      target,
    );
    runCollect(target, out);
    const ev = JSON.parse(fs.readFileSync(out, 'utf8')) as GhaTestEvidence;
    if (ev.rules?.['strict-types'] !== undefined) {
      console.log('OK   strict-types collector ran against extends-chain tsconfig');
    } else {
      failed++;
      console.error('FAIL strict-types not present in evidence');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (failed > 0) {
  console.error(`${failed} audit-collect test(s) failed`);
  process.exit(1);
}
console.log('All audit-collect tests passed');

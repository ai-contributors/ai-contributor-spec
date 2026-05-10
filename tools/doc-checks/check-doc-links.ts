#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Validates internal Markdown links and anchors across the repository.
// External links are not fetched. Anchor slugs follow GitHub's rules
// (lowercase, spaces → hyphens, drop punctuation except `_` and `-`).

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { githubSlug as slug } from '../shared/_slug.ts';

const files = execSync("git ls-files '*.md'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const anchorCache = new Map<string, Set<string>>();

function anchorsFor(file: string): Set<string> {
  const cached = anchorCache.get(file);
  if (cached) return cached;
  const counts = new Map<string, number>();
  const anchors = new Set<string>();
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const headingText = m[1];
    const explicit = headingText.match(/\s*\{#([a-z0-9][a-z0-9-]*)\}\s*$/);
    const visibleText = explicit ? headingText.slice(0, explicit.index).trimEnd() : headingText;
    anchors.add(slug(visibleText, counts));
    if (explicit) anchors.add(explicit[1]);
  }
  anchorCache.set(file, anchors);
  return anchors;
}

const linkRe = /!?\[[^\]\n]*(?:\][^\[]*)?\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const problems: string[] = [];
let internal = 0,
  external = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  let m;
  while ((m = linkRe.exec(content))) {
    const raw = m[1].replace(/^<|>$/g, '');
    if (/^(https?:|mailto:)/i.test(raw)) {
      external++;
      continue;
    }
    internal++;
    if (raw.startsWith('#')) {
      const anchor = decodeURIComponent(raw.slice(1));
      if (!anchorsFor(file).has(anchor)) problems.push(`${file}: missing self anchor ${raw}`);
      continue;
    }
    const [target, hash] = raw.split('#');
    const resolved = path.normalize(path.join(dir, decodeURIComponent(target)));
    if (!fs.existsSync(resolved)) {
      problems.push(`${file}: missing target ${raw} -> ${resolved}`);
      continue;
    }
    if (hash && path.extname(resolved).toLowerCase() === '.md') {
      const anchor = decodeURIComponent(hash);
      if (!anchorsFor(resolved).has(anchor)) {
        problems.push(`${file}: missing anchor ${raw} -> ${resolved}#${anchor}`);
      }
    }
  }
}

console.log(
  `md files: ${files.length}, internal links: ${internal}, external (skipped): ${external}`,
);
if (problems.length) {
  console.error('Problems:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('OK — no broken internal links or anchors');

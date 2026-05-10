import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const trackedMarkdown = execFileSync('git', ['ls-files', '*.md'], {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

const allowedPrefixes = ['.ai-contributor-audit/', 'tools/test-fixtures/audit-validate/'];
const allowedFiles = new Set([
  'skills/ai-contributor-audit/SKILL.md',
  'skills/ai-contributor-audit-fix/SKILL.md',
  'skills/ai-contributor-audit-profile/SKILL.md',
]);

const failures = trackedMarkdown.filter((file) => {
  if (allowedFiles.has(file)) return false;
  if (allowedPrefixes.some((prefix) => file.startsWith(prefix))) return false;
  return readFileSync(file, 'utf8').startsWith('---\n');
});

if (failures.length > 0) {
  console.error('Publication Markdown must not start with frontmatter:');
  for (const file of failures) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`check-doc-frontmatter: ok (${trackedMarkdown.length - failures.length} checked)`);

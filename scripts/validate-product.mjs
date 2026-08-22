/* eslint-disable no-undef */
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('../', import.meta.url);
const maintainedRoots = ['src', 'e2e', 'scripts'];
const sourceExtensions = new Set(['.ts', '.svelte', '.css', '.mjs']);
const issues = [];
const companionProfile = JSON.parse(
  await readFile(new URL('src/lib/data/pet-profile.json', root), 'utf8'),
);
const escapedCompanionName = companionProfile.displayName.replace(
  /[.*+?^${}()|[\]\\]/g,
  '\\$&',
);
const companionNamePattern = new RegExp(`\\b${escapedCompanionName}\\b`, 'i');
const companionAvatarPath = companionProfile.avatarPath.toLowerCase();

function hardcodesCompanion(source) {
  return (
    companionNamePattern.test(source) ||
    source.toLowerCase().includes(companionAvatarPath)
  );
}

async function filesBelow(path) {
  const entries = await readdir(new URL(`${path}/`, root));
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry);
    const details = await stat(new URL(child, root));
    if (details.isDirectory()) files.push(...(await filesBelow(child)));
    else files.push(child);
  }
  return files;
}

const files = (
  await Promise.all(maintainedRoots.map((path) => filesBelow(path)))
).flat();

for (const path of files) {
  if (!sourceExtensions.has(extname(path))) continue;
  if (path === 'scripts/validate-product.mjs') continue;
  const source = await readFile(new URL(path, root), 'utf8');
  const lineCount = source.split('\n').length;
  if (lineCount > 300)
    issues.push(`${path}: ${lineCount} lines exceeds the 300-line split point`);

  if (
    /\b(poc|prototype|playtest|stub|todo|fixme)\b|coming soon|not implemented|no-op/i.test(
      source,
    )
  )
    issues.push(`${path}: contains unfinished-product language`);
  if (hardcodesCompanion(source))
    issues.push(`${path}: hardcodes the configured companion identity`);
}

for (const path of files.filter(
  (candidate) => candidate.endsWith('.json') || candidate.endsWith('.jsonl'),
)) {
  if (path === 'src/lib/data/pet-profile.json') continue;
  const source = await readFile(new URL(path, root), 'utf8');
  if (hardcodesCompanion(source))
    issues.push(`${path}: hardcodes the configured companion identity`);
  if (
    /\b(poc|prototype|playtest|stub|todo|fixme)\b|coming soon|not implemented|no-op/i.test(
      source,
    )
  )
    issues.push(`${path}: contains unfinished-product language`);
}

const gameplayFiles = files.filter(
  (path) => path.startsWith('src/lib/') && sourceExtensions.has(extname(path)),
);
for (const path of gameplayFiles) {
  const source = await readFile(new URL(path, root), 'utf8');
  if (/Math\.random\s*\(/.test(source))
    issues.push(`${path}: gameplay must not use Math.random()`);
  if (/\b(localStorage|sessionStorage|XMLHttpRequest|fetch\s*\()/.test(source))
    issues.push(`${path}: runtime persistence or network access is forbidden`);
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log(`validated ${files.length} maintained product files`);

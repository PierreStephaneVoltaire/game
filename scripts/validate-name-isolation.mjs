/* eslint-disable no-undef */
/**
 * Keep the configured companion name at the authored/display boundary.
 *
 * The profile is intentionally allowed to contain the display name.  User-
 * facing copy in data and Markdown is also allowed to use it.  Names in
 * paths, identifiers, structured IDs, asset references, seeds, or fenced
 * examples are rejected so a display-only rename cannot leak into a runtime
 * contract or an infrastructure name.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, resolve } from 'node:path';

const defaultRoot = new URL('../', import.meta.url);
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsonl',
  '.mjs',
  '.md',
  '.svelte',
  '.ts',
  '.toml',
  '.yaml',
  '.yml',
]);
const scanDirectories = ['docs', 'src', 'scripts', 'static', 'e2e'];
const scanRootFiles = ['AGENTS.md', 'CONTEXT.md', 'README.md', 'package.json'];
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  '.svelte-kit',
  'build',
]);

const authoredKeyTokens = new Set([
  'cause',
  'copy',
  'description',
  'display',
  'epitaph',
  'error',
  'hint',
  'label',
  'message',
  'name',
  'narration',
  'reason',
  'reference',
  'serving',
  'text',
  'title',
]);
const structuralKeyTokens = new Set([
  'app',
  'application',
  'asset',
  'avatar',
  'backend',
  'cookie',
  'environment',
  'file',
  'filename',
  'image',
  'infra',
  'infrastructure',
  'key',
  'path',
  'prefix',
  'resource',
  'seed',
  'state',
  'storage',
  'terraform',
  'url',
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function identifierTokens(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function location(relativePath, line) {
  return `${relativePath}${line ? `:${line}` : ''}`;
}

async function filesBelow(root, directory) {
  const directoryUrl = new URL(`${directory}/`, root);
  let entries;
  try {
    entries = await readdir(directoryUrl, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const child = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(root, child)));
    else if (textExtensions.has(extname(entry.name))) files.push(child);
  }
  return files;
}

function isStructuralKey(key) {
  return identifierTokens(key).some((token) => structuralKeyTokens.has(token));
}

function isAuthoredKey(key) {
  return identifierTokens(key).some((token) => authoredKeyTokens.has(token));
}

function containsNameIdentifier(value, nameTokens) {
  return identifierTokens(value).some((token) => nameTokens.includes(token));
}

function visitJson(value, pathParts, report, context) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      visitJson(entry, [...pathParts, String(index)], report, context),
    );
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...pathParts, key];
    const keyLocation = childPath.join('.');
    if (
      context.nameTokens.some((token) => identifierTokens(key).includes(token))
    )
      report(`structured key contains the configured name (${keyLocation})`);

    const structural = context.structural || isStructuralKey(key);
    if (typeof child === 'string') {
      if (
        structural &&
        (context.namePattern.test(child) ||
          containsNameIdentifier(child, context.nameTokens))
      )
        report(
          `configured name appears in a structural value (${keyLocation})`,
        );
      else if (
        !structural &&
        !isAuthoredKey(key) &&
        context.namePattern.test(child)
      )
        report(
          `configured name appears outside authored text (${keyLocation})`,
        );
    } else {
      visitJson(child, childPath, report, {
        ...context,
        structural,
      });
    }
  }
}

function scanMarkdown(source, report, context) {
  let inFence = false;
  let offset = 0;
  for (const line of source.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
    } else if (inFence && line) {
      if (
        !context.namePattern.test(line) &&
        !containsNameIdentifier(line, context.nameTokens)
      ) {
        offset += line.length + 1;
        continue;
      }
      report(
        'configured name appears in a fenced code example',
        lineNumber(source, offset),
      );
    }
    offset += line.length + 1;
  }
}

/** Return structural name-isolation violations for the current worktree. */
export async function findNameIsolationIssues({ root = defaultRoot } = {}) {
  const profileUrl = new URL('src/lib/data/pet-profile.json', root);
  const profile = JSON.parse(await readFile(profileUrl, 'utf8'));
  const displayName = String(profile.displayName ?? '').trim();
  if (!displayName)
    return ['src/lib/data/pet-profile.json: displayName is empty'];

  const nameTokens = identifierTokens(displayName);
  const namePattern = new RegExp(`\\b${escapeRegExp(displayName)}\\b`, 'i');
  const pathPattern = new RegExp(
    `(?:^|[-_.\\\\/])${escapeRegExp(displayName)}(?:$|[-_.\\\\/])`,
    'i',
  );
  const files = [
    ...scanRootFiles,
    ...(
      await Promise.all(
        scanDirectories.map((directory) => filesBelow(root, directory)),
      )
    ).flat(),
  ];
  const issues = [];

  for (const path of files) {
    if (pathPattern.test(path))
      issues.push(`${path}: configured name appears in a filename or path`);
    const source = await readFile(new URL(path, root), 'utf8');
    const report = (message, line) =>
      issues.push(`${location(path, line)}: ${message}`);
    const extension = extname(path);

    if (extension === '.json' || extension === '.jsonl') {
      const lines = source.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (!lines[index].trim()) continue;
        let value;
        try {
          value = JSON.parse(lines[index]);
        } catch {
          continue;
        }
        const lineReport = (message) => report(message, index + 1);
        visitJson(value, [], lineReport, {
          namePattern,
          nameTokens,
          structural: false,
        });
      }
    } else if (extension === '.md') {
      scanMarkdown(source, report, { namePattern, nameTokens });
    } else {
      const matches = source.matchAll(
        new RegExp(`\\b${escapeRegExp(displayName)}\\b`, 'gi'),
      );
      for (const match of matches)
        report(
          'configured name appears in source code; move it to authored data',
          lineNumber(source, match.index),
        );
      for (const match of source.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g)) {
        if (
          containsNameIdentifier(match[0], nameTokens) &&
          match[0].toLowerCase() !== displayName.toLowerCase()
        )
          report(
            'configured name appears in an identifier',
            lineNumber(source, match.index),
          );
      }
    }
  }
  return issues;
}

async function main() {
  const issues = await findNameIsolationIssues();
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('validated configured companion name isolation');
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();

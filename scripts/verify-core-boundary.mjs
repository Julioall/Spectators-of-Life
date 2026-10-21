import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const coreRoot = join(repositoryRoot, 'src', 'core');
const files = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(path);
  }
}

for (const directory of [
  coreRoot,
  join(repositoryRoot, 'src', 'modules', 'biosphere', 'flora', 'domain'),
  join(repositoryRoot, 'src', 'modules', 'biosphere', 'flora', 'simulation'),
  join(repositoryRoot, 'src', 'modules', 'biosphere', 'flora', 'contracts'),
]) collect(directory);
const forbidden = [
  { pattern: /\bMath\.random\s*\(/, name: 'Math.random' },
  { pattern: /\bDate\.now\s*\(/, name: 'Date.now' },
  { pattern: /\bglobalThis\s*\.\s*(?:window|document|navigator)\b|(?<![\w$.])(?:window|document|navigator)(?![\w$])(?!(?:\s*:))/, name: 'DOM/browser global' },
  { pattern: /\bperformance\./, name: 'performance clock' },
  { pattern: /\b(?:Phaser|vite)\b/i, name: 'render/build dependency' },
  { pattern: /(?:from\s*|import\s*\()\s*['"](?:node:)?(?:fs|path|worker_threads|perf_hooks|phaser|vite)(?:\/[^'"]*)?['"]/, name: 'platform dependency' },
];

const failures = [];
for (const path of files) {
  const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const rule of forbidden) {
    if (rule.pattern.test(source)) failures.push(`${relative(repositoryRoot, path)}: ${rule.name}`);
  }
}

if (failures.length > 0) {
  console.error(`Violação de fronteira do core:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Fronteira headless Core + Flora aprovada: ${files.length} arquivos do core sem APIs de browser, relógio ou render.`);
}

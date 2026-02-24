/**
 * Copy template resources (e.g. .yaml, init-scripts) into dist so runtime
 * paths like path.join(__dirname, 'resources') resolve correctly.
 * Run after tsc. Node 16+ for fs.cpSync.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { relative as _relative, basename, dirname, join } from 'node:path';

const __dirname = dirname(new URL(import.meta.url).pathname);
const srcTemplates = join(__dirname, '..', 'src', 'templates');
const distTemplates = join(__dirname, '..', 'dist', 'templates');

if (!existsSync(distTemplates)) {
  throw new Error('copy-template-resources: dist/templates not found (run tsc first)');
}

// Copy root-level template files (e.g. main-compose.yaml)
const mainComposeSrc = join(srcTemplates, 'main-compose.yaml');
if (existsSync(mainComposeSrc)) {
  copyFileSync(mainComposeSrc, join(distTemplates, 'main-compose.yaml'));
}

function* walkDirs(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      yield full;
      yield* walkDirs(full);
    }
  }
}

for (const dir of walkDirs(srcTemplates)) {
  if (basename(dir) !== 'resources') continue;
  const relative = _relative(srcTemplates, dir);
  const dest = join(distTemplates, relative);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(dir, dest, { recursive: true });
}

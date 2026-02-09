/**
 * Copy template resources (e.g. .yaml, init-scripts) into dist so runtime
 * paths like path.join(__dirname, 'resources') resolve correctly.
 * Run after tsc. Node 16+ for fs.cpSync.
 */
const fs = require('fs');
const path = require('path');

const srcTemplates = path.join(__dirname, '..', 'src', 'templates');
const distTemplates = path.join(__dirname, '..', 'dist', 'templates');

if (!fs.existsSync(distTemplates)) {
  console.warn('copy-template-resources: dist/templates not found (run tsc first)');
  process.exit(0);
}

function* walkDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      yield full;
      yield* walkDirs(full);
    }
  }
}

for (const dir of walkDirs(srcTemplates)) {
  if (path.basename(dir) !== 'resources') continue;
  const relative = path.relative(srcTemplates, dir);
  const dest = path.join(distTemplates, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(dir, dest, { recursive: true });
}

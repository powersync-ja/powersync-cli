import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const sourceDist = path.join(__dirname, '..', '.output');
const targetDist = path.join(repoRoot, 'plugins', 'config-edit', 'editor-dist');

if (!existsSync(sourceDist)) {
  throw new Error(`Editor build not found at ${sourceDist}. Run "pnpm --filter editor build" first.`);
}

rmSync(targetDist, { force: true, recursive: true });
cpSync(sourceDist, targetDist, { recursive: true });
console.log(`Copied editor dist to ${targetDist}`);

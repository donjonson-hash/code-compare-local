// Stage the same local editor used by the extension, without shipping its
// manifest, background worker, sources, tests, or development dependencies.
import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist/client');
const files = [
  'index.html', 'studio.css',
  'app.html', 'app.js', 'syntax-worker.js', 'styles.css',
  'workspace-theme.css', 'workspace-theme.js',
  'assets/anime-studio.png', 'assets/mark.svg',
  'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png',
  'THIRD-PARTY-NOTICES.txt', 'PRIVACY.md',
];

// Check inputs before replacing the generated web directory. Build app.js and
// syntax-worker.js with npm run build whenever their source has changed.
for (const file of files) {
  if (!(await stat(resolve(root, file))).isFile())
    throw new Error(`Missing web build input: ${file}`);
}
await rm(output, { recursive: true, force: true });
for (const file of files) {
  const target = resolve(output, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, file), target);
}
console.log(`Staged ${files.length} web files in dist/client from the shared editor build.`);

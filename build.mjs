import { build } from 'esbuild';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { canonicalMergePlugin } from './scripts/canonical-merge-plugin.mjs';
import { checkSharedCodec } from './scripts/check-shared-codec.mjs';
const sharedCodec = await checkSharedCodec();
const app = await build({entryPoints:['src/app.mjs'],outfile:'app.js',bundle:true,format:'iife',target:['chrome110','firefox115'],minify:true,legalComments:'inline',metafile:true,plugins:[canonicalMergePlugin]});
const worker = await build({entryPoints:['src/syntax-worker.mjs'],outfile:'syntax-worker.js',bundle:true,format:'iife',target:['chrome110','firefox115'],minify:true,legalComments:'inline',metafile:true});
// Ship license texts for all bundled production dependencies.
const sections = ['Local modification: @codemirror/merge 6.12.2 is bundled with a guarded build-time change to use full comparison after document edits. Original licenses follow. See scripts/canonical-merge-plugin.mjs and DETERMINISM.md.'];
sections.push(`Shared first-party UTF-8 codec: ${sharedCodec.repository}, commit ${sharedCodec.commit}, ${sharedCodec.path}, SHA-256 ${sharedCodec.sha256}. Vendored unchanged; project license remains UNLICENSED. See docs/SHARED-UTF8.md.`);
const roots = new Set(Object.keys({...app.metafile.inputs, ...worker.metafile.inputs})
  .map(path => path.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1]).filter(Boolean));
for (const root of [...roots].sort()) {
    const pkg = JSON.parse(await readFile(`${root}/package.json`));
    const names = (await readdir(root)).filter(name => /^(license|copying)(\.|$)/i.test(name));
    for (const name of names) sections.push(`${pkg.name} ${pkg.version}\n${await readFile(`${root}/${name}`, 'utf8')}`);
}
await writeFile('THIRD-PARTY-NOTICES.txt', sections.join('\n\n'+'='.repeat(72)+'\n\n'));
console.log('Built app.js, syntax-worker.js and third-party notices.');

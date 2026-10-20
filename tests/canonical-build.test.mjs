import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { canonicalMergePlugin, patchMergeSource } from '../scripts/canonical-merge-plugin.mjs';

test('canonical adapter refuses an unreviewed dependency version or modified upstream source', () => {
  const source = readFileSync(new URL('../node_modules/@codemirror/merge/dist/index.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => patchMergeSource(source, '6.12.2'));
  assert.throws(() => patchMergeSource(source, '6.12.3'), /upstream source changed/);
  assert.throws(() => patchMergeSource(source + '\n// changed upstream\n', '6.12.2'), /upstream source changed/);
  assert.throws(() => patchMergeSource(patchMergeSource(source, '6.12.2'), '6.12.2'), /upstream source changed/);
});

test('build cannot silently omit the canonical adapter', async () => {
  await assert.rejects(build({
    stdin: { contents: 'export const unrelated = true;' }, bundle: true,
    write: false, logLevel: 'silent', plugins: [canonicalMergePlugin],
  }), /adapter was not applied exactly once/);
});

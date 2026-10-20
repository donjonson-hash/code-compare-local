import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export async function checkSharedCodec() {
  const base = new URL('../src/vendor/deterministic-extensions/', import.meta.url);
  const provenance = JSON.parse(await readFile(new URL('provenance.json', base), 'utf8'));
  if (provenance.repository !== 'https://github.com/donjonson-hash/deterministic-extensions'
      || provenance.path !== 'src/core/utf8.mjs'
      || !/^[a-f0-9]{40}$/.test(provenance.commit)
      || !/^[a-f0-9]{64}$/.test(provenance.sha256)) throw new Error('Invalid shared UTF-8 provenance');
  const actual = createHash('sha256').update(await readFile(new URL('utf8.mjs', base))).digest('hex');
  if (actual !== provenance.sha256) throw new Error('Shared UTF-8 codec changed: review upstream and update its pinned provenance');
  return provenance;
}

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// The pinned library exposes no public API for replacing both editors' chunks.
// Keep its transaction delivery/history intact; change only how chunks are built.
const VERSION = '6.12.2';
const SOURCE_SHA256 = '98f01e3a8c526b392840718807f95848621dfe6f7e4d48bd0aef57304a6ea8df';
const incremental = `            let changes = trs.reduce((chs, tr) => chs.compose(tr.changes), ChangeSet.empty(trs[0].startState.doc.length));
            this.chunks = target == this.a ? Chunk.updateA(this.chunks, last.newDoc, this.b.state.doc, changes, this.diffConf)
                : Chunk.updateB(this.chunks, this.a.state.doc, last.newDoc, changes, this.diffConf);`;
const canonical = `            // Code Compare Local: canonical full comparison, independent of edit history.
            this.chunks = Chunk.build(target == this.a ? last.newDoc : this.a.state.doc,
                target == this.b ? last.newDoc : this.b.state.doc, this.diffConf);`;

export function patchMergeSource(source, version) {
  const hash = createHash('sha256').update(source).digest('hex');
  if (version !== VERSION || hash !== SOURCE_SHA256 || source.split(incremental).length !== 2) {
    throw new Error('Canonical comparison patch: upstream source changed. Review the pinned merge adapter before building.');
  }
  return source.replace(incremental, canonical);
}

export const canonicalMergePlugin = {
  name: 'canonical-merge',
  setup(build) {
    let patched = 0;
    build.onStart(() => { patched = 0; });
    build.onLoad({ filter: /[\\/]@codemirror[\\/]merge[\\/]dist[\\/]index\.js$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      const pkg = JSON.parse(await readFile(resolve(dirname(args.path), '../package.json'), 'utf8'));
      const contents = patchMergeSource(source, pkg.version);
      patched++;
      return { contents, loader: 'js' };
    });
    build.onEnd(result => {
      if (!result.errors.length && patched !== 1)
        return { errors: [{ text: 'Canonical comparison adapter was not applied exactly once.' }] };
    });
  },
};

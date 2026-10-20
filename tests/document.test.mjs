import { DIFF_CONFIG } from '../src/diff-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, Text } from '@codemirror/state';
import { history, undo, redo, isolateHistory } from '@codemirror/commands';
import { Chunk } from '@codemirror/merge';
import { normalize, makeDocument, decodeFile, encodeFile, applyEdits, chunkEdits, safeFilename } from '../src/document.mjs';
import { rawField, rawHistory, restoreRaw } from '../src/raw-state.mjs';

test('UTF-8 round-trip preserves BOM, tabs, mixed EOLs, emoji and final newline', () => {
  for (const raw of ['', 'a', '\n', '\r', '\r\n', '\uFEFF\tПривет 😀\r\nx = 2\ny = 3\rz = 4\r\n']) {
    const bytes = new TextEncoder().encode(raw);
    assert.deepEqual(encodeFile(decodeFile(bytes)), bytes);
  }
});

test('rejects invalid encodings, binary and oversized documents', () => {
  assert.throws(() => decodeFile(new Uint8Array([0xff, 0xfe])));
  assert.throws(() => decodeFile(new TextEncoder().encode('a\0b')));
  assert.throws(() => makeDocument('x'.repeat(200001)));
  assert.throws(() => makeDocument('\n'.repeat(4000)));
  assert.throws(() => decodeFile(new Uint8Array(512 * 1024 + 1)));
});

test('edits preserve untouched mixed line endings and use dominant EOL for new lines', () => {
  const doc = makeDocument('one\r\ntwo\nthree\r\nfour');
  const updated = applyEdits(doc, [{ from: 4, to: 7, insert: 'TWO\nextra' }]);
  assert.equal(updated.raw, 'one\r\nTWO\r\nextra\nthree\r\nfour');
});

test('a selected chunk preserves untouched B and copies source line endings', () => {
  const a = makeDocument('a\r\nfirst\r\nsame\nlast\r\n');
  const b = makeDocument('a\nFIRST\nsame\nLAST\n');
  let raw = b;
  const chunks = Chunk.build(Text.of(normalize(a.raw).split('\n')), Text.of(normalize(b.raw).split('\n')), DIFF_CONFIG);
  for (const chunk of [...chunks].reverse()) raw = applyEdits(raw, chunkEdits(chunk, a));
  assert.equal(normalize(raw.raw), normalize(a.raw));
  assert.ok(raw.raw.startsWith('a\n')); // An unchanged B line is not rewritten.
});

test('all chunk transfers reconstruct A, including empty files and trailing newlines', () => {
  const values = ['', '\n', '\n\n', 'a', 'a\n', 'a\r\n', 'a\nb', 'prefix\na\nsuffix\n', '😀\n\txyz', 'const a = 1;\n', 'const a = 2;\n'];
  for (const a of values) for (const b of values) {
    const source = makeDocument(a);
    let target = makeDocument(b);
    const chunks = Chunk.build(Text.of(normalize(a).split('\n')), Text.of(normalize(b).split('\n')), DIFF_CONFIG);
    for (const chunk of [...chunks].reverse()) target = applyEdits(target, chunkEdits(chunk, source));
    assert.equal(normalize(target.raw), normalize(a), JSON.stringify({ a, b }));
  }
});

test('random bounded diffs are lossless after block transfer', () => {
  let seed = 927;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
  const atoms = ['abc', '\t', '\n', '\r\n', '😀', '123', '{}', ' '];
  for (let i = 0; i < 200; i++) {
    const a = Array.from({ length: rand() % 80 }, () => atoms[rand() % atoms.length]).join('');
    const b = Array.from({ length: rand() % 80 }, () => atoms[rand() % atoms.length]).join('');
    const source = makeDocument(a); let target = makeDocument(b);
    const chunks = Chunk.build(Text.of(normalize(a).split('\n')), Text.of(normalize(b).split('\n')), DIFF_CONFIG);
    for (const chunk of [...chunks].reverse()) target = applyEdits(target, chunkEdits(chunk, source));
    assert.equal(normalize(target.raw), normalize(a));
  }
});

function editor(raw) {
  const doc = makeDocument(raw);
  let state = EditorState.create({ doc: normalize(raw), extensions: [rawField.init(() => doc), rawHistory, history(), EditorState.lineSeparator.of('\n')] });
  const view = { get state() { return state; }, dispatch(tr) { state = tr.state || state.update(tr).state; } };
  return view;
}

test('undo/redo restores exact bytes for grouped typing in mixed-EOL documents', () => {
  const raw = 'one\r\ntwo\n';
  const view = editor(raw);
  view.dispatch({ changes: { from: 3, insert: 'x' }, userEvent: 'input.type' });
  view.dispatch({ changes: { from: 4, insert: 'y' }, userEvent: 'input.type' });
  assert.equal(view.state.field(rawField).raw, 'onexy\r\ntwo\n');
  assert.ok(undo(view)); assert.equal(view.state.field(rawField).raw, raw);
  assert.equal(view.state.doc.toString(), normalize(raw));
  assert.ok(redo(view)); assert.equal(view.state.field(rawField).raw, 'onexy\r\ntwo\n');
});

test('format-only changes and BOM are undoable without text changes', () => {
  const view = editor('a\r\nb');
  const next = makeDocument('a\nb', true);
  view.dispatch({ effects: restoreRaw.of(next), annotations: isolateHistory.of('full') });
  assert.ok(undo(view));
  assert.equal(view.state.field(rawField).raw, 'a\r\nb');
  assert.equal(view.state.field(rawField).bom, false);
  assert.ok(redo(view));
  assert.deepEqual(view.state.field(rawField), next);
});

test('undo/redo after a merge restores exact destination and source bytes', () => {
  const view = editor('old\nline');
  const replacement = makeDocument('new\r\nline\r\n', true);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: normalize(replacement.raw) }, effects: restoreRaw.of(replacement), annotations: isolateHistory.of('full') });
  assert.equal(view.state.doc.toString(), normalize(replacement.raw));
  assert.ok(undo(view)); assert.equal(view.state.field(rawField).raw, 'old\nline');
  assert.ok(redo(view)); assert.deepEqual(view.state.field(rawField), replacement);
});

test('download filename retains extension while removing path separators', () => {
  assert.equal(safeFilename('  result.ts  '), 'result.ts');
  assert.equal(safeFilename('../test.py'), '.._test.py');
  assert.equal(safeFilename(''), 'result.txt');
});

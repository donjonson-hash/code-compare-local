import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@codemirror/state';
import {history, undo, redo, isolateHistory} from '@codemirror/commands';
import {decodeFile, encodeFile, makeDocument, normalize} from '../src/document.mjs';
import {rawField, rawHistory, restoreRaw} from '../src/raw-state.mjs';

const utf8 = value => new TextEncoder().encode(value);

// Frozen pre-migration codec behavior from fd345888de2b0bb4dac93578b0d6f349a4f644e7.
// Keep this independent of the shared codec to detect migration regressions.
function legacyDecode(bytes) {
  const text = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(bytes);
  const bom = text.startsWith('\uFEFF');
  return {raw:bom ? text.slice(1) : text, bom};
}
const legacyEncode = doc => utf8((doc.bom ? '\uFEFF' : '') + doc.raw);

test('shared codec adapter matches the previous codec on a deterministic Unicode/EOL corpus', () => {
  const atoms = ['ascii', '\t', '\n', '\r', '\r\n', 'Привет', '日本語', '😀', 'e\u0301', '\uFEFF'];
  const values = ['', '\uFEFF', '\uFEFF\uFEFF', 'last line', 'a\r\nb\nc\rd\r\n'];
  let seed = 17;
  for (let i = 0; i < 120; i++) {
    let value = i % 3 === 0 ? '\uFEFF' : '';
    for (let j = 0; j < i % 23; j++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      value += atoms[seed % atoms.length];
    }
    values.push(value);
  }
  for (const value of values) {
    const bytes = utf8(value), before = legacyDecode(bytes), after = decodeFile(bytes);
    assert.deepEqual({raw:after.raw, bom:after.bom}, before);
    assert.deepEqual(encodeFile(after), legacyEncode(before));
    assert.deepEqual(encodeFile(after), bytes);
  }
});

test('one BOM marker is metadata and a second remains text, including in a sliced byte view', () => {
  const bytes = utf8('\uFEFF\uFEFFone\r\ntwo\nthree');
  const backing = new Uint8Array(bytes.length + 4).fill(0xff);
  backing.set(bytes, 2);
  const selected = backing.subarray(2, bytes.length + 2);
  const document = decodeFile(selected);
  assert.equal(document.bom, true);
  assert.equal(document.raw, '\uFEFFone\r\ntwo\nthree');
  assert.equal(document.eol, '\r\n', 'a dominant-EOL tie keeps the first encountered ending');
  assert.deepEqual(encodeFile(document), bytes);
  for (const input of [
    new DataView(backing.buffer, 2, bytes.length),
    new Int8Array(backing.buffer, 2, bytes.length),
    bytes.slice().buffer
  ]) {
    assert.deepEqual(decodeFile(input), document, 'accepted BufferSource inputs retain the exact selected bytes');
    assert.deepEqual(encodeFile(decodeFile(input)), bytes);
  }
  const malformed = new Uint8Array([0x61, 0xe2, 0x82, 0x62]).subarray(1, 3);
  assert.throws(() => decodeFile(malformed), {message:'Use a UTF-8 file. Save it with UTF-8 encoding first.'});
});

test('adapter retains CCL normalized-character, line and binary policies', () => {
  const raw = 'a'.repeat(196001) + '\r\n'.repeat(3999);
  assert.equal(normalize(raw).length, 200000);
  assert.ok(raw.length > 200000);
  assert.deepEqual(encodeFile(decodeFile(utf8(raw))), utf8(raw), 'raw length must not replace the normalized limit');
  const limitMessage = 'The beta supports up to 200,000 characters and 4,000 lines per side.';
  assert.throws(() => decodeFile(utf8(raw + 'x')), {message:limitMessage});
  assert.throws(() => decodeFile(utf8('\r\n'.repeat(4000))), {message:limitMessage});
  assert.throws(() => decodeFile(utf8('\uFEFFa\0b')), {message:'This is a binary file. Open a text file containing code.'});
});

test('512 KiB import limit includes the BOM and is checked before text decoding', () => {
  const payload = '\u0800'.repeat(174761) + 'ab';
  const atLimit = utf8('\uFEFF' + payload);
  assert.equal(atLimit.byteLength, 512 * 1024);
  assert.deepEqual(encodeFile(decodeFile(atLimit)), atLimit);
  const error = {message:'The file exceeds 512 KB. Choose a smaller file.'};
  assert.throws(() => decodeFile(utf8('\uFEFF' + payload + 'c')), error);
  assert.throws(() => decodeFile(new Uint8Array(512 * 1024 + 1).fill(0xff)), error);
});

test('manually entered lone surrogates keep the previous TextEncoder replacement policy', () => {
  const raw = '\ud800a\udfff';
  for (const bom of [false, true]) {
    const doc = makeDocument(raw, bom);
    assert.deepEqual(encodeFile(doc), utf8((bom ? '\uFEFF' : '') + '\uFFFDa\uFFFD'));
    assert.deepEqual(encodeFile(doc), legacyEncode(doc));
  }
});

test('imported byte views survive document replacement, Undo and Redo with exact export bytes', () => {
  const bBytes = utf8('\uFEFFold\r\nline\nlast');
  const backing = new Uint8Array(bBytes.length + 2).fill(0xff);
  backing.set(bBytes, 1);
  const b = decodeFile(backing.subarray(1, bBytes.length + 1));
  let state = EditorState.create({doc:normalize(b.raw), extensions:[
    rawField.init(() => b), rawHistory, history(), EditorState.lineSeparator.of('\n')
  ]});
  const view = {get state() { return state; }, dispatch(tr) { state = tr.state || state.update(tr).state; }};
  const aBytes = utf8('\uFEFF\uFEFFnew\r\n😀\r\n');
  const a = decodeFile(aBytes);
  view.dispatch({
    changes:{from:0, to:state.doc.length, insert:normalize(a.raw)},
    effects:restoreRaw.of(a), annotations:isolateHistory.of('full')
  });
  assert.deepEqual(encodeFile(state.field(rawField)), aBytes);
  assert.ok(undo(view));
  assert.deepEqual(encodeFile(state.field(rawField)), bBytes);
  assert.ok(redo(view));
  assert.deepEqual(encodeFile(state.field(rawField)), aBytes);
});

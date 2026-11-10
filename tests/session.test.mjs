import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument, normalize, encodeFile } from '../src/document.mjs';
import { MAX_SESSION_BYTES, SESSION_FORMAT, SESSION_VERSION, serializeSession, parseSession } from '../src/session.mjs';

function snapshot(a = 'const value = 1;\r\n', b = 'const value = 2;\n') {
  return {
    a: { ...makeDocument(a), name: 'original.js' },
    b: { ...makeDocument(b), name: 'updated.js' },
    resultFilename: 'result.js', language: 'javascript',
    settings: { wrap: false, changesOnly: true, showWhitespace: true, fontSize: 18, focusMode: false },
    review: { a: normalize(a), b: normalize(b), kept: [JSON.stringify([0, 16, 'const value = 1;', 'const value = 2;'])] },
  };
}

const envelope = value => ({ format: SESSION_FORMAT, version: SESSION_VERSION, ...value });
const parseObject = value => parseSession(JSON.stringify(value));

test('session round-trip preserves both raw files, Unicode, BOM, mixed endings and preferred typing EOL', () => {
  const input = snapshot('\uFEFF\tПривет 😀\r\nsecond\nthird\rfinal\r\n', '😀\n\tответ\r\n');
  input.a.bom = true;
  input.a.name = 'исходник-😀.py';
  input.b.bom = true;
  input.b.eol = '\r'; // Retained editor policy, intentionally not the current majority.
  input.language = 'python';
  input.settings.focusMode = true;
  const saved = serializeSession(input);
  const restored = parseSession(saved);
  assert.deepEqual(restored, input);
  assert.deepEqual(encodeFile(restored.a), encodeFile(input.a));
  assert.deepEqual(encodeFile(restored.b), encodeFile(input.b));
  assert.equal(restored.b.eol, '\r');
  assert.equal(parseSession('\uFEFF' + saved).a.raw, input.a.raw, 'An outer UTF-8 BOM does not remove BOM text inside a source file');
});

test('empty files and trailing newlines remain distinct through a session', () => {
  for (const raw of ['', '\n', '\r', '\r\n', 'x', 'x\n']) {
    const input = snapshot(raw, '');
    input.review.kept = [];
    const restored = parseSession(serializeSession(input));
    assert.equal(restored.a.raw, raw);
    assert.equal(restored.b.raw, '');
    assert.deepEqual(encodeFile(restored.a), encodeFile(input.a));
  }
});

test('stale review pair loses marks while code and names remain available', () => {
  const input = snapshot();
  input.review.b = 'an older result';
  const restored = parseObject(envelope(input));
  assert.equal(restored.b.raw, input.b.raw);
  assert.equal(restored.b.name, input.b.name);
  assert.deepEqual(restored.review, { a: normalize(input.a.raw), b: normalize(input.b.raw), kept: [] });
  const duplicate = snapshot();
  duplicate.review.kept.push(duplicate.review.kept[0]);
  assert.equal(parseSession(serializeSession(duplicate)).review.kept.length, 1);
});

test('result filenames use the existing safe download policy, while display names stay exact', () => {
  const input = snapshot();
  input.resultFilename = '../private:result?.js';
  input.a.name = '<original>.js';
  const restored = parseSession(serializeSession(input));
  assert.equal(restored.resultFilename, '.._private_result_.js');
  assert.equal(restored.a.name, '<original>.js');
  input.resultFilename = '';
  assert.equal(parseSession(serializeSession(input)).resultFilename, 'result.txt');
});

test('wrong files, unsupported versions, unknown fields and non-record JSON are rejected', () => {
  assert.throws(() => parseSession('{'), /valid JSON/);
  assert.throws(() => parseSession(new Uint8Array()), /UTF-8 JSON/);
  for (const value of [null, [], 4, 'hello']) assert.throws(() => parseObject(value), /Invalid session/);
  assert.throws(() => parseObject({ ...envelope(snapshot()), format: 'another-product' }), /not a Compare Code/);
  for (const version of [0, 2, '1', null])
    assert.throws(() => parseObject({ ...envelope(snapshot()), version }), /Unsupported.*version/);
  assert.throws(() => parseObject({ ...envelope(snapshot()), history: [] }), /fields/);
  const polluted = JSON.stringify(envelope(snapshot())).replace('"version":1', '"version":1,"__proto__":{"polluted":true}');
  assert.throws(() => parseSession(polluted), /fields/);
  assert.equal({}.polluted, undefined);
});

test('embedded documents enforce ordinary source limits and strict BOM/EOL types', () => {
  for (const patch of [{ raw: 'x'.repeat(200_001) }, { raw: '\n'.repeat(4_000) }, { raw: 'x\0y' },
    { raw: null }, { bom: 'true' }, { eol: 'LF' }]) {
    const input = snapshot(); Object.assign(input.a, patch);
    assert.throws(() => parseObject(envelope(input)), /Session document A|Invalid session document A/);
  }
  const largeUtf8 = snapshot();
  largeUtf8.b.raw = '界'.repeat(175_000); // Below 200k text units, above 512 KiB in UTF-8.
  assert.throws(() => serializeSession(largeUtf8), /document B exceeds 512 KiB/);
  assert.throws(() => parseObject(envelope(largeUtf8)), /document B exceeds 512 KiB/);
  const boundary = snapshot('界'.repeat(174_762) + 'xx', '');
  boundary.review.kept = [];
  assert.equal(encodeFile(parseSession(serializeSession(boundary)).a).length, 512 * 1024);
  boundary.a.bom = true;
  assert.throws(() => serializeSession(boundary), /document A exceeds 512 KiB/, 'The BOM counts toward the file-size limit');
});

test('language, view settings, names and review marks reject invalid types and unsupported values', () => {
  const invalid = [
    value => { value.language = '__proto__'; },
    value => { value.language = 'rust'; },
    value => { value.settings.wrap = 'false'; },
    value => { value.settings.fontSize = '18'; },
    value => { value.settings.fontSize = 200; },
    value => { delete value.settings.focusMode; },
    value => { value.a.name = 'a\nsecret.js'; },
    value => { value.b.name = 'x'.repeat(256); },
    value => { value.resultFilename = null; },
    value => { value.review.kept = [null]; },
    value => { value.review.kept = ''; },
    value => { value.review.kept = Array(8_001).fill('key'); },
    value => { value.review.a = 'not\r\nnormalized'; },
    value => { value.review.applied = 1; },
  ];
  for (const mutate of invalid) {
    const input = snapshot(); mutate(input);
    assert.throws(() => parseObject(envelope(input)), /session/);
  }
});

test('session size guard rejects large inputs before JSON parsing and oversized serialized review data', () => {
  assert.throws(() => parseSession(' '.repeat(MAX_SESSION_BYTES + 1)), /exceeds 8 MiB/);
  assert.throws(() => parseSession('界'.repeat(Math.floor(MAX_SESSION_BYTES / 3) + 1)), /exceeds 8 MiB/);
  const input = snapshot();
  input.review.kept = ['x'.repeat(MAX_SESSION_BYTES)];
  assert.throws(() => serializeSession(input), /exceeds 8 MiB/);
  input.review.kept.push(input.review.kept[0]);
  assert.throws(() => serializeSession(input), /review data exceeds 8 MiB/, 'Bound accumulated review data before JSON allocation');
});

test('source text is inert session data and parsing does not modify the input snapshot', () => {
  const raw = '</script><img src="https://example.invalid" onerror="globalThis.sessionCodeRan=true">';
  const input = snapshot(raw, 'globalThis.sessionCodeRan = true;');
  const before = structuredClone(input);
  const restored = parseSession(serializeSession(input));
  assert.deepEqual(input, before);
  assert.equal(restored.a.raw, raw);
  assert.equal(globalThis.sessionCodeRan, undefined);
  assert.equal(Object.hasOwn(restored, 'history'), false);
});

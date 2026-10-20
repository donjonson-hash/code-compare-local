import test from 'node:test';
import assert from 'node:assert/strict';
import { Text, ChangeSet } from '@codemirror/state';
import { Chunk } from '@codemirror/merge';
import { DIFF_CONFIG } from '../src/diff-policy.mjs';
import { makeDocument, normalize, encodeFile } from '../src/document.mjs';
import { prepareBlockTransfer, checkBlockTransfer } from '../src/block-transfer.mjs';

const text = value => Text.of(normalize(value).split('\n'));
const snapshot = chunks => JSON.parse(JSON.stringify(chunks));

function withClock(now, work) {
  const original = Date.now;
  Date.now = now;
  try { return work(); } finally { Date.now = original; }
}

function noClock(work) {
  return withClock(() => { throw new Error('Comparison read the wall clock'); }, work);
}

test('full comparisons retain ranges and precision with a stopped, jumping or unavailable clock', () => {
  // The old 100 ms policy groups this case when the clock jumps, despite
  // having the same text and the same search-depth budget.
  const a = text(Array.from({ length: 120 }, (_, i) => `const value_${i} = ${i};`).join('\n'));
  const b = text(Array.from({ length: 120 }, (_, i) => `const value_${i} = ${i + 100};`).join('\n'));
  const expected = withClock(() => 1000, () => snapshot(Chunk.build(a, b, DIFF_CONFIG)));
  assert.ok(expected.length > 0);
  assert.ok(expected.every(chunk => chunk.precise));
  let clock = 1000;
  assert.deepEqual(withClock(() => clock += 1000, () => snapshot(Chunk.build(a, b, DIFF_CONFIG))), expected);
  assert.deepEqual(noClock(() => snapshot(Chunk.build(a, b, DIFF_CONFIG))), expected);
  // Interleaving an imprecise comparison must not leak precision or budget state.
  Chunk.build(text('a'.repeat(1600)), text('b'.repeat(1600)), DIFF_CONFIG);
  assert.deepEqual(noClock(() => snapshot(Chunk.build(a, b, DIFF_CONFIG))), expected);
});

function repeatedTextTrace() {
  const a = Array.from({ length: 350 }, (_, i) => `line ${i % 7}: ${'ab'.repeat(8)} ${i % 3}\n`).join('');
  let b = a, seed = 42;
  const next = n => (seed = (1664525 * seed + 1013904223) >>> 0) % n;
  for (let i = 0; i < 8; i++) {
    const at = next(b.length);
    const insert = ['x', 'Y', '\n', 'line 0: abababababababab 0\n'][next(4)];
    b = b.slice(0, at) + insert + b.slice(at + next(4));
  }
  return { a: text(a), b: text(b), from: 7649, to: 7693, insert: 'line 0: abababababababab 0\n' };
}

function runTrace() {
  const fixture = repeatedTextTrace();
  let { a, b } = fixture;
  let chunks = Chunk.build(a, b, DIFF_CONFIG);
  const states = [snapshot(chunks)];
  const bChange = ChangeSet.of({ from: fixture.from, to: fixture.to, insert: fixture.insert }, b.length);
  const bUndo = bChange.invert(b);
  b = bChange.apply(b);
  chunks = Chunk.updateB(chunks, a, b, bChange, DIFF_CONFIG);
  states.push(snapshot(chunks));
  const aChange = ChangeSet.of({ from: 3500, to: 3504, insert: 'edited in A' }, a.length);
  a = aChange.apply(a);
  chunks = Chunk.updateA(chunks, a, b, aChange, DIFF_CONFIG);
  states.push(snapshot(chunks));
  b = bUndo.apply(b);
  chunks = Chunk.updateB(chunks, a, b, bUndo, DIFF_CONFIG);
  states.push(snapshot(chunks));
  return states;
}

test('the same incremental A/B edit and undo trace repeats without reading a clock', () => {
  // Incremental history is an input: this does not assert equality with a
  // fresh full build, whose grouping can differ on repeated text.
  const expected = withClock(() => 1000, runTrace);
  assert.equal(expected.length, 4);
  assert.notDeepEqual(expected[0], expected[1]);
  assert.notDeepEqual(expected[1], expected[2]);
  assert.deepEqual(noClock(runTrace), expected);
  let clock = 1000;
  assert.deepEqual(withClock(() => clock += 1000, runTrace), expected);
});

test('depth-limited and large-range fallback stays lossless through validated block transfers', () => {
  // 1,600 characters exhaust detailed search; 15,000 take the large-range
  // fallback. Both must retain an honest grouped status and complete text.
  for (const length of [1600, 15000]) {
    const source = makeDocument('A'.repeat(length));
    let target = makeDocument('B'.repeat(length), true);
    const chunks = noClock(() => Chunk.build(text(source.raw), text(target.raw), DIFF_CONFIG));
    assert.ok(chunks.length > 0);
    assert.ok(chunks.some(chunk => !chunk.precise), 'the search budget still invokes grouped fallback');
    let revision = 0;
    for (const chunk of [...chunks].reverse()) {
      const context = { source, target, sourceRevision: 0, targetRevision: revision };
      const operation = prepareBlockTransfer({ ...context, id: `fallback-${length}-${revision}`, chunk });
      const result = checkBlockTransfer(operation, context);
      assert.equal(result.status, 'ready');
      target = result.document;
      revision++;
    }
    assert.deepEqual(encodeFile(target), encodeFile(makeDocument(source.raw, true)), 'every source byte and target BOM survives fallback');
  }
});

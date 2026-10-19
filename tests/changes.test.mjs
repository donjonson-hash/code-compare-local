import test from 'node:test';
import assert from 'node:assert/strict';
import { Text } from '@codemirror/state';
import { Chunk, Change } from '@codemirror/merge';
import { buildChangeItems } from '../src/changes.mjs';

function compare(a, b) {
  const docA = Text.of(a.split('\n')), docB = Text.of(b.split('\n'));
  return buildChangeItems(Chunk.build(docA, docB), docA, docB);
}

test('change labels point at actual changed lines, excluding full chunk context', () => {
  const docA = Text.of(['same', 'old', 'context', 'old again', 'same']);
  const docB = Text.of(['same', 'new', 'context', 'new again', 'same']);
  const chunk = new Chunk([new Change(5, 8, 5, 8), new Change(17, 20, 17, 20)], 0, docA.length + 1, 0, docB.length + 1);
  const [item] = buildChangeItems([chunk], docA, docB);
  assert.equal(item.a.label, 'lines 2, 4');
  assert.equal(item.b.label, 'lines 2, 4');
  assert.equal(item.kind, 'Changed');
  assert.equal(item.chunk, chunk);
  assert.equal(item.a.from, 5);
});

test('whole-line insertion and deletion identify content and empty anchors', () => {
  const [added] = compare('first\nlast', 'first\nextra\nlast');
  assert.equal(added.kind, 'Added in B');
  assert.equal(added.a.label, 'before line 2');
  assert.equal(added.b.label, 'line 2');
  const [removed] = compare('first\nextra\nlast', 'first\nlast');
  assert.equal(removed.kind, 'Removed from B');
  assert.equal(removed.a.label, 'line 2');
  assert.equal(removed.b.label, 'before line 2');
});

test('EOF appended lines do not mark the unchanged preceding line', () => {
  const [added] = compare('a', 'a\nb\nc');
  assert.equal(added.a.label, 'end of file (line 1)');
  assert.equal(added.b.label, 'lines 2–3');
  assert.equal(added.preview, 'b');
  const [removed] = compare('a\nb\nc', 'a');
  assert.equal(removed.a.label, 'lines 2–3');
  assert.equal(removed.b.label, 'end of file (line 1)');
});

test('empty files, final newlines and inline insertion have valid 1-based positions', () => {
  const [empty] = compare('', 'x\ny');
  assert.equal(empty.a.label, 'empty file');
  assert.equal(empty.a.startLine, 1);
  assert.equal(empty.b.label, 'lines 1–2');
  const [newline] = compare('a', 'a\n');
  assert.equal(newline.b.label, 'line 1');
  const [inline] = compare('abc', 'aXbc');
  assert.equal(inline.a.label, 'line 1, column 2');
  assert.equal(inline.b.label, 'line 1');
  assert.deepEqual(compare('', ''), []);
});

test('all ranges remain within documents including non-BMP text and trailing newline', () => {
  const variants = ['', '\n', 'one', 'one\n', 'one\ntwo\n', '😀 = 1\n', '😀 = 2\n', '\nend'];
  for (const a of variants) for (const b of variants) {
    for (const item of compare(a, b)) {
      for (const [side, text] of [['a', a], ['b', b]]) {
        const range = item[side];
        assert.ok(range.from >= 0 && range.to <= text.length && range.from <= range.to);
        assert.ok(range.startLine >= 1 && range.endLine <= text.split('\n').length);
      }
    }
  }
});

test('space/tab changes remain explicit differences with precise Python line ranges', () => {
  const cases = [
    ['if ready:\n    run()\n', 'if ready:\n\trun()\n'],
    ['if ready:\n    run()\n', 'if ready:\n        run()\n'],
    ['if ready:\n    run()\n', 'if ready:\nrun()\n']
  ];
  for (const [a, b] of cases) {
    const [item] = compare(a, b);
    assert.equal(item.whitespaceOnly, true);
    assert.equal(item.kind, 'Spaces / tabs changed');
    assert.equal(item.a.startLine, 2);
    assert.equal(item.b.startLine, 2);
    assert.equal(item.a.endLine, 2);
    assert.equal(item.b.endLine, 2);
  }
});

test('space/tab classification is lexical and does not imply harmless string or token changes', () => {
  for (const [a, b] of [
    ['message = "a b"', 'message = "ab"'],
    ['x = a + +b', 'x = a ++b'],
    ['x = 1\n  \nend', 'x = 1\n\t\nend']
  ]) {
    const [item] = compare(a, b);
    assert.equal(item.whitespaceOnly, true);
    assert.match(item.summary, /^Spaces \/ tabs changed — A:/);
  }
});

test('line breaks, blank-line additions, nonbreaking spaces and code changes stay significant', () => {
  for (const [a, b] of [
    ['a b', 'a\nb'],
    ['a\nb', 'a\n \nb'],
    ['a\n \nb', 'a\nb'],
    ['a', 'a\n'],
    ['a b', 'a\u00a0b'],
    ['value = 1', 'value  = 2'],
    ['if ready:\n    run()\n', 'if ready:\n\tstop()\n']
  ]) {
    const items = compare(a, b);
    assert.ok(items.length > 0);
    assert.ok(items.every(item => item.whitespaceOnly === false));
    assert.ok(items.every(item => item.kind !== 'Spaces / tabs changed'));
  }
});

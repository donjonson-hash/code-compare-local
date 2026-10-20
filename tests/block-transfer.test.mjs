import { DIFF_CONFIG } from '../src/diff-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Text } from '@codemirror/state';
import { Chunk } from '@codemirror/merge';
import { makeDocument, normalize, encodeFile } from '../src/document.mjs';
import { prepareBlockTransfer, checkBlockTransfer } from '../src/block-transfer.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
function fixture(a = 'one\nnew\nlast', b = 'one\nold\nlast', options = {}) {
  const source = makeDocument(a, options.sourceBOM ?? false), target = makeDocument(b, options.targetBOM ?? false);
  const chunk = Chunk.build(Text.of(normalize(a).split('\n')), Text.of(normalize(b).split('\n')), DIFF_CONFIG)[0] ??
    { fromA: 0, fromB: 0, changes: [] };
  const context = { source, target, sourceRevision: 4, targetRevision: 9, appliedIds: new Set() };
  const operation = prepareBlockTransfer({ ...context, id: 'session-1:change-1', chunk });
  return { operation, context };
}

test('proposal and preflight are reproducible, serializable, immutable and detached', () => {
  const { operation, context } = fixture();
  assert.deepEqual(fixture().operation, operation, 'identical inputs and ID produce identical proposals');
  const first = checkBlockTransfer(operation, context);
  assert.equal(first.status, 'ready');
  assert.deepEqual(checkBlockTransfer(clone(operation), context), first);
  assert.deepEqual(checkBlockTransfer(operation, context), first);
  assert.equal(context.target.raw, 'one\nold\nlast');
  assert.equal(context.appliedIds.size, 0);
  for (const value of [operation, operation.source, operation.target, operation.edits, operation.edits[0], operation.edits[0].source, operation.edits[0].target]) {
    assert.ok(Object.isFrozen(value));
  }
  assert.equal(Object.isFrozen(context.source), false);
  context.source.raw = 'changed';
  assert.equal(operation.source.raw, 'one\nnew\nlast');
  assert.equal(checkBlockTransfer(operation, context).status, 'stale');
});

test('staleness covers either whole file, raw-only changes, BOM, EOL policy and edit-undo revisions', () => {
  for (const side of ['source', 'target']) {
    for (const mutate of [
      doc => ({ ...doc, raw: doc.raw + '\n' }),
      doc => ({ ...doc, raw: doc.raw.replaceAll('\n', '\r\n') }),
      doc => ({ ...doc, bom: !doc.bom }),
      doc => ({ ...doc, eol: '\r\n' })
    ]) {
      const { operation, context } = fixture();
      context[side] = mutate(context[side]);
      assert.equal(checkBlockTransfer(operation, context).status, 'stale', side);
    }
    const { operation, context } = fixture();
    context[`${side}Revision`] += 2; // Text may match again after Undo, revision does not.
    assert.equal(checkBlockTransfer(operation, context).status, 'stale', `${side} edit then undo`);
  }
});

test('a committed ID is rejected even after Undo and cannot alter documents or consume more IDs', () => {
  const { operation, context } = fixture();
  const applied = checkBlockTransfer(operation, context);
  assert.equal(applied.status, 'ready');
  context.appliedIds.add(operation.id);
  context.target = applied.document; context.targetRevision++;
  assert.equal(checkBlockTransfer(operation, context).status, 'already-applied');
  context.target = makeDocument(operation.target.raw); context.targetRevision++;
  assert.equal(checkBlockTransfer(clone(operation), context).status, 'already-applied');
  assert.equal(context.appliedIds.size, 1);
  assert.equal(context.target.raw, operation.target.raw);
});

test('malformed and tampered proposals return invalid without mutation or throwing', () => {
  const { operation, context } = fixture();
  const mutations = [
    op => { op.schemaVersion = 2; }, op => { op.id = ''; },
    op => { op.edits[0].replacement = 'invented'; },
    op => { op.edits[0].target.expected = 'invented'; },
    op => { op.edits[0].source.expected = 'invented'; },
    op => { op.edits[0].target.from = -1; },
    op => { op.edits[0].target.to = 9999; },
    op => { op.edits[0].source.to = 9999; },
    op => { op.edits[0].target.from = 5.5; },
    op => { op.edits[0].target.from = op.edits[0].target.to + 1; },
    op => { op.edits.push(clone(op.edits[0])); },
    op => { op.source.revision = -1; }, op => { op.target.bom = 'false'; }
  ];
  for (const mutate of mutations) {
    const candidate = clone(operation); mutate(candidate);
    assert.equal(checkBlockTransfer(candidate, context).status, 'invalid');
  }
  for (const candidate of [null, false, [], {}, { ...operation, edits: null }]) {
    assert.equal(checkBlockTransfer(candidate, context).status, 'invalid');
  }
  assert.equal(context.target.raw, operation.target.raw);
  assert.equal(context.appliedIds.size, 0);
});

test('disjoint sub-edits apply atomically, and reversed or overlapping edits are rejected', () => {
  const source = makeDocument('aXbYc'), target = makeDocument('a0b1c');
  const context = { source, target, sourceRevision: 0, targetRevision: 0 };
  const operation = prepareBlockTransfer({ ...context, id: 'two', chunk: { fromA: 0, fromB: 0, changes: [
    { fromA: 1, toA: 2, fromB: 1, toB: 2 }, { fromA: 3, toA: 4, fromB: 3, toB: 4 }
  ] } });
  assert.equal(checkBlockTransfer(operation, context).document.raw, 'aXbYc');
  const reverse = clone(operation); reverse.edits.reverse();
  assert.equal(checkBlockTransfer(reverse, context).status, 'invalid');
  const overlap = clone(operation); overlap.edits[1].target.from = 1;
  assert.equal(checkBlockTransfer(overlap, context).status, 'invalid');
  assert.equal(target.raw, 'a0b1c');
});

test('empty-file insertion/deletion and EOF additions preserve selected source bytes and target BOM', () => {
  for (const [a, b] of [['😀\r\n\tvalue\n', ''], ['', '😀\r\n\tvalue\n'], ['line\nend', 'line'], ['line', 'line\nend']]) {
    const { operation, context } = fixture(a, b, { targetBOM: true });
    const result = checkBlockTransfer(operation, context);
    assert.equal(result.status, 'ready');
    assert.equal(result.document.raw, a);
    assert.equal(result.document.bom, true);
    assert.deepEqual(encodeFile(result.document), new TextEncoder().encode('\uFEFF' + a));
  }
});

test('real line deletions allow signed relative chunk offsets while validating absolute positions', () => {
  const a = Array.from({ length: 240 }, (_, i) => `value_${i + 1} = ${i + 1}`).join('\n') + '\n';
  const removed = Array.from({ length: 11 }, (_, i) => `value_${i + 66} = ${i + 66}\n`).join('');
  const b = a.replace('value_30 = 30', 'value_30 = 999').replace(removed, '')
    .replace('value_200 = 200', 'value_200 = 888');
  const source = makeDocument(a), target = makeDocument(b);
  const chunks = Chunk.build(Text.of(a.split('\n')), Text.of(b.split('\n')), DIFF_CONFIG);
  const chunk = chunks.find(chunk => chunk.changes.some(change => change.fromA < 0 || change.fromB < 0));
  assert.ok(chunk, 'the library fixture must exercise a signed relative offset');
  const context = { source, target, sourceRevision: 0, targetRevision: 0 };
  const operation = prepareBlockTransfer({ ...context, id: 'restore-lines', chunk });
  const result = checkBlockTransfer(operation, context);
  assert.equal(result.status, 'ready');
  assert.equal(result.document.raw, a.replace('value_30 = 30', 'value_30 = 999')
    .replace('value_200 = 200', 'value_200 = 888'));
  assert.throws(() => prepareBlockTransfer({ ...context, id: 'negative-absolute', chunk: {
    fromA: 0, fromB: 0, changes: [{ fromA: -1, toA: 0, fromB: 0, toB: 0 }]
  } }), /Cannot prepare/);
});

test('mixed line endings outside the selected block and target BOM remain exact', () => {
  const { operation, context } = fixture('one\r\nNEW\r\nlast\r', 'one\nold\nlast\n', { sourceBOM: false, targetBOM: true });
  const result = checkBlockTransfer(operation, context);
  assert.equal(result.status, 'ready');
  assert.equal(result.document.raw, 'one\nNEW\nlast\n');
  assert.equal(result.document.bom, true);
  assert.equal(result.document.eol, context.target.eol);
});

test('emoji edits use whole UTF-16 pairs; split source or target boundaries are invalid', () => {
  const { operation, context } = fixture('a😀b', 'a😃b');
  assert.equal(checkBlockTransfer(operation, context).document.raw, 'a😀b');
  for (const side of ['source', 'target']) {
    const bad = clone(operation);
    bad.edits[0][side].from++;
    assert.equal(checkBlockTransfer(bad, context).status, 'invalid');
  }
});

test('all candidate edits are validated before a result over character or line limits is rejected', () => {
  for (const [a, b] of [['x', 'y'.repeat(200_000)], ['\n', 'x\n'.repeat(3999) + 'x']]) {
    const source = makeDocument(a), target = makeDocument(b);
    const context = { source, target, sourceRevision: 0, targetRevision: 0, appliedIds: new Set() };
    const operation = prepareBlockTransfer({ ...context, id: 'limit', chunk: {
      fromA: 0, fromB: 0, changes: [{ fromA: 0, toA: a.length, fromB: 0, toB: 0 }]
    } });
    assert.equal(checkBlockTransfer(operation, context).status, 'limit-exceeded');
    assert.equal(target.raw, b);
    assert.equal(context.appliedIds.size, 0);
  }
});

test('matching content and empty proposals are no-change, never successful applications', () => {
  const { operation, context } = fixture('same', 'same');
  assert.equal(checkBlockTransfer(operation, context).status, 'no-change');
  const matching = prepareBlockTransfer({ ...context, id: 'matching', chunk: { fromA: 0, fromB: 0,
    changes: [{ fromA: 0, toA: 4, fromB: 0, toB: 4 }] } });
  assert.equal(checkBlockTransfer(matching, context).status, 'no-change');
  assert.equal(context.appliedIds.size, 0);
});

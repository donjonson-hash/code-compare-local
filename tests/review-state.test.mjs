import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewState } from '../src/review-state.mjs';

const pair = (b, keys) => ({ a: 'reference', b, keys });

test('Keep B, Use A, undo and redo preserve the actual review decisions', () => {
  const state = createReviewState();
  const initial = pair('original', ['first', 'second', 'third']);
  const applied = pair('one fixed', ['first', 'third']);
  state.sync(initial);
  state.keep('first');
  state.apply('second', applied);
  assert.deepEqual(state.progress, { reviewed: 2, total: 3, applied: 1, kept: 1, notice: '' });
  state.sync(initial, 'history');
  assert.equal(state.isKept('first'), true);
  assert.deepEqual(state.progress, { reviewed: 1, total: 3, applied: 0, kept: 1, notice: '' });
  state.sync(applied, 'history');
  assert.equal(state.progress.reviewed, 2);
});

test('changing a Keep B decision to Use A counts that block once', () => {
  const state = createReviewState();
  state.sync(pair('original', ['first']));
  state.keep('first');
  state.keep('first');
  assert.equal(state.progress.reviewed, 1);
  state.apply('first', pair('reference', []));
  assert.deepEqual(state.progress, { reviewed: 1, total: 1, applied: 1, kept: 0, notice: '' });
  state.sync(pair('original', ['first']), 'history');
  assert.equal(state.isKept('first'), true);
});

test('manual edits invalidate approvals even if old content is pasted back', () => {
  const state = createReviewState();
  const initial = pair('original', ['first']);
  state.sync(initial); state.keep('first');
  state.sync(pair('edited', ['first', 'second']));
  assert.equal(state.progress.reviewed, 0);
  assert.match(state.progress.notice, /review restarted/);
  state.sync(initial, 'history');
  assert.equal(state.isKept('first'), false);
  state.sync(pair('edited', ['first', 'second']));
  state.sync(initial);
  assert.equal(state.progress.reviewed, 0);
});

test('empty files, failed apply and reset do not manufacture progress', () => {
  const state = createReviewState();
  const empty = { a: '', b: '', keys: [] };
  state.sync(empty);
  assert.equal(state.keep('missing'), false);
  assert.equal(state.apply('missing', empty), false);
  assert.equal(state.progress.total, 0);
  state.sync(pair('added', ['addition']));
  assert.equal(state.apply('addition', pair('added', ['addition'])), false);
  state.keep('addition'); state.reset();
  assert.equal(state.progress.reviewed, 0);
  assert.equal(state.progress.total, 0);
});

test('history uses document value equality, not CodeMirror Text object identity', () => {
  const state = createReviewState({ sameDocument: (a, b) => a.text === b.text });
  const original = { a: { text: 'a' }, b: { text: 'b' }, keys: ['one'] };
  state.sync(original);
  state.apply('one', { a: { text: 'a' }, b: { text: 'a' }, keys: [] });
  state.sync({ a: { text: 'a' }, b: { text: 'b' }, keys: ['one'] }, 'history');
  assert.equal(state.progress.reviewed, 0);
  assert.equal(state.progress.total, 1);
});


test('an edit followed by undo before rendering cannot revive stale approvals', () => {
  const state = createReviewState();
  const original = pair('original', ['one']);
  state.sync(original); state.keep('one');
  state.invalidate();
  state.sync(original, 'history');
  assert.equal(state.progress.reviewed, 0);
  assert.equal(state.isKept('one'), false);
  assert.match(state.progress.notice, /review restarted/);
});

import { EditorView } from '@codemirror/view';
import { buildChangeItems } from './changes.mjs';
import { createReviewState } from './review-state.mjs';
import { restoreRaw } from './raw-state.mjs';

export function createChangesController({ getMerge, prepareChunk, applyChunk, notify }) {
  const list = document.getElementById('changes-list');
  const summary = document.getElementById('changes-summary');
  const position = document.getElementById('change-position');
  const useCurrent = document.getElementById('use-current');
  const keepCurrentButton = document.getElementById('keep-current');
  const progress = document.getElementById('review-progress');
  const review = createReviewState({ sameDocument: (a, b) => a.eq(b) });
  let items = [], active = -1, lastChunks, lastA, lastB, pendingCause = 'edit', applying = false;

  function readItems(merge) {
    return buildChangeItems(merge.chunks, merge.a.state.doc, merge.b.state.doc).map(item => ({
      ...item,
      // A remains unchanged when a block is copied to B. Excluding B's position
      // keeps decisions attached to their content when preceding lines move.
      key: JSON.stringify([item.a.from, item.a.to,
        merge.a.state.doc.sliceString(item.a.from, item.a.to),
        merge.b.state.doc.sliceString(item.b.from, item.b.to)])
    }));
  }
  function pair(merge, nextItems) {
    return { a: merge.a.state.doc, b: merge.b.state.doc, keys: nextItems.map(item => item.key) };
  }

  function paintActive() {
    for (let i = 0; i < list.children.length; i++) {
      const selected = i === active;
      const card = list.children[i];
      const kept = review.isKept(items[i].key);
      card.classList.toggle('is-active', selected);
      card.classList.toggle('is-reviewed', kept);
      if (selected) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
      const keep = card.querySelector('.change-keep');
      keep.textContent = kept ? 'B kept ✓' : 'Keep B';
      keep.disabled = kept;
      keep.setAttribute('aria-pressed', String(kept));
    }
    position.textContent = items.length ? `${active < 0 ? '—' : active + 1} / ${items.length}` : '0 / 0';
    useCurrent.disabled = active < 0 || !items.length;
    if (keepCurrentButton) keepCurrentButton.disabled = active < 0 || !items.length || review.isKept(items[active].key);
    const state = review.progress;
    if (progress) progress.textContent = `Reviewed ${state.reviewed} / ${state.total}${state.notice ? ` · ${state.notice}` : state.total && state.reviewed === state.total ? ' · All changes reviewed' : ''}`;
  }

  function update() {
    const merge = getMerge();
    if (!merge) return;
    const docA = merge.a.state.doc, docB = merge.b.state.doc;
    if (lastChunks === merge.chunks && lastA === docA && lastB === docB) return;
    const previous = items[active];
    lastChunks = merge.chunks; lastA = docA; lastB = docB;
    items = readItems(merge).map(item => ({ ...item, operation: prepareChunk(item.chunk) }));
    review.sync(pair(merge, items), pendingCause);
    pendingCause = 'edit';
    if (!items.length || !previous) active = -1;
    else {
      active = items.findIndex(item => item.chunk === previous.chunk);
      if (active < 0) {
        let distance = Infinity;
        items.forEach((item, index) => {
          const nextDistance = Math.abs(item.a.from - previous.a.from) + Math.abs(item.b.from - previous.b.from);
          if (nextDistance < distance) { distance = nextDistance; active = index; }
        });
      }
    }
    summary.textContent = items.length
      ? `${items.length} change block${items.length === 1 ? '' : 's'}${items.some(item => !item.chunk.precise) ? ' · grouped' : ''}`
      : docA.length || docB.length ? 'No text differences' : 'Open or paste two versions';
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
      const card = document.createElement('li');
      card.className = 'change-item';
      const jump = document.createElement('button');
      jump.type = 'button'; jump.className = 'change-jump';
      jump.setAttribute('aria-label', `Change ${item.index + 1}: ${item.summary}`);
      for (const [className, text] of [['change-kind', `${item.index + 1}. ${item.kind}`], ['change-lines', item.label], ['change-preview', item.preview]]) {
        const span = document.createElement('span');
        span.className = className; span.textContent = text; jump.append(span);
      }
      jump.addEventListener('click', () => {
        update();
        const index = items.findIndex(current => current.chunk === item.chunk);
        if (index >= 0) reveal(index);
      });
      const apply = document.createElement('button');
      apply.type = 'button'; apply.className = 'change-apply'; apply.textContent = 'Use A';
      apply.title = item.a.empty ? 'Remove this addition from B' : 'Use version A for this change';
      apply.setAttribute('aria-label', `Use A for change ${item.index + 1}: ${item.label}`);
      apply.addEventListener('click', event => { if (event.detail <= 1) applyItem(item); });
      const keep = document.createElement('button');
      keep.type = 'button'; keep.className = 'change-keep'; keep.textContent = 'Keep B';
      keep.title = 'Keep version B and mark this change reviewed';
      keep.setAttribute('aria-label', `Keep B for change ${item.index + 1}: ${item.label}`);
      keep.addEventListener('click', event => {
        if (event.detail > 1) return;
        update();
        const index = items.findIndex(current => current.chunk === item.chunk);
        if (index >= 0) { active = index; keepCurrent(); }
      });
      const actions = document.createElement('div');
      actions.className = 'change-actions'; actions.append(apply, keep);
      card.append(jump, actions); fragment.append(card);
    });
    list.replaceChildren(fragment);
    paintActive();
  }

  function reveal(index) {
    if (!items.length) return;
    active = (index + items.length) % items.length;
    const item = items[active], merge = getMerge();
    for (const side of ['a', 'b']) {
      const range = item[side];
      const doc = merge[side].state.doc;
      const anchor = doc.line(range.startLine).from;
      merge[side].dispatch({
        selection: { anchor },
        effects: EditorView.scrollIntoView(anchor, { y: 'center', x: 'nearest' })
      });
    }
    paintActive();
    list.children[active]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function nextUnreviewed(start = active + 1) {
    update();
    for (let offset = 0; offset < items.length; offset++) {
      const index = (Math.max(0, start) + offset) % items.length;
      if (!review.isKept(items[index].key)) { reveal(index); return; }
    }
    paintActive();
  }

  function keepCurrent() {
    update();
    const item = items[active];
    if (!item) return;
    review.keep(item.key);
    paintActive();
    nextUnreviewed();
  }

  function captureForChunk(chunk) {
    update();
    const item = items.find(item => item.chunk === chunk);
    return item ? () => applyItem(item) : null;
  }

  function applyItem(item) {
    // Use the proposal that was displayed. Never silently replace an old
    // proposal with a new command against a newer document during this click.
    const merge = getMerge();
    applying = true;
    let accepted;
    try { accepted = applyChunk(item.operation); } finally { applying = false; }
    if (!accepted) { update(); return false; }
    const applied = review.apply(item.key, pair(merge, readItems(merge)));
    update();
    if (applied) {
      const start = items.findIndex(next => next.a.from >= item.a.from);
      nextUnreviewed(start < 0 ? 0 : start);
    }
    return true;
  }

  return {
    update, captureForChunk, keepCurrent, nextUnreviewed,
    documentChanged(editorUpdate) {
      if (applying) return;
      const isHistory = editorUpdate.transactions.filter(tr => tr.docChanged || tr.effects.some(e => e.is(restoreRaw)))
        .every(tr => tr.isUserEvent('undo') || tr.isUserEvent('redo'));
      // Invalidate immediately, even if a manual edit and Undo happen before
      // the next animation frame. Configuration changes do not reach this path.
      if (!isHistory) review.invalidate();
      lastChunks = undefined; // A rapid edit + undo may end at the same Text objects.
      pendingCause = isHistory ? 'history' : 'edit';
    },
    reset() {
      active = -1; items = []; lastChunks = lastA = lastB = undefined;
      pendingCause = 'edit'; review.reset(); update();
    },
    revealFirst() { update(); if (items.length) reveal(0); },
    next() { update(); if (items.length) reveal(active < 0 ? 0 : active + 1); },
    previous() { update(); if (items.length) reveal(active < 0 ? items.length - 1 : active - 1); },
    applyCurrent() { if (active >= 0 && items[active]) applyItem(items[active]); }
  };
}

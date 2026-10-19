import { EditorView } from '@codemirror/view';
import { buildChangeItems } from './changes.mjs';

export function createChangesController({ getMerge, applyChunk }) {
  const list = document.getElementById('changes-list');
  const summary = document.getElementById('changes-summary');
  const position = document.getElementById('change-position');
  const useCurrent = document.getElementById('use-current');
  let items = [], active = -1, lastChunks, lastA, lastB;

  function paintActive() {
    for (let i = 0; i < list.children.length; i++) {
      const selected = i === active;
      const card = list.children[i];
      card.classList.toggle('is-active', selected);
      if (selected) card.setAttribute('aria-current', 'true');
      else card.removeAttribute('aria-current');
    }
    position.textContent = items.length ? `${active < 0 ? '—' : active + 1} / ${items.length}` : '0 / 0';
    useCurrent.disabled = active < 0 || !items.length;
  }

  function update() {
    const merge = getMerge();
    if (!merge) return;
    const docA = merge.a.state.doc, docB = merge.b.state.doc;
    if (lastChunks === merge.chunks && lastA === docA && lastB === docB) return;
    const previous = items[active];
    lastChunks = merge.chunks; lastA = docA; lastB = docB;
    items = buildChangeItems(merge.chunks, docA, docB);
    if (!items.length || !previous) active = -1;
    else {
      active = items.findIndex(item => item.chunk === previous.chunk);
      if (active < 0) {
        // Edits recreate chunks. Stay near the former active block, without
        // moving the user's editor viewport while they type.
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
      apply.addEventListener('click', () => {
        update();
        const index = items.findIndex(current => current.chunk === item.chunk);
        if (index < 0) return; // Never apply an index from an obsolete diff.
        active = index;
        applyChunk(items[index].chunk);
        update();
      });
      card.append(jump, apply); fragment.append(card);
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

  return {
    update,
    reset() { active = -1; items = []; lastChunks = lastA = lastB = undefined; update(); },
    revealFirst() { update(); if (items.length) reveal(0); },
    next() { update(); if (items.length) reveal(active < 0 ? 0 : active + 1); },
    previous() { update(); if (items.length) reveal(active < 0 ? items.length - 1 : active - 1); },
    applyCurrent() {
      update();
      if (active >= 0 && items[active]) { applyChunk(items[active].chunk); update(); }
    }
  };
}

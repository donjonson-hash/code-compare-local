import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, placeholder, drawSelection, highlightWhitespace } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab, undo, redo, undoDepth, redoDepth, isolateHistory } from '@codemirror/commands';
import { syntaxHighlighting, bracketMatching, StreamLanguage } from '@codemirror/language';
import { MergeView } from '@codemirror/merge';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { normalize, makeDocument, decodeFile, encodeFile, formatLabel, safeFilename, validate } from './document.mjs';
import { rawField, rawHistory, restoreRaw } from './raw-state.mjs';
import { lintGutter } from '@codemirror/lint';
import { createSyntaxController } from './syntax-ui.mjs';
import { createChangesController } from './changes-ui.mjs';
import { accessibleCollapsedContext } from './focus-view.mjs';
import { prepareBlockTransfer, checkBlockTransfer } from './block-transfer.mjs';
import { DIFF_CONFIG } from './diff-policy.mjs';
import { studioHighlightStyle } from './editor-theme.mjs';
import { serializeSession, parseSession, MAX_SESSION_BYTES } from './session.mjs';

const $ = id => document.getElementById(id);
const compartments = { a: { language: new Compartment(), wrap: new Compartment(), whitespace: new Compartment() }, b: { language: new Compartment(), wrap: new Compartment(), whitespace: new Compartment() } };
const revisions = { a: 0, b: 0 };
// Content versions are separate from async file-loading cancellation tokens.
const transferRevisions = { a: 0, b: 0 };
const appliedOperationIds = new Set();
let operationSequence = 0, controlsRevision = '';
let merge, syntax, changes, revealRequested = false, updateQueued = false, toastTimer, dirty = false;
let sessionGeneration = 0, pendingSession = null;

function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000);
}

function extensions(side, doc) {
  return [
    rawField.init(() => doc), rawHistory, history({ minDepth: 40 }),
    lineNumbers(), lintGutter(), highlightActiveLineGutter(), drawSelection(), bracketMatching(),
    EditorView.theme({}, { dark: true }), syntaxHighlighting(studioHighlightStyle),
    keymap.of([...historyKeymap, ...defaultKeymap, indentWithTab]),
    EditorState.tabSize.of(4), EditorState.lineSeparator.of('\n'),
    compartments[side].language.of([]), compartments[side].wrap.of([]),
    compartments[side].whitespace.of($('show-whitespace').checked ? highlightWhitespace() : []),
    accessibleCollapsedContext,
    EditorState.phrases.of({ '$ unchanged lines': '$ unchanged lines · expand' }),
    placeholder(side === 'a' ? 'Paste the original code…' : 'Paste the updated code…'),
    EditorView.contentAttributes.of({ 'aria-label': `Code ${side.toUpperCase()}`, spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    EditorState.transactionFilter.of(tr => {
      if (!tr.docChanged) return tr;
      try { validate(tr.newDoc.toString()); return tr; }
      catch (error) { queueMicrotask(() => notify(error.message)); return []; }
    }),
    EditorView.updateListener.of(update => {
      if (update.docChanged || update.transactions.some(tr => tr.effects.some(e => e.is(restoreRaw)))) {
        revisions[side]++;
        transferRevisions[side]++;
        changes?.documentChanged(update);
        dirty = true;
        syntax?.schedule();
      }
      queueStats();
    })
  ];
}

function renderRevertControl() {
  const button = document.createElement('button');
  button.textContent = '→';
  button.type = 'button';
  button.title = 'Copy this block from A to B';
  button.setAttribute('aria-label', 'Copy this block from A to B');
  // Disable CodeMirror's parent mousedown handler: all transfers must pass
  // through the same checked command, including pointer and keyboard actions.
  button.addEventListener('mousedown', event => { event.stopPropagation(); event.preventDefault(); });
  let applyDisplayed = null;
  queueMicrotask(() => {
    // CodeMirror assigns data-chunk immediately after this render callback.
    // Capture once; a detached old button must never resolve a newer index.
    const chunk = merge.chunks[Number(button.dataset.chunk)];
    applyDisplayed = chunk ? changes.captureForChunk(chunk) : null;
    button.disabled = !applyDisplayed;
  });
  button.addEventListener('click', event => {
    event.stopPropagation();
    event.preventDefault();
    if (event.detail <= 1) applyDisplayed?.();
  });
  return button;
}

function transferSnapshot() {
  return {
    source: merge.a.state.field(rawField), target: merge.b.state.field(rawField),
    sourceRevision: transferRevisions.a, targetRevision: transferRevisions.b
  };
}

function prepareChunk(chunk) {
  return prepareBlockTransfer({ id: `block-${++operationSequence}`, ...transferSnapshot(), chunk });
}

function applyChunk(operation) {
  const result = checkBlockTransfer(operation, { ...transferSnapshot(), appliedIds: appliedOperationIds });
  if (result.status !== 'ready') {
    notify(result.message);
    return false;
  }
  try {
    merge.b.dispatch({
      changes: result.edits.map(e => ({ from: e.from, to: e.to, insert: normalize(e.rawInsert) })),
      effects: restoreRaw.of(result.document), annotations: isolateHistory.of('full'), userEvent: 'input.merge'
    });
  } catch {
    notify('This change could not be applied. Select the difference again.');
    return false;
  }
  const actual = merge.b.state.field(rawField);
  if (actual.raw !== result.document.raw || actual.bom !== result.document.bom ||
      actual.eol !== result.document.eol || merge.b.state.doc.toString() !== normalize(result.document.raw)) {
    notify('This change was not applied. Check the file limits and select the difference again.');
    return false;
  }
  // Consume the command only after the editor accepted the complete transaction.
  appliedOperationIds.add(operation.id);
  merge.b.focus();
  notify('Block copied to B. You can undo this edit.');
  return true;
}

function initialize(docA = makeDocument(), docB = makeDocument()) {
  merge = new MergeView({
    a: { doc: normalize(docA.raw), extensions: extensions('a', docA) },
    b: { doc: normalize(docB.raw), extensions: extensions('b', docB) },
    parent: $('editors'), revertControls: 'a-to-b', renderRevertControl,
    diffConfig: DIFF_CONFIG, highlightChanges: true, gutter: true
  });
  queueStats();
}

function queueStats() {
  if (updateQueued) return;
  updateQueued = true;
  requestAnimationFrame(() => { updateQueued = false; if (merge) updateStats(); });
}

function updateStats() {
  for (const side of ['a', 'b']) {
    const state = merge[side].state;
    $( `meta-${side}` ).textContent = `${state.doc.lines} lines · ${state.doc.length.toLocaleString('en-US')} chars · ${formatLabel(state.field(rawField))}`;
  }
  const a = merge.a.state.field(rawField), b = merge.b.state.field(rawField);
  const sameText = merge.a.state.doc.eq(merge.b.state.doc);
  const sameRaw = a.raw === b.raw && a.bom === b.bom;
  $('format-notice').hidden = !(sameText && !sameRaw);
  const count = merge.chunks.length;
  const approximate = merge.chunks.some(c => !c.precise);
  $('diff-count').textContent = sameText ? (sameRaw ? (a.raw ? 'Versions match' : 'Add two texts') : 'Format differs') : `${count} change block${count === 1 ? '' : 's'}${approximate ? ' · grouped' : ''}`;
  $('prev').disabled = $('next').disabled = !count;
  $('undo').disabled = !undoDepth(merge.b.state);
  $('redo').disabled = !redoDepth(merge.b.state);
  $('copy-all').disabled = sameRaw;
  changes?.update();
  const nextControlsRevision = `${transferRevisions.a}:${transferRevisions.b}`;
  if (controlsRevision !== nextControlsRevision) {
    controlsRevision = nextControlsRevision;
    // CodeMirror otherwise reuses arrow DOM nodes by chunk index.
    merge.reconfigure({ renderRevertControl });
  }
  if (revealRequested) {
    revealRequested = false;
    if ($('changes-only').checked) setChangesOnly(true);
    changes?.revealFirst();
  }
}

const languages = {
  text: () => [], javascript: () => javascript(), jsx: () => javascript({ jsx: true }), typescript: () => javascript({ typescript: true }), tsx: () => javascript({ typescript: true, jsx: true }),
  json, python, html, css, java, cpp, sql, markdown, yaml: () => StreamLanguage.define(yaml)
};

function setLanguage(name) {
  $('language').value = name;
  for (const side of ['a', 'b']) merge[side].dispatch({ effects: compartments[side].language.reconfigure(languages[name]()) });
  syntax?.schedule();
}

function inferLanguage(name) {
  const ext = name.split('.').at(-1).toLowerCase();
  return ({js:'javascript',mjs:'javascript',cjs:'javascript',jsx:'jsx',ts:'typescript',tsx:'tsx',py:'python',json:'json',html:'html',htm:'html',css:'css',java:'java',c:'cpp',h:'cpp',cpp:'cpp',hpp:'cpp',cc:'cpp',sql:'sql',yaml:'yaml',yml:'yaml',md:'markdown'})[ext] || 'text';
}

function replaceDocument(side, doc) {
  merge[side].dispatch({ changes: { from: 0, to: merge[side].state.doc.length, insert: normalize(doc.raw) }, effects: restoreRaw.of(doc), annotations: isolateHistory.of('full'), userEvent: 'input.load' });
}

async function loadFile(side, file) {
  if (!file) return;
  const revision = ++revisions[side];
  try {
    if (file.size > 512 * 1024) throw new Error('File exceeds 512 KB. Choose a smaller file.');
    const doc = decodeFile(new Uint8Array(await file.arrayBuffer()));
    if (revision !== revisions[side]) { notify('Loading canceled: the editor content has changed.'); return; }
    changes?.reset();
    revealRequested = true;
    replaceDocument(side, doc);
    $(`name-${side}`).textContent = file.name;
    setLanguage(inferLanguage(file.name));
    if (side === 'b' || $('filename').value === 'result.txt') $('filename').value = safeFilename(file.name);
    notify(`Opened ${file.name} in ${side.toUpperCase()}.`);
  } catch (error) { notify(error.message); }
}

for (const side of ['a', 'b']) {
  $(`file-${side}`).addEventListener('change', event => {
    loadFile(side, event.target.files[0]);
    event.target.value = '';
  });
}
$('language').addEventListener('change', event => setLanguage(event.target.value));
$('wrap').addEventListener('change', event => {
  for (const side of ['a', 'b']) merge[side].dispatch({ effects: compartments[side].wrap.reconfigure(event.target.checked ? EditorView.lineWrapping : []) });
});
$('undo').addEventListener('click', () => { undo(merge.b); merge.b.focus(); });
$('redo').addEventListener('click', () => { redo(merge.b); merge.b.focus(); });
function setChangesOnly(enabled) {
  $('changes-only').checked = enabled;
  // Remove the field before rebuilding its ranges for newly loaded documents.
  merge.reconfigure({ collapseUnchanged: undefined });
  if (enabled) merge.reconfigure({ collapseUnchanged: { margin: 3, minSize: 6 } });
  $('focus-hint').hidden = !enabled;
}
$('changes-only').addEventListener('change', event => {
  setChangesOnly(event.target.checked);
  if (event.target.checked) changes.revealFirst();
});
$('show-whitespace').addEventListener('change', event => {
  for (const side of ['a', 'b']) merge[side].dispatch({
    effects: compartments[side].whitespace.reconfigure(event.target.checked ? highlightWhitespace() : [])
  });
  $('whitespace-hint').hidden = !event.target.checked;
});
$('keep-current').addEventListener('click', event => { if (event.detail <= 1) changes.keepCurrent(); });
$('next').addEventListener('click', () => changes.next());
$('prev').addEventListener('click', () => changes.previous());
$('use-current').addEventListener('click', event => { if (event.detail <= 1) changes.applyCurrent(); });
$('font-size').addEventListener('change', event => {
  const size = Number(event.target.value);
  if (![14, 16, 18, 20].includes(size)) return;
  document.documentElement.style.setProperty('--code-font-size', `${size}px`);
  merge.a.requestMeasure(); merge.b.requestMeasure();
});
$('copy-all').addEventListener('click', () => { replaceDocument('b', merge.a.state.field(rawField)); notify('Version A copied to B. You can undo this edit.'); });
$('copy-format').addEventListener('click', () => { replaceDocument('b', merge.a.state.field(rawField)); notify('Line endings and BOM copied from A. You can undo this edit.'); });
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(merge.b.state.field(rawField).raw); notify('Code B copied. Use Download B to preserve line endings exactly.'); }
  catch { notify('Clipboard unavailable. Select code B and copy it manually, or download the file.'); }
});
$('download').addEventListener('click', () => {
  const bytes = encodeFile(merge.b.state.field(rawField));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url; link.download = safeFilename($('filename').value); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  // A download request cannot confirm that the browser saved the file, and
  // exporting B does not save edits in A. Keep the leave-page protection.
  notify('File B sent to your browser for download.');
});

function sessionSnapshot() {
  return {
    a: { ...merge.a.state.field(rawField), name: $('name-a').textContent },
    b: { ...merge.b.state.field(rawField), name: $('name-b').textContent },
    resultFilename: $('filename').value, language: $('language').value,
    settings: { wrap: $('wrap').checked, changesOnly: $('changes-only').checked,
      showWhitespace: $('show-whitespace').checked, fontSize: Number($('font-size').value),
      focusMode: $('zen-mode').getAttribute('aria-pressed') === 'true' },
    review: changes.exportReview()
  };
}

$('save-session').addEventListener('click', () => {
  try {
    const text = serializeSession(sessionSnapshot());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'compare-code-session.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    // As with Download B, a browser download request is not a save receipt.
    notify('Session sent for download. It contains both code files; edit history is not included.');
  } catch (error) { notify(error.message); }
});

function restoreSession(saved) {
  // Parsing and all limits have been checked before either editor is replaced.
  // Rebuild both states together so Undo cannot restore a previous session.
  sessionGeneration++;
  revisions.a++; revisions.b++;
  transferRevisions.a++; transferRevisions.b++;
  appliedOperationIds.clear(); controlsRevision = ''; revealRequested = false;
  merge.destroy();
  $('show-whitespace').checked = saved.settings.showWhitespace;
  initialize(saved.a, saved.b);
  $('name-a').textContent = saved.a.name; $('name-b').textContent = saved.b.name;
  $('filename').value = saved.resultFilename;
  setLanguage(saved.language);
  for (const id of ['wrap', 'show-whitespace']) {
    $(id).checked = id === 'wrap' ? saved.settings.wrap : saved.settings.showWhitespace;
    $(id).dispatchEvent(new Event('change'));
  }
  $('font-size').value = String(saved.settings.fontSize);
  $('font-size').dispatchEvent(new Event('change'));
  setChangesOnly(saved.settings.changesOnly);
  if (($('zen-mode').getAttribute('aria-pressed') === 'true') !== saved.settings.focusMode) $('zen-mode').click();
  changes.reset();
  changes.restoreReview(saved.review);
  dirty = true;
  syntax.schedule(true);
  queueStats();
  notify('Session opened. Both texts and remaining Keep B marks restored. Edit history starts here.');
}

async function loadSession(file) {
  if (!file) return;
  const generation = ++sessionGeneration;
  const before = JSON.stringify(sessionSnapshot());
  const revisionA = revisions.a, revisionB = revisions.b;
  try {
    if (file.size > MAX_SESSION_BYTES) throw new Error('Session exceeds 8 MiB. Choose a smaller session file.');
    const bytes = await file.arrayBuffer();
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('Use a UTF-8 Compare Code session file.'); }
    const saved = parseSession(text);
    if (generation !== sessionGeneration || revisionA !== revisions.a || revisionB !== revisions.b || before !== JSON.stringify(sessionSnapshot())) {
      notify('Opening session canceled: the workspace changed. Open the session again.'); return;
    }
    if (dirty || merge.a.state.doc.length || merge.b.state.doc.length) {
      pendingSession = { saved, before, generation, revisionA, revisionB };
      $('confirm-session').returnValue = '';
      $('confirm-session').showModal();
    } else restoreSession(saved);
  } catch (error) {
    if (generation === sessionGeneration) notify(error.message);
  }
}
$('open-session').addEventListener('change', event => {
  loadSession(event.target.files[0]);
  event.target.value = '';
});
$('confirm-session').addEventListener('close', () => {
  const pending = pendingSession;
  pendingSession = null;
  if ($('confirm-session').returnValue !== 'open' || !pending) return;
  if (pending.generation !== sessionGeneration || pending.revisionA !== revisions.a || pending.revisionB !== revisions.b || pending.before !== JSON.stringify(sessionSnapshot())) {
    notify('Opening session canceled: the workspace changed. Open the session again.'); return;
  }
  restoreSession(pending.saved);
});
$('clear').addEventListener('click', () => $('confirm-clear').showModal());
$('confirm-clear').addEventListener('close', () => {
  if ($('confirm-clear').returnValue !== 'clear') return;
  sessionGeneration++; pendingSession = null;
  revealRequested = false;
  $('changes-only').checked = false; $('focus-hint').hidden = true;
  changes.reset();
  appliedOperationIds.clear();
  merge.destroy();
  initialize();
  $('filename').value = 'result.txt'; $('language').value = 'text'; $('wrap').checked = false;
  $('name-a').textContent = 'Paste code or open a file';
  $('name-b').textContent = 'Edit directly here';
  dirty = false;
  revisions.a++; revisions.b++;
  transferRevisions.a++; transferRevisions.b++;
  syntax.schedule();
  notify('Both editors cleared.');
});
$('demo').addEventListener('click', () => {
  const a = 'function calculateTotal(items) {\n  const subtotal = items.reduce((sum, item) => {\n    return sum + item.price;\n  }, 0);\n\n  const tax = subtotal * 0.20;\n  return subtotal + tax;\n}\n\nconst cart = [\n  { name: "Notebook", price: 12 },\n  { name: "Pencil", price: 3 }\n];\n\nconsole.log(calculateTotal(cart));\n';
  const b = 'function calculateTotal(items) {\n  const subtotal = items.reduce((sum, item) => {\n    return sum + item.price * item.quantity;\n  }, 0);\n\n  const tax = subtotal * 0.18;\n  const shipping = subtotal > 50 ? 0 : 5;\n  return subtotal + tax + shipping;\n}\n\nconst cart = [\n  { name: "Notebook", price: 12, quantity: 2 },\n  { name: "Pencil", price: 3, quantity: 4 }\n];\n\nconsole.log(calculateTotal(cart).toFixed(2));\n';
  changes.reset(); revealRequested = true;
  replaceDocument('a', makeDocument(a)); replaceDocument('b', makeDocument(b));
  $('name-a').textContent = 'cart-original.js'; $('name-b').textContent = 'cart-updated.js';
  $('filename').value = 'cart-updated.js'; setLanguage('javascript');
  notify('Example loaded. Select a difference, then use A to update that block in B.');
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
initialize();
changes = createChangesController({ getMerge: () => merge, prepareChunk, applyChunk, notify });
syntax = createSyntaxController({ getView: side => merge[side], getLanguage: () => $('language').value, beforeReveal: () => {
  if ($('changes-only').checked) { setChangesOnly(false); notify('Showing full files for this syntax issue.'); }
} });
syntax.schedule(true);

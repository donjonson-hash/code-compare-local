import { EditorView } from '@codemirror/view';
import { setDiagnostics } from '@codemirror/lint';
import { isolateHistory } from '@codemirror/commands';
import { compareSyntax } from './syntax-compare.mjs';

export function createSyntaxController({ getView, getLanguage, beforeReveal = () => {}, notify = () => {} }) {
  let worker, timer, watchdog, generation = 0, active = 0, snapshot = null;
  let pendingFix = null;
  const $ = id => document.getElementById(id);
  const fixDialog = $('confirm-syntax-fix');
  const fixApply = fixDialog.querySelector('button[value="apply"]');
  const invalidateFix = () => {
    if (!pendingFix) return;
    pendingFix = null;
    fixApply.disabled = true;
    $('syntax-fix-status').textContent = 'Code or language changed. Close this preview and check again.';
  };
  const currentFix = pending => pending && pending.id === generation &&
    pending.language === getLanguage() && pending.view === getView(pending.side) &&
    pending.source === pending.view.state.doc.toString();
  const addFixButton = (item, side, diagnostic, request) => {
    const fix = diagnostic.fix;
    const source = request[side];
    if (!fix || !Number.isInteger(fix.from) || !Number.isInteger(fix.to) || fix.from < 0 ||
        fix.to < fix.from || fix.to > source.length || typeof fix.insert !== 'string' ||
        typeof fix.title !== 'string' || source.slice(fix.from, fix.to) === fix.insert) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'button small syntax-fix-preview'; button.dataset.side = side;
    button.textContent = `Preview fix in ${side.toUpperCase()}`;
    button.addEventListener('click', () => {
      const pending = { side, source, fix, id: request.id, language: request.language, view: getView(side) };
      if (!currentFix(pending) || fixDialog.open) return;
      pendingFix = pending;
      const start = Math.max(source.lastIndexOf('\n', Math.max(0, fix.from - 1)) + 1, fix.from - 140);
      const nextLine = source.indexOf('\n', fix.to);
      const end = Math.min(nextLine < 0 ? source.length : nextLine, fix.to + 140);
      const prefix = start > 0 && source[start - 1] !== '\n' ? '…' : '';
      const suffix = end < source.length && source[end] !== '\n' ? '…' : '';
      $('syntax-fix-title').textContent = `${side.toUpperCase()}: ${fix.title}`;
      $('syntax-fix-before').textContent = prefix + source.slice(start, end) + suffix;
      $('syntax-fix-after').textContent = prefix + source.slice(start, fix.from) + fix.insert + source.slice(fix.to, end) + suffix;
      $('syntax-fix-status').textContent = request.language === 'python'
        ? 'This edit passed the preliminary Python check. Review the change before applying it.'
        : 'This edit passed the syntax check. Review the change before applying it.';
      fixApply.disabled = false;
      fixDialog.returnValue = '';
      fixDialog.showModal();
    });
    item.append(button);
  };
  fixDialog.addEventListener('close', () => {
    const pending = pendingFix;
    pendingFix = null;
    if (fixDialog.returnValue !== 'apply') return;
    if (!currentFix(pending)) { notify('This syntax suggestion is out of date. Check again.'); return; }
    const { view, fix, source, side } = pending;
    beforeReveal();
    const expected = source.slice(0, fix.from) + fix.insert + source.slice(fix.to);
    view.dispatch({ changes: { from: fix.from, to: fix.to, insert: fix.insert },
      selection: { anchor: fix.from, head: fix.from + fix.insert.length },
      effects: EditorView.scrollIntoView(fix.from, { y: 'center' }),
      annotations: isolateHistory.of('full'), userEvent: 'input.syntax-fix' });
    if (view.state.doc.toString() !== expected) return;
    view.focus();
    notify(`Syntax edit applied to ${side.toUpperCase()}. Checking again; you can undo this edit.`);
  });
  const renderStatus = (side, title, note, kind = 'neutral') => {
    $(`syntax-${side}`).dataset.state = kind;
    $(`syntax-status-${side}`).textContent = title;
    $(`syntax-note-${side}`).textContent = note;
    $(`syntax-list-${side}`).replaceChildren();
    $(`syntax-details-${side}`).hidden = true;
  };
  const clearMarks = () => {
    for (const side of ['a', 'b']) getView(side).dispatch(setDiagnostics(getView(side).state, []));
  };
  const comparisonStatus = (title, note, kind) => {
    $('syntax-comparison').dataset.state = kind;
    $('syntax-comparison-status').textContent = title;
    $('syntax-comparison-note').textContent = note;
    $('syntax-comparison-list').replaceChildren();
  };
  const reveal = (side, diagnostic, id) => {
    if (id !== generation) return;
    beforeReveal();
    const editor = getView(side);
    const from = Math.min(editor.state.doc.length, Math.max(0, diagnostic.from));
    const to = Math.min(editor.state.doc.length, Math.max(from, diagnostic.to));
    editor.dispatch({ selection: { anchor: from, head: to }, effects: EditorView.scrollIntoView(from, { y: 'center' }) });
    editor.focus();
  };
  function renderComparison(a, b, request) {
    const report = compareSyntax({ sourceA: request.a, sourceB: request.b, resultA: a, resultB: b });
    const counts = ['introduced', 'resolved', 'persistent', 'uncertain'].map(kind => report[kind].length);
    const title = report.status === 'unavailable' ? 'Comparison unavailable'
      : report.status === 'incomplete' ? 'Comparison incomplete'
      : counts.every(count => count === 0) ? 'No syntax diagnostics reported in A or B'
      : `Newly reported: ${counts[0]} · No longer reported: ${counts[1]} · Matching: ${counts[2]} · Uncertain: ${counts[3]}`;
    const note = [report.reason, a.scope, report.limited ? 'Preliminary check; validate Python code with Python.' : '',
      'These are parser reports, not proof of a fix or correct behavior. An earlier issue can hide later diagnostics.'].filter(Boolean).join(' ');
    comparisonStatus(title, note, report.status);
    const labels = { introduced: 'Newly reported in B', resolved: 'No longer reported in B', persistent: 'Matching diagnostic', uncertain: 'Uncertain match' };
    for (const category of ['introduced', 'resolved', 'persistent', 'uncertain']) {
      for (const entry of report[category]) {
        const item = document.createElement('li');
        item.className = 'syntax-comparison-item'; item.dataset.category = category;
        const label = document.createElement('strong'); label.textContent = labels[category];
        item.append(label);
        for (const side of ['a', 'b']) {
          const diagnostic = entry[side];
          if (!diagnostic) continue;
          const button = document.createElement('button');
          button.type = 'button'; button.className = `diagnostic syntax-comparison-link ${diagnostic.severity}`;
          button.dataset.side = side;
          button.textContent = `${side.toUpperCase()} · Line ${diagnostic.line}:${diagnostic.column} · ${diagnostic.severity} — ${diagnostic.message}`;
          button.addEventListener('click', () => reveal(side, diagnostic, request.id));
          item.append(button);
          const original = (side === 'a' ? a : b).diagnostics.find(d =>
            d.from === diagnostic.from && d.to === diagnostic.to && d.message === diagnostic.message);
          if (original) addFixButton(item, side, original, request);
        }
        const reason = document.createElement('p'); reason.textContent = entry.reason; item.append(reason);
        $('syntax-comparison-list').append(item);
      }
    }
  }
  const failed = message => {
    ++generation;
    invalidateFix();
    clearTimeout(timer); clearTimeout(watchdog);
    worker?.terminate(); worker = null; active = 0; snapshot = null;
    clearMarks();
    $('syntax-report').dataset.worker = 'unavailable';
    for (const side of ['a', 'b']) renderStatus(side, 'Check incomplete', message, 'unavailable');
    comparisonStatus('Comparison incomplete', message, 'incomplete');
  };
  function startWorker() {
    try {
      const current = new Worker(new URL('syntax-worker.js', document.baseURI));
      worker = current;
      current.onmessage = ({ data }) => {
        if (worker !== current) return;
        if (data.ready) { $('syntax-report').dataset.worker = 'ready'; return; }
        if (data.id !== generation || data.id !== active) return;
        const request = snapshot;
        clearTimeout(watchdog); active = 0;
        if (data.failed) { failed('Could not parse this code. Try checking again.'); return; }
        if (!request || getLanguage() !== request.language || getView('a').state.doc.toString() !== request.a ||
            getView('b').state.doc.toString() !== request.b) { schedule(true); return; }
        render('a', data.a, request); render('b', data.b, request);
        renderComparison(data.a, data.b, request);
      };
      current.onerror = event => {
        event.preventDefault();
        if (worker === current) failed('Syntax checking could not start. Save or copy your work, then reload the editor and try again.');
      };
      return true;
    } catch {
      failed('Syntax checking could not start. Save or copy your work, then reload the editor and try again.');
      return false;
    }
  }
  function render(side, result, request) {
    const view = getView(side);
    const diagnostics = result.diagnostics || [];
    view.dispatch(setDiagnostics(view.state, diagnostics));
    if (result.status === 'empty') {
      renderStatus(side, 'Add code', 'Checking starts automatically.'); return;
    }
    if (result.status === 'unsupported') {
      renderStatus(side, getLanguage() === 'text' ? 'Choose a language' : 'Highlighting only', result.scope, 'unsupported'); return;
    }
    const errors = diagnostics.filter(d => d.severity === 'error').length;
    const warnings = diagnostics.length - errors;
    const title = errors ? `Errors: ${errors}${warnings ? ` · warnings: ${warnings}` : ''}` : warnings ? `Warnings: ${warnings}` : 'No syntax issues found';
    renderStatus(side, title, `${result.scope}${result.limited ? ' · preliminary' : ''}${result.truncated ? ' · list truncated' : ''}`, errors ? 'error' : warnings ? 'warning' : 'checked');
    if (!diagnostics.length) return;
    const details = $(`syntax-details-${side}`);
    details.hidden = false; details.open = true;
    for (const diagnostic of diagnostics) {
      const from = Math.min(view.state.doc.length, Math.max(0, diagnostic.from));
      const line = view.state.doc.lineAt(from);
      const button = document.createElement('button');
      button.type = 'button'; button.className = `diagnostic ${diagnostic.severity}`;
      button.textContent = `Line ${line.number}:${from - line.from + 1} — ${diagnostic.message}`;
      const id = generation;
      button.addEventListener('click', () => reveal(side, diagnostic, id));
      const item = document.createElement('li'); item.append(button);
      addFixButton(item, side, diagnostic, request);
      $(`syntax-list-${side}`).append(item);
    }
  }
  function run(id) {
    if (id !== generation) return;
    // A slow previous parse cannot delay a new request indefinitely.
    if (active) { worker?.terminate(); worker = null; active = 0; }
    if (!worker && !startWorker()) return;
    active = id;
    for (const side of ['a', 'b']) renderStatus(side, 'Checking…', 'Checked locally. Code is not run.', 'pending');
    comparisonStatus('Comparing syntax reports…', 'Checked locally. Code is not run.', 'pending');
    watchdog = setTimeout(() => {
      if (id === generation && id === active) failed('The check took too long. Try a smaller snippet.');
    }, 3000);
    snapshot = { id, language: getLanguage(), a: getView('a').state.doc.toString(), b: getView('b').state.doc.toString() };
    worker.postMessage(snapshot);
  }
  function schedule(immediate = false) {
    const id = ++generation;
    invalidateFix();
    clearTimeout(timer); clearTimeout(watchdog);
    for (const side of ['a', 'b']) renderStatus(side, 'Waiting to check', 'Results will update after your edit.', 'pending');
    comparisonStatus('Waiting to compare', 'Previous results were cleared after your edit.', 'pending');
    // CodeMirror forbids dispatch during an update listener.
    queueMicrotask(() => { if (id === generation) clearMarks(); });
    timer = setTimeout(() => run(id), immediate ? 0 : 450);
  }
  startWorker();
  $('check-syntax').addEventListener('click', () => schedule(true));
  return { schedule };
}

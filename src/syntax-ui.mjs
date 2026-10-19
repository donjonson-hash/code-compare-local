import { EditorView } from '@codemirror/view';
import { setDiagnostics } from '@codemirror/lint';

export function createSyntaxController({ getView, getLanguage, beforeReveal = () => {} }) {
  let worker, timer, watchdog, generation = 0, active = 0;
  const $ = id => document.getElementById(id);
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
  const failed = message => {
    clearTimeout(watchdog);
    worker?.terminate(); worker = null; active = 0;
    $('syntax-report').dataset.worker = 'unavailable';
    for (const side of ['a', 'b']) renderStatus(side, 'Check incomplete', message, 'unavailable');
  };
  function startWorker() {
    try {
      const current = new Worker(new URL('syntax-worker.js', document.baseURI));
      worker = current;
      current.onmessage = ({ data }) => {
        if (worker !== current) return;
        if (data.ready) { $('syntax-report').dataset.worker = 'ready'; return; }
        if (data.id !== generation || data.id !== active) return;
        clearTimeout(watchdog); active = 0;
        if (data.failed) { failed('Could not parse this code. Try checking again.'); return; }
        render('a', data.a); render('b', data.b);
      };
      current.onerror = event => {
        event.preventDefault();
        if (worker === current) failed('Open the editor from the installed extension and try again.');
      };
      return true;
    } catch {
      failed('Open the editor from the installed extension and try again.');
      return false;
    }
  }
  function render(side, result) {
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
      button.addEventListener('click', () => {
        if (id !== generation) return;
        beforeReveal();
        const editor = getView(side);
        editor.dispatch({ selection: { anchor: from, head: Math.min(editor.state.doc.length, diagnostic.to) }, effects: EditorView.scrollIntoView(from, { y: 'center' }) });
        editor.focus();
      });
      const item = document.createElement('li'); item.append(button); $(`syntax-list-${side}`).append(item);
    }
  }
  function run(id) {
    if (id !== generation) return;
    // A slow previous parse cannot delay a new request indefinitely.
    if (active) { worker?.terminate(); worker = null; active = 0; }
    if (!worker && !startWorker()) return;
    active = id;
    for (const side of ['a', 'b']) renderStatus(side, 'Checking…', 'Checked locally. Code is not run.', 'pending');
    watchdog = setTimeout(() => {
      if (id === generation && id === active) failed('The check took too long. Try a smaller snippet.');
    }, 3000);
    worker.postMessage({ id, language: getLanguage(), a: getView('a').state.doc.toString(), b: getView('b').state.doc.toString() });
  }
  function schedule(immediate = false) {
    const id = ++generation;
    clearTimeout(timer); clearTimeout(watchdog);
    for (const side of ['a', 'b']) renderStatus(side, 'Waiting to check', 'Results will update after your edit.', 'pending');
    // CodeMirror forbids dispatch during an update listener.
    queueMicrotask(() => { if (id === generation) clearMarks(); });
    timer = setTimeout(() => run(id), immediate ? 0 : 450);
  }
  startWorker();
  $('check-syntax').addEventListener('click', () => schedule(true));
  return { schedule };
}

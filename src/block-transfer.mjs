import { applyEdits, normalize, rawSlice, validate } from './document.mjs';

const KIND = 'copy-block-a-to-b';
const REASON = 'Use the selected version A block in B.';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const documentShape = doc => record(doc) && typeof doc.raw === 'string' &&
  typeof doc.bom === 'boolean' && ['\n', '\r', '\r\n'].includes(doc.eol);
const snapshotShape = doc => documentShape(doc) && integer(doc.revision);
const headerShape = op => record(op) && op.schemaVersion === 1 && op.kind === KIND &&
  typeof op.id === 'string' && op.id.trim().length > 0 && op.origin === 'user' && op.reason === REASON;
const snapshot = (doc, revision) => ({ raw: doc.raw, bom: doc.bom, eol: doc.eol, revision });
const unchanged = (saved, doc, revision) => saved.revision === revision &&
  saved.raw === doc.raw && saved.bom === doc.bom && saved.eol === doc.eol;

// Positions refer to normalized text, but a boundary must not cut a UTF-16 pair.
function boundary(text, offset) {
  return integer(offset) && offset <= text.length && !(offset > 0 && offset < text.length &&
    text.charCodeAt(offset - 1) >= 0xD800 && text.charCodeAt(offset - 1) <= 0xDBFF &&
    text.charCodeAt(offset) >= 0xDC00 && text.charCodeAt(offset) <= 0xDFFF);
}

function validRange(range, text, previous) {
  return record(range) && typeof range.expected === 'string' &&
    boundary(text, range.from) && boundary(text, range.to) && range.from <= range.to &&
    (!previous || (range.from >= previous.to && range.from !== previous.from));
}

function validEdits(op) {
  if (!snapshotShape(op.source) || !snapshotShape(op.target) || !Array.isArray(op.edits)) return false;
  validate(op.source.raw); validate(op.target.raw);
  const sourceText = normalize(op.source.raw), targetText = normalize(op.target.raw);
  let previous;
  for (const edit of op.edits) {
    if (!record(edit) || typeof edit.replacement !== 'string' ||
        !validRange(edit.source, sourceText, previous?.source) ||
        !validRange(edit.target, targetText, previous?.target)) return false;
    const sourceRaw = rawSlice(op.source, edit.source.from, edit.source.to);
    if (edit.source.expected !== sourceRaw || edit.replacement !== sourceRaw ||
        edit.target.expected !== rawSlice(op.target, edit.target.from, edit.target.to)) return false;
    previous = edit;
  }
  return true;
}

function freezeOperation(op) {
  Object.freeze(op.source); Object.freeze(op.target);
  for (const edit of op.edits) {
    Object.freeze(edit.source); Object.freeze(edit.target); Object.freeze(edit);
  }
  Object.freeze(op.edits);
  return Object.freeze(op);
}

/** Capture a proposal. No input object is frozen or mutated. */
export function prepareBlockTransfer({ id, source, target, sourceRevision, targetRevision, chunk }) {
  if (!documentShape(source) || !documentShape(target) || !integer(sourceRevision) ||
      !integer(targetRevision) || !record(chunk) || !integer(chunk.fromA) ||
      !integer(chunk.fromB) || !Array.isArray(chunk.changes)) {
    throw new Error('Cannot prepare this change. Select a current difference and try again.');
  }
  const operation = {
    schemaVersion: 1, kind: KIND, id, origin: 'user', reason: REASON,
    source: snapshot(source, sourceRevision), target: snapshot(target, targetRevision),
    edits: chunk.changes.map(change => {
      // CodeMirror can start a line deletion one unit before its chunk's line
      // boundary. Relative positions may be -1; absolute ranges are validated
      // below against the actual documents.
      if (!record(change) || ![change.fromA, change.toA, change.fromB, change.toB].every(Number.isSafeInteger)) {
        throw new Error('Cannot prepare this change. The difference has invalid positions.');
      }
      const fromA = chunk.fromA + change.fromA, toA = chunk.fromA + change.toA;
      const fromB = chunk.fromB + change.fromB, toB = chunk.fromB + change.toB;
      const replacement = rawSlice(source, fromA, toA);
      return {
        source: { from: fromA, to: toA, expected: replacement },
        target: { from: fromB, to: toB, expected: rawSlice(target, fromB, toB) },
        replacement
      };
    })
  };
  if (!headerShape(operation) || !validEdits(operation)) {
    throw new Error('Cannot prepare this change. Select a current difference and try again.');
  }
  return freezeOperation(operation);
}

/** Pure preflight: the caller records the ID only after committing the result. */
export function checkBlockTransfer(operation, context) {
  const invalid = () => ({ status: 'invalid', message: 'This change is invalid. Select a difference again.' });
  try {
    if (!headerShape(operation) || !record(context)) return invalid();
    const { source, target, sourceRevision, targetRevision, appliedIds = new Set() } = context;
    if (!(appliedIds instanceof Set)) return invalid();
    if (appliedIds.has(operation.id)) {
      return { status: 'already-applied', message: 'This change has already been applied.' };
    }
    if (!validEdits(operation) || !documentShape(source) || !documentShape(target) ||
        !integer(sourceRevision) || !integer(targetRevision)) return invalid();
    if (!unchanged(operation.source, source, sourceRevision) || !unchanged(operation.target, target, targetRevision)) {
      return { status: 'stale', message: 'The files changed. Select the difference again before applying it.' };
    }
    const edits = operation.edits.map(edit => ({
      from: edit.target.from, to: edit.target.to, rawInsert: edit.replacement
    }));
    let document;
    try { document = applyEdits(target, edits); }
    catch {
      return { status: 'limit-exceeded', message: 'This change would exceed the editor limit of 200,000 characters or 4,000 lines.' };
    }
    if (document.raw === target.raw) return { status: 'no-change', message: 'This change already matches B.' };
    return { status: 'ready', document, edits };
  } catch { return invalid(); }
}

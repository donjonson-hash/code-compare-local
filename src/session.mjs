import { MAX_BYTES, MAX_CHARS, MAX_LINES, makeDocument, normalize, encodeFile, safeFilename } from './document.mjs';

export const SESSION_FORMAT = 'compare-code-session';
export const SESSION_VERSION = 1;
// JSON escaping, the exact review pair and block keys can be larger than the
// two source files. Each embedded document still follows the normal file limit.
export const MAX_SESSION_BYTES = 8 * 1024 * 1024;
const MAX_NAME_LENGTH = 255;
const MAX_REVIEW_KEYS = MAX_LINES * 2;
const LANGUAGES = new Set(['text', 'javascript', 'jsx', 'typescript', 'tsx',
  'json', 'python', 'html', 'css', 'java', 'cpp', 'sql', 'markdown', 'yaml']);
const SNAPSHOT_KEYS = ['a', 'b', 'resultFilename', 'language', 'settings', 'review'];
const encoder = new TextEncoder();

function record(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new Error(`Invalid session ${label}.`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) ||
      actual.some(key => !keys.includes(key)))
    throw new Error(`Invalid session ${label} fields.`);
}

function filename(value, label) {
  if (typeof value !== 'string' || value.length > MAX_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error(`Invalid session ${label}: use a filename of up to 255 characters without control characters.`);
  return value;
}

function document(value, side) {
  record(value, ['raw', 'bom', 'eol', 'name'], `document ${side}`);
  if (typeof value.raw !== 'string' || typeof value.bom !== 'boolean' ||
      !['\n', '\r\n', '\r'].includes(value.eol))
    throw new Error(`Invalid session document ${side}: text, BOM and line-ending settings are required.`);
  try { makeDocument(value.raw, value.bom); }
  catch { throw new Error(`Session document ${side} must be text without NUL bytes, up to 200,000 text units and 4,000 lines.`); }
  if (encodeFile(value).byteLength > MAX_BYTES)
    throw new Error(`Session document ${side} exceeds 512 KiB. Reduce its size before saving or loading a session.`);
  // Do not recompute eol: edits can change the most common line ending while
  // the editor deliberately retains the original preferred ending for typing.
  return { raw: value.raw, bom: value.bom, eol: value.eol, name: filename(value.name, `filename ${side}`) };
}

function settings(value) {
  record(value, ['wrap', 'changesOnly', 'showWhitespace', 'fontSize', 'focusMode'], 'view settings');
  for (const key of ['wrap', 'changesOnly', 'showWhitespace', 'focusMode'])
    if (typeof value[key] !== 'boolean') throw new Error('Invalid session view settings: switches must be true or false.');
  if (![14, 16, 18, 20].includes(value.fontSize))
    throw new Error('Invalid session code size. Choose 14, 16, 18 or 20 px.');
  return { wrap: value.wrap, changesOnly: value.changesOnly, showWhitespace: value.showWhitespace,
    fontSize: value.fontSize, focusMode: value.focusMode };
}

function review(value, a, b) {
  record(value, ['a', 'b', 'kept'], 'review');
  for (const side of ['a', 'b']) {
    if (typeof value[side] !== 'string' || value[side].length > MAX_CHARS ||
        normalize(value[side]) !== value[side] || value[side].includes('\0'))
      throw new Error('Invalid session review document pair.');
  }
  if (!Array.isArray(value.kept) || value.kept.length > MAX_REVIEW_KEYS)
    throw new Error('Invalid session review marks.');
  let keyUnits = 0;
  for (const key of value.kept) {
    if (typeof key !== 'string' || !key.length) throw new Error('Invalid session review marks.');
    keyUnits += key.length;
    if (keyUnits > MAX_SESSION_BYTES) throw new Error('The session review data exceeds 8 MiB.');
  }
  const textA = normalize(a.raw), textB = normalize(b.raw);
  // A manually edited session must not attach old Keep B decisions to a new
  // pair. The controller must also intersect these keys with freshly computed
  // current block keys; parsing alone does not calculate or approve a diff.
  const samePair = value.a === textA && value.b === textB;
  return { a: textA, b: textB, kept: samePair ? [...new Set(value.kept)] : [] };
}

function validateSnapshot(value) {
  record(value, SNAPSHOT_KEYS, 'snapshot');
  const a = document(value.a, 'A'), b = document(value.b, 'B');
  if (typeof value.language !== 'string' || !LANGUAGES.has(value.language))
    throw new Error('Unsupported session language.');
  return { a, b, resultFilename: safeFilename(filename(value.resultFilename, 'result filename')),
    language: value.language, settings: settings(value.settings), review: review(value.review, a, b) };
}

function checkSize(text) {
  if (text.length > MAX_SESSION_BYTES || encoder.encode(text).byteLength > MAX_SESSION_BYTES)
    throw new Error('The session file exceeds 8 MiB.');
}

export function serializeSession(snapshot) {
  const validated = validateSnapshot(snapshot);
  const text = JSON.stringify({ format: SESSION_FORMAT, version: SESSION_VERSION, ...validated }, null, 2) + '\n';
  checkSize(text);
  return text;
}

export function parseSession(text) {
  if (typeof text !== 'string') throw new Error('Read the session as a UTF-8 JSON file.');
  checkSize(text);
  let value;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This is not a valid JSON session file.'); }
  record(value, ['format', 'version', ...SNAPSHOT_KEYS], 'file');
  if (value.format !== SESSION_FORMAT) throw new Error('This is not a Compare Code session file.');
  if (value.version !== SESSION_VERSION) throw new Error('Unsupported Compare Code session version.');
  // Copy only the known data fields; never evaluate source code, revive objects,
  // import history, or write anything to browser storage.
  return validateSnapshot({ a: value.a, b: value.b, resultFilename: value.resultFilename,
    language: value.language, settings: value.settings, review: value.review });
}

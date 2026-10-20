import { decodeUtf8Bytes, encodeUtf8Text } from './vendor/deterministic-extensions/utf8.mjs';

// Product policy stays here; the shared codec only handles UTF-8 and its BOM.
// Code offsets use UTF-16, matching CodeMirror and JavaScript string offsets.
export const MAX_BYTES = 512 * 1024;
export const MAX_CHARS = 200_000;
export const MAX_LINES = 4_000;
export const normalize = text => text.replace(/\r\n|\r/g, '\n');

export function validate(text) {
  if (text.includes('\0')) throw new Error('This is a binary file. Open a text file containing code.');
  if (normalize(text).length > MAX_CHARS || text.split(/\r\n|\r|\n/).length > MAX_LINES)
    throw new Error('The beta supports up to 200,000 characters and 4,000 lines per side.');
}

export function makeDocument(raw = '', bom = false) {
  validate(raw);
  const endings = raw.match(/\r\n|\r|\n/g) || [];
  const counts = new Map();
  for (const end of endings) counts.set(end, (counts.get(end) || 0) + 1);
  const eol = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || '\n';
  return { raw, bom, eol };
}

export function decodeFile(bytes) {
  if (bytes.byteLength > MAX_BYTES) throw new Error('The file exceeds 512 KB. Choose a smaller file.');
  let decoded;
  try {
    // Preserve the BufferSource inputs accepted by the previous decoder,
    // including views with nonzero offsets; never decode the whole backing buffer.
    let view;
    if (ArrayBuffer.isView(bytes)) view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    else if (bytes instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && bytes instanceof SharedArrayBuffer)) view = new Uint8Array(bytes);
    else throw new TypeError('Expected UTF-8 bytes');
    decoded = decodeUtf8Bytes(view);
  }
  catch { throw new Error('Use a UTF-8 file. Save it with UTF-8 encoding first.'); }
  return makeDocument(decoded.raw, decoded.bom);
}

export function encodeFile(doc) {
  return encodeUtf8Text(doc.raw, doc.bom);
}

export function rawOffset(raw, position) {
  let i = 0, normalized = 0;
  while (i < raw.length && normalized < position) {
    if (raw[i] === '\r' && raw[i + 1] === '\n') i++;
    i++; normalized++;
  }
  return i;
}

export function rawSlice(doc, from, to) {
  return doc.raw.slice(rawOffset(doc.raw, from), rawOffset(doc.raw, to));
}

// All positions refer to the old document; rawInsert preserves source EOLs.
export function applyEdits(doc, edits) {
  let raw = doc.raw;
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i];
    const insert = edit.rawInsert ?? normalize(edit.insert).replace(/\n/g, doc.eol);
    raw = raw.slice(0, rawOffset(doc.raw, edit.from)) + insert +
      raw.slice(rawOffset(doc.raw, edit.to));
  }
  validate(raw);
  return { ...doc, raw };
}

export function chunkEdits(chunk, source) {
  return chunk.changes.map(c => ({
    from: chunk.fromB + c.fromB,
    to: chunk.fromB + c.toB,
    rawInsert: rawSlice(source, chunk.fromA + c.fromA, chunk.fromA + c.toA)
  }));
}

export function formatLabel(doc) {
  const endings = new Set(doc.raw.match(/\r\n|\r|\n/g) || []);
  const names = { '\r\n': 'CRLF', '\r': 'CR', '\n': 'LF' };
  const eol = endings.size > 1 ? 'mixed line endings' : names[[...endings][0]] || 'no line endings';
  return `UTF-8${doc.bom ? ' BOM' : ''} · ${eol}`;
}

export function safeFilename(name) {
  const value = name.trim().replace(/[\\/\x00-\x1F<>:"|?*]/g, '_').replace(/[. ]+$/g, '');
  return value && value !== '.' && value !== '..' ? value.slice(0, 180) : 'result.txt';
}

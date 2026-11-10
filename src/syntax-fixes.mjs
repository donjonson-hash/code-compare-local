// Small, reviewable punctuation edits. This module never runs source code.
// The caller supplies the same syntax checker used for the original report.
export const MAX_FIX_CANDIDATES = 8;
const MAX_SOURCE_LENGTH = 200_000;
const aliases = { js: 'javascript', ts: 'typescript', py: 'python' };

function jsonTokens(source) {
  const tokens = [];
  for (let i = 0; i < source.length;) {
    if (/[ \t\r\n]/.test(source[i])) { i++; continue; }
    const from = i;
    if ('{}[]:,'.includes(source[i])) {
      tokens.push({ kind: source[i++], from, to: i }); continue;
    }
    if (source[i] === '"') {
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') i++;
        i++;
      }
      if (i >= source.length) return null;
      i++;
      let value;
      try { value = JSON.parse(source.slice(from, i)); } catch { return null; }
      tokens.push({ kind: 'string', from, to: i, value }); continue;
    }
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(i));
    if (!match) return null;
    i += match[0].length;
    tokens.push({ kind: 'value', from, to: i });
  }
  return tokens;
}

const isValue = token => token && ['value', 'string', '{', '['].includes(token.kind);
const endsValue = token => token && ['value', 'string', '}', ']'].includes(token.kind);

function jsonCandidates(source, diagnostics) {
  const tokens = jsonTokens(source);
  if (!tokens) return [];
  const candidates = [];
  const add = (title, from, to, insert, regionFrom, regionTo) => {
    const diagnosticIndex = diagnostics.findIndex(d => d.from >= regionFrom && d.from <= regionTo);
    if (diagnosticIndex >= 0) candidates.push({ title, from, to, insert, diagnosticIndex });
  };
  for (let i = 1; i + 1 < tokens.length; i++) {
    const token = tokens[i], next = tokens[i + 1];
    if (token.kind === ',' && endsValue(tokens[i - 1]) && ['}', ']'].includes(next.kind))
      add('Remove trailing comma', token.from, token.to, '', token.from, next.to);
  }
  // Only repair object-member separators. Adjacent array/scalar values such as
  // [1 2] can reflect an unintended value; do not guess that a comma was meant.
  const stack = [];
  let rootStarted = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let frame = stack.at(-1);
    if (frame) {
      const close = frame.kind === '{' ? '}' : ']';
      if (token.kind === close) {
        stack.pop();
        if (stack.length) stack.at(-1).valueEnd = token.to;
        continue;
      }
      if (frame.state === 'after') {
        if (token.kind === ',') { frame.state = frame.kind === '{' ? 'key' : 'value'; continue; }
        if (frame.kind === '{' && token.kind === 'string' && frame.keys.has(token.value)) return [];
        if (frame.kind !== '{' || token.kind !== 'string' || tokens[i + 1]?.kind !== ':') break;
        add('Insert missing comma between object members', frame.valueEnd, frame.valueEnd, ',', frame.valueEnd, token.to);
        frame.state = 'key';
      }
      if (frame.state === 'key') {
        if (token.kind === 'string' && frame.keys.has(token.value)) return [];
        if (token.kind !== 'string') break;
        frame.keys.add(token.value); frame.key = token; frame.state = 'colon'; continue;
      }
      if (frame.state === 'colon') {
        if (token.kind === ':') { frame.state = 'value'; continue; }
        if (!isValue(token)) break;
        add('Insert missing colon after object key', frame.key.to, frame.key.to, ':', frame.key.to, token.to);
        frame.state = 'value';
      }
      if (frame.state !== 'value' || !isValue(token)) break;
      frame.state = 'after'; frame.valueEnd = token.to;
    } else {
      if (rootStarted || !isValue(token)) break;
      rootStarted = true;
    }
    if (token.kind === '{' || token.kind === '[')
      stack.push({ kind: token.kind, state: token.kind === '{' ? 'key' : 'value', keys: new Set(), valueEnd: token.to });
  }
  return candidates;
}

function pythonCandidates(source, diagnostics) {
  // Do not interpret multiline strings, explicit continuations, or tabs when
  // locating a header/body boundary. The original source remains unchanged.
  if (/'''|"""|\t|\\\r?\n/.test(source)) return [];
  const lines = source.split('\n'), candidates = [];
  let offset = 0;
  for (let index = 0; index + 1 < lines.length; index++) {
    const line = lines[index], lineStart = offset;
    offset += line.length + 1;
    if (!/^ *(?:(?:async +)?(?:def|for|with)|if|elif|while|class|else|try|except|finally)\b/.test(line)) continue;
    let quote = '', comment = line.length, invalid = false;
    const brackets = [];
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (quote) {
        if (char === '\\') { i++; continue; }
        if (char === quote) quote = '';
        continue;
      }
      if (char === '#' ) { comment = i; break; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === ':' || char === ';' || char === '\\') { invalid = true; break; }
      if ('([{'.includes(char)) brackets.push(char);
      if (')]}'.includes(char) && brackets.pop() !== ({ ')': '(', ']': '[', '}': '{' })[char]) { invalid = true; break; }
    }
    if (invalid || quote || brackets.length) continue;
    const code = line.slice(0, comment).trimEnd();
    const indent = line.length - line.trimStart().length;
    let next = index + 1;
    while (next < lines.length && /^ *(?:#.*)?$/.test(lines[next])) next++;
    if (next >= lines.length || lines[next].length - lines[next].trimStart().length <= indent) continue;
    const diagnosticIndex = diagnostics.findIndex(d => d.from >= lineStart && d.from <= offset &&
      /^Python: invalid syntax or an incomplete statement\./.test(d.message));
    if (diagnosticIndex >= 0) candidates.push({ title: 'Insert missing header colon', from: lineStart + code.length,
      to: lineStart + code.length, insert: ':', diagnosticIndex });
  }
  return candidates;
}

function restCommaCandidates(source, diagnostics) {
  const candidates = [];
  diagnostics.forEach((diagnostic, diagnosticIndex) => {
    if (!/^Unexpected trailing comma after rest element\.(?: \(\d+:\d+\))?$/.test(diagnostic.message)) return;
    // Babel points just after the forbidden comma in the pinned parser version.
    for (const from of [diagnostic.from - 1, diagnostic.from]) {
      if (from >= 0 && source[from] === ',') candidates.push({ title: 'Remove trailing comma after rest element',
        from, to: from + 1, insert: '', diagnosticIndex });
    }
  });
  return candidates;
}

/** Returns a new parser report. A fix is offered only when exactly one bounded
 * candidate passes the complete syntax check with no diagnostics. Python is
 * still preliminary: a clean candidate does not certify runtime behavior. */
export function attachSyntaxFixes(source, language, result, validateSyntax) {
  const output = { ...result, diagnostics: (Array.isArray(result?.diagnostics) ? result.diagnostics : []).map(diagnostic => {
    const copy = { ...diagnostic }; delete copy.fix; return copy;
  }) };
  if (typeof source !== 'string' || source.length > MAX_SOURCE_LENGTH || typeof validateSyntax !== 'function' ||
      output.status !== 'checked' || output.truncated || !output.diagnostics.length || output.diagnostics.length > MAX_FIX_CANDIDATES ||
      output.diagnostics.some(d => d.severity !== 'error' || !Number.isInteger(d.from) || !Number.isInteger(d.to) ||
        d.from < 0 || d.to < d.from || d.to > source.length || typeof d.message !== 'string')) return output;
  const lang = aliases[language] || language;
  const candidates = lang === 'json' ? jsonCandidates(source, output.diagnostics)
    : lang === 'python' ? pythonCandidates(source, output.diagnostics)
    : ['javascript', 'typescript', 'jsx', 'tsx'].includes(lang) ? restCommaCandidates(source, output.diagnostics) : [];
  const unique = [...new Map(candidates.map(candidate => [JSON.stringify([candidate.from, candidate.to, candidate.insert]), candidate])).values()];
  if (!unique.length || unique.length > MAX_FIX_CANDIDATES) return output;
  const accepted = [];
  for (const candidate of unique) {
    const updated = source.slice(0, candidate.from) + candidate.insert + source.slice(candidate.to);
    if (updated.length > MAX_SOURCE_LENGTH) continue;
    let checked;
    try { checked = validateSyntax(updated, language); } catch { return output; }
    if (checked?.status === 'checked' && !checked.truncated && Array.isArray(checked.diagnostics) && checked.diagnostics.length === 0)
      accepted.push(candidate);
  }
  if (accepted.length !== 1) return output;
  const { diagnosticIndex, ...fix } = accepted[0];
  output.diagnostics[diagnosticIndex].fix = fix;
  return output;
}

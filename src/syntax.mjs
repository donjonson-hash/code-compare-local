import { parse as parseJavaScript } from '@babel/parser';
import { parser as pythonParser } from '@lezer/python';
import { parser as jsonParser } from '@lezer/json';
import { parseAllDocuments } from 'yaml';

const LIMIT = 50;
const ALIASES = { js: 'javascript', ts: 'typescript', py: 'python', yml: 'yaml' };
const SCOPES = {
  javascript: 'JavaScript syntax · code is not run',
  jsx: 'JavaScript / JSX syntax · code is not run',
  typescript: 'TypeScript syntax · no type checking',
  tsx: 'TypeScript / JSX syntax · no type checking',
  json: 'JSON syntax',
  yaml: 'YAML syntax · no schema validation',
  python: 'Grammar and indentation · does not replace validation with Python',
};

/** Parse source only: never execute it or resolve its imports. Offsets are UTF-16. */
export function checkSyntax(source, language) {
  const lang = ALIASES[language] || language;
  const result = {
    status: 'checked', scope: SCOPES[lang] || 'Syntax checking is not available for this language yet',
    limited: lang === 'python', diagnostics: [], truncated: false,
  };
  if (!SCOPES[lang]) return { ...result, status: 'unsupported' };
  if (!source.trim()) return { ...result, status: 'empty' };
  const seen = new Set();
  const add = (from, to, message, severity = 'error') => {
    from = Math.max(0, Math.min(source.length, Number.isFinite(from) ? from : 0));
    to = Math.max(from, Math.min(source.length, Number.isFinite(to) ? to : from + 1));
    const key = `${from}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (result.diagnostics.length >= LIMIT) { result.truncated = true; return; }
    result.diagnostics.push({ from, to, severity, message });
  };
  if (lang === 'python') checkPython(source, add);
  else if (lang === 'json') {
    try { JSON.parse(source); }
    catch (error) {
      const pos = jsonErrorPosition(source, error.message);
      add(pos, pos + 1, `JSON: ${error.message}`);
    }
  } else if (lang === 'yaml') {
    // Do not convert to JS objects: alias expansion and application-specific tags
    // are not needed for syntax validation.
    const documents = parseAllDocuments(source, { prettyErrors: false, strict: true });
    for (const doc of documents) {
      for (const error of doc.errors) add(error.pos?.[0], error.pos?.[1], `YAML: ${error.message}`);
      for (const warning of doc.warnings) add(warning.pos?.[0], warning.pos?.[1], `YAML: ${warning.message}`, 'warning');
    }
  } else {
    const plugins = [];
    if (lang === 'jsx' || lang === 'tsx') plugins.push('jsx');
    if (lang === 'typescript' || lang === 'tsx') plugins.push('typescript');
    try {
      const ast = parseJavaScript(source, {
        sourceType: 'unambiguous', plugins, errorRecovery: true,
        attachComment: false, ranges: false, tokens: false,
      });
      for (const error of ast.errors) add(error.pos, error.pos + 1, error.message);
    } catch (error) {
      // Babel throws for unrecoverable syntax, even with errorRecovery enabled.
      if (!Number.isFinite(error.pos)) throw error;
      add(error.pos, error.pos + 1, error.message);
    }
  }
  result.diagnostics.sort((a, b) => a.from - b.from || a.to - b.to);
  return result;
}

function jsonErrorPosition(source, message) {
  const position = /\bposition (\d+)/i.exec(message);
  if (position) return Number(position[1]);
  const location = /\bline (\d+) column (\d+)/i.exec(message);
  if (location) {
    let from = 0;
    for (let line = 1; line < Number(location[1]); line++) {
      const end = source.indexOf('\n', from);
      if (end < 0) return source.length;
      from = end + 1;
    }
    return from + Number(location[2]) - 1;
  }
  let treePosition = null;
  jsonParser.parse(source).iterate({ enter(node) {
    if (node.type.isError && treePosition === null) treePosition = node.from;
  } });
  if (treePosition !== null) return treePosition;
  return /end/i.test(message) ? source.length : 0;
}

function checkPython(source, add) {
  const tree = pythonParser.parse(source);
  const ignored = [];
  const suiteColons = new Set();
  const grammarErrors = [];
  const limitedHeaders = [];
  tree.iterate({ enter(node) {
    if (node.type.isError) grammarErrors.push({ from: node.from, to: node.to });
    // Lezer currently lacks Python's parenthesized context-manager lists.
    // Recognize this limitation from the parsed statement, without rewriting
    // source or claiming that the header itself has passed validation.
    if (node.name === 'WithStatement') {
      const keyword = node.node.getChild('with');
      const expression = keyword?.nextSibling;
      const body = node.node.getChild('Body');
      if (expression && source[expression.from] === '(' && body) {
        limitedHeaders.push({ from: expression.from, to: body.from });
      }
    }
    if (node.name === 'Body' || node.name === 'MatchBody') {
      const first = node.node.firstChild;
      if (first?.name === ':') suiteColons.add(first.from);
    }
    if (node.name === 'String' || node.name === 'FormatString') {
      ignored.push({ from: node.from, to: node.to, string: true });
      checkStringClosure(source, node.from, node.to, add);
      // Keep walking: grammar errors inside f-string expressions still matter.
    } else if (node.name === 'Comment') ignored.push({ from: node.from, to: node.to, string: false });
  } });
  const reportedHeaders = new Set();
  for (const error of grammarErrors) {
    const header = limitedHeaders.find(h => error.from >= h.from && error.to <= h.to);
    if (header) {
      if (!reportedHeaders.has(header)) {
        reportedHeaders.add(header);
        add(header.from, header.to, 'Python: this parser does not fully support with (…) headers. Validate this header with Python.', 'warning');
      }
    } else add(error.from, error.to, 'Python: invalid syntax or an incomplete statement.');
  }
  // Discard nested strings/comments within an outer f-string. The outer literal
  // contributes one token to the containing logical line.
  ignored.sort((a, b) => a.from - b.from || b.to - a.to);
  const spans = [];
  for (const span of ignored) if (!spans.length || span.from >= spans.at(-1).to) spans.push(span);

  // Python indentation belongs to logical lines, not physical lines. The parser
  // supplies literal/comment spans and actual suite colons; bracket nesting and
  // explicit line joining suppress NEWLINE exactly where indentation is irrelevant.
  const stack = [{ column: 0, alternate: 0 }];
  let expectedSuite = false;
  let logicalStart = -1, logicalIndent = null, lastToken = -1;
  let depth = 0, spanIndex = 0, physicalStart = 0;
  const finishLine = () => {
    if (logicalStart < 0) return;
    const { column, alternate, from, to } = logicalIndent;
    let top = stack.at(-1);
    if (column > top.column) {
      if (!expectedSuite) add(from, to || from + 1, 'Python: unexpected indentation.');
      if (alternate <= top.alternate) add(from, to, 'Python: ambiguous mix of tabs and spaces in indentation.');
      stack.push({ column, alternate });
    } else {
      if (expectedSuite) add(logicalStart, logicalStart + 1, 'Python: an indented block is required after the colon.');
      while (stack.length > 1 && column < stack.at(-1).column) stack.pop();
      top = stack.at(-1);
      if (column !== top.column) add(from, to || from + 1, 'Python: indentation does not match any outer level.');
      else if (alternate !== top.alternate) add(from, to || from + 1, 'Python: ambiguous mix of tabs and spaces in indentation.');
    }
    expectedSuite = suiteColons.has(lastToken);
    logicalStart = -1; logicalIndent = null; lastToken = -1;
  };
  const beginToken = pos => {
    if (logicalStart >= 0) return;
    logicalStart = pos;
    let column = 0, alternate = 0, end = physicalStart;
    while (end < pos) {
      const char = source[end];
      if (char === ' ') { column++; alternate++; }
      else if (char === '\t') { column += 8 - column % 8; alternate++; }
      else if (char === '\f') { column = 0; alternate = 0; }
      else break;
      end++;
    }
    logicalIndent = { column, alternate, from: physicalStart, to: Math.max(end, physicalStart + 1) };
  };
  for (let i = 0; i < source.length;) {
    const span = spans[spanIndex];
    if (span && i === span.from) {
      if (span.string) { beginToken(i); lastToken = i; }
      for (let j = i; j < span.to; j++) {
        if (source[j] === '\n' || source[j] === '\r') physicalStart = j + 1;
      }
      i = span.to; spanIndex++; continue;
    }
    const char = source[i];
    if (char === '\\' && (source[i + 1] === '\n' || source[i + 1] === '\r')) {
      i += source[i + 1] === '\r' && source[i + 2] === '\n' ? 3 : 2;
      physicalStart = i; continue;
    }
    if (char === '\r' || char === '\n') {
      if (!depth) finishLine();
      i += char === '\r' && source[i + 1] === '\n' ? 2 : 1;
      physicalStart = i; continue;
    }
    if (char === ' ' || char === '\t' || char === '\f') { i++; continue; }
    beginToken(i);
    if ('([{'.includes(char)) depth++;
    else if (')]}'.includes(char)) depth = Math.max(0, depth - 1);
    lastToken = i;
    i++;
  }
  finishLine();
  if (expectedSuite) add(source.length, source.length, 'Python: an indented block is required after the colon.');
}

function checkStringClosure(source, from, to, add) {
  let quoteStart = from;
  while (quoteStart < to && /[rRuUbBfF]/.test(source[quoteStart])) quoteStart++;
  const quote = source[quoteStart];
  if (quote !== '"' && quote !== "'") return;
  const triple = source.slice(quoteStart, quoteStart + 3) === quote.repeat(3);
  const width = triple ? 3 : 1;
  let end = to;
  // An unterminated one-line string is accepted by Lezer's recovery tokenizer.
  // Validate its actual closing delimiter rather than trusting tree error nodes.
  const delimiter = quote.repeat(width);
  let escaped = 0;
  for (let i = end - width - 1; i >= quoteStart + width && source[i] === '\\'; i--) escaped++;
  if (end - quoteStart < width * 2 || source.slice(end - width, end) !== delimiter || escaped % 2) {
    add(quoteStart, Math.min(to, quoteStart + width), 'Python: unterminated string literal.');
  }
}

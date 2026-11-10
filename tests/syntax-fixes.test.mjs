import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSyntax } from '../src/syntax.mjs';
import { attachSyntaxFixes, MAX_FIX_CANDIDATES } from '../src/syntax-fixes.mjs';

const report = (source, language) => attachSyntaxFixes(source, language, checkSyntax(source, language), checkSyntax);
const fixes = result => result.diagnostics.filter(diagnostic => diagnostic.fix).map(diagnostic => diagnostic.fix);
const apply = (source, fix) => source.slice(0, fix.from) + fix.insert + source.slice(fix.to);
const assertFix = (source, expected, language, title) => {
  const result = report(source, language);
  const candidates = fixes(result);
  assert.equal(candidates.length, 1, 'One fix for ' + JSON.stringify(source));
  assert.match(candidates[0].title, title);
  assert.equal(apply(source, candidates[0]), expected);
  assert.deepEqual(checkSyntax(expected, language).diagnostics, []);
  assert.ok(candidates[0].to - candidates[0].from <= 1 && candidates[0].insert.length <= 1,
    'Only one punctuation character is inserted or removed');
  return result;
};

test('JSON removes only the trailing comma outside escaped strings and Unicode values', () => {
  assertFix('{"value": 1,}', '{"value": 1}', 'json', /trailing comma/);
  const escaped = JSON.stringify('comma,] and quote "');
  assertFix('[1, ' + escaped + ',]', '[1, ' + escaped + ']', 'json', /trailing comma/);
  const source = '{\n  "café": "😀",\n  "value": 2,\n}\n';
  assertFix(source, source.replace('2,', '2'), 'json', /trailing comma/);
  assertFix('{"items": [1, 2,]}', '{"items": [1, 2]}', 'json', /trailing comma/);
});

test('JSON missing object-member comma and key colon preserve existing values', () => {
  assertFix('{"a":1 "b":2}', '{"a":1, "b":2}', 'json', /missing comma/);
  assertFix('{"a": {"nested": 1} "b":2}', '{"a": {"nested": 1}, "b":2}', 'json', /missing comma/);
  assertFix('{"a": [1, 2] "b":2}', '{"a": [1, 2], "b":2}', 'json', /missing comma/);
  assertFix('{"value" 2}', '{"value": 2}', 'json', /missing colon/);
  assertFix('{"value" {"nested": true}}', '{"value": {"nested": true}}', 'json', /missing colon/);
  assertFix('{"value" "literal"}', '{"value": "literal"}', 'json', /missing colon/);
});

test('JSON does not invent values, split adjacent array values, repair duplicates or alter string contents', () => {
  for (const source of ['{"missing": }', '[1 2]', '["a" "b"]', '{"a":1 "a":2}', '{"a"1,"a":2}',
    '{"a":1,"a":2,}', '{"a":"unterminated}', '{"a":"inside,}"', '{"a":1, "b":}', '{,}', '[,]'])
    assert.equal(fixes(report(source, 'json')).length, 0, source);
  assert.equal(fixes(report('{"literal": ",}"}', 'json')).length, 0, 'Already-valid strings are not changed');
});

test('a partial JSON repair is never offered when another syntax issue remains', () => {
  for (const source of ['{"a":[1,], "b":[2,]}', '{"a"1 "b":2}', '{"a":[1,], "b":}'])
    assert.equal(fixes(report(source, 'json')).length, 0, source);
});

test('JavaScript family removes parser-confirmed trailing rest comma only', () => {
  for (const language of ['javascript', 'jsx', 'typescript', 'tsx']) {
    assertFix('function collect(...items,) { return items; }', 'function collect(...items) { return items; }', language, /rest element/);
    assert.equal(fixes(report('const value = ;', language)).length, 0);
    assert.equal(fixes(report('function f() {', language)).length, 0, 'No guessed closing delimiter');
  }
  assertFix('const [first, ...rest,] = items;', 'const [first, ...rest] = items;', 'javascript', /rest element/);
  assert.equal(fixes(report('const items = [1, 2,];', 'javascript')).length, 0, 'Valid trailing commas remain valid');
});

test('Python missing header colon keeps body indentation and its preliminary status', () => {
  const examples = [
    ['if ready\n    pass\n', 'if ready:\n    pass\n'],
    ['if ready # condition\n    print("ready")\n', 'if ready: # condition\n    print("ready")\n'],
    ['def greet(name)\n    return name\n', 'def greet(name):\n    return name\n'],
    ['for item in items\n    print(item)\n', 'for item in items:\n    print(item)\n'],
    ['if value == "#label"\n    pass\n', 'if value == "#label":\n    pass\n'],
  ];
  for (const [source, expected] of examples) {
    const result = assertFix(source, expected, 'python', /header colon/);
    assert.equal(result.limited, true);
  }
});

test('Python does not guess indentation, unfinished expressions or multiline syntax', () => {
  for (const source of ['if ready\npass\n', 'if ready:\npass\n', 'if\n    pass\n', 'if (ready\n    pass\n',
    'if ready\n\tpass\n', 'if ready\n    pass\ntext = """multiline\ntext"""\n',
    'if ready\n    value =\n', 'if ready\n    pass\nif other\n    pass\n'])
    assert.equal(fixes(report(source, 'python')).length, 0, JSON.stringify(source));
});

test('failed, truncated, unsupported, clean and warning reports offer no fixes or validations', () => {
  const source = '{"value":1,}', original = checkSyntax(source, 'json');
  let calls = 0;
  const validate = () => { calls++; return { status: 'checked', diagnostics: [] }; };
  for (const modified of [{ ...original, truncated: true }, { ...original, status: 'unsupported' },
    { ...original, status: 'failed' }, { ...original, status: 'empty' }, { ...original, diagnostics: [] },
    { ...original, diagnostics: original.diagnostics.map(d => ({ ...d, severity: 'warning' })) }])
    assert.equal(fixes(attachSyntaxFixes(source, 'json', modified, validate)).length, 0);
  assert.equal(calls, 0);
});

test('candidate parse failures and incomplete validation fail closed', () => {
  const source = '{"a":1,}', result = checkSyntax(source, 'json');
  for (const validate of [() => { throw new Error('parser failed'); }, () => ({ status: 'empty', diagnostics: [] }),
    () => ({ status: 'checked', diagnostics: [], truncated: true }), () => ({ status: 'checked' })])
    assert.equal(fixes(attachSyntaxFixes(source, 'json', result, validate)).length, 0);
});

test('ambiguous valid candidates are rejected and candidate work is bounded', () => {
  const source = 'if first\n    pass\nif second\n    pass\n';
  const result = checkSyntax(source, 'python');
  let calls = 0;
  const permissive = () => { calls++; return { status: 'checked', diagnostics: [] }; };
  assert.equal(fixes(attachSyntaxFixes(source, 'python', result, permissive)).length, 0);
  assert.equal(calls, 2, 'Even a permissive validator cannot turn two candidates into a guessed choice');
  const oversizedReport = { ...result, diagnostics: Array.from({ length: MAX_FIX_CANDIDATES + 1 }, () => result.diagnostics[0]) };
  calls = 0;
  assert.equal(fixes(attachSyntaxFixes(source, 'python', oversizedReport, permissive)).length, 0);
  assert.equal(calls, 0);
});

test('reports are immutable, aliases work and parsed source is never executed', () => {
  const source = 'function f(...args,) { globalThis.__quickFixExecuted = true; }';
  const original = checkSyntax(source, 'js'), snapshot = structuredClone(original);
  globalThis.__quickFixExecuted = false;
  const result = attachSyntaxFixes(source, 'js', original, checkSyntax);
  assert.equal(fixes(result).length, 1);
  assert.deepEqual(original, snapshot);
  assert.equal(globalThis.__quickFixExecuted, false);
  delete globalThis.__quickFixExecuted;
  assert.equal(fixes(report('if ready\n    pass\n', 'py')).length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSyntax } from '../src/syntax.mjs';

const errors = (text, language) => checkSyntax(text, language).diagnostics.filter(d => d.severity === 'error');

test('JavaScript parser catches broken edits but ignores indentation and never executes source', () => {
  assert.ok(errors('function f() { return 1;', 'javascript').length);
  assert.ok(errors('const x = ;', 'javascript').length);
  assert.equal(errors('const x = 1;\n    console.log(x);', 'javascript').length, 0);
  globalThis.__syntaxExecuted = false;
  assert.equal(errors('globalThis.__syntaxExecuted = true; throw new Error("executed");', 'js').length, 0);
  assert.equal(globalThis.__syntaxExecuted, false);
  delete globalThis.__syntaxExecuted;
});

test('JSX and TypeScript use their own grammar, not type evaluation', () => {
  assert.equal(errors('export const C = () => <div>Hello</div>;', 'jsx').length, 0);
  assert.ok(errors('const C = () => <div></span>;', 'jsx').length);
  assert.ok(errors('const C = () => <div/>;', 'javascript').length);
  assert.equal(errors('interface Item { name: string }; const n: number = "not checked";', 'ts').length, 0);
  assert.equal(errors('const C = (p: {x: string}) => <b>{p.x}</b>;', 'tsx').length, 0);
  assert.ok(errors('interface Item { name: };', 'typescript').length);
});

test('JSON rejects trailing comma and comments with UTF-16 positions', () => {
  const source = '{"emoji":"😀","n":}';
  const diagnostics = errors(source, 'json');
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].from, source.indexOf('}'));
  assert.ok(errors('{"a":1,}', 'json').length);
  assert.ok(errors('{/* nope */"a":1}', 'json').length);
  assert.equal(errors('{"a":[1,true,null],"s":"😀"}', 'json').length, 0);
});

test('YAML checks indentation and duplicate keys without expanding aliases', () => {
  assert.ok(errors('a:\n  b: 1\n c: 2\n', 'yaml').length);
  assert.ok(errors('a: 1\na: 2\n', 'yaml').length);
  assert.equal(errors('a: &a [1, 2]\nb: *a\ntext: |\n  [not syntax]\n', 'yaml').length, 0);
  assert.equal(errors('---\na: 1\n---\na: 2\n', 'yaml').length, 0);
});

test('Python catches indentation lost or accidentally inserted during copy and transfer', () => {
  for (const source of [
    'if True:\nprint(1)\n',
    'x = 1\n  y = 2\n',
    '  x = 1\n',
    'if True:\n    a = 1\n  b = 2\n',
    'if True: pass\n  x = 1\n',
    'def f():\n\tpass\n        pass\n',
    'if True:\n    pass\n        pass\n',
  ]) assert.ok(errors(source, 'python').length, JSON.stringify(source));
});

test('Python valid logical lines, strings, comments, decorators, match and tabs avoid false positives', () => {
  const examples = [
    'if True:\n    a = 1\n    if a:\n        b = 2\n    c = 3\nx = 4\n',
    'if True:\n\tpass\n\tpass\n',
    'if (\n    True\n):\n    pass\n',
    'x = (\n1 +\n    2\n)\n',
    'x = 1 + \\\n    2\ny = 3\n',
    'if True:\n  # odd comment indent is harmless\n    pass\n\n# comment\n',
    's = """a\n  inconsistent\n indentation: (\n"""\nx = 1\n',
    's = f"""{1 + 2}\n  words\n"""\nx = 1\n',
    '@decorator(\n  1,\n  2\n)\ndef f():\n    return 1\n',
    'match x:\n    case {"a": value}:\n        print(value)\n    case _:\n        pass\n',
    'if True:\r\n    x = 1\r\n    y = 2\r\n',
    'if True: pass\nx = 1\n',
    's = "escaped\\\"quote"\nr = r"a\\\\"\nb = b"x"\n',
  ];
  for (const source of examples) assert.deepEqual(errors(source, 'python'), [], JSON.stringify(source));
});

test('Python catches unclosed literals and brackets while keeping its limited scope explicit', () => {
  for (const source of ['x = "unclosed\ny = 2\n', "x = '''unclosed", 'x = [1, 2\n']) {
    assert.ok(errors(source, 'python').length, JSON.stringify(source));
  }
  const result = checkSyntax('x = 1\n', 'python');
  assert.equal(result.limited, true);
  assert.match(result.scope, /does not replace/);
});

test('Python parenthesized with reports parser limitation, while body indentation is still checked', () => {
  const header = 'with (\n    a() as x,\n    b() as y,\n):\n';
  const valid = checkSyntax(header + '    pass\n', 'python');
  assert.equal(valid.diagnostics.filter(d => d.severity === 'error').length, 0);
  assert.ok(valid.diagnostics.some(d => d.severity === 'warning' && /with/.test(d.message)));
  const broken = checkSyntax(header + 'pass\n', 'python');
  assert.ok(broken.diagnostics.some(d => d.severity === 'error' && /indent/.test(d.message)));
  // Unsupported headers are explicitly unverified, never silently marked clean.
  assert.ok(checkSyntax('with (\n    a() as x,\n    b() as y,\n:\n    pass\n', 'python').diagnostics.length);
});

test('Diagnostics stay bounded and sources unchanged; unsupported is never reported as clean', () => {
  const source = Array.from({ length: 100 }, (_, i) => `k${i}: 1\nk${i}: 2`).join('\n');
  const before = source;
  const result = checkSyntax(source, 'yaml');
  assert.equal(result.diagnostics.length, 50);
  assert.equal(result.truncated, true);
  assert.equal(source, before);
  for (const d of result.diagnostics) assert.ok(d.from >= 0 && d.from <= d.to && d.to <= source.length);
  assert.equal(checkSyntax('int main( {', 'cpp').status, 'unsupported');
  assert.equal(checkSyntax('', 'javascript').status, 'empty');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSyntax, diagnosticMessageKey } from '../src/syntax-compare.mjs';

const checked = (diagnostics = [], extra = {}) => ({ status: 'checked', diagnostics, truncated: false, limited: false, ...extra });
const issue = (source, fragment, message = 'Unexpected token', severity = 'error', occurrence = 0) => {
  let from = -1;
  for (let i = 0; i <= occurrence; i++) from = source.indexOf(fragment, from + 1);
  assert.ok(from >= 0, `Fixture fragment ${fragment} exists`);
  return { from, to: from + fragment.length, message, severity };
};
const compare = (sourceA, sourceB, diagnosticsA = [], diagnosticsB = []) => compareSyntax({
  sourceA, sourceB, resultA: checked(diagnosticsA), resultB: checked(diagnosticsB),
});

test('the same unique error survives inserted lines and Babel coordinate changes', () => {
  const a = 'const value = ;\n';
  const b = '// comment\nconst good = 1;\n' + a;
  const result = compare(a, b, [issue(a, ';', 'Unexpected token (1:14)')], [issue(b, ';\n', 'Unexpected token (3:14)', 'error', 1)]);
  // Diagnostic spans must also agree: use the actual one-character parser span.
  const exact = compare(a, b, [issue(a, ';', 'Unexpected token (1:14)')],
    [{ from: b.lastIndexOf(';'), to: b.lastIndexOf(';') + 1, message: 'Unexpected token (3:14)', severity: 'error' }]);
  assert.equal(exact.persistent.length, 1);
  assert.equal(exact.persistent[0].a.line, 1);
  assert.equal(exact.persistent[0].b.line, 3);
  assert.equal(exact.persistent[0].a.column, exact.persistent[0].b.column);
  assert.equal(exact.introduced.length + exact.resolved.length + exact.uncertain.length, 0);
  assert.equal(result.uncertain.length, 2, 'Different reported spans are not silently paired');
});

test('JSON position suffixes are ignored, while meaningful message numbers are preserved', () => {
  const a = '{"x": }', b = '\n\n' + a;
  const result = compare(a, b,
    [issue(a, '}', 'JSON: Unexpected token at position 6 (line 1 column 7)')],
    [issue(b, '}', 'JSON: Unexpected token at position 8 (line 3 column 7)')]);
  assert.equal(result.persistent.length, 1);
  assert.equal(diagnosticMessageKey('Invalid value 123 (2:5)'), 'Invalid value 123');
  assert.notEqual(diagnosticMessageKey('Invalid value 123 (2:5)'), diagnosticMessageKey('Invalid value 456 (9:5)'));
});

test('repeated identical source lines stay uncertain after an edit', () => {
  const a = 'bad();\nbad();\n', b = '// inserted\n' + a;
  const diagnosticsA = [issue(a, 'bad', 'Repeated issue', 'error', 0), issue(a, 'bad', 'Repeated issue', 'error', 1)];
  const diagnosticsB = [issue(b, 'bad', 'Repeated issue', 'error', 0), issue(b, 'bad', 'Repeated issue', 'error', 1)];
  const result = compare(a, b, diagnosticsA, diagnosticsB);
  assert.equal(result.persistent.length, 0);
  assert.equal(result.uncertain.length, 4);
  assert.equal(result.introduced.length + result.resolved.length, 0);
  const unchanged = compare(a, a, diagnosticsA, diagnosticsA);
  assert.equal(unchanged.persistent.length, 2, 'Identical full sources disambiguate repeated positions');
  assert.equal(unchanged.uncertain.length, 0);
});

test('a single reported error on a repeated line is not assigned an invented identity', () => {
  const a = 'bad();\nbad();\n', b = 'bad();\n';
  const result = compare(a, b, [issue(a, 'bad')], [issue(b, 'bad')]);
  assert.equal(result.uncertain.length, 2);
  assert.equal(result.persistent.length, 0);
});

test('changed source or a different unmatched parser error on both sides is uncertain', () => {
  for (const message of ['Unexpected token', 'Missing closing bracket']) {
    const a = 'const before = ;', b = 'const after = ;';
    const result = compare(a, b, [issue(a, ';')], [issue(b, ';', message)]);
    assert.equal(result.uncertain.length, 2);
    assert.equal(result.introduced.length + result.resolved.length, 0);
  }
});

test('complete clean reports permit newly reported and no-longer-reported diagnostics', () => {
  const good = 'const value = 1;', bad = 'const value = ;';
  const diagnostic = issue(bad, ';');
  const introduced = compare(good, bad, [], [diagnostic]);
  assert.equal(introduced.introduced.length, 1);
  assert.equal(introduced.introduced[0].a, null);
  assert.equal(introduced.introduced[0].b.from, diagnostic.from);
  const resolved = compare(bad, good, [diagnostic], []);
  assert.equal(resolved.resolved.length, 1);
  assert.match(resolved.resolved[0].reason, /does not prove/);
  assert.equal(compare(good, good).status, 'compared');
});

test('a confidently paired error does not hide a newly reported different kind', () => {
  const a = 'first();\n', b = a + 'second();\n';
  const result = compare(a, b, [issue(a, 'first', 'First issue')],
    [issue(b, 'first', 'First issue'), issue(b, 'second', 'Second issue')]);
  assert.equal(result.persistent.length, 1);
  assert.equal(result.introduced.length, 1);
  assert.equal(result.uncertain.length, 0);
  const ambiguous = compare(a, b, [issue(a, 'first', 'First issue')],
    [issue(b, 'first', 'First issue'), issue(b, 'second', 'First issue')]);
  assert.equal(ambiguous.introduced.length, 0);
  assert.equal(ambiguous.uncertain.length, 1, 'A duplicate kind without a unique counterpart is conservative');
});

test('empty, unsupported, pending and failed checks never become a claimed fix', () => {
  const sourceA = 'bad();', sourceB = 'good();';
  for (const status of ['empty', 'unsupported', 'pending', 'failed']) {
    for (const side of ['a', 'b']) {
      const resultA = checked([issue(sourceA, 'bad')]);
      const resultB = checked();
      (side === 'a' ? resultA : resultB).status = status;
      const result = compareSyntax({ sourceA, sourceB, resultA, resultB });
      assert.notEqual(result.status, 'compared');
      assert.equal(result.introduced.length + result.resolved.length, 0);
      assert.equal(result.uncertain.length, 1);
    }
  }
});

test('truncation on either side suppresses disappearance and clean conclusions', () => {
  for (const truncatedA of [true, false]) {
    const result = compareSyntax({ sourceA: 'bad();', sourceB: 'good();',
      resultA: checked([issue('bad();', 'bad')], { truncated: truncatedA }),
      resultB: checked([], { truncated: !truncatedA }),
    });
    assert.equal(result.status, 'incomplete');
    assert.equal(result.resolved.length + result.introduced.length, 0);
    assert.match(result.reason, /truncated/);
  }
});

test('invalid or missing diagnostics fail closed instead of yielding clean results', () => {
  const inputs = [undefined, { status: 'checked' }, checked([null]), checked([{ from: -1, to: 1, message: 'bad', severity: 'error' }]),
    checked([{ from: 0, to: 99, message: 'bad', severity: 'error' }]), { status: 'checked', diagnostics: {} }];
  for (const resultA of inputs) {
    const result = compareSyntax({ sourceA: 'bad', sourceB: 'good', resultA, resultB: checked() });
    assert.equal(result.status, 'incomplete');
    assert.equal(result.introduced.length + result.resolved.length, 0);
  }
});

test('limited Python scope and warning severity are preserved', () => {
  const sourceA = 'pass', sourceB = 'with unsupported: pass';
  const result = compareSyntax({ sourceA, sourceB, resultA: checked([], { limited: true }),
    resultB: checked([issue(sourceB, 'unsupported', 'Parser limitation', 'warning')], { limited: true }) });
  assert.equal(result.limited, true);
  assert.equal(result.introduced[0].b.severity, 'warning');
});

test('identical code with inconsistent reports is incomplete rather than a fix', () => {
  const result = compare('bad', 'bad', [issue('bad', 'bad')], []);
  assert.equal(result.status, 'incomplete');
  assert.equal(result.resolved.length, 0);
  assert.equal(result.uncertain.length, 1);
});

test('matching is deterministic, order-independent, and does not mutate input reports', () => {
  const sourceA = 'first();\nsecond();', sourceB = '// prefix\n' + sourceA;
  const resultA = checked([issue(sourceA, 'second', 'Second'), issue(sourceA, 'first', 'First')]);
  const resultB = checked([issue(sourceB, 'first', 'First'), issue(sourceB, 'second', 'Second')]);
  const input = { sourceA, sourceB, resultA, resultB };
  const snapshot = structuredClone(input);
  const result = compareSyntax(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(compareSyntax(input), result);
  assert.deepEqual(compareSyntax({ ...input, resultA: checked([...resultA.diagnostics].reverse()), resultB: checked([...resultB.diagnostics].reverse()) }), result);
  assert.equal(result.persistent.length, 2);
});

test('UTF-16 offsets and end-of-file diagnostics retain precise navigation locations', () => {
  const a = '😀 missing', b = '// prefix\n' + a;
  const diagnostic = source => ({ from: source.length, to: source.length, message: 'Unexpected end', severity: 'error' });
  const result = compare(a, b, [diagnostic(a)], [diagnostic(b)]);
  assert.equal(result.persistent.length, 1);
  assert.equal(result.persistent[0].a.column, a.length + 1);
  assert.equal(result.persistent[0].b.from, b.length);
});

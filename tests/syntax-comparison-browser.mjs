import assert from 'node:assert/strict';

export async function checkSyntaxComparison({ page, open, output }) {
  let sequence = 0;
  const expectedCounts = async (introduced, resolved, persistent, uncertain, state = 'compared') => {
    await page.waitForFunction(({ counts, state }) => {
      const root = document.getElementById('syntax-comparison');
      return root.dataset.state === state && Object.entries(counts).every(([category, count]) =>
        root.querySelectorAll(`li[data-category="${category}"]`).length === count);
    }, { counts: { introduced, resolved, persistent, uncertain }, state });
  };
  const pair = async (a, b, extension = 'js') => {
    const id = ++sequence;
    // Distinct names provide a load-completion handshake even when successive
    // fixtures contain the same number of characters as the preceding files.
    for (const [side, text] of [['a', a], ['b', b]]) {
      const name = `syntax-comparison-${id}-${side}.${extension}`;
      await open(side, text, name);
      await page.waitForFunction(({ side, name }) => document.getElementById(`name-${side}`).textContent === name, { side, name });
    }
    await page.locator('#check-syntax').click();
  };
  const focused = async side => assert.ok(await page.getByRole('textbox', { name: `Code ${side}`, exact: true })
    .evaluate(editor => editor.contains(document.activeElement)), `The diagnostic focuses editor ${side}`);

  const broken = 'const value = ;';
  await pair(broken, '// inserted comment\n' + broken);
  await expectedCounts(0, 0, 1, 0);
  const persistent = page.locator('#syntax-comparison-list li[data-category="persistent"]');
  assert.match(await persistent.locator('[data-side="a"]').innerText(), /A · Line 1:15/);
  assert.match(await persistent.locator('[data-side="b"]').innerText(), /B · Line 2:15/);
  await persistent.locator('[data-side="b"]').click();
  await focused('B');
  assert.equal(await page.evaluate(() => window.getSelection().toString()), ';', 'The jump selects the reported token in B');

  const oldButton = await persistent.locator('[data-side="b"]').elementHandle();
  await page.getByRole('textbox', { name: 'Code B', exact: true }).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('\n// newer revision');
  await page.getByRole('textbox', { name: 'Code A', exact: true }).click();
  await oldButton.evaluate(button => button.click());
  await focused('A');
  await oldButton.dispose();
  await expectedCounts(0, 0, 1, 0);

  // A real block transfer and Undo/Redo must refresh the comparison, not retain
  // the previous parser result after B changes.
  await pair('const total = 1;', 'const total = ;');
  await expectedCounts(1, 0, 0, 0);
  await page.locator('#syntax-comparison-list [data-side="b"]').click();
  await focused('B');
  await page.locator('#changes-list .change-jump').first().click();
  await page.locator('#use-current').click();
  await expectedCounts(0, 0, 0, 0);
  assert.match(await page.locator('#syntax-comparison-status').innerText(), /No syntax diagnostics reported/);
  await page.locator('#undo').click();
  await expectedCounts(1, 0, 0, 0);
  await page.locator('#redo').click();
  await expectedCounts(0, 0, 0, 0);

  await pair('{"value": }', '{"value": 4}', 'json');
  await expectedCounts(0, 1, 0, 0);
  await page.locator('#syntax-comparison-list li[data-category="resolved"] [data-side="a"]').click();
  await focused('A');
  assert.match(await page.locator('#syntax-comparison-note').innerText(), /not proof of a fix/);
  await pair('{"value": 4}', '{"value": }', 'json');
  await expectedCounts(1, 0, 0, 0);

  await page.locator('#language').selectOption('html');
  await expectedCounts(0, 0, 0, 0, 'unavailable');
  assert.match(await page.locator('#syntax-comparison-status').innerText(), /unavailable/i);
  assert.equal(await page.locator('#syntax-b').getAttribute('data-state'), 'unsupported');

  await pair('const value = ;', '');
  await expectedCounts(0, 0, 0, 1, 'unavailable');
  assert.match(await page.locator('#syntax-comparison-note').innerText(), /empty file is not evidence/);

  await pair(broken, '// inserted comment\n' + broken);
  await expectedCounts(0, 0, 1, 0);
  if (output) await page.locator('#syntax-comparison').screenshot({ path: `${output}/syntax-comparison.png` });
}

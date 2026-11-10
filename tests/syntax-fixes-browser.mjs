import assert from 'node:assert/strict';

export async function checkSyntaxFixes({ page, open, download, output }) {
  let sequence = 0;
  const dialog = page.locator('#confirm-syntax-fix');
  const state = async (side, expected) => page.waitForFunction(({ side, expected }) =>
    document.getElementById(`syntax-${side}`).dataset.state === expected, { side, expected });
  const load = async (side, text) => {
    // The shared open helper checks character count, which can match an older
    // document. A unique filename also confirms this exact file has loaded.
    const name = `syntax-fix-${++sequence}-${side}.json`;
    await open(side, text, name);
    await page.waitForFunction(({ side, name }) =>
      document.getElementById(`name-${side}`).textContent === name, { side, name });
  };
  const close = async (value, direct = false) => {
    await dialog.evaluate(el => {
      el.dataset.fixTestClosed = 'pending';
      el.addEventListener('close', () => queueMicrotask(() => { el.dataset.fixTestClosed = 'done'; }), { once: true });
    });
    if (direct) await dialog.evaluate((el, value) => el.close(value), value);
    else await dialog.locator(`button[value="${value}"]`).click();
    await page.waitForFunction(() => document.getElementById('confirm-syntax-fix').dataset.fixTestClosed === 'done');
  };
  const preview = async (side, comparison = false) => {
    const selector = comparison ? '#syntax-comparison-list' : `#syntax-list-${side}`;
    await page.locator(`${selector} .syntax-fix-preview[data-side="${side}"]`).first().click();
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.locator('button[value="apply"]').isDisabled(), false);
  };
  const stale = async () => {
    await page.waitForFunction(() => document.getElementById('syntax-fix-status').textContent ===
      'Code or language changed. Close this preview and check again.');
    assert.equal(await dialog.locator('button[value="apply"]').isDisabled(), true);
    // The close handler must revalidate too, even if a stale dialog is closed
    // with an apply result without activating its disabled button.
    await close('apply', true);
  };
  const textA = () => page.getByRole('textbox', { name: 'Code A', exact: true })
    .evaluate(editor => [...editor.querySelectorAll('.cm-line')].map(line => line.textContent).join('\n'));

  await page.locator('#changes-only').uncheck();
  const originalA = '{"unchanged": true}';
  const broken = '\uFEFF{\r\n  "café": "😀",\n  "value": 2,\r}\r\n';
  const fixed = broken.replace('"value": 2,', '"value": 2');
  await load('a', originalA);
  await load('b', broken);
  await state('a', 'checked');
  await state('b', 'error');
  await preview('b');
  assert.match(await page.locator('#syntax-fix-before').textContent(), /"value": 2,/);
  assert.match(await page.locator('#syntax-fix-after').textContent(), /"value": 2/);
  assert.doesNotMatch(await page.locator('#syntax-fix-after').textContent(), /"value": 2,/);
  await page.screenshot({ path: `${output}/syntax-fix-preview.png`, fullPage: true });
  await close('cancel');
  assert.deepEqual((await download()).bytes, Buffer.from(broken), 'Cancel does not alter B bytes');
  assert.equal(await textA(), originalA);

  await preview('b', true);
  await close('apply');
  await state('b', 'checked');
  assert.deepEqual((await download()).bytes, Buffer.from(fixed), 'A fix preserves BOM, Unicode and every untouched mixed line ending');
  assert.equal(await textA(), originalA, 'A B fix leaves A unchanged');
  assert.equal(await page.locator('#syntax-list-b .syntax-fix-preview').count(), 0);
  await page.locator('#undo').click();
  await state('b', 'error');
  assert.deepEqual((await download()).bytes, Buffer.from(broken), 'One Undo reverses the whole fix');
  await page.locator('#redo').click();
  await state('b', 'checked');
  assert.deepEqual((await download()).bytes, Buffer.from(fixed), 'Redo restores the exact corrected bytes');

  // A has its own edit history; its fix cannot change the downloadable B.
  await load('a', '{"left": 1,}');
  await state('a', 'error');
  await preview('a');
  await close('apply');
  await state('a', 'checked');
  assert.equal(await textA(), '{"left": 1}');
  assert.deepEqual((await download()).bytes, Buffer.from(fixed), 'An A fix leaves B and its file format untouched');
  await page.getByRole('textbox', { name: 'Code A', exact: true }).click();
  await page.keyboard.press('Control+z');
  await state('a', 'error');
  assert.equal(await textA(), '{"left": 1,}', 'A fix is undone through the editor history');
  assert.deepEqual((await download()).bytes, Buffer.from(fixed));

  await load('a', originalA);
  await load('b', broken);
  await state('b', 'error');
  await preview('b');
  const newer = '\uFEFF{"newer": true}\r\n';
  await load('b', newer);
  await stale();
  await state('b', 'checked');
  assert.deepEqual((await download()).bytes, Buffer.from(newer), 'A stale preview cannot replace a subsequently loaded file');

  await load('b', broken);
  await state('b', 'error');
  const detached = await page.locator('#syntax-list-b .syntax-fix-preview').first().elementHandle();
  await preview('b');
  // A modal blocks pointer interaction with the language picker. Dispatch its
  // real change event to exercise a change occurring while the preview exists.
  await page.locator('#language').evaluate(el => {
    el.value = 'html'; el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await stale();
  await state('b', 'unsupported');
  assert.deepEqual((await download()).bytes, Buffer.from(broken), 'Changing language invalidates the proposed edit');
  await detached.evaluate(button => button.click());
  assert.equal(await dialog.isVisible(), false, 'A detached button cannot reopen a preview from an older check');
  await detached.dispose();

  await page.locator('#language').selectOption('json');
  await load('b', '{"missing": }');
  await state('b', 'error');
  assert.equal(await page.locator('#syntax-list-b .syntax-fix-preview').count(), 0, 'Missing values require user intent, so no fix is offered');
}

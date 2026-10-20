import assert from 'node:assert/strict';

// Repeated lines make incremental grouping history-sensitive in the unpatched
// editor: the final text has seven fresh-build chunks but four after this edit.
function repeatedLineFixture() {
  const a = Array.from({ length: 350 }, (_, i) => `line ${i % 7}: ${'ab'.repeat(8)} ${i % 3}\n`).join('');
  let b = a, seed = 42;
  const next = n => (seed = (1664525 * seed + 1013904223) >>> 0) % n;
  for (let i = 0; i < 8; i++) {
    const at = next(b.length);
    const insert = ['x', 'Y', '\n', 'line 0: abababababababab 0\n'][next(4)];
    b = b.slice(0, at) + insert + b.slice(at + next(4));
  }
  return { a, b, from: 7649, to: 7693, insert: 'line 0: abababababababab 0\n' };
}

export async function checkCanonicalComparison({ page, open, download }) {
  const { a, b, from, to, insert } = repeatedLineFixture();
  const finalB = b.slice(0, from) + insert + b.slice(to);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const snapshot = async () => {
    await settle();
    return page.evaluate(() => ({
      count: document.getElementById('diff-count').textContent,
      cards: [...document.querySelectorAll('#changes-list .change-jump')].map(el => ({
        label: el.getAttribute('aria-label'), text: el.textContent,
      })),
    }));
  };
  const reset = async (target, source = a) => {
    await page.locator('#clear').click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('diff-count').textContent === 'Add two texts');
    await page.locator('#wrap').uncheck();
    await open('a', source, 'canonical-a.txt');
    await open('b', target, 'canonical-b.txt');
    await settle();
  };
  const selectRange = async (side, source, start, end) => {
    const editor = page.getByRole('textbox', { name: `Code ${side}`, exact: true });
    await editor.focus();
    const prefix = source.slice(0, start).split('\n');
    const targetLine = prefix.length - 1;
    const lastLine = source.split('\n').length - 1;
    if (targetLine < lastLine / 2) {
      await page.keyboard.press('Control+Home');
      for (let i = 0; i < targetLine; i++) await page.keyboard.press('ArrowDown');
    } else {
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Home');
      for (let i = lastLine; i > targetLine; i--) await page.keyboard.press('ArrowUp');
    }
    for (let i = 0; i < prefix.at(-1).length; i++) await page.keyboard.press('ArrowRight');
    for (let i = start; i < end; i++) await page.keyboard.press('Shift+ArrowRight');
    assert.equal(await page.evaluate(() => getSelection().toString()), source.slice(start, end), `the intended interior range in ${side} is selected`);
    return editor;
  };

  // Reference path: load the final contents directly into a fresh comparison.
  await reset(finalB);
  const canonical = await snapshot();
  assert.equal(canonical.cards.length, 7, 'fixture retains separated fresh-build differences');
  assert.equal((await download()).bytes.toString(), finalB);

  // Alternative path: load an earlier B, then replace a selected interior range.
  // Keyboard navigation exercises the actual editor, without accessing its state.
  await reset(b);
  const before = await snapshot();
  const editor = await selectRange('B', b, from, to);
  await page.keyboard.insertText(insert);
  await settle();
  assert.ok(await editor.evaluate(el => el.contains(document.activeElement)), 'comparison rebuild preserves editor focus');
  // The next selected character proves that recomputation kept the caret after
  // the insertion instead of resetting it to the start/end of the document.
  await page.keyboard.press('Shift+ArrowRight');
  assert.equal(await page.evaluate(() => getSelection().toString()), b.slice(to, to + 1), 'comparison preserves the insertion caret');
  await page.keyboard.press('ArrowLeft');
  assert.equal((await download()).bytes.toString(), finalB);
  assert.deepEqual(await snapshot(), canonical, 'editing and direct loading produce identical visible grouping and line ranges');

  await page.locator('#undo').click();
  assert.equal((await download()).bytes.toString(), b, 'Undo restores the original bytes');
  assert.deepEqual(await snapshot(), before, 'Undo restores the original canonical grouping');
  await page.locator('#redo').click();
  assert.equal((await download()).bytes.toString(), finalB, 'Redo restores the edited bytes');
  assert.deepEqual(await snapshot(), canonical, 'Redo returns to the same canonical grouping');

  // Exporting A through the existing all-copy action proves the reference was
  // untouched; undoing that action also proves history survived every rebuild.
  await page.locator('#copy-all').click();
  assert.equal((await download()).bytes.toString(), a, 'reference A remains unchanged');
  await page.locator('#undo').click();
  assert.equal((await download()).bytes.toString(), finalB);
  assert.deepEqual(await snapshot(), canonical);

  // Changing A must use the same full comparison as changing B. Keep B's
  // downloaded bytes fixed while exercising A's own keyboard Undo/Redo stack.
  const finalA = a.slice(0, 3500) + 'edited in A' + a.slice(3504);
  await reset(finalB, finalA);
  const changedA = await snapshot();
  await reset(finalB);
  await selectRange('A', a, 3500, 3504);
  await page.keyboard.insertText('edited in A');
  assert.deepEqual(await snapshot(), changedA, 'editing A and loading final A produce identical grouping');
  await page.keyboard.press('Control+z');
  assert.deepEqual(await snapshot(), canonical, 'Undo in A restores the original grouping');
  await page.keyboard.press('Control+y');
  assert.deepEqual(await snapshot(), changedA, 'Redo in A restores the edited grouping');
  assert.equal((await download()).bytes.toString(), finalB, 'editing A never mutates B');
  await page.locator('#copy-all').click();
  assert.equal((await download()).bytes.toString(), finalA, 'A edit and keyboard Redo preserve the expected source bytes');
  await page.locator('#undo').click();
  assert.equal((await download()).bytes.toString(), finalB);
  assert.deepEqual(await snapshot(), changedA);
}

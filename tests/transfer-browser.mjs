import assert from 'node:assert/strict';

export async function checkDeterministicTransfer({ page, open, download }) {
  const a = Array.from({ length: 50 }, (_, i) => `value_${i + 1} = ${i + 1}`).join('\n') + '\n';
  const b = a.replace('value_8 = 8', 'value_8 = 800')
    .replace('value_25 = 25', 'value_25 = 2500').replace('value_42 = 42', 'value_42 = 4200');
  const firstApplied = b.replace('value_8 = 800', 'value_8 = 8');
  const progress = async (done, total) => page.waitForFunction(({ done, total }) =>
    document.getElementById('review-progress').textContent.startsWith(`Reviewed ${done} / ${total}`), { done, total });
  const reset = async () => {
    await open('a', a, 'transfer.py'); await open('b', b, 'transfer.py');
    await progress(0, 3);
    await page.locator('#changes-list .change-jump').first().click();
  };
  const capture = () => page.locator('#changes-list .change-apply').first().elementHandle();
  const edit = async side => {
    await page.getByRole('textbox', { name: `Code ${side}`, exact: true }).click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText('# changed after proposal\n');
  };

  await reset();
  const consumed = await capture();
  // Keep the original button/command even when its card is removed from the DOM.
  await consumed.evaluate(button => { button.click(); button.click(); });
  await progress(1, 3);
  assert.equal((await download()).bytes.toString(), firstApplied, 'replayed command cannot apply the next block');
  await page.locator('#undo').click(); await progress(0, 3);
  await consumed.evaluate(button => button.click());
  assert.match(await page.locator('#toast').innerText(), /already/i);
  assert.equal((await download()).bytes.toString(), b, 'Undo does not resurrect a consumed command');
  await page.locator('#redo').click(); await progress(1, 3);
  assert.equal((await download()).bytes.toString(), firstApplied);
  await page.locator('#undo').click(); await progress(0, 3);
  await page.locator('#changes-list .change-apply').first().click();
  await progress(1, 3);
  assert.equal((await download()).bytes.toString(), firstApplied, 'a new proposal after Undo is allowed');

  await reset();
  const staleA = await capture();
  await edit('A');
  await staleA.evaluate(button => button.click());
  assert.match(await page.locator('#toast').innerText(), /changed|outdated|stale/i);
  assert.equal((await download()).bytes.toString(), b, 'source edits invalidate the displayed proposal');

  await reset();
  const staleB = await capture();
  await edit('B');
  await staleB.evaluate(button => button.click());
  assert.match(await page.locator('#toast').innerText(), /changed|outdated|stale/i);
  assert.equal((await download()).bytes.toString(), b + '# changed after proposal\n', 'target edits survive rejected proposals');

  await reset();
  const rawOnly = await capture();
  const rawB = '\uFEFF' + b.replace(/\n/g, '\r\n');
  await open('b', rawB, 'raw-change.py');
  await page.waitForFunction(() => document.getElementById('name-b').textContent === 'raw-change.py');
  await rawOnly.evaluate(button => button.click());
  assert.match(await page.locator('#toast').innerText(), /changed|outdated|stale/i);
  assert.equal((await download()).bytes.toString(), rawB, 'format-only reload invalidates old proposals');
  await page.locator('.cm-merge-revert button').first().click();
  await progress(1, 3);
  assert.equal((await download()).bytes.toString(), rawB.replace('value_8 = 800', 'value_8 = 8'), 'new proposals work after raw-only reload');
  await page.locator('#undo').click();
  assert.equal((await download()).bytes.toString(), rawB, 'Undo restores BOM and CRLF exactly');

  await reset();
  const arrow = await page.locator('.cm-merge-revert button').first().elementHandle();
  await arrow.click();
  await progress(1, 3);
  await arrow.evaluate(button => button.click());
  assert.match(await page.locator('#toast').innerText(), /already/i);
  assert.equal((await download()).bytes.toString(), firstApplied, 'old arrow cannot resolve a newer chunk index');
  await arrow.dispose();

  const originalViewport = page.viewportSize();
  for (const width of [1440, 1280, 1100, 900]) {
    await page.setViewportSize({ width, height: 720 });
    await reset();
    // Let CodeMirror finish revealing the selected line before checking the page top.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.getElementById('changes-list').scrollTop = 0;
    });
    // Locator.click() auto-scrolls: assert discoverability before any such click.
    for (const [selector, label] of [
      ['#use-current', 'Use A'], ['#undo', 'Undo'], ['#redo', 'Redo'],
      ['#download', 'Download B'], ['#changes-list .change-apply', 'Use A'],
    ]) {
      const control = page.locator(selector).first();
      assert.ok((await control.innerText()).includes(label), `${selector} has a visible label`);
      assert.ok(await control.evaluate(el => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth
          && hit && el.contains(hit);
      }), `${selector} must be in the viewport and not clipped at ${width}px`);
    }
    await page.locator('#use-current').dblclick();
    await progress(1, 3);
    await page.locator('#undo').click(); await progress(0, 3);
    assert.equal((await download()).bytes.toString(), b, 'Undo restores the original B bytes');
    await page.locator('#redo').click(); await progress(1, 3);
    assert.equal((await download()).bytes.toString(), firstApplied, 'double click → Undo → Redo downloads exactly one applied block');
  }
  await page.setViewportSize(originalViewport);
  await consumed.dispose(); await staleA.dispose(); await staleB.dispose(); await rawOnly.dispose();
}

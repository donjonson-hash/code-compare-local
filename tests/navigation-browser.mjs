import assert from 'node:assert/strict';

// A browser download event confirms that a download started, not that the user
// successfully saved B. It never saves A. Keep the leave-page guard in both cases.
export async function checkDownloadNavigation({ page, open, download, url }) {
  const existingDialogListeners = page.listeners('dialog');
  for (const listener of existingDialogListeners) page.off('dialog', listener);
  const dialogTypes = [];
  let dialogFailure;
  let dialogHandled = Promise.resolve();
  const dismissDialog = dialog => {
    dialogTypes.push(dialog.type());
    dialogHandled = dialog.dismiss().catch(error => { dialogFailure = error; });
  };
  page.on('dialog', dismissDialog);

  const warnsBeforeLeaving = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  const assertEmpty = async side => {
    // CodeMirror includes placeholder text in the empty editor's DOM. Wait for
    // the next-frame statistics instead of treating that label as file content.
    await page.waitForFunction(side => /\b0 chars\b/.test(document.getElementById(`meta-${side}`).textContent), side);
    assert.match(await page.locator(`#meta-${side}`).textContent(), /\b0 chars\b/);
  };
  const clear = async () => {
    await page.locator('#clear').click();
    // Empty metadata can already match before the dialog's queued close event
    // resets the editors and file-load revisions. Observe that event explicitly
    // before allowing another file load to start.
    await page.locator('#confirm-clear').evaluate(dialog => {
      dialog.dataset.navigationTestClosed = 'pending';
      dialog.addEventListener('close', () => {
        queueMicrotask(() => { dialog.dataset.navigationTestClosed = 'complete'; });
      }, { once: true });
    });
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('confirm-clear').dataset.navigationTestClosed === 'complete');
    await page.locator('#confirm-clear').evaluate(dialog => { delete dialog.dataset.navigationTestClosed; });
    for (const side of ['a', 'b']) await assertEmpty(side);
  };
  const append = async (side, text) => {
    await page.getByRole('textbox', { name: `Code ${side}`, exact: true }).click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(text);
  };

  try {
    await clear();
    assert.equal(await warnsBeforeLeaving(), false, 'Clearing both editors resets the leave-page warning');
    await open('a', 'const original = 1;', 'original.js');
    await open('b', 'const result = 2;', 'result.js');
    await append('A', ' // unsaved A');
    const aBefore = await page.getByRole('textbox', { name: 'Code A', exact: true }).textContent();
    const bBefore = await download();
    assert.equal(bBefore.bytes.toString(), 'const result = 2;');
    assert.equal(await warnsBeforeLeaving(), true, 'Downloading B must not discard the warning for edited A');

    // Exercise the actual Studio navigation after trusted user interaction.
    // Cancel its native confirmation and ensure the live documents survive.
    const nextDialog = page.waitForEvent('dialog', { timeout: 10_000 });
    await Promise.all([nextDialog, page.locator('a.brand[href="index.html"]').click()]);
    await dialogHandled;
    if (dialogFailure) throw dialogFailure;
    assert.deepEqual(dialogTypes, ['beforeunload'], 'Studio must ask before leaving edited documents');
    assert.equal(page.url(), url, 'Canceling Studio navigation keeps the editor open');
    assert.equal(await page.getByRole('textbox', { name: 'Code A', exact: true }).textContent(), aBefore,
      'Canceling navigation preserves the unsaved A text');
    assert.deepEqual((await download()).bytes, bBefore.bytes, 'Canceling navigation preserves the exact B bytes');

    await clear();
    assert.equal(await warnsBeforeLeaving(), false, 'Clear resets the warning after canceled navigation');
    await append('B', 'const onlyB = 3;');
    await assertEmpty('a');
    assert.equal((await download()).bytes.toString(), 'const onlyB = 3;');
    assert.equal(await warnsBeforeLeaving(), true,
      'A started B download cannot confirm a completed save, even when only B was edited');
    await clear();
    assert.equal(await warnsBeforeLeaving(), false, 'Explicit Clear still allows leaving without a warning');
  } finally {
    page.off('dialog', dismissDialog);
    for (const listener of existingDialogListeners) page.on('dialog', listener);
  }
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function checkSessions({ page, open, download, output }) {
  const save = async () => {
    await new Promise(resolve => setTimeout(resolve, 1100));
    const event = page.waitForEvent('download');
    await page.locator('#save-session').click();
    const file = await event;
    assert.equal(file.suggestedFilename(), 'compare-code-session.json');
    const bytes = await readFile(await file.path());
    return { bytes, data: JSON.parse(bytes.toString()) };
  };
  const choose = async bytes => page.locator('#open-session').setInputFiles({
    name: 'saved-session.json', mimeType: 'application/json', buffer: bytes
  });
  const closeDialog = async (id, value) => {
    const dialog = page.locator(`#${id}`);
    await dialog.evaluate(el => {
      el.dataset.sessionTestClosed = 'pending';
      el.addEventListener('close', () => queueMicrotask(() => { el.dataset.sessionTestClosed = 'done'; }), { once: true });
    });
    await dialog.locator(`button[value="${value}"]`).click();
    await page.waitForFunction(id => document.getElementById(id).dataset.sessionTestClosed === 'done', id);
  };
  const clear = async () => {
    await page.locator('#clear').click();
    await closeDialog('confirm-clear', 'clear');
  };
  const editB = async text => {
    await page.getByRole('textbox', { name: 'Code B', exact: true }).click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(text);
  };
  const a = '\uFEFFconst café = 1;\r\n// 😀\nconst tail = 3;\r';
  const b = '\uFEFFconst café = 2;\r\n// 😀\nconst tail = 3;\r';
  await open('a', a, 'session-original.js');
  await page.waitForFunction(() => document.getElementById('name-a').textContent === 'session-original.js');
  await open('b', b, 'session-result.js');
  await page.waitForFunction(() => document.getElementById('name-b').textContent === 'session-result.js');
  await page.locator('#changes-list .change-keep').first().click();
  await page.waitForFunction(() => document.querySelectorAll('#changes-list .is-reviewed').length === 1);
  await page.locator('#filename').fill('finished.js');
  await page.locator('#wrap').check();
  await page.locator('#show-whitespace').check();
  await page.locator('#changes-only').check();
  await page.locator('#font-size').selectOption('18');
  const original = await save();
  assert.equal(original.data.a.raw, a.slice(1));
  assert.equal(original.data.b.raw, b.slice(1));
  assert.equal(original.data.a.bom, true);
  assert.equal(original.data.b.bom, true);
  assert.equal(original.data.review.kept.length, 1);
  assert.equal(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event); return event.defaultPrevented;
  }), true, 'Starting a session download cannot confirm that the file was saved');

  await page.locator('#changes-only').uncheck();
  await editB('// changed after save');
  const edited = await download();
  await choose(original.bytes);
  await page.locator('#confirm-session').waitFor({ state: 'visible' });
  await closeDialog('confirm-session', 'cancel');
  assert.deepEqual((await download()).bytes, edited.bytes, 'Cancel preserves the current B');
  await choose(original.bytes);
  await page.locator('#confirm-session').waitFor({ state: 'visible' });
  await closeDialog('confirm-session', 'open');
  await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Session opened'));
  assert.deepEqual((await download()).bytes, Buffer.from(b), 'Session restore preserves exact B bytes');
  assert.deepEqual((await save()).data, original.data, 'A/B, preferred EOL, names, settings and review decisions round-trip');
  assert.equal(await page.locator('#undo').isDisabled(), true, 'Undo history from the replaced workspace is discarded');
  assert.equal(await page.locator('#redo').isDisabled(), true);
  assert.equal(await page.locator('#changes-list .is-reviewed').count(), 1);
  assert.equal(await page.locator('#wrap').isChecked(), true);
  assert.equal(await page.locator('#show-whitespace').isChecked(), true);
  assert.equal(await page.locator('#changes-only').isChecked(), true);
  assert.equal(await page.locator('#font-size').inputValue(), '18');
  assert.equal(await page.locator('#language').inputValue(), 'javascript');
  await page.screenshot({ path: `${output}/session-restored.png`, fullPage: true });

  // Validate the whole file before touching either current document.
  await choose(Buffer.from('{broken json'));
  await page.waitForFunction(() => document.getElementById('toast').textContent === 'This is not a valid JSON session file.');
  assert.equal(await page.locator('#confirm-session').isVisible(), false);
  assert.deepEqual((await save()).data, original.data);
  const unsupported = { ...original.data, version: 999 };
  await choose(Buffer.from(JSON.stringify(unsupported)));
  await page.waitForFunction(() => /version/i.test(document.getElementById('toast').textContent));
  assert.deepEqual((await download()).bytes, Buffer.from(b));
  await choose(Buffer.alloc(8 * 1024 * 1024 + 1, ' '));
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('8 MiB'));
  assert.deepEqual((await download()).bytes, Buffer.from(b));

  // A saved approval cannot follow an externally modified document pair.
  const stale = structuredClone(original.data);
  stale.b.raw = stale.b.raw.replace('café = 2', 'café = 7');
  await choose(Buffer.from(JSON.stringify(stale)));
  await page.locator('#confirm-session').waitFor({ state: 'visible' });
  await closeDialog('confirm-session', 'open');
  await page.waitForFunction(() => document.querySelectorAll('#changes-list .is-reviewed').length === 0);
  assert.equal((await save()).data.review.kept.length, 0);

  // Slow file reads must not overwrite code typed after opening the picker.
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      if (this.name !== 'saved-session.json') return original.call(this);
      return new Promise(resolve => {
        window.releaseSessionRead = async () => resolve(await original.call(this));
      });
    };
    window.restoreSessionReader = () => { File.prototype.arrayBuffer = original; };
  });
  await choose(original.bytes);
  await page.waitForFunction(() => typeof window.releaseSessionRead === 'function');
  await page.locator('#changes-only').uncheck();
  await editB('// keep this edit');
  const afterEdit = await download();
  await page.evaluate(() => window.releaseSessionRead());
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('workspace changed'));
  assert.equal(await page.locator('#confirm-session').isVisible(), false);
  assert.deepEqual((await download()).bytes, afterEdit.bytes);
  await page.evaluate(() => {
    window.restoreSessionReader(); delete window.restoreSessionReader; delete window.releaseSessionRead;
  });

  await clear();
  await choose(original.bytes);
  await page.waitForFunction(() => document.getElementById('name-b').textContent === 'session-result.js');
  assert.equal(await page.locator('#confirm-session').isVisible(), false, 'An empty workspace needs no replacement dialog');
  assert.deepEqual((await download()).bytes, Buffer.from(b));
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Session controls fit a narrow viewport');
  await page.screenshot({ path: `${output}/session-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await clear();
  await page.locator('#show-whitespace').uncheck();
  await page.locator('#font-size').selectOption('16');
}

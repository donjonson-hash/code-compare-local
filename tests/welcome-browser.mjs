import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exercise actual links and editor input. The install/update event is covered
// separately by welcome.test.mjs; this also works with a reused browser profile.
export async function checkWelcomeFlow({ context, appUrl, output }) {
  const localPage = new URL(appUrl).protocol !== 'chrome-extension:';
  const localOrigin = new URL(appUrl).origin;
  const errors = [], externalRequests = [], pages = new Set();
  const trackPage = page => {
    pages.add(page);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
  };
  const trackRequest = request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== localOrigin)
      externalRequests.push(request.url());
  };
  context.on('page', trackPage);
  context.on('request', trackRequest);

  // HTTP localhost is only a development fallback. Installed-extension links
  // remain offline throughout; the fallback briefly needs its local server.
  const navigate = async callback => {
    if (localPage) await context.setOffline(false);
    try { await callback(); }
    finally { if (localPage) await context.setOffline(true); }
  };
  const ready = tab => tab.waitForFunction(() => document.getElementById('syntax-report')?.dataset.worker === 'ready');
  const welcomeUrl = new URL('welcome.html', appUrl).href;
  try {
    const tab = await context.newPage();
    await navigate(async () => {
      await tab.goto(welcomeUrl);
      await tab.locator('#open-editor').waitFor();
    });
    await tab.screenshot({ path: `${output}/welcome.png`, fullPage: true });
    await tab.setViewportSize({ width: 375, height: 812 });
    assert.ok(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'welcome fits a narrow viewport');
    assert.ok(await tab.locator('#open-editor').isVisible());
    assert.ok(await tab.locator('#try-example').isVisible());
    await tab.setViewportSize({ width: 1440, height: 1000 });

    await navigate(async () => {
      await tab.locator('#open-editor').click();
      await ready(tab);
    });
    assert.equal(await tab.locator('#diff-count').innerText(), 'Add two texts');
    assert.match(await tab.locator('#meta-a').innerText(), /\b0 chars\b/);
    assert.match(await tab.locator('#meta-b').innerText(), /\b0 chars\b/);

    await navigate(async () => {
      await tab.goto(welcomeUrl);
      await tab.locator('#try-example').click();
      await ready(tab);
      await tab.waitForFunction(() => document.querySelectorAll('#changes-list .change-item').length === 4);
    });
    assert.equal(new URL(tab.url()).search, '', 'the one-time example launch flag is consumed');
    assert.equal(await tab.locator('#name-b').innerText(), 'cart-updated.js');
    await navigate(async () => { await tab.reload(); await ready(tab); });
    assert.equal(await tab.locator('#diff-count').innerText(), 'Add two texts', 'reloading does not insert a new example or recover a session');

    const edited = 'const keepMyWork = 42;\n';
    await tab.getByRole('textbox', { name: 'Code B', exact: true }).focus();
    await tab.keyboard.insertText(edited);
    const popupPromise = context.waitForEvent('page');
    let help;
    await navigate(async () => {
      await tab.locator('#getting-started').click();
      help = await popupPromise;
      await help.waitForURL(welcomeUrl);
      await help.locator('#open-editor').waitFor();
    });
    assert.equal(new URL(tab.url()).pathname, new URL(appUrl).pathname, 'help opens separately from the edited document');
    const pendingDownload = tab.waitForEvent('download');
    await tab.locator('#download').click();
    const saved = await pendingDownload;
    assert.equal(await readFile(await saved.path(), 'utf8'), edited, 'opening help preserves the edited B bytes');
    await tab.locator('#undo').click();
    // Statistics render on the next animation frame, after the history edit.
    await tab.waitForFunction(() => /\b0 chars\b/.test(document.getElementById('meta-b').textContent));
    assert.match(await tab.locator('#meta-b').innerText(), /\b0 chars\b/, 'opening help preserves edit history');
    const undoneDownload = tab.waitForEvent('download');
    await tab.locator('#download').click();
    assert.equal(await readFile(await (await undoneDownload).path(), 'utf8'), '', 'Undo restores empty B bytes');
    await tab.locator('#redo').click();
    const redoneDownload = tab.waitForEvent('download');
    await tab.locator('#download').click();
    assert.equal(await readFile(await (await redoneDownload).path(), 'utf8'), edited, 'Redo restores edited B bytes');
    assert.deepEqual(externalRequests, [], 'welcome and its local editor links make no external requests');
    assert.deepEqual(errors, [], 'welcome flow has no uncaught browser errors');
  } finally {
    context.off('page', trackPage);
    context.off('request', trackRequest);
    for (const tab of pages) if (!tab.isClosed()) await tab.close();
    await context.setOffline(true);
  }
}

import assert from 'node:assert/strict';

const canonicalOrigin = 'https://comparecode.pro/';

async function checkInfoDocument(page, filename, expectedUrl) {
  await page.waitForURL(expectedUrl);
  await page.waitForLoadState('load');
  assert.equal(page.url(), expectedUrl, `${filename} opens as a local page`);
  assert.equal(await page.locator('h1').count(), 1, `${filename} has one main heading`);
  assert.equal(await page.locator('h1').isVisible(), true, `${filename} heading is visible`);
  assert.ok((await page.locator('h1').innerText()).trim(), `${filename} heading is not empty`);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),
    new URL(filename, canonicalOrigin).href, `${filename} has its production canonical URL`);
}

async function captureInfoLayouts(page, output, name) {
  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 375, height: 812 }],
  ]) {
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${name} fits the ${viewport.width} px window`);
    await page.screenshot({ path: `${output}/${name}-${label}.png`, fullPage: true });
  }
}

export async function checkInfoPages({ page, homeUrl, output }) {
  assert.equal(page.url(), homeUrl, 'Information page navigation begins on Home');
  await page.locator('footer a[href="privacy.html"]').click();
  await checkInfoDocument(page, 'privacy.html', new URL('privacy.html', homeUrl).href);
  await captureInfoLayouts(page, output, 'privacy');

  // The main navigation stays available on the narrow layout too.
  await page.locator('header nav a[href="support.html"]').click();
  await checkInfoDocument(page, 'support.html', new URL('support.html', homeUrl).href);
  await captureInfoLayouts(page, output, 'support');

  await page.locator('header a.logo[href="index.html"]').click();
  await page.waitForURL(homeUrl);
  await page.waitForLoadState('load');
  assert.equal(page.url(), homeUrl, 'The logo returns to Home');
  await page.setViewportSize({ width: 1440, height: 1000 });
}

// Call before putting the website context offline: each help link opens a new
// local page, while the existing workspace and its documents stay in place.
export async function checkWorkspaceHelp({ page, context, url, download }) {
  assert.equal(page.url(), url, 'Help starts from the loaded workspace');
  const before = await download();
  for (const filename of ['privacy.html', 'support.html']) {
    const [helpPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator(`footer a[href="${filename}"]`).click(),
    ]);
    try {
      assert.notEqual(helpPage, page, `${filename} opens a separate tab`);
      await checkInfoDocument(helpPage, filename, new URL(filename, url).href);
      assert.equal(page.url(), url, 'Opening help does not navigate the workspace');
    } finally {
      await helpPage.close();
      await page.bringToFront();
    }
    assert.equal(page.url(), url, 'Closing help keeps the workspace open');
    const after = await download();
    assert.equal(after.name, before.name, 'Opening help preserves the result filename');
    assert.deepEqual(after.bytes, before.bytes, 'Opening and closing help preserves the exact B bytes');
  }
}

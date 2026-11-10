// Full end-to-end suite: Chromium by default, or --web --browser=webkit.
// CHROMIUM_EXECUTABLE overrides only Chromium. No remote service is used.
import assert from 'node:assert/strict';
import { checkFocusedReview } from './review-browser.mjs';
import { checkDeterministicTransfer } from './transfer-browser.mjs';
import { checkClockIndependentComparison } from './diff-browser.mjs';
import { checkCanonicalComparison } from './canonical-browser.mjs';
import { checkStudioContrast } from './theme-browser.mjs';
import { checkDownloadNavigation } from './navigation-browser.mjs';
import { checkInfoPages, checkWorkspaceHelp } from './info-browser.mjs';
import { checkSessions } from './session-browser.mjs';
import { checkSyntaxComparison } from './syntax-comparison-browser.mjs';
import { checkSyntaxFixes } from './syntax-fixes-browser.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const webBuild = process.argv.includes('--web');
const browserFlags = process.argv.filter(arg => arg.startsWith('--browser='));
if (browserFlags.length > 1) throw new Error('Choose a single --browser=chromium or --browser=webkit.');
const browserEngine = browserFlags[0]?.slice('--browser='.length) || 'chromium';
if (!['chromium', 'webkit'].includes(browserEngine)) throw new Error('Supported browser engines: chromium, webkit.');
if (!webBuild && browserEngine !== 'chromium') throw new Error('WebKit is available only for --web; extension tests require Chromium.');
if (webBuild && process.env.REQUIRE_EXTENSION)
  throw new Error('Choose either the website or the required installed extension.');
const browserType = (await import(process.env.PLAYWRIGHT_MODULE || 'playwright'))[browserEngine];
const servedRoot = webBuild ? `${root}/dist/client` : root;
const output = process.env.TEST_OUTPUT || `${root}/test-output${browserEngine === 'webkit' ? '/webkit' : ''}`;
await mkdir(output, { recursive: true });
const server = createServer(async(req,res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!['index.html', 'studio.css', 'privacy.html', 'support.html', 'info.css', 'robots.txt', 'sitemap.xml', 'app.html', 'app.js', 'syntax-worker.js',
    'styles.css', 'workspace-theme.css', 'workspace-theme.js',
    'assets/anime-studio.png', 'assets/mark.svg', 'icons/icon16.png',
    'icons/icon48.png', 'icons/icon128.png', 'PRIVACY.md',
    'THIRD-PARTY-NOTICES.txt'].includes(name)) { res.writeHead(404).end(); return; }
  try {
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.html') ? 'text/html' : name.endsWith('.xml') ? 'application/xml' : 'text/plain');
    res.end(await readFile(`${servedRoot}/${name}`));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const localOrigin = `http://127.0.0.1:${server.address().port}`;
const context = await browserType.launchPersistentContext(`${output}/profile-${browserEngine}`, {
  ...(browserEngine === 'chromium' ? {
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
    channel: process.env.CHROMIUM_EXECUTABLE ? undefined : 'chromium',
    args: ['--no-sandbox', '--disable-gpu', ...(webBuild ? [] : [`--disable-extensions-except=${root}`, `--load-extension=${root}`])],
  } : {}),
  headless: true, viewport: { width: 1440, height: 1000 }, acceptDownloads: true,
});
const page = await context.newPage();
const errors = [], requests = [];
const blockedAppRequests = [];
const networkIsolation = browserEngine === 'webkit' ? 'http-blocked-with-worker-cache' : 'emulated-offline';
const cachedWorkerLoads = [];
const httpPattern = /^https?:\/\//;
let httpBlocker;
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== localOrigin) requests.push(request.url()); });
page.on('dialog', dialog => dialog.accept());
// serviceWorkers() is Chromium-only; website checks never query extension APIs.
let extensionWorker = webBuild ? undefined : context.serviceWorkers()[0];
if (process.env.REQUIRE_EXTENSION && !extensionWorker) extensionWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
const url = extensionWorker ? new URL('app.html', extensionWorker.url()).href : `${localOrigin}/app.html`;
const homeUrl = new URL('index.html', url).href;
const open = async (side, text, name = 'sample.py') => {
  await page.locator(`#file-${side}`).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await page.waitForFunction(({side, text}) => document.getElementById(`meta-${side}`).textContent.includes(`${text.replace(/\r\n|\r/g,'\n').replace(/^\uFEFF/,'').length.toLocaleString('en-US')} chars`), { side, text });
};
const download = async () => {
  // Chromium throttles bursts of more than ten downloads per second.
  await new Promise(resolve => setTimeout(resolve, 1100));
  const pending = page.waitForEvent('download');
  await page.locator('#download').click();
  const file = await pending;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
};

let traceSaved = false;
try {
  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(homeUrl);
  await page.waitForFunction(() => {
    const image = document.querySelector('img[src="assets/anime-studio.png"]');
    return image?.complete && image.naturalWidth > 0;
  });
  await page.screenshot({ path: `${output}/studio-home.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The studio home fits a narrow window');
  await page.screenshot({ path: `${output}/studio-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await checkInfoPages({ page, homeUrl, output });
  await page.locator('a[href="app.html?demo=1"]').first().click();
  await page.waitForFunction(() => document.getElementById('diff-count')?.textContent.includes('4 change blocks'));
  assert.equal(page.url(), url, 'The landing example opens the editor and consumes its one-time URL flag');
  await page.waitForFunction(() => document.getElementById('syntax-report').dataset.worker === 'ready');
  await checkWorkspaceHelp({ page, context, url, download });
  if (browserEngine === 'webkit') {
    // Measured by file-read-probe.mjs: all six online cases read exact bytes,
    // all six emulated-offline cases fail with NotReadableError, including disk
    // inputs that are never cleared. Keep File/Blob usable while denying HTTP(S).
    // This is network isolation, not a claim of native Safari offline coverage.
    // Playwright routing also disables HTTP cache. Replay only the exact built
    // worker already served by this server: replacing a busy worker must not
    // become an artificial network dependency. No request is forwarded.
    const workerUrl = localOrigin + '/syntax-worker.js';
    const cachedWorkerBytes = await readFile(servedRoot + '/syntax-worker.js');
    const probePage = await context.newPage();
    const blockedProbeRequests = [];
    httpBlocker = async route => {
      const request = route.request();
      if (request.method() === 'GET' && request.url() === workerUrl) {
        cachedWorkerLoads.push(request.url());
        await route.fulfill({ status: 200, contentType: 'text/javascript', body: cachedWorkerBytes });
        return;
      }
      let belongsToProbe = false;
      try { belongsToProbe = request.frame().page() === probePage; } catch {}
      (belongsToProbe ? blockedProbeRequests : blockedAppRequests).push({ method: request.method(), url: request.url() });
      await route.abort('internetdisconnected');
    };
    await context.route(httpPattern, httpBlocker);
    try {
      const probes = [
        { method: 'GET', url: localOrigin + '/index.html?isolation-probe=http' },
        { method: 'GET', url: localOrigin.replace('http:', 'https:') + '/index.html?isolation-probe=https' },
        { method: 'GET', url: workerUrl + '?isolation-probe=query' },
        { method: 'POST', url: workerUrl },
      ];
      for (const probe of probes) {
        const rejected = await probePage.evaluate(async ({ url, method }) => {
          try { await fetch(url, { method }); return false; } catch { return true; }
        }, probe);
        assert.equal(rejected, true, 'The isolation probe request must be rejected');
      }
      assert.deepEqual(blockedProbeRequests, probes, 'HTTP, HTTPS, worker query and worker POST all reached the blocker');
    } finally { await probePage.close(); }
  } else {
    await context.setOffline(true);
  }

  await page.locator('#demo').click();
  await page.locator('.cm-merge-revert button').first().waitFor();
  assert.match(await page.locator('#diff-count').innerText(), /4 change blocks/);
  await checkStudioContrast(page);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  const demoBefore = await download();
  await page.locator('.cm-merge-revert button').first().click();
  const demoAfter = await download();
  assert.notDeepEqual(demoAfter.bytes, demoBefore.bytes);
  await page.locator('#undo').click();
  assert.deepEqual((await download()).bytes, demoBefore.bytes);
  await page.locator('#redo').click();
  assert.deepEqual((await download()).bytes, demoAfter.bytes);

  // Focus changes the layout without replacing either editor or its history.
  const originalA = await page.getByRole('textbox', { name: 'Code A', exact: true }).textContent();
  await page.locator('#zen-mode').click();
  assert.equal(await page.locator('#zen-mode').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.changes-sidebar').isVisible(), false);
  assert.deepEqual((await download()).bytes, demoAfter.bytes, 'Focus preserves B bytes');
  assert.equal(await page.getByRole('textbox', { name: 'Code A', exact: true }).textContent(), originalA, 'Focus preserves A');
  await page.locator('#undo').click();
  assert.deepEqual((await download()).bytes, demoBefore.bytes, 'Undo history survives entering focus');
  await page.locator('#redo').click();
  assert.deepEqual((await download()).bytes, demoAfter.bytes, 'Redo history survives entering focus');
  await page.locator('#zen-mode').click();
  assert.equal(await page.locator('#zen-mode').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.changes-sidebar').isVisible(), true);
  assert.equal(await page.getByRole('textbox', { name: 'Code A', exact: true }).textContent(), originalA, 'Leaving focus preserves A');
  assert.deepEqual((await download()).bytes, demoAfter.bytes, 'Leaving focus preserves B');

  // Syntax diagnostics react to a hunk transfer and its undo, without executing code.
  await open('a', 'def greet():\n    print("hello")\n', 'syntax.py');
  await open('b', 'def greet():\nprint("hello")\n', 'syntax.py');
  await page.waitForFunction(() => document.getElementById('syntax-a').dataset.state === 'checked' && document.getElementById('syntax-b').dataset.state === 'error');
  assert.match(await page.locator('#syntax-note-b').innerText(), /preliminary/);
  await page.locator('#syntax-list-b button').first().click();
  assert.ok(await page.getByRole('textbox', { name:'Code B', exact:true }).evaluate(el => el.contains(document.activeElement)));
  await page.screenshot({path:`${output}/syntax-python.png`, fullPage:true});
  await page.locator('.cm-merge-revert button').first().click();
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'checked');
  await page.locator('#undo').click();
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'error');
  await page.locator('#language').selectOption('html');
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'unsupported');
  assert.equal(await page.locator('#syntax-list-b button').count(), 0);
  // A rapid edit must invalidate old diagnostics; unsupported is not a pass.
  await open('b', 'const value = ;', 'check.js');
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'error');
  await open('b', 'const value = 1;', 'check.js');
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'checked');
  assert.equal(await page.locator('#syntax-list-b button').count(), 0);
  await open('b', '{"key": }', 'check.json');
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'error');
  await page.locator('#check-syntax').click();
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'error');
  await open('b', 'value:\n\tbad: 1', 'check.yaml');
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'error');
  await open('b', 'let x: number = 42;', 'check.ts');
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'checked');

  // Full user journey: fix one error, download exact bytes, then reopen
  // that actual download in B and confirm syntax remains clean.
  for (const [extension, language] of [['py', 'python'], ['js', 'javascript'], ['ts', 'typescript'], ['json', 'json'], ['yaml', 'yaml']]) {
    const expected = await readFile(`${root}/examples/${language}/A-correct.${extension}`);
    const broken = await readFile(`${root}/examples/${language}/B-error.${extension}`);
    await open('a', expected.toString(), `A-correct.${extension}`);
    await open('b', broken.toString(), `B-error.${extension}`);
    await page.waitForFunction(() => document.getElementById('syntax-a').dataset.state === 'checked' && document.getElementById('syntax-b').dataset.state === 'error');
    await page.locator('.cm-merge-revert button').first().click();
    await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'checked');
    await page.locator('#filename').fill(`fixed.${extension}`);
    const saved = await download();
    assert.equal(saved.name, `fixed.${extension}`);
    assert.deepEqual(saved.bytes, expected, `${language}: corrected bytes must match A`);
    await page.locator('#undo').click();
    await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'error');
    await page.locator('#redo').click();
    await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'checked');
    await open('b', saved.bytes.toString(), saved.name);
    await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'checked');
    assert.equal(await page.locator('#language').inputValue(), language);
    assert.equal(await page.locator('#syntax-list-b button').count(), 0);
    assert.deepEqual((await download()).bytes, expected, `${language}: reopening must preserve bytes`);
  }

  // Long files must expose a navigable overview before manual scrolling.
  const longA = Array.from({length:240}, (_, i) => `value_${i + 1} = ${i + 1}`).join('\n') + '\n';
  const longB = longA.replace('value_30 = 30', 'value_30 = 999')
    .replace(Array.from({length:11}, (_, i) => `value_${i + 66} = ${i + 66}\n`).join(''), '')
    .replace('value_200 = 200', 'value_200 = 888');
  await open('a', longA, 'long.py');
  await open('b', longB, 'long.py');
  await page.waitForFunction(() => document.querySelectorAll('#changes-list .change-jump').length === 3);
  const items = page.locator('#changes-list .change-item');
  assert.match(await items.nth(0).innerText(), /30/);
  assert.match(await items.nth(1).innerText(), /66.*76/s);
  assert.match(await items.nth(2).innerText(), /200[\s\S]*189/);
  await items.nth(2).locator('.change-jump').click();
  await page.waitForFunction(() => document.querySelectorAll('#changes-list .change-item')[2].classList.contains('is-active'));
  await page.waitForFunction(() => {
    const viewport = document.querySelector('.cm-mergeView').getBoundingClientRect();
    return [...document.querySelectorAll('.cm-merge-b .cm-line')].some(line => {
      const r = line.getBoundingClientRect();
      return line.textContent.includes('value_200 = 888') && r.top >= viewport.top && r.bottom <= viewport.bottom;
    });
  });
  const beforeFont = await page.locator('.cm-mergeView').evaluate(el => getComputedStyle(el).fontSize);
  assert.equal(beforeFont, '16px');
  await page.locator('#font-size').selectOption('20');
  assert.equal(await page.locator('.cm-mergeView').evaluate(el => getComputedStyle(el).fontSize), '20px');
  await page.locator('#font-size').selectOption('16');
  await page.locator('#use-current').click();
  await page.waitForFunction(() => document.querySelectorAll('#changes-list .change-jump').length === 2);
  const partlyFixed = (await download()).bytes.toString();
  assert.equal(partlyFixed, longB.replace('value_200 = 888', 'value_200 = 200'));
  await page.locator('#undo').click();
  await page.waitForFunction(() => document.querySelectorAll('#changes-list .change-jump').length === 3);
  assert.equal((await download()).bytes.toString(), longB);
  await page.locator('#changes-list .change-apply').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('#changes-list .change-jump').length === 2);
  const restored = (await download()).bytes.toString();
  assert.equal(restored, longA.replace('value_30 = 30', 'value_30 = 999').replace('value_200 = 200','value_200 = 888'));
  await page.locator('#prev').click();
  await page.locator('#next').click();
  assert.equal(await page.locator('#changes-list .is-active').count(), 1);
  await page.screenshot({path:`${output}/change-overview.png`,fullPage:true});

  // Optional private regression fixture supplied by the user; never committed.
  if (process.env.REVIEW_FILE_A && process.env.REVIEW_FILE_B) {
    const a = await readFile(process.env.REVIEW_FILE_A, 'utf8');
    const b = await readFile(process.env.REVIEW_FILE_B, 'utf8');
    await open('a', a, 'test_archive_extraction.py');
    await open('b', b, 'test_archive_extraction_B.py');
    await page.waitForFunction(() => document.querySelectorAll('#changes-list .change-jump').length === 4);
    const reviewItems = page.locator('#changes-list .change-item');
    for (const [i, pattern] of [[0,/30/],[1,/32.*33/s],[2,/36.*37/s]]) assert.match(await reviewItems.nth(i).innerText(), pattern);
    await reviewItems.nth(3).locator('.change-jump').click();
    await page.screenshot({path:`${output}/private-user-files.png`,fullPage:true});
    await reviewItems.nth(3).locator('.change-apply').click();
    await page.waitForFunction(() => document.querySelectorAll('#changes-list .change-jump').length === 3);
    const expected = a.replace('    if isinstance(files, str):','     if isinstance(files, str):')
      .replace('    buf = io.BytesIO()', '     buf = io.BytesIO()')
      .replace('    with zipfile.ZipFile(buf, "w") as z:', '     with zipfile.ZipFile(buf, "w") as z:')
      .replace('    buf.seek(0)', '     buf.seek(0)').replace('    return buf', '     return buf');
    assert.equal((await download()).bytes.toString(), expected, 'restore only the removed function; leave other edits intact');
    await page.locator('#undo').click();
    assert.equal((await download()).bytes.toString(), b);
  }

  await checkFocusedReview({ page, open, download, output });
  await checkDeterministicTransfer({ page, open, download });
  await checkClockIndependentComparison({ page, open, download });
  await checkCanonicalComparison({ page, open, download });
  await checkSyntaxComparison({ page, open, output });
  await checkSyntaxFixes({ page, open, download, output });
  await checkSessions({ page, open, download, output });

  const exact = '\uFEFF\tпривет 😀\r\nsecond\nthird\rfinal\r\n';
  await open('b', exact, 'mixed.ts');
  const roundTrip = await download();
  assert.equal(roundTrip.name, 'mixed.ts');
  assert.deepEqual(roundTrip.bytes, Buffer.from(exact));

  await open('a', 'a\r\nb\r\n');
  await open('b', 'a\nb\n');
  await page.locator('#format-notice').waitFor({ state: 'visible' });
  await page.locator('#copy-format').click();
  assert.equal((await download()).bytes.toString(), 'a\r\nb\r\n');
  await page.locator('#undo').click();
  assert.equal((await download()).bytes.toString(), 'a\nb\n');

  for (const [a, b] of [['', 'a\n'], ['a\n', ''], ['abc\n', 'abc'], ['\tfirst\r\nnew\r\nend', '\tfirst\nold\nend']]) {
    await open('a', a); await open('b', b);
    await page.locator('.cm-merge-revert button').first().waitFor();
    let count = 0;
    while (await page.locator('.cm-merge-revert button').count()) {
      assert.ok(count++ < 10);
      await page.locator('.cm-merge-revert button').first().click();
      await page.waitForFunction(() => document.getElementById('diff-count').textContent.includes('Versions match') || document.getElementById('diff-count').textContent.includes('Format differs') || document.getElementById('diff-count').textContent.includes('Add two texts'));
    }
    assert.equal((await download()).bytes.toString().replace(/\r\n|\r/g,'\n'), a.replace(/\r\n|\r/g,'\n'));
    await page.locator('#undo').click();
    assert.equal((await download()).bytes.toString(), b);
  }

  await open('b', 'hello\r\n', 'edit.js');
  await page.getByRole('textbox', { name: 'Code B', exact: true }).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('\tworld');
  assert.equal((await download()).bytes.toString(), 'hello\r\n\tworld');
  await page.locator('#undo').click();
  assert.equal((await download()).bytes.toString(), 'hello\r\n');

  await page.locator('#file-b').setInputFiles({ name: 'too-large.txt', mimeType: 'text/plain', buffer: Buffer.alloc(512 * 1024 + 1, 'x') });
  await page.waitForFunction(() => document.getElementById('toast').textContent.includes('512 KB'));
  assert.equal((await download()).bytes.toString(), 'hello\r\n');

  const hostile = '</script><img src="https://example.invalid/" onerror="globalThis.codeExecuted=true"><script>globalThis.codeExecuted=true</script>';
  await open('b', hostile, 'payload.html');
  assert.equal(await page.evaluate(() => globalThis.codeExecuted), undefined);
  assert.equal((await download()).bytes.toString(), hostile);

  await page.setViewportSize({ width: 900, height: 900 });
  await page.locator('#demo').click();
  await page.screenshot({ path: `${output}/compact.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The editor fits a narrow window');
  await page.screenshot({ path: `${output}/workspace-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 900, height: 900 });
  await page.locator('#clear').click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal((await download()).bytes.length, 0);
  assert.equal(await page.locator('#undo').isDisabled(), true);
  // An installed extension must keep its home page, image, and editor local.
  // The website needs the server for a full navigation; no offline reload is claimed.
  if (httpBlocker) {
    assert.deepEqual(blockedAppRequests, [], 'The loaded editor made no HTTP(S) attempts while isolated');
    await context.unroute(httpPattern, httpBlocker);
  } else if (!extensionWorker) await context.setOffline(false);
  await checkDownloadNavigation({ page, open, download, url });
  await page.locator('a.brand[href="index.html"]').click();
  assert.equal(page.url(), homeUrl);
  await page.locator('img[src="assets/anime-studio.png"]').waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('img[src="assets/anime-studio.png"]');
    return image?.complete && image.naturalWidth > 0;
  });
  await page.locator('a[href="app.html"]').first().click();
  await page.waitForFunction(() => document.getElementById('syntax-report')?.dataset.worker === 'ready');
  assert.equal(page.url(), url);
  for (const side of ['a', 'b']) {
    await page.waitForFunction(side => /\b0 chars\b/.test(document.getElementById(`meta-${side}`).textContent), side);
    assert.match(await page.locator(`#meta-${side}`).textContent(), /\b0 chars\b/,
      `Normal entry leaves ${side.toUpperCase()} empty instead of reloading the example`);
  }
  assert.equal((await download()).bytes.length, 0, 'Normal entry exports an empty file, not placeholder text');
  assert.deepEqual(requests, [], 'No network requests while using the app');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log(JSON.stringify({ passed: true, mode: webBuild ? 'website' : extensionWorker ? 'extension' : 'local-page', browserEngine, platform: process.platform, browser: context.browser()?.version() ?? 'unavailable', networkIsolation, ...(browserEngine === 'chromium' ? { offline: true } : {}), blockedAppRequests, cachedWorkerLoads, cases: ['home-demo-navigation', 'rendered-token-contrast', 'focus-preserves-bytes-and-history', 'local-home-editor-navigation', 'demo', 'block-transfer', 'undo-redo', 'python-indent-errors', 'syntax-after-merge-and-undo', 'diagnostic-navigation', 'language-change-invalidates-results', 'javascript-json-yaml-typescript', 'five-language-fix-download-reopen', 'long-file-change-list-and-navigation', 'selected-change-only-and-undo', 'code-font-size', 'collapse-context-and-keyboard-expand', 'shared-diagnostic-reveal', 'visible-whitespace-byte-preservation', 'keep-apply-review-progress-undo-redo', 'edit-invalidates-review', 'replayed-transfer-command', 'stale-source-and-target-proposals', 'raw-only-stale-proposal', 'double-click-one-block', 'clock-independent-comparison-and-download', 'canonical-grouping-after-A-B-edits-and-undo-redo', 'UTF8-BOM-mixed-EOL-roundtrip', 'format-only', 'empty-insert-delete-final-newline', 'manual-edit', 'size-limit', 'inert-code', 'compact-layout', 'clear', 'no-external-network'] }, null, 2));
} catch(error) {
  const state = await page.evaluate(() => ({
    status: document.getElementById('diff-count')?.textContent ?? null,
    toast: document.getElementById('toast')?.textContent ?? null,
  })).catch(() => ({}));
  console.error({ browserEngine, platform: process.platform, networkIsolation, blockedAppRequests, cachedWorkerLoads, errors, requests, ...state });
  await page.screenshot({path: `${output}/failure.png`, fullPage:true}).catch(() => {});
  await context.tracing.stop({ path: `${output}/failure-trace.zip` }).then(() => { traceSaved = true; })
    .catch(traceError => console.error('Could not save failure trace:', traceError.message));
  throw error;
} finally {
  if (!traceSaved) await context.tracing.stop().catch(() => {});
  await context.close(); await new Promise(resolve => server.close(resolve));
}

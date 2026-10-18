// Optional end-to-end check: install Playwright separately, then provide a
// Chromium binary through CHROMIUM_EXECUTABLE. No remote service is used.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const output = process.env.TEST_OUTPUT || `${root}/test-output`;
await mkdir(output, { recursive: true });
const server = createServer(async(req,res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (!['app.html','app.js','syntax-worker.js','styles.css','icons/icon16.png'].includes(name)) { res.writeHead(404).end(); return; }
  try {
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(await readFile(`${root}/${name}`));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const localOrigin = `http://127.0.0.1:${server.address().port}`;
const context = await chromium.launchPersistentContext(`${output}/profile`, {
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
  channel: process.env.CHROMIUM_EXECUTABLE ? undefined : 'chromium',
  headless: true, viewport: { width: 1440, height: 1000 }, acceptDownloads: true,
  args: ['--no-sandbox', '--disable-gpu', `--disable-extensions-except=${root}`, `--load-extension=${root}`]
});
const page = await context.newPage();
const errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== localOrigin) requests.push(request.url()); });
page.on('dialog', dialog => dialog.accept());
let extensionWorker = context.serviceWorkers()[0];
if (process.env.REQUIRE_EXTENSION && !extensionWorker) extensionWorker = await context.waitForEvent('serviceworker', { timeout: 15000 });
const url = extensionWorker ? new URL('app.html', extensionWorker.url()).href : `${localOrigin}/app.html`;
await page.goto(url);
await page.waitForFunction(() => document.getElementById('syntax-report').dataset.worker === 'ready');
await context.setOffline(true);
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

try {
  await page.locator('#demo').click();
  await page.locator('.cm-merge-revert button').first().waitFor();
  assert.match(await page.locator('#diff-count').innerText(), /4 change blocks/);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  const demoBefore = await download();
  await page.locator('.cm-merge-revert button').first().click();
  const demoAfter = await download();
  assert.notDeepEqual(demoAfter.bytes, demoBefore.bytes);
  await page.locator('#undo').click();
  assert.deepEqual((await download()).bytes, demoBefore.bytes);
  await page.locator('#redo').click();
  assert.deepEqual((await download()).bytes, demoAfter.bytes);

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
  await page.locator('#clear').click();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  assert.equal((await download()).bytes.length, 0);
  assert.equal(await page.locator('#undo').isDisabled(), true);
  assert.deepEqual(requests, [], 'No network requests while using the app');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log(JSON.stringify({ passed: true, mode: extensionWorker ? 'extension' : 'local-page', browser: context.browser()?.version(), offline: true, cases: ['demo', 'block-transfer', 'undo-redo', 'python-indent-errors', 'syntax-after-merge-and-undo', 'diagnostic-navigation', 'language-change-invalidates-results', 'javascript-json-yaml-typescript', 'five-language-fix-download-reopen', 'UTF8-BOM-mixed-EOL-roundtrip', 'format-only', 'empty-insert-delete-final-newline', 'manual-edit', 'size-limit', 'inert-code', 'compact-layout', 'clear', 'no-external-network'] }, null, 2));
} catch(error) {
  console.error({errors, requests, status: await page.locator('#diff-count').textContent(), toast: await page.locator('#toast').textContent()});
  await page.screenshot({path: `${output}/failure.png`, fullPage:true});
  throw error;
} finally { await context.close(); await new Promise(resolve => server.close(resolve)); }

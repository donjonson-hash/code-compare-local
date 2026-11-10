// Controlled diagnostic: identify whether selected-file reads fail because of
// offline emulation, the upload representation, or clearing the input too soon.
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const temporary = await mkdtemp(join(tmpdir(), 'comparecode-file-probe-'));
const filename = join(temporary, 'sample.py');
const expected = Buffer.from('\uFEFFdef greet():\r\n    print("😀")\n', 'utf8');
await writeFile(filename, expected);
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><meta charset="utf-8"><input id="file" type="file">');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await webkit.launch({ headless: true });
const results = [];
try {
  for (const offline of [false, true]) {
    for (const reset of ['never', 'immediate', 'after-read']) {
      for (const upload of ['buffer', 'disk']) {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
          await page.goto('http://127.0.0.1:' + server.address().port);
          await page.evaluate(reset => {
            const input = document.getElementById('file');
            window.probeResult = null;
            input.addEventListener('change', () => {
              const file = input.files[0];
              const read = file.arrayBuffer();
              if (reset === 'immediate') input.value = '';
              read.then(buffer => {
                window.probeResult = { outcome: 'read', bytes: [...new Uint8Array(buffer)] };
              }, error => {
                window.probeResult = { outcome: 'error', name: error.name, message: error.message };
              }).finally(() => {
                if (reset === 'after-read') input.value = '';
              });
            });
          }, reset);
          await context.setOffline(offline);
          await page.locator('#file').setInputFiles(upload === 'disk' ? filename
            : { name: 'sample.py', mimeType: 'text/plain', buffer: expected });
          await page.waitForFunction(() => window.probeResult !== null, null, { timeout: 10_000 });
          const outcome = await page.evaluate(() => window.probeResult);
          const bytesMatch = outcome.outcome === 'read' && Buffer.from(outcome.bytes).equals(expected);
          results.push({ offline, reset, upload, ...outcome, bytes: undefined, bytesMatch });
        } catch (error) {
          results.push({ offline, reset, upload, outcome: 'harness-error', name: error.name, message: error.message });
        } finally {
          await context.close();
        }
        console.log(JSON.stringify(results.at(-1)));
      }
    }
  }
  console.log(JSON.stringify({ browserEngine: 'webkit', browser: browser.version(), platform: process.platform,
    diagnosticOnly: true, cases: results }, null, 2));
  // A diagnostic error is data, not a waived product failure. The main website
  // suite still follows this probe and retains all of its original assertions.
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}

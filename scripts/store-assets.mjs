// Capture the actual packaged UI with synthetic test files, plus a separate
// promotional tile. Never point this script at user files or browser profiles.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['app.html', 'app.js', 'syntax-worker.js', 'styles.css']);
const server = createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (!allowed.has(name)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
  res.end(await readFile(`${root}${name}`));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : { channel: 'chromium' }),
  headless: true, args: ['--no-sandbox'],
});
try {
  await mkdir(`${root}store`, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 800 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app.html`);
  for (const [side, name] of [['a', 'A-correct.js'], ['b', 'B-error.js']]) {
    await page.locator(`#file-${side}`).setInputFiles(`${root}examples/javascript/${name}`);
  }
  await page.waitForFunction(() => document.getElementById('syntax-a').dataset.state === 'checked' && document.getElementById('syntax-b').dataset.state === 'error');
  await page.locator('#toast').waitFor({ state: 'hidden' });
  const box = await page.locator('.workspace').boundingBox();
  const clip = { x: box.x, y: box.y - 8, width: 1280, height: 800 };
  const save = await page.locator('#download').boundingBox();
  assert.ok(save.y + save.height < clip.y + clip.height, 'Screenshot must include Download B');
  await page.screenshot({ path: `${root}store/screenshot-1280x800.png`, clip, fullPage: true });

  const promo = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  await promo.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#f6f8f8;color:#172b3b;font:14px Arial,sans-serif;padding:28px 30px}
    .name{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:bold}.icon{background:#172b3b;color:white;border-radius:8px;padding:7px;font:17px monospace}
    h1{font-size:32px;line-height:1.12;letter-spacing:-1px;margin:23px 0 13px}p{margin:0;color:#697b89;font-size:14px;line-height:1.6}
    .badge{display:inline-block;margin-top:19px;border:1px solid #bed8ca;background:#eff8f2;color:#236b59;border-radius:20px;padding:6px 12px;font-size:12px}
  </style></head><body><div class="name"><span class="icon">{≠}</span>Code Compare Local</div><h1>Compare. Fix. Save.</h1><p>Side-by-side code comparison<br>with local syntax checks.</p><div class="badge">On your device. No account or AI.</div></body></html>`);
  await promo.screenshot({ path: `${root}store/promo-440x280.png` });
  const icon = await browser.newPage({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 });
  const svg = await readFile(`${root}icons/icon.svg`, 'utf8');
  for (const size of [16, 48, 128]) {
    await icon.setViewportSize({ width: size, height: size });
    await icon.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await icon.screenshot({ path: `${root}icons/icon${size}.png`, omitBackground: true });
  }
  console.log('Created store screenshot, promotional tile, and extension icons');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

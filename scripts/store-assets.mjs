// Capture the actual packaged UI with synthetic test files, plus a separate
// promotional tile. Never point this script at user files or browser profiles.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set(['app.html', 'app.js', 'syntax-worker.js', 'styles.css', 'welcome.html', 'welcome.css', 'icons/icon16.png', 'icons/icon128.png']);
const server = createServer(async (req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1);
  if (!allowed.has(name)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html');
  res.end(await readFile(`${root}${name}`));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : { channel: 'chromium' }),
  headless: true, args: ['--no-sandbox'],
});
try {
  await mkdir(`${root}store`, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 720 }, deviceScaleFactor: 0.8 });
  await page.goto(`http://127.0.0.1:${server.address().port}/app.html`);
  for (const [side, name] of [['a', 'A-correct.js'], ['b', 'B-error.js']]) {
    await page.locator(`#file-${side}`).setInputFiles(`${root}examples/javascript/${name}`);
  }
  await page.waitForFunction(() => document.getElementById('syntax-a').dataset.state === 'checked' && document.getElementById('syntax-b').dataset.state === 'error');
  await page.locator('#font-size').selectOption('18');
  await page.locator('#toast').waitFor({ state: 'hidden' });
  const manifest = JSON.parse(await readFile(`${root}manifest.json`, 'utf8'));
  assert.equal(await page.locator('.version').innerText(), `Beta ${manifest.version}`);
  const clip = { x: 0, y: 0, width: 1600, height: 1000 };
  const save = await page.locator('#download').boundingBox();
  assert.ok(save.y + save.height < clip.y + clip.height, 'Screenshot must include Download B');
  await page.screenshot({ path: `${root}store/screenshot-1280x800.png`, clip, fullPage: true });

  // Capture the real result of the visible block-transfer action.
  await page.locator('#use-current').click();
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'checked');
  assert.equal(await page.locator('#changes-list .change-item').count(), 0);
  assert.ok(await page.locator('#undo').isEnabled());
  await page.locator('#toast').waitFor({ state: 'hidden' });
  await page.screenshot({ path: `${root}store/screenshot-fixed-1280x800.png`, clip, fullPage: true });

  const welcome = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await welcome.goto(`http://127.0.0.1:${server.address().port}/welcome.html`);
  await welcome.locator('#try-example').waitFor();
  await welcome.screenshot({ path: `${root}store/screenshot-welcome-1280x800.png` });

  const promo = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  await promo.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#f6f8f8;color:#172b3b;font:14px Arial,sans-serif;padding:28px 30px}
    .name{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:bold}.icon{background:#172b3b;color:white;border-radius:8px;padding:7px;font:17px monospace}
    h1{font-size:32px;line-height:1.12;letter-spacing:-1px;margin:23px 0 13px}p{margin:0;color:#697b89;font-size:14px;line-height:1.6}
    .badge{display:inline-block;margin-top:19px;border:1px solid #bed8ca;background:#eff8f2;color:#236b59;border-radius:20px;padding:6px 12px;font-size:12px}
  </style></head><body><div class="name"><span class="icon">{≠}</span>Code Compare Local</div><h1>Compare. Fix. Save.</h1><p>Side-by-side code comparison<br>with local syntax checks.</p><div class="badge">On your device. No account or AI.</div></body></html>`);
  await promo.screenshot({ path: `${root}store/promo-440x280.png` });

  const marquee = await browser.newPage({ viewport: { width: 1400, height: 560 }, deviceScaleFactor: 1 });
  const screenshot = (await readFile(`${root}store/screenshot-1280x800.png`)).toString('base64');
  await marquee.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#153f32;color:#fff;font:18px Arial,sans-serif;display:grid;grid-template-columns:430px 1fr;align-items:center;gap:42px;padding:42px;height:560px}
    .brand{font-size:21px;font-weight:600;color:#c6e0cf;margin-bottom:32px}h1{font-size:56px;line-height:1.03;letter-spacing:-2px;margin:0 0 24px}p{font-size:19px;line-height:1.5;color:#c6e0cf;max-width:350px}.badge{display:inline-block;border:1px solid #6d9c83;border-radius:24px;padding:9px 14px;font-size:14px}
    .frame{width:100%;max-width:720px;justify-self:end;background:#edf3ed;border:1px solid #8cac98;border-radius:12px;overflow:hidden;box-shadow:0 16px 35px #081d2440}.bar{height:28px;display:flex;align-items:center;padding:0 12px;gap:6px}.bar i{width:7px;height:7px;border-radius:50%;background:#a2b6a8}.bar span{font-size:10px;color:#597261;margin:auto}.frame img{display:block;width:100%;height:auto}
  </style></head><body><div><div class="brand">{≠} &nbsp; Code Compare Local</div><h1>See the change.<br>Keep control.</h1><p>Compare code side by side.<br>Edit, check syntax, and save.</p><span class="badge">On your device. No account or AI.</span></div><div class="frame"><div class="bar"><i></i><i></i><i></i><span>Code Compare Local</span></div><img src="data:image/png;base64,${screenshot}" alt="Actual comparison interface"></div></body></html>`);
  await marquee.locator('img').evaluate(img => img.decode());
  await marquee.screenshot({ path: `${root}store/promo-1400x560.png` });

  // Complete the existing vector icon set; preserve the accepted 16/48/128 files.
  const icon = await browser.newPage({ deviceScaleFactor: 1 });
  const svg = await readFile(`${root}icons/icon.svg`, 'utf8');
  for (const size of [32, 64]) {
    await icon.setViewportSize({ width: size, height: size });
    await icon.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await icon.screenshot({ path: `${root}icons/icon${size}.png`, omitBackground: true });
  }
  console.log(`Created three ${manifest.version} screenshots, two promos and missing 32/64 icons`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

import assert from 'node:assert/strict';

export async function checkClockIndependentComparison({ page, open, download }) {
  const a = Array.from({ length: 120 }, (_, i) => `const value_${i} = ${i};`).join('\n');
  const b = Array.from({ length: 120 }, (_, i) => `const value_${i} = ${i + 100};`).join('\n');
  const run = async jumpingClock => {
    await page.locator('#clear').click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('diff-count').textContent === 'Add two texts');
    if (jumpingClock) await page.evaluate(() => {
      window.__originalNowForTest = Date.now;
      let tick = Date.now();
      Date.now = () => (tick += 1000);
    });
    try {
      await open('a', a, 'clock-a.js');
      await open('b', b, 'clock-b.js');
      await page.waitForFunction(() => document.getElementById('diff-count').textContent.includes('1 change block'));
      const view = await page.evaluate(() => ({
        count: document.getElementById('diff-count').textContent,
        cards: [...document.querySelectorAll('#changes-list .change-jump')].map(el => el.textContent),
      }));
      assert.equal((await download()).bytes.toString(), b, 'comparison must not alter B');
      await page.locator('#use-current').click();
      await page.waitForFunction(() => document.getElementById('diff-count').textContent === 'Versions match');
      assert.equal((await download()).bytes.toString(), a, 'clock changes cannot corrupt the transferred result');
      return view;
    } finally {
      if (jumpingClock) await page.evaluate(() => {
        Date.now = window.__originalNowForTest;
        delete window.__originalNowForTest;
      });
    }
  };
  const normal = await run(false);
  assert.doesNotMatch(normal.count, /grouped/, 'fixture must exercise detailed comparison');
  assert.deepEqual(await run(true), normal, 'visible comparison must not depend on a rapidly advancing clock');
}

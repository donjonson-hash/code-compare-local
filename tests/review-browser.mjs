import assert from 'node:assert/strict';

export async function checkFocusedReview({ page, open, download, output }) {
  const lines = Array.from({ length: 160 }, (_, i) => `value_${i + 1} = ${i + 1}`);
  const a = lines.join('\n') + '\n';
  const b = a.replace('value_40 = 40', 'value_40 = 400').replace('value_120 = 120', 'value_120 = 1200');
  await open('a', a, 'focus.py'); await open('b', b, 'focus.py');
  await page.locator('#changes-only').check();
  await page.locator('.cm-collapsedLines').first().waitFor();
  assert.ok(await page.locator('.cm-collapsedLines').count() >= 4, 'both panes collapse distant unchanged sections');
  assert.equal((await download()).bytes.toString(), b, 'folding is display-only');
  await page.locator('#changes-list .change-jump').nth(1).click();
  await page.waitForFunction(() => {
    const viewport = document.querySelector('.cm-mergeView').getBoundingClientRect();
    return [...document.querySelectorAll('.cm-merge-b .cm-line')].some(line => {
      const r = line.getBoundingClientRect();
      return line.textContent.includes('value_120 = 1200') && r.top >= viewport.top && r.bottom <= viewport.bottom;
    });
  });
  const count = await page.locator('.cm-collapsedLines').count();
  const metaA = await page.locator('#meta-a').innerText();
  const metaB = await page.locator('#meta-b').innerText();
  const widget = page.locator('.cm-merge-a .cm-collapsedLines').first();
  await widget.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(n => document.querySelectorAll('.cm-collapsedLines').length < n, count);
  assert.equal(await page.locator('#meta-a').innerText(), metaA, 'keyboard expansion cannot type into A');
  assert.equal(await page.locator('#meta-b').innerText(), metaB, 'keyboard expansion cannot type into B');
  assert.equal(await page.locator('#changes-list .change-item').count(), 2);
  await page.locator('#changes-only').uncheck();
  assert.equal(await page.locator('.cm-collapsedLines').count(), 0);
  assert.equal((await download()).bytes.toString(), b);

  // A shared error can be hidden because it is identical in both versions.
  const invalid = a.replace('value_80 = 80', 'value_80 = (');
  await open('a', invalid, 'shared.py'); await open('b', invalid, 'shared.py');
  await page.waitForFunction(() => document.getElementById('syntax-b').dataset.state === 'error');
  await page.locator('#changes-only').check();
  await page.locator('.cm-collapsedLines').first().waitFor();
  await page.locator('#syntax-list-b button').first().click();
  assert.equal(await page.locator('#changes-only').isChecked(), false);
  assert.equal(await page.locator('.cm-collapsedLines').count(), 0);

  const spacesA = 'def task():\n\treturn "a b"\n';
  const spacesB = 'def task():\n    return "a  b"\n';
  await open('a', spacesA, 'spaces.py'); await open('b', spacesB, 'spaces.py');
  await page.waitForFunction(() => document.getElementById('changes-list').textContent.includes('Spaces / tabs changed'));
  await page.locator('#show-whitespace').check();
  await page.locator('.cm-highlightTab').first().waitFor();
  await page.locator('.cm-highlightSpace').first().waitFor();
  assert.equal((await download()).bytes.toString(), spacesB, 'displaying whitespace preserves file bytes');
  await page.locator('#show-whitespace').uncheck();
  assert.equal(await page.locator('.cm-highlightTab').count(), 0);
  assert.equal(await page.locator('.cm-highlightSpace').count(), 0);

  const reviewA = lines.slice(0, 50).join('\n') + '\n';
  const reviewB = reviewA.replace('value_8 = 8', 'value_8 = 800').replace('value_25 = 25', 'value_25 = 2500').replace('value_42 = 42', 'value_42 = 4200');
  await open('a', reviewA, 'review.py'); await open('b', reviewB, 'review.py');
  const progress = async (done, total) => page.waitForFunction(({ done, total }) => {
    const text = document.getElementById('review-progress').textContent;
    return new RegExp(`Reviewed\\s+${done}\\s*[/]\\s*${total}`).test(text);
  }, { done, total });
  await progress(0, 3);
  await page.locator('#changes-list .change-jump').first().click();
  await page.locator('#keep-current').click();
  await progress(1, 3);
  assert.equal(await page.locator('#changes-list .is-reviewed').count(), 1);
  assert.match(await page.locator('#changes-list .is-active .change-lines').innerText(), /^A: line 25(?:, column \d+)? · B: line 25$/);
  assert.equal((await download()).bytes.toString(), reviewB, 'Keep B changes only review status');
  await page.locator('#use-current').click();
  await progress(2, 3);
  assert.equal(await page.locator('#changes-list .change-item').count(), 2);
  await page.locator('#undo').click();
  await progress(1, 3);
  assert.equal((await download()).bytes.toString(), reviewB);
  await page.locator('#redo').click();
  await progress(2, 3);
  await page.locator('#changes-list .change-item:not(.is-reviewed) .change-jump').click();
  await page.locator('#use-current').click();
  await progress(3, 3);
  assert.equal((await download()).bytes.toString(), reviewA.replace('value_8 = 8','value_8 = 800'));
  await page.locator('#changes-only').check();
  await page.locator('#show-whitespace').check();
  await page.locator('#toast').waitFor({ state: 'hidden' });
  await page.screenshot({ path: `${output}/review-completed.png`, fullPage: true });
  // Editing reviewed code cannot retain an obsolete approval.
  await page.locator('#changes-only').uncheck();
  await page.getByRole('textbox', { name: 'Code B', exact: true }).click();
  await page.keyboard.press('Control+End'); await page.keyboard.insertText('# changed after review\n');
  await progress(0, 2);
  assert.equal(await page.locator('#changes-list .is-reviewed').count(), 0);
  await page.locator('#show-whitespace').uncheck();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise browser lifecycle events, including unpacked-extension reloads.
// Only a new installation should interrupt the user with a welcome tab.
test('welcome opens on install only; updates stay quiet and toolbar opens the editor', async () => {
  let installed, clicked;
  const opened = [];
  const chrome = {
    action: { onClicked: { addListener(callback) { clicked = callback; } } },
    runtime: {
      getURL: name => `chrome-extension://test/${name}`,
      onInstalled: { addListener(callback) { installed = callback; } },
    },
    tabs: { create(options) { opened.push(options.url); } },
  };
  vm.runInNewContext(await readFile(new URL('../background.js', import.meta.url), 'utf8'), { chrome });
  for (const reason of ['update', 'chrome_update', 'shared_module_update']) installed({ reason });
  assert.deepEqual(opened, []);
  installed({ reason: 'install' });
  assert.deepEqual(opened, ['chrome-extension://test/welcome.html']);
  clicked();
  assert.deepEqual(opened, ['chrome-extension://test/welcome.html', 'chrome-extension://test/app.html']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';

test('MV3 package references existing files and requests no site permissions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3);
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  for (const path of [manifest.background.service_worker, ...Object.values(manifest.icons), 'app.html', 'welcome.html', 'welcome.css', 'app.js', 'syntax-worker.js', 'styles.css', 'THIRD-PARTY-NOTICES.txt'])
    await access(new URL(`../${path}`, import.meta.url));
});

test('extension action opens its packaged editor without site access', async () => {
  let clicked, opened;
  const chrome = {
    action: { onClicked: { addListener(callback) { clicked = callback; } } },
    runtime: { getURL: name => `chrome-extension://test/${name}`, onInstalled: { addListener() {} } },
    tabs: { create(options) { opened = options.url; } }
  };
  vm.runInNewContext(await readFile(new URL('../background.js', import.meta.url), 'utf8'), { chrome });
  clicked();
  assert.equal(opened, 'chrome-extension://test/app.html');
});

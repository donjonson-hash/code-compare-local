import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// A bad locale or unresolved message can prevent Chrome from installing the ZIP.
test('localized manifest resolves all fields within Chrome metadata limits', async () => {
  const root = new URL('../', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  const names = (await readdir(new URL('_locales/', root))).sort();
  const expected = ['en','de','fr','es','es_419','it','nl','sv','da','no','fi','ar','id','ru','pt_BR','pt_PT','ja','fil','vi','tr','th','ko'].sort();
  assert.deepEqual(names, expected);
  const references = [manifest.name, manifest.description, manifest.action.default_title].map(value => {
    const match = /^__MSG_(\w+)__$/.exec(value);
    assert.ok(match, `expected a localized manifest field: ${value}`);
    return match[1];
  });
  for (const locale of names) {
    const messages = JSON.parse(await readFile(new URL(`_locales/${locale}/messages.json`, root), 'utf8'));
    for (const key of references) {
      assert.equal(typeof messages[key]?.message, 'string', `${locale}: missing ${key}`);
      assert.ok(messages[key].message.trim(), `${locale}: empty ${key}`);
      assert.ok(!messages[key].message.includes('__MSG_'), `${locale}: unresolved placeholder`);
    }
    assert.ok(messages.extensionName.message.length <= 75, `${locale}: name too long`);
    assert.ok(messages.extensionDescription.message.length <= 132, `${locale}: description too long`);
  }
});

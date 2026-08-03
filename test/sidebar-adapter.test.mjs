import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const asset of ['AppSidebar-D4gkYkoF.js', 'AppSidebar-legacy-DbJ0tmeN.js']) {
  test(`${asset} exposes the recycle-bin shortcut before Templates`, async () => {
    const source = await readFile(new URL(`../app/public/assets/${asset}`, import.meta.url), 'utf8');
    const shortcut = source.indexOf('id:`recycle-bin`') >= 0
      ? 'id:`recycle-bin`'
      : 'id:"recycle-bin"';
    const templates = source.indexOf('generic.templates');
    assert.notEqual(source.indexOf(shortcut), -1);
    assert.notEqual(templates, -1);
    assert.ok(source.indexOf(shortcut) < templates);
    assert.match(source, /trash-2/);
    assert.match(source, /Workflow Recycle Bin/);
    if (asset.includes('legacy')) {
      assert.match(source, /available:!0,link:\{href:[`\"]https:\/\/automation\.databuilder\.ninja\/recycle-bin\/[`\"]\}/);
    } else {
      assert.match(source, /available:!0,route:\{to:\{name:[`\"]recycle-bin[`\"]\}\}/);
    }
    assert.match(source, /Workflow Recycle Bin/);
  });
}

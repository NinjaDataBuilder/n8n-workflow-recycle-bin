import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const generator = new URL('../scripts/generate-n8n-2445-adapter.mjs', import.meta.url);

test('exact 2.44.5 app adapter renders the same root base-path placeholders as n8n HTTP serving', async () => {
  const { renderRootBasePath } = await import(generator.href);
  assert.equal(typeof renderRootBasePath, 'function');
  const encoded = '/%7B%7BBASE_PATH%7D%7D/';
  const raw = '/{{BASE_PATH}}/';
  const synthetic = Array(5).fill(encoded + 'assets/chunk.js').join('\n') + '\n' + raw + '\nwindow.BASE_PATH';
  const rendered = renderRootBasePath(synthetic);
  assert.equal(rendered, Array(5).fill('/assets/chunk.js').join('\n') + '\n/\nwindow.BASE_PATH');
  assert.doesNotMatch(rendered, /%7B%7BBASE_PATH%7D%7D|\{\{BASE_PATH\}\}/);
  assert.throws(() => renderRootBasePath('unknown upstream shape'), /base.path/i);
  assert.throws(() => renderRootBasePath(encoded + raw), /base.path/i);
});

test('sidecar explicitly allow-lists each new exact 2.44.5 asset without broad file serving', async () => {
  const source = await readFile(new URL('../src/http-server.mjs', import.meta.url), 'utf8');
  for (const name of ['app-0aL7xNtl.js', 'AppSidebar-DqEHFut7.js', 'WorkflowsView-DXcBW1OL.js', 'RecycleBinEmbeddedView-n8n-2.44.5.js']) {
    assert.ok(source.includes("'/assets/" + name + "': ['assets/" + name + "'"), 'Missing explicit asset map: ' + name);
  }
});

test('exact 2.44.5 adapter patches only current asset anchors and rejects unknown shapes', async () => {
  assert.ok(existsSync(generator), 'The exact 2.44.5 adapter generator is required');
  const { patchApp, patchSidebar, patchWorkflows, NATIVE_ASSETS, EMBEDDED_VIEW } = await import(generator.href);
  assert.deepEqual(Object.keys(NATIVE_ASSETS), ['app-0aL7xNtl.js', 'AppSidebar-DqEHFut7.js', 'WorkflowsView-DXcBW1OL.js', 'vendor-COD0pq0C.js']);
  // Synthetic source slices test patch semantics; strict real-asset hashes are a separate build gate.
  const app = patchApp('prefix,{path:`/entity-not-found/:entityType(credential|workflow)`,rest},catchAll');
  assert.ok(app.indexOf('path:`/home/recycle-bin`') < app.indexOf('path:`/entity-not-found'));
  assert.match(app, /middleware:\[`authenticated`\]/);
  assert.match(app, /RecycleBinEmbeddedView-n8n-2\.44\.5\.js/);
  const sidebar = patchSidebar('prefix,{id:`templates`,rest},{id:`templates`,rest}');
  assert.equal((sidebar.match(/id:`recycle-bin`/g) ?? []).length, 1);
  assert.ok(sidebar.indexOf('id:`recycle-bin`') < sidebar.indexOf('id:`templates`'));
  const workflows = patchWorkflows('label:x.baseText(`workflows.item.archive`),value:i.ARCHIVE,divided:!0');
  assert.match(workflows, /label:`Move to Recycle Bin`,value:i\.ARCHIVE,divided:!0/);
  assert.match(EMBEDDED_VIEW, /import \{ qd as h \} from '\.\/vendor-COD0pq0C\.js'/);
  assert.match(EMBEDDED_VIEW, /return h\('iframe'/);
  for (const patch of [patchApp, patchSidebar, patchWorkflows]) assert.throws(() => patch('unknown bundle'), /anchor/);
});

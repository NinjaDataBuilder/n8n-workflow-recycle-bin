import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const htmlPath = new URL('../app/public/index.html', import.meta.url);

test('restore UI uses the native authenticated n8n unarchive route', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /method: 'POST'/);
  assert.match(html, /\/rest\/workflows\/\$\{encodeURIComponent\(item\.workflowId\)\}\/unarchive/);
  assert.match(html, /'browser-id': browserIdentity\(\)/);
  assert.match(html, /'push-ref': pushRef\(\)/);
  assert.doesNotMatch(html, /X-N8N-API-KEY|Bearer /);
});

test('permanent delete requires literal confirmation and stays server-mediated', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /permanentDelete\.disabled = !item\.canDelete/);
  assert.match(html, /confirmationText !== 'DELETAR'/);
  assert.match(html, /fetch\(`api\/recycle-bin\/\$\{encodeURIComponent\(item\.workflowId\)\}\/permanent-delete/);
  assert.doesNotMatch(html, /fetch\(`\/api\/recycle-bin\/\$\{encodeURIComponent\(item\.workflowId\)\}\/permanent-delete/);
  assert.doesNotMatch(html, /method: 'DELETE'/);
  assert.doesNotMatch(html, /X-N8N-API-KEY|Bearer /);
});

test('enabled buttons have a purple hover and keyboard focus ring without styling disabled hover', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /button:hover:not\(:disabled\).*border-color:#9c6ade.*box-shadow:/);
  assert.match(html, /button:focus-visible:not\(:disabled\).*outline:2px solid rgba\(156,106,222,/);
  assert.doesNotMatch(html, /button:hover\{[^}]*border-color:#9c6ade/);
});

test('search UI creates removable comma-delimited tags and uses the n8n page title', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /<title>Workflow Recycle Bin - n8n<\/title>/);
  assert.match(html, /\.title img\{width:40px;height:40px\}/);
  assert.match(html, /id="search-tags"/);
  assert.match(html, /id="refresh"[^>]*aria-label="Refresh list"/);
  assert.match(html, /Refresh/);
  assert.match(html, /class="search-icon"[^>]*aria-hidden="true"/);
  assert.match(html, /placeholder="Search: use commas to create filters"/);
  assert.match(html, /import \{ getRetentionDisplay \} from '\.\/assets\/retention-display\.mjs\?v=1'/);
  assert.match(html, /getRetentionDisplay\(item\)/);
  assert.match(html, /display\.label/);
  assert.match(html, /retention-fill/);
  assert.match(html, /setInterval\(\(\) => \{ if \(!loading && items\.length > 0\) render\(\); \}, 60000\)/);
  assert.match(html, /permanentDelete\.disabled = !item\.canDelete/);
  assert.match(html, /confirmationText !== 'DELETAR'/);
  assert.match(html, /appendSearchTerm/);
  assert.match(html, /consumeDelimitedInput/);
  assert.match(html, /event\.key === ',' \|\| event\.key === 'Enter'/);
  assert.match(html, /event\.key === 'Backspace'/);
  assert.match(html, /Remove filter/);
});

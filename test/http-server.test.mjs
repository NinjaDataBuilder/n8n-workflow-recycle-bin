import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditStore } from '../src/audit-store.mjs';
import { createRecycleBinServer } from '../src/http-server.mjs';

const browserHeaders = {
  cookie: 'n8n-auth=valid-session',
  'browser-id': 'browser-identity-123',
};

function fakeSessionBridge(visible = [], onDelete = () => {}) {
  function authorize(request) {
    if (request.headers.cookie !== browserHeaders.cookie || request.headers['browser-id'] !== browserHeaders['browser-id']) {
      const error = new Error('Authentication required'); error.status = 401; throw error;
    }
  }
  return {
    async authenticateBrowserRequest(request) { authorize(request); return { id: 'user-1' }; },
    async listArchivedWorkflows(request) { authorize(request); return visible; },
    async permanentlyDeleteWorkflow(request, workflowId) { authorize(request); return onDelete(request, workflowId); },
  };
}

async function service(visible = [], onDelete) {
  const directory = await mkdtemp(join(tmpdir(), 'recycle-http-'));
  const store = createAuditStore(join(directory, 'audit.json'));
  const server = createRecycleBinServer({ store, hookToken: 'local-hook-secret', sessionBridge: fakeSessionBridge(visible, onDelete) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { base: `http://127.0.0.1:${port}`, store, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('exposes health and protects browser and hook endpoints', async (t) => {
  const app = await service(); t.after(app.close);
  assert.deepEqual(await (await fetch(`${app.base}/health`)).json(), { status: 'ok' });
  const page = await fetch(`${app.base}/`);
  assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
  const pageHtml = await page.text();
  assert.match(pageHtml, /Workflow Recycle Bin/);
  assert.match(pageHtml, /workflow-search\.mjs/);
  const searchModule = await fetch(`${app.base}/assets/workflow-search.mjs`);
  assert.equal(searchModule.status, 200);
  assert.equal(searchModule.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.match(await searchModule.text(), /filterWorkflowItems/);
  const retentionModule = await fetch(`${app.base}/assets/retention-display.mjs`);
  assert.equal(retentionModule.status, 200);
  assert.equal(retentionModule.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.match(await retentionModule.text(), /Retention paused/);
  for (const asset of ['WorkflowsView-NnKQLkxf.js', 'WorkflowsView-legacy-jnvFs9qm.js']) {
    const adapter = await fetch(`${app.base}/assets/${asset}`);
    assert.equal(adapter.status, 200);
    assert.equal(adapter.headers.get('content-type'), 'text/javascript; charset=utf-8');
    const source = await adapter.text();
    assert.match(source, /label:["`]Move to Recycle Bin["`]/);
    assert.doesNotMatch(source, /baseText\(["`]Move to Recycle Bin["`]\)/);
    assert.match(source, /archiveWorkflow/);
  }
  assert.equal((await fetch(`${app.base}/api/recycle-bin`)).status, 401);
  assert.equal((await fetch(`${app.base}/internal/archive`, { method: 'POST' })).status, 401);
});

test('lists only n8n-visible archived workflows and enriches authoritative retention data', async (t) => {
  const app = await service([
    { workflowId: 'wf-visible', workflowName: 'Visible workflow', isArchived: true, scopes: ['workflow:read', 'workflow:delete'], project: 'Personal' },
  ]); t.after(app.close);

  for (const input of [
    { workflowId: 'wf-visible', workflowName: 'Visible workflow', actor: 'user-1', archivedAt: '2026-07-01T00:00:00.000Z' },
    { workflowId: 'wf-hidden', workflowName: 'Hidden workflow', actor: 'user-2', archivedAt: '2026-07-01T00:00:00.000Z' },
  ]) {
    const created = await fetch(`${app.base}/internal/archive`, {
      method: 'POST',
      headers: { authorization: 'Bearer local-hook-secret', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    assert.equal(created.status, 201);
  }

  const listed = await fetch(`${app.base}/api/recycle-bin`, { headers: browserHeaders });
  assert.equal(listed.status, 200);
  assert.equal(listed.headers.get('cache-control'), 'no-store');
  const payload = await listed.json();
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].workflowId, 'wf-visible');
  assert.equal(payload.items[0].retentionEligible, true);
  assert.equal(payload.items[0].canDelete, true);
});

test('visible workflow without authoritative archive event is not retention eligible', async (t) => {
  const app = await service([
    { workflowId: 'wf-discovered', workflowName: 'Discovered archive', isArchived: true, scopes: ['workflow:read'], project: null },
  ]); t.after(app.close);
  const response = await fetch(`${app.base}/api/recycle-bin`, { headers: browserHeaders });
  const item = (await response.json()).items[0];
  assert.equal(item.archivedAt, null);
  assert.equal(item.purgeAt, null);
  assert.equal(item.retentionEligible, false);
  assert.equal(item.canDelete, false);
});

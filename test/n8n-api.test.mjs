import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowRequest, invokeWorkflowLifecycle } from '../src/n8n-api.mjs';

const config = { baseUrl: 'https://n8n.example.test/', apiKey: 'secret-kept-local', workflowId: 'Abc_123-xyz' };

test('builds only the official 2.32 archive route', () => {
  const request = buildWorkflowRequest({ ...config, operation: 'archive' });
  assert.equal(request.url, 'https://n8n.example.test/api/v1/workflows/Abc_123-xyz/archive');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers['X-N8N-API-KEY'], 'secret-kept-local');
});

test('builds only the official 2.32 unarchive and delete routes', () => {
  assert.equal(buildWorkflowRequest({ ...config, operation: 'unarchive' }).url, 'https://n8n.example.test/api/v1/workflows/Abc_123-xyz/unarchive');
  const deletion = buildWorkflowRequest({ ...config, operation: 'permanentDelete' });
  assert.equal(deletion.url, 'https://n8n.example.test/api/v1/workflows/Abc_123-xyz');
  assert.equal(deletion.init.method, 'DELETE');
});

test('rejects arbitrary routes and unsafe workflow identifiers', () => {
  assert.throws(() => buildWorkflowRequest({ ...config, operation: 'GET /users' }), /Unsupported/);
  assert.throws(() => buildWorkflowRequest({ ...config, workflowId: '../other', operation: 'archive' }), /unsupported characters/);
});

test('returns a successful API response but surfaces failures safely', async () => {
  const fetchOk = async () => ({ ok: true, json: async () => ({ id: 'Abc_123-xyz', isArchived: true }) });
  assert.deepEqual(await invokeWorkflowLifecycle(fetchOk, { ...config, operation: 'archive' }), { id: 'Abc_123-xyz', isArchived: true });
  const fetchError = async () => ({ ok: false, status: 403, json: async () => ({ message: 'Forbidden' }) });
  await assert.rejects(() => invokeWorkflowLifecycle(fetchError, { ...config, operation: 'permanentDelete' }), /Forbidden/);
});

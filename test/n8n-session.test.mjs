import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserAuthError, createN8nSessionBridge } from '../src/n8n-session.mjs';

const request = {
  headers: {
    cookie: 'theme=dark; n8n-auth=jwt-value; unrelated=private',
    'browser-id': 'browser-identity-123',
  },
};

test('session introspection forwards only the n8n auth cookie and browser identity', async () => {
  let captured;
  const bridge = createN8nSessionBridge({
    baseUrl: 'http://n8n-editor:5678',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ data: { id: 'user-1', role: 'global:owner', globalScopes: ['workflow:list'] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const user = await bridge.authenticateBrowserRequest(request);
  assert.equal(user.id, 'user-1');
  assert.equal(captured.url, 'http://n8n-editor:5678/rest/login');
  assert.equal(captured.init.headers.cookie, 'n8n-auth=jwt-value');
  assert.equal(captured.init.headers['browser-id'], 'browser-identity-123');
  assert.doesNotMatch(captured.init.headers.cookie, /theme|unrelated|private/);
});

test('archived workflow list is allow-listed, sanitized, and excludes active records', async () => {
  let capturedUrl;
  const bridge = createN8nSessionBridge({
    baseUrl: 'http://n8n-editor:5678',
    fetchImpl: async (url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({
        data: [
          { id: 'wf-1', name: 'Archived', isArchived: true, scopes: ['workflow:read'], homeProject: { name: 'Personal' }, nodes: [{ credentials: { secret: true } }] },
          { id: 'wf-2', name: 'Active', isArchived: false, scopes: ['workflow:read'] },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });

  const workflows = await bridge.listArchivedWorkflows(request);
  assert.equal(workflows.length, 1);
  assert.deepEqual(workflows[0], {
    workflowId: 'wf-1', workflowName: 'Archived', isArchived: true, scopes: ['workflow:read'], project: 'Personal',
  });
  assert.match(capturedUrl, /^http:\/\/n8n-editor:5678\/rest\/workflows\?/);
  assert.doesNotMatch(JSON.stringify(workflows), /credentials|secret|nodes/);
});

test('missing browser binding and rejected n8n sessions fail closed', async () => {
  const bridge = createN8nSessionBridge({
    baseUrl: 'http://n8n-editor:5678',
    fetchImpl: async () => new Response('{}', { status: 401 }),
  });
  await assert.rejects(() => bridge.authenticateBrowserRequest({ headers: { cookie: 'n8n-auth=value' } }), BrowserAuthError);
  await assert.rejects(() => bridge.authenticateBrowserRequest(request), BrowserAuthError);
});

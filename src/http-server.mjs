import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { authorizePermanentDelete } from './policy.mjs';

const PUBLIC_DIR = fileURLToPath(new URL('../app/public/', import.meta.url));
const STATIC_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
});

async function staticAsset(pathname) {
  const files = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/assets/recycle-bin-trash.svg': ['assets/recycle-bin-trash.svg', 'image/svg+xml'],
    '/assets/workflow-search.mjs': ['assets/workflow-search.mjs', 'text/javascript; charset=utf-8'],
    '/assets/retention-display.mjs': ['assets/retention-display.mjs', 'text/javascript; charset=utf-8'],
    '/assets/AppSidebar-D4gkYkoF.js': ['assets/AppSidebar-D4gkYkoF.js', 'text/javascript; charset=utf-8'],
    '/assets/AppSidebar-legacy-DbJ0tmeN.js': ['assets/AppSidebar-legacy-DbJ0tmeN.js', 'text/javascript; charset=utf-8'],
    '/assets/router-BfHF4NzA.js': ['assets/router-BfHF4NzA.js', 'text/javascript; charset=utf-8'],
    '/assets/RecycleBinEmbeddedView-0.1.0.js': ['assets/RecycleBinEmbeddedView-0.1.0.js', 'text/javascript; charset=utf-8'],
    '/assets/WorkflowsView-NnKQLkxf.js': ['assets/WorkflowsView-NnKQLkxf.js', 'text/javascript; charset=utf-8'],
    '/assets/WorkflowsView-legacy-jnvFs9qm.js': ['assets/WorkflowsView-legacy-jnvFs9qm.js', 'text/javascript; charset=utf-8'],
  };
  const entry = files[pathname];
  return entry ? { content: await readFile(`${PUBLIC_DIR}${entry[0]}`), type: entry[1] } : null;
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 65_536) throw new Error('Request body too large');
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function respond(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function mergeVisibleWorkflows(visible, audited) {
  const byId = new Map(audited.map((item) => [item.workflowId, item]));
  return visible.map((workflow) => {
    const audit = byId.get(workflow.workflowId);
    return {
      ...workflow,
      actor: audit?.actor ?? null,
      archivedAt: audit?.archivedAt ?? null,
      purgeAt: audit?.purgeAt ?? null,
      retentionEligible: Boolean(audit?.archivedAt && audit?.purgeAt),
      canDelete: workflow.scopes.includes('workflow:delete'),
    };
  });
}

export function createRecycleBinServer({ store, hookToken, sessionBridge }) {
  if (!hookToken) throw new Error('hookToken is required');
  if (!sessionBridge?.authenticateBrowserRequest || !sessionBridge?.listArchivedWorkflows) {
    throw new Error('sessionBridge is required');
  }

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET') {
        const asset = await staticAsset(url.pathname);
        if (asset) {
          response.writeHead(200, { ...STATIC_HEADERS, 'content-type': asset.type });
          response.end(asset.content);
          return;
        }
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        return respond(response, 200, { status: 'ok' });
      }
      if (request.method === 'GET' && url.pathname === '/api/recycle-bin') {
        await sessionBridge.authenticateBrowserRequest(request);
        const [visible, audited] = await Promise.all([
          sessionBridge.listArchivedWorkflows(request),
          store.listArchived(),
        ]);
        return respond(response, 200, { items: mergeVisibleWorkflows(visible, audited) });
      }
      if (request.method === 'POST' && url.pathname.startsWith('/api/recycle-bin/') && url.pathname.endsWith('/permanent-delete')) {
        await sessionBridge.authenticateBrowserRequest(request);
        const match = url.pathname.match(/^\/api\/recycle-bin\/([A-Za-z0-9_-]+)\/permanent-delete$/);
        if (!match) {
          const error = new Error('Invalid workflow identifier'); error.status = 400; throw error;
        }
        const workflowId = match[1];
        const input = await body(request);
        const visible = await sessionBridge.listArchivedWorkflows(request);
        const workflow = visible.find((item) => item.workflowId === workflowId);
        if (!workflow) {
          const error = new Error('Archived workflow not found or not visible'); error.status = 404; throw error;
        }
        if (!workflow.scopes.includes('workflow:delete')) {
          const error = new Error('Workflow delete scope required'); error.status = 403; throw error;
        }
        const audit = (await store.listArchived()).find((item) => item.workflowId === workflowId);
        authorizePermanentDelete({
          ...workflow,
          id: workflow.workflowId,
          archivedAt: audit?.archivedAt ?? null,
        }, { mode: 'immediate', confirmationText: input.confirmationText });
        if (typeof sessionBridge.permanentlyDeleteWorkflow !== 'function') {
          const error = new Error('Permanent delete bridge is unavailable'); error.status = 503; throw error;
        }
        await sessionBridge.permanentlyDeleteWorkflow(request, workflowId);
        const auditItem = audit ? await store.markDeleted(workflowId) : null;
        return respond(response, 200, { deleted: true, workflowId, audit: auditItem });
      }
      if (request.method === 'POST' && url.pathname === '/internal/archive') {
        if (request.headers.authorization !== `Bearer ${hookToken}`) {
          return respond(response, 401, { error: 'Unauthorized' });
        }
        const input = await body(request);
        const item = await store.archive(input);
        return respond(response, 201, { item });
      }
      if (request.method === 'POST' && url.pathname === '/internal/restore') {
        if (request.headers.authorization !== `Bearer ${hookToken}`) {
          return respond(response, 401, { error: 'Unauthorized' });
        }
        const input = await body(request);
        const item = await store.restore(input.workflowId, input.restoredAt);
        return respond(response, 200, { item });
      }
      return respond(response, 404, { error: 'Not found' });
    } catch (error) {
      const status = [400, 401, 403, 404, 503].includes(error?.status) ? error.status : 400;
      const message = status === 401 ? 'Authentication required' : error.message;
      return respond(response, status, { error: message });
    }
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
const hookPath = new URL('../hooks/workflow-recycle-bin.cjs', import.meta.url).pathname;

async function withHookServer(run) {
  const calls = [];
  const server = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    calls.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(raw) });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previousBase = process.env.N8N_RECYCLE_BIN_SERVICE_URL;
  const previousToken = process.env.N8N_RECYCLE_BIN_HOOK_TOKEN;
  process.env.N8N_RECYCLE_BIN_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.N8N_RECYCLE_BIN_HOOK_TOKEN = 'test-hook-token';
  delete require.cache[hookPath];
  try {
    await run(require(hookPath), calls);
  } finally {
    delete require.cache[hookPath];
    if (previousBase === undefined) delete process.env.N8N_RECYCLE_BIN_SERVICE_URL;
    else process.env.N8N_RECYCLE_BIN_SERVICE_URL = previousBase;
    if (previousToken === undefined) delete process.env.N8N_RECYCLE_BIN_HOOK_TOKEN;
    else process.env.N8N_RECYCLE_BIN_HOOK_TOKEN = previousToken;
    await new Promise((resolve) => server.close(resolve));
  }
}

test('afterArchive and afterUnarchive notify only the internal authenticated endpoints', async () => {
  await withHookServer(async (hooks, calls) => {
    await hooks.workflow.afterArchive[0]('wf-archive');
    await hooks.workflow.afterUnarchive[0]('wf-restore');
    assert.deepEqual(calls, [
      {
        path: '/internal/archive', authorization: 'Bearer test-hook-token',
        body: { workflowId: 'wf-archive', workflowName: 'Workflow wf-archive', actor: 'n8n external hook' },
      },
      {
        path: '/internal/restore', authorization: 'Bearer test-hook-token',
        body: { workflowId: 'wf-restore' },
      },
    ]);
  });
});

test('hook refuses to load without its isolated configuration', () => {
  const previousBase = process.env.N8N_RECYCLE_BIN_SERVICE_URL;
  const previousToken = process.env.N8N_RECYCLE_BIN_HOOK_TOKEN;
  delete process.env.N8N_RECYCLE_BIN_SERVICE_URL;
  delete process.env.N8N_RECYCLE_BIN_HOOK_TOKEN;
  delete require.cache[hookPath];
  try {
    assert.throws(() => require(hookPath), /configuration is incomplete/);
  } finally {
    delete require.cache[hookPath];
    if (previousBase === undefined) delete process.env.N8N_RECYCLE_BIN_SERVICE_URL;
    else process.env.N8N_RECYCLE_BIN_SERVICE_URL = previousBase;
    if (previousToken === undefined) delete process.env.N8N_RECYCLE_BIN_HOOK_TOKEN;
    else process.env.N8N_RECYCLE_BIN_HOOK_TOKEN = previousToken;
  }
});

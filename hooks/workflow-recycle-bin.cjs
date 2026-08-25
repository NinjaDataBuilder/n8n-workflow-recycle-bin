// n8n 2.36.7 External Hooks adapter; compatibility is version-gated. Installed only by the version-aware bundle.
// Secrets are read from local environment/secret files, never workflow data.
const base = process.env.N8N_RECYCLE_BIN_SERVICE_URL;
const token = process.env.N8N_RECYCLE_BIN_HOOK_TOKEN;
if (!base || !token) throw new Error('Recycle Bin hook configuration is incomplete');

async function notify(path, payload) {
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Recycle Bin hook endpoint failed: HTTP ${response.status}`);
}

module.exports = {
  workflow: {
    afterArchive: [async function afterArchive(workflowId) {
      // The hook event contains an ID. Name and actor enrichment are deliberately deferred to the service/API adapter.
      await notify('/internal/archive', { workflowId, workflowName: `Workflow ${workflowId}`, actor: 'n8n external hook' });
    }],
    afterUnarchive: [async function afterUnarchive(workflowId) {
      await notify('/internal/restore', { workflowId });
    }],
  },
};

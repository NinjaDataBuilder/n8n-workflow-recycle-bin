const BASE_PATH = '/api/v1/workflows';

function validateBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('n8n base URL must use HTTP(S)');
  return url.toString().replace(/\/$/, '');
}

function validateWorkflowId(workflowId) {
  const value = String(workflowId ?? '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('workflowId contains unsupported characters');
  return value;
}

export function buildWorkflowRequest({ baseUrl, apiKey, workflowId, operation }) {
  if (!apiKey || typeof apiKey !== 'string') throw new Error('n8n API key is required');
  const id = validateWorkflowId(workflowId);
  const root = validateBaseUrl(baseUrl);
  const operations = Object.freeze({
    archive: { method: 'POST', suffix: '/archive' },
    unarchive: { method: 'POST', suffix: '/unarchive' },
    permanentDelete: { method: 'DELETE', suffix: '' },
  });
  const selected = operations[operation];
  if (!selected) throw new Error('Unsupported recycle-bin operation');

  return Object.freeze({
    url: `${root}${BASE_PATH}/${encodeURIComponent(id)}${selected.suffix}`,
    init: Object.freeze({
      method: selected.method,
      headers: Object.freeze({
        Accept: 'application/json',
        'X-N8N-API-KEY': apiKey,
      }),
    }),
  });
}

export async function invokeWorkflowLifecycle(fetchImpl, input) {
  const request = buildWorkflowRequest(input);
  const response = await fetchImpl(request.url, request.init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.message === 'string' ? body.message : `HTTP ${response.status}`;
    throw new Error(`n8n workflow lifecycle operation failed: ${detail}`);
  }
  return body;
}

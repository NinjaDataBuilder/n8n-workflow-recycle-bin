const AUTH_COOKIE_NAME = 'n8n-auth';
const BROWSER_ID_HEADER = 'browser-id';

export class BrowserAuthError extends Error {
  constructor(message = 'Authentication required', status = 401) {
    super(message);
    this.name = 'BrowserAuthError';
    this.status = status;
  }
}

function validateBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('n8n internal URL must use HTTP(S)');
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const entry of header.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    if (entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
  }
  return null;
}

function sessionHeaders(request) {
  const token = readCookie(request.headers.cookie, AUTH_COOKIE_NAME);
  if (!token || token.length > 8192) throw new BrowserAuthError();
  const browserId = request.headers[BROWSER_ID_HEADER];
  if (typeof browserId !== 'string' || !/^[A-Za-z0-9_-]{8,200}$/.test(browserId)) {
    throw new BrowserAuthError('Valid browser identity required');
  }
  return Object.freeze({
    accept: 'application/json',
    cookie: `${AUTH_COOKIE_NAME}=${token}`,
    [BROWSER_ID_HEADER]: browserId,
  });
}

function publicUser(payload) {
  const user = payload?.data ?? payload;
  if (!user || typeof user.id !== 'string') throw new BrowserAuthError();
  return Object.freeze({
    id: user.id,
    role: typeof user.role === 'string' ? user.role : null,
    globalScopes: Array.isArray(user.globalScopes)
      ? user.globalScopes.filter((scope) => typeof scope === 'string')
      : [],
  });
}

function workflowList(payload) {
  const candidate = Array.isArray(payload?.data?.data)
    ? payload.data.data
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  return candidate
    .filter((workflow) => workflow?.isArchived === true && typeof workflow.id === 'string')
    .map((workflow) => ({
      workflowId: workflow.id,
      workflowName: typeof workflow.name === 'string' ? workflow.name : 'Unnamed workflow',
      isArchived: true,
      scopes: Array.isArray(workflow.scopes)
        ? workflow.scopes.filter((scope) => typeof scope === 'string')
        : [],
      project: typeof workflow.homeProject?.name === 'string' ? workflow.homeProject.name : null,
    }));
}

export function createN8nSessionBridge({ baseUrl, fetchImpl = fetch }) {
  const root = validateBaseUrl(baseUrl);

  async function call(request, path, method = 'GET') {
    let response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers: sessionHeaders(request),
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      if (error instanceof BrowserAuthError) throw error;
      throw new BrowserAuthError('Authentication service unavailable', 503);
    }
    if (response.status === 401 || response.status === 403) throw new BrowserAuthError();
    if (!response.ok) throw new BrowserAuthError('n8n session bridge unavailable', 503);
    return await response.json().catch(() => null);
  }

  return Object.freeze({
    async authenticateBrowserRequest(request) {
      return publicUser(await call(request, '/rest/login'));
    },
    async listArchivedWorkflows(request) {
      const query = new URLSearchParams({
        includeScopes: 'true',
        filter: JSON.stringify({ isArchived: true }),
        take: '100',
      });
      return workflowList(await call(request, `/rest/workflows?${query}`));
    },
    async permanentlyDeleteWorkflow(request, workflowId) {
      const id = String(workflowId ?? '').trim();
      if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('workflowId contains unsupported characters');
      return call(request, `/rest/workflows/${encodeURIComponent(id)}`, 'DELETE');
    },
  });
}

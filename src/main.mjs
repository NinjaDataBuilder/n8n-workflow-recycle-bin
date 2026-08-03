import { createAuditStore } from './audit-store.mjs';
import { createRecycleBinServer } from './http-server.mjs';
import { createN8nSessionBridge } from './n8n-session.mjs';

const port = Number(process.env.PORT ?? 3000);
const storePath = process.env.RECYCLE_BIN_AUDIT_STORE_PATH ?? '/data/audit.json';
const n8nInternalUrl = process.env.N8N_INTERNAL_URL;
if (!n8nInternalUrl) throw new Error('N8N_INTERNAL_URL is required');

async function readRequiredSecret(name) {
  const directValue = process.env[name];
  if (directValue) return directValue;

  const filePath = process.env[`${name}_FILE`];
  if (!filePath) throw new Error(`${name} must be supplied via a local secret`);

  const { readFile } = await import('node:fs/promises');
  const value = (await readFile(filePath, 'utf8')).trim();
  if (!value) throw new Error(`${name}_FILE must contain a non-empty secret`);
  return value;
}

const hookToken = await readRequiredSecret('N8N_RECYCLE_BIN_HOOK_TOKEN');
const sessionBridge = createN8nSessionBridge({ baseUrl: n8nInternalUrl });

const server = createRecycleBinServer({
  store: createAuditStore(storePath),
  hookToken,
  sessionBridge,
});
server.listen(port, '0.0.0.0', () => console.log(`Workflow Recycle Bin listening on ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

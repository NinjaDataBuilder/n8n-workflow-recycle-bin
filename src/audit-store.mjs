import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { calculatePurgeAt, DEFAULT_RETENTION_DAYS } from './policy.mjs';

const EMPTY = Object.freeze({ version: 1, items: [] });

async function readState(path) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) throw new Error('invalid audit store schema');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return structuredClone(EMPTY);
    throw error;
  }
}

async function writeState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export function createAuditStore(path, { retentionDays = DEFAULT_RETENTION_DAYS } = {}) {
  async function mutate(mutator) {
    const state = await readState(path);
    const output = await mutator(state);
    await writeState(path, state);
    return output;
  }

  return Object.freeze({
    async archive({ workflowId, workflowName, actor, archivedAt = new Date().toISOString() }) {
      if (!workflowId || !workflowName) throw new Error('workflowId and workflowName are required');
      return mutate((state) => {
        const existing = state.items.find((item) => item.workflowId === workflowId && item.status === 'archived');
        if (existing) return existing;
        const item = {
          workflowId, workflowName, actor: actor ?? 'unknown', archivedAt,
          purgeAt: calculatePurgeAt(archivedAt, retentionDays), status: 'archived', restoredAt: null, deletedAt: null,
        };
        state.items.push(item);
        return item;
      });
    },
    async restore(workflowId, restoredAt = new Date().toISOString()) {
      return mutate((state) => {
        const item = state.items.find((entry) => entry.workflowId === workflowId && entry.status === 'archived');
        if (!item) throw new Error('Archived workflow audit record not found');
        item.status = 'restored'; item.restoredAt = restoredAt;
        return item;
      });
    },
    async markDeleted(workflowId, deletedAt = new Date().toISOString()) {
      return mutate((state) => {
        const item = state.items.find((entry) => entry.workflowId === workflowId && entry.status === 'archived');
        if (!item) throw new Error('Archived workflow audit record not found');
        item.status = 'deleted'; item.deletedAt = deletedAt;
        return item;
      });
    },
    async listArchived() { return (await readState(path)).items.filter((item) => item.status === 'archived'); },
  });
}

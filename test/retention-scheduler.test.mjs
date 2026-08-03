import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditStore } from '../src/audit-store.mjs';
import { runRetentionSweep } from '../src/retention-scheduler.mjs';

async function setup() {
  const store = createAuditStore(join(await mkdtemp(join(tmpdir(), 'retention-')), 'audit.json'));
  await store.archive({ workflowId: 'due', workflowName: 'Due', archivedAt: '2026-06-01T00:00:00.000Z' });
  await store.archive({ workflowId: 'recent', workflowName: 'Recent', archivedAt: '2026-07-25T00:00:00.000Z' });
  return store;
}
test('dry-run reports only due workflows and never invokes delete', async () => {
  const store = await setup(); let calls = 0;
  const result = await runRetentionSweep({ store, now: '2026-07-31T00:00:00.000Z', deleteWorkflow: async () => calls++ });
  assert.deepEqual(result, { dryRun: true, scanned: 2, candidates: [{ workflowId: 'due', workflowName: 'Due', purgeAt: '2026-07-01T00:00:00.000Z' }], deleted: [] });
  assert.equal(calls, 0);
});
test('live mode deletes one due target at a time and marks audit state afterward', async () => {
  const store = await setup(); const calls = [];
  const result = await runRetentionSweep({ store, now: '2026-07-31T00:00:00.000Z', dryRun: false, deleteWorkflow: async (id) => calls.push(id) });
  assert.deepEqual(calls, ['due']); assert.deepEqual(result.deleted, ['due']); assert.equal((await store.listArchived()).length, 1);
});
test('protected workflows never become automatic deletion candidates', async () => {
  const store = await setup();
  const result = await runRetentionSweep({ store, now: '2026-07-31T00:00:00.000Z', protectedWorkflowIds: ['due'] });
  assert.deepEqual(result.candidates, []);
});

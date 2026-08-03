import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAuditStore } from '../src/audit-store.mjs';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'recycle-bin-'));
  return { path: join(directory, 'audit.json'), store: createAuditStore(join(directory, 'audit.json')) };
}

test('records archive time and fixed 30-day purge deadline', async () => {
  const { store, path } = await fixture();
  const record = await store.archive({ workflowId: 'wf-1', workflowName: 'Disposable test', actor: 'Alexandre', archivedAt: '2026-07-01T10:00:00.000Z' });
  assert.equal(record.purgeAt, '2026-07-31T10:00:00.000Z');
  assert.equal((await store.listArchived()).length, 1);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).version, 1);
});

test('is idempotent for repeated archive notifications', async () => {
  const { store } = await fixture();
  await store.archive({ workflowId: 'wf-1', workflowName: 'Disposable test', archivedAt: '2026-07-01T10:00:00.000Z' });
  await store.archive({ workflowId: 'wf-1', workflowName: 'Changed name', archivedAt: '2026-07-02T10:00:00.000Z' });
  assert.equal((await store.listArchived()).length, 1);
});

test('removes restored and permanently-deleted records from active recycle-bin listing', async () => {
  const { store } = await fixture();
  await store.archive({ workflowId: 'restore', workflowName: 'Restore me' });
  await store.restore('restore', '2026-07-01T11:00:00.000Z');
  assert.deepEqual(await store.listArchived(), []);
  await store.archive({ workflowId: 'delete', workflowName: 'Delete me' });
  await store.markDeleted('delete', '2026-07-01T12:00:00.000Z');
  assert.deepEqual(await store.listArchived(), []);
});

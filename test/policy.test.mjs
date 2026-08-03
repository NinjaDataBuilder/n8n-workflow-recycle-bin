import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizePermanentDelete,
  calculatePurgeAt,
  inspectWorkflowForRecycleBin,
} from '../src/policy.mjs';

const archivedWorkflow = Object.freeze({
  id: 'wf-trash-1',
  isArchived: true,
  archivedAt: '2026-07-01T10:00:00.000Z',
  tags: [],
});

test('calculates a 30-day retention deadline deterministically', () => {
  assert.equal(calculatePurgeAt('2026-07-01T10:00:00.000Z'), '2026-07-31T10:00:00.000Z');
});

test('marks archived workflows due only after their retention window', () => {
  assert.equal(inspectWorkflowForRecycleBin(archivedWorkflow, { now: '2026-07-31T09:59:59.000Z' }).isPurgeDue, false);
  assert.equal(inspectWorkflowForRecycleBin(archivedWorkflow, { now: '2026-07-31T10:00:00.000Z' }).isPurgeDue, true);
});

test('allows scheduled deletion only after retention has elapsed', () => {
  assert.deepEqual(
    authorizePermanentDelete(archivedWorkflow, { mode: 'scheduled' }, { now: '2026-07-31T10:00:00.000Z' }),
    { workflowId: 'wf-trash-1', mode: 'scheduled', purgeAt: '2026-07-31T10:00:00.000Z' },
  );
  assert.throws(() => authorizePermanentDelete(archivedWorkflow, { mode: 'scheduled' }, { now: '2026-07-30T10:00:00.000Z' }), /Retention period/);
});

test('requires literal DELETAR for immediate permanent deletion', () => {
  assert.throws(() => authorizePermanentDelete(archivedWorkflow, { mode: 'immediate', confirmationText: 'DELETE' }), /DELETAR/);
  assert.equal(authorizePermanentDelete(archivedWorkflow, { mode: 'immediate', confirmationText: 'DELETAR' }).mode, 'immediate');
});

test('never permits protected or active workflows to be permanently deleted', () => {
  assert.throws(() => authorizePermanentDelete(archivedWorkflow, { mode: 'immediate', confirmationText: 'DELETAR' }, { protectedWorkflowIds: ['wf-trash-1'] }), /Protected/);
  assert.throws(() => authorizePermanentDelete({ ...archivedWorkflow, isArchived: false }, { mode: 'immediate', confirmationText: 'DELETAR' }), /Only archived/);
});

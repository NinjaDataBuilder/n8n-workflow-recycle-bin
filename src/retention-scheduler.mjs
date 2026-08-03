import { authorizePermanentDelete } from './policy.mjs';

export async function runRetentionSweep({ store, now = new Date().toISOString(), dryRun = true, protectedWorkflowIds = [], protectedTags = [], deleteWorkflow }) {
  const archived = await store.listArchived();
  const candidates = [];
  const deleted = [];
  for (const item of archived) {
    const workflow = { id: item.workflowId, isArchived: true, archivedAt: item.archivedAt, tags: item.tags ?? [] };
    try {
      const authorization = authorizePermanentDelete(workflow, { mode: 'scheduled' }, { now, protectedWorkflowIds, protectedTags });
      candidates.push({ workflowId: item.workflowId, workflowName: item.workflowName, purgeAt: authorization.purgeAt });
      if (!dryRun) {
        if (typeof deleteWorkflow !== 'function') throw new Error('A deleteWorkflow executor is required when dryRun is false');
        await deleteWorkflow(item.workflowId);
        await store.markDeleted(item.workflowId, now);
        deleted.push(item.workflowId);
      }
    } catch (error) {
      // Not-yet-due and protected records are intentionally absent from candidates.
    }
  }
  return Object.freeze({ dryRun, scanned: archived.length, candidates, deleted });
}

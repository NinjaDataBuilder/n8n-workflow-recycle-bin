const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_DAYS = 30;
export const PERMANENT_DELETE_CONFIRMATION = 'DELETAR';

function requireIsoDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid ISO date`);
  return date;
}

export function calculatePurgeAt(archivedAt, retentionDays = DEFAULT_RETENTION_DAYS) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error('retentionDays must be an integer between 1 and 3650');
  }
  const archived = requireIsoDate(archivedAt, 'archivedAt');
  return new Date(archived.getTime() + retentionDays * DAY_MS).toISOString();
}

export function inspectWorkflowForRecycleBin(workflow, policy = {}) {
  const now = requireIsoDate(policy.now ?? new Date().toISOString(), 'now');
  const retentionDays = policy.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const protectedIds = new Set(policy.protectedWorkflowIds ?? []);
  const protectedTags = new Set(policy.protectedTags ?? []);
  const tags = workflow.tags ?? [];
  const protectedByTag = tags.some((tag) => protectedTags.has(typeof tag === 'string' ? tag : tag.name));
  const isProtected = protectedIds.has(workflow.id) || protectedByTag;
  const archivedAt = workflow.archivedAt ? requireIsoDate(workflow.archivedAt, 'archivedAt') : null;
  const purgeAt = archivedAt ? calculatePurgeAt(archivedAt.toISOString(), retentionDays) : null;

  return Object.freeze({
    id: workflow.id,
    isArchived: workflow.isArchived === true,
    isProtected,
    purgeAt,
    isPurgeDue: purgeAt ? now.getTime() >= new Date(purgeAt).getTime() : false,
  });
}

export function authorizePermanentDelete(workflow, request, policy = {}) {
  const view = inspectWorkflowForRecycleBin(workflow, policy);
  if (view.isProtected) throw new Error('Protected workflows cannot be permanently deleted');
  if (!view.isArchived) throw new Error('Only archived workflows can be permanently deleted');

  const immediate = request.mode === 'immediate';
  if (immediate && request.confirmationText !== PERMANENT_DELETE_CONFIRMATION) {
    throw new Error(`Immediate deletion requires typing ${PERMANENT_DELETE_CONFIRMATION}`);
  }
  if (!immediate && !view.isPurgeDue) {
    throw new Error('Retention period has not elapsed');
  }
  return Object.freeze({ workflowId: view.id, mode: immediate ? 'immediate' : 'scheduled', purgeAt: view.purgeAt });
}

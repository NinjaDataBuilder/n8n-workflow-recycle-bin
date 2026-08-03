export const RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function timestamp(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function daysLabel(days) {
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function getRetentionDisplay(item, now = Date.now()) {
  const archivedAt = timestamp(item?.archivedAt);
  const purgeAt = timestamp(item?.purgeAt);

  if (!item?.retentionEligible || archivedAt === null || purgeAt === null) {
    return Object.freeze({
      state: 'suspended',
      label: 'Retention paused',
      detail: 'Waiting for an authoritative archive date',
      progressPercent: null,
    });
  }

  const elapsed = Math.max(0, Math.min(RETENTION_WINDOW_MS, now - archivedAt));
  const progressPercent = Math.round((elapsed / RETENTION_WINDOW_MS) * 100);
  const remainingDays = Math.max(0, Math.ceil((purgeAt - now) / (24 * 60 * 60 * 1000)));

  if (remainingDays === 0 || now >= purgeAt) {
    return Object.freeze({
      state: 'eligible',
      label: 'Retention period completed',
      detail: 'Eligible for protected permanent deletion',
      progressPercent: 100,
    });
  }

  return Object.freeze({
    state: 'countdown',
    label: `${daysLabel(remainingDays)} remaining before permanent deletion`,
    detail: `${progressPercent}% of the retention period`,
    progressPercent,
  });
}

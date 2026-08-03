import test from 'node:test';
import assert from 'node:assert/strict';
import { RETENTION_WINDOW_MS, getRetentionDisplay } from '../app/public/assets/retention-display.mjs';

const archivedAt = Date.parse('2026-07-31T00:00:00.000Z');

test('suspends retention without an authoritative archive date', () => {
  const display = getRetentionDisplay({ retentionEligible: false }, archivedAt);
  assert.deepEqual(display, {
    state: 'suspended',
    label: 'Retention paused',
    detail: 'Waiting for an authoritative archive date',
    progressPercent: null,
  });
});

test('starts a 30-day countdown at zero percent', () => {
  const display = getRetentionDisplay({
    archivedAt: new Date(archivedAt).toISOString(),
    purgeAt: new Date(archivedAt + RETENTION_WINDOW_MS).toISOString(),
    retentionEligible: true,
  }, archivedAt);
  assert.equal(display.state, 'countdown');
  assert.equal(display.label, '30 days remaining before permanent deletion');
  assert.equal(display.detail, '0% of the retention period');
  assert.equal(display.progressPercent, 0);
});

test('updates the countdown and progress during retention', () => {
  const now = archivedAt + 12 * 24 * 60 * 60 * 1000;
  const display = getRetentionDisplay({
    archivedAt: new Date(archivedAt).toISOString(),
    purgeAt: new Date(archivedAt + RETENTION_WINDOW_MS).toISOString(),
    retentionEligible: true,
  }, now);
  assert.equal(display.label, '18 days remaining before permanent deletion');
  assert.equal(display.progressPercent, 40);
});

test('reaches 100 percent only when the retention deadline is reached', () => {
  const display = getRetentionDisplay({
    archivedAt: new Date(archivedAt).toISOString(),
    purgeAt: new Date(archivedAt + RETENTION_WINDOW_MS).toISOString(),
    retentionEligible: true,
  }, archivedAt + RETENTION_WINDOW_MS);
  assert.deepEqual(display, {
    state: 'eligible',
    label: 'Retention period completed',
    detail: 'Eligible for protected permanent deletion',
    progressPercent: 100,
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompatible, resolveCompatibility } from '../src/compatibility.mjs';

test('supports every 2.32 patch release through the tested sidebar adapter', () => {
  assert.deepEqual(assertCompatible('2.32.5'), {
    range: '2.32.x',
    coreApi: true,
    externalHooks: true,
    sidebarAdapter: 'v2.32',
    status: 'supported',
    version: '2.32.5',
  });
});

test('refuses an untested release line before any installation action', () => {
  const result = resolveCompatibility('2.33.0');
  assert.equal(result.status, 'unsupported');
  assert.match(result.reason, /Installation must stop/);
  assert.throws(() => assertCompatible('2.33.0'), /Installation must stop/);
});

test('rejects malformed version values', () => {
  assert.throws(() => resolveCompatibility('latest'), /Invalid n8n version/);
});

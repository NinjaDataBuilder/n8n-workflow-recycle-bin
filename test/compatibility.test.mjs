import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompatible, resolveCompatibility } from '../src/compatibility.mjs';

test('supports the exact n8n 2.36.7 adapter', () => {
  assert.deepEqual(assertCompatible('2.36.7'), {
    exact: '2.36.7',
    coreApi: true,
    externalHooks: true,
    sidebarAdapter: 'v2.36.7',
    status: 'supported',
    version: '2.36.7',
  });
});

test('retains compatibility for the previously validated exact n8n 2.35.3 adapter', () => {
  assert.equal(assertCompatible('2.35.3').sidebarAdapter, 'v2.35.3');
});

test('supports the original 2.32.5 reference adapter', () => {
  assert.equal(assertCompatible('2.32.5').sidebarAdapter, 'v2.32');
});

test('refuses an untested patch or release before installation', () => {
  const result = resolveCompatibility('2.36.8');
  assert.equal(result.status, 'unsupported');
  assert.match(result.reason, /Installation must stop/);
  assert.throws(() => assertCompatible('2.33.0'), /Installation must stop/);
});

test('rejects malformed version values', () => {
  assert.throws(() => resolveCompatibility('latest'), /Invalid n8n version/);
});

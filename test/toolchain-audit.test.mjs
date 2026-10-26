import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const auditor = fileURLToPath(new URL('../scripts/n8n-toolchain-compatibility-audit.py', import.meta.url));
const python = `
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('compatibility_audit_under_test', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.MANIFEST = pathlib.Path(sys.argv[2])
module.live_n8n_version = lambda container: '2.44.5'
module.latest_n8n_release = lambda: '2.44.5'
module.TOOLS = {}
sys.argv = [sys.argv[1], '--json']
raise SystemExit(module.main())
`;

function audit(entry) {
  const directory = mkdtempSync(join(tmpdir(), 'toolchain-audit-test-'));
  try {
    const manifest = join(directory, 'matrix.json');
    writeFileSync(manifest, JSON.stringify({ versions: { '2.44.5': entry } }));
    const result = spawnSync('python3', ['-c', python, auditor, manifest], { encoding: 'utf8' });
    assert.equal(result.error, undefined);
    assert.ok(result.stdout, result.stderr);
    return { exitCode: result.status, report: JSON.parse(result.stdout) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('a known but incomplete compatibility row must continue to block release', () => {
  const result = audit({
    recycleBin: '0.1.8',
    status: 'validation-incomplete',
    releaseReady: false,
    releaseBlockers: ['Authenticated browser verification is still pending'],
  });
  assert.equal(result.exitCode, 1);
  assert.equal(result.report.status, 'alert');
  assert.match(result.report.alerts.join('\n'), /Authenticated browser verification is still pending/);
  assert.doesNotMatch(result.report.alerts.join('\n'), /não possui matriz/);
  assert.equal(result.report.releaseReady, false);
});

test('an approved compatibility row retains the existing clean audit behavior', () => {
  const result = audit({ status: 'validated', releaseReady: true, releaseBlockers: [] });
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, 'ok');
  assert.equal(result.report.releaseReady, true);
});

for (const [name, entry] of [
  ['explicit false without a reason', { releaseReady: false }],
  ['a string instead of boolean approval', { releaseReady: 'true' }],
  ['an incomplete status despite claimed approval', { status: 'validation-incomplete', releaseReady: true }],
  ['blockers despite claimed approval', { releaseReady: true, releaseBlockers: ['Still blocked'] }],
  ['malformed blocker metadata', { releaseReady: true, releaseBlockers: 'not an array' }],
]) {
  test(`release remains blocked for ${name}`, () => {
    const result = audit(entry);
    assert.equal(result.exitCode, 1);
    assert.equal(result.report.status, 'alert');
    assert.equal(result.report.releaseReady, false);
    assert.ok(result.report.alerts.length > 0);
  });
}

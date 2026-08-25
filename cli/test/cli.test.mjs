import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, assertSupportedN8nVersion, doctor, installFromBundle, uninstall } from '../src/cli.mjs';

async function tempDirectory(prefix) {
  return fs.mkdtemp(join(tmpdir(), prefix));
}

async function makeBundle(root, version = '0.1.2') {
  const bundleRoot = join(root, `workflow-recycle-bin-${version}`);
  await fs.mkdir(join(bundleRoot, 'deploy'), { recursive: true });
  await fs.mkdir(join(bundleRoot, 'scripts'), { recursive: true });
  await fs.writeFile(join(bundleRoot, 'Dockerfile'), 'FROM scratch\n');
  await fs.writeFile(join(bundleRoot, 'deploy/docker-compose.sidecar.yml'), 'services: {}\n');
  await fs.writeFile(join(bundleRoot, 'scripts/preflight.mjs'), 'console.log(JSON.stringify({ok:true}))\n');
  const archive = join(root, `workflow-recycle-bin-v${version}.tar.gz`);
  const { spawn } = await import('node:child_process');
  await new Promise((resolve, reject) => {
    const child = spawn('tar', ['-czf', archive, '-C', root, `workflow-recycle-bin-${version}`]);
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`tar exit ${code}`)));
  });
  return archive;
}

test('parses commands and kebab-case options', () => {
  assert.deepEqual(parseArgs(['install', '--n8n-version', '2.32.5', '--dry-run']), {
    command: 'install',
    n8n_version: '2.32.5',
    dry_run: true,
  });
});

test('accepts the exact validated n8n versions and rejects untested versions', () => {
  assert.equal(assertSupportedN8nVersion('2.32.5'), '2.32.5');
  assert.equal(assertSupportedN8nVersion('2.35.3'), '2.35.3');
  assert.equal(assertSupportedN8nVersion('2.36.7'), '2.36.7');
  assert.throws(() => assertSupportedN8nVersion('2.33.0'), /Supported versions/);
  assert.throws(() => assertSupportedN8nVersion('2.36.8'), /Supported versions/);
});

test('doctor validates a target without printing secrets', async () => {
  const target = await tempDirectory('recycle-bin-doctor-');
  await fs.writeFile(join(target, 'docker-compose.yml'), 'services: {}\n');
  const calls = [];
  const run = async (command, args) => { calls.push([command, args]); };
  const result = await doctor({ target, n8nVersion: '2.32.5', network: 'n8n_default', run });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
});

test('dry-run does not stage files or invoke Docker', async () => {
  const target = await tempDirectory('recycle-bin-install-');
  const bundleRoot = await tempDirectory('recycle-bin-bundle-');
  const bundle = await makeBundle(bundleRoot);
  await fs.writeFile(join(target, 'docker-compose.yml'), 'services: {}\n');
  const calls = [];
  const run = async (command, args) => {
    calls.push([command, args]);
    if (command === 'docker') throw new Error('Docker must not run in dry-run');
  };
  const result = await installFromBundle({
    target,
    version: '0.1.2',
    n8nVersion: '2.32.5',
    bundlePath: bundle,
    network: 'n8n_default',
    n8nInternalUrl: 'http://n8n:5678',
    dryRun: true,
    run,
  });
  assert.equal(result.dryRun, true);
  assert.equal(calls.some(([command]) => command === 'docker'), false);
  assert.equal(await fs.stat(join(target, 'workflow-recycle-bin')).catch(() => null), null);
});

test('install stages a bundle, validates Compose, and writes no token value', async () => {
  const target = await tempDirectory('recycle-bin-install-');
  const bundleRoot = await tempDirectory('recycle-bin-bundle-');
  const bundle = await makeBundle(bundleRoot);
  const secret = join(target, 'hook-token');
  await fs.writeFile(secret, 'not inspected by the CLI\n', { mode: 0o600 });
  await fs.writeFile(join(target, 'docker-compose.yml'), 'services: {}\n');
  const calls = [];
  const run = async (command, args) => { calls.push([command, args]); };
  const result = await installFromBundle({
    target,
    version: '0.1.2',
    n8nVersion: '2.32.5',
    bundlePath: bundle,
    network: 'n8n_default',
    n8nInternalUrl: 'http://n8n:5678',
    hookTokenFile: secret,
    run,
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  const env = await fs.readFile(join(target, 'workflow-recycle-bin', '.env'), 'utf8');
  assert.match(env, /RECYCLE_BIN_HOOK_TOKEN_FILE=/);
  assert.doesNotMatch(env, /not inspected by the CLI/);
  assert.equal((await fs.stat(join(target, 'workflow-recycle-bin/install-manifest.json'))).mode & 0o777, 0o600);
});

test('uninstall requires confirmation and preserves the data volume', async () => {
  const target = await tempDirectory('recycle-bin-uninstall-');
  const destination = join(target, 'workflow-recycle-bin');
  await fs.mkdir(join(destination, 'deploy'), { recursive: true });
  await fs.writeFile(join(destination, '.env'), 'RECYCLE_BIN_IMAGE=test\n', { mode: 0o600 });
  await fs.writeFile(join(destination, 'deploy/docker-compose.sidecar.yml'), 'services: {}\n');
  const calls = [];
  const run = async (command, args) => { calls.push([command, args]); };
  await assert.rejects(() => uninstall({ target, run }), /--confirm/);
  const result = await uninstall({ target, confirm: true, run });
  assert.equal(result.dataVolumePreserved, true);
  assert.equal(calls.length, 1);
  assert.equal(await fs.stat(destination).catch(() => null), null);
});

test('rolls back staged files when Compose validation fails', async () => {
  const target = await tempDirectory('recycle-bin-rollback-');
  const destination = join(target, 'workflow-recycle-bin');
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(join(destination, 'old.txt'), 'previous release\n');
  const bundleRoot = await tempDirectory('recycle-bin-bundle-');
  const bundle = await makeBundle(bundleRoot);
  await fs.writeFile(join(target, 'docker-compose.yml'), 'services: {}\n');
  const run = async (command) => {
    if (command === 'docker') throw new Error('compose validation failed');
  };
  await assert.rejects(() => installFromBundle({
    target,
    version: '0.1.2',
    n8nVersion: '2.32.5',
    bundlePath: bundle,
    network: 'n8n_default',
    n8nInternalUrl: 'http://n8n:5678',
    run,
  }), /Staged files were rolled back/);
  assert.equal(await fs.readFile(join(destination, 'old.txt'), 'utf8'), 'previous release\n');
});

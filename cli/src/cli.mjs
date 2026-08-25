#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const CLI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REPOSITORY = 'NinjaDataBuilder/n8n-workflow-recycle-bin';
const SUPPORTED_N8N_VERSIONS = new Set(['2.32.5', '2.35.3', '2.36.7']);

export function parseArgs(argv) {
  if (argv[0]?.startsWith('--')) {
    return { command: 'help', help: argv.includes('--help') };
  }
  const [command = 'help', ...tokens] = argv;
  const options = { command };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const equal = token.indexOf('=');
    const key = (equal === -1 ? token.slice(2) : token.slice(2, equal)).replaceAll('-', '_');
    if (equal !== -1) {
      options[key] = token.slice(equal + 1);
      continue;
    }
    const next = tokens[index + 1];
    if (next && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

export function assertSupportedN8nVersion(version) {
  if (!version || !SUPPORTED_N8N_VERSIONS.has(version)) {
    throw new Error(`Unsupported n8n version: ${version ?? '(missing)'}. Supported versions: ${[...SUPPORTED_N8N_VERSIONS].join(', ')}`);
  }
  return version;
}

function requireOption(options, name) {
  const value = options[name];
  if (!value || value === true) throw new Error(`Missing required option: --${name.replaceAll('_', '-')}`);
  return value;
}

function releaseArtifactName(version) {
  return `workflow-recycle-bin-v${version}.tar.gz`;
}

function validateRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error(`Invalid GitHub repository: ${repository}`);
  }
  return repository;
}

function runCommand(command, args, { cwd, env = process.env, stdio = 'inherit' } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env, stdio });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise({ code, signal });
      else reject(new Error(`${command} ${args.join(' ')} failed with ${signal ?? `exit ${code}`}`));
    });
  });
}

async function commandAvailable(command, args = ['--version'], run = runCommand) {
  try {
    await run(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(path, label) {
  const stat = await fs.stat(path).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`${label} is not a directory: ${path}`);
}

async function ensureSecretFile(path) {
  const absolute = resolve(path);
  const stat = await fs.stat(absolute).catch(() => null);
  if (!stat?.isFile()) throw new Error(`Hook token file does not exist: ${absolute}`);
  if ((stat.mode & 0o077) !== 0) {
    throw new Error(`Hook token file must not be group/world accessible: ${absolute}`);
  }
  return absolute;
}

async function sha256File(path) {
  return createHash('sha256').update(await fs.readFile(path)).digest('hex');
}

async function fetchRelease({ repository, version, fetchImpl = globalThis.fetch }) {
  validateRepository(repository);
  const artifact = releaseArtifactName(version);
  const base = `https://github.com/${repository}/releases/download/v${version}`;
  const artifactResponse = await fetchImpl(`${base}/${artifact}`);
  if (!artifactResponse.ok) throw new Error(`Could not download release artifact: HTTP ${artifactResponse.status}`);
  const bytes = Buffer.from(await artifactResponse.arrayBuffer());
  const checksumResponse = await fetchImpl(`${base}/SHA256SUMS`);
  if (!checksumResponse.ok) throw new Error(`Release is missing SHA256SUMS: HTTP ${checksumResponse.status}`);
  const checksumText = await checksumResponse.text();
  const expected = checksumText
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .find((parts) => parts[1] === artifact)?.[0];
  if (!expected) throw new Error(`SHA256SUMS does not contain ${artifact}`);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error('Release checksum mismatch');

  const directory = await fs.mkdtemp(join(tmpdir(), 'workflow-recycle-bin-'));
  const archivePath = join(directory, artifact);
  await fs.writeFile(archivePath, bytes, { mode: 0o600 });
  return { archivePath, checksum: actual, cleanup: () => fs.rm(directory, { recursive: true, force: true }) };
}

async function verifyTarEntries(archivePath) {
  const output = await new Promise((resolvePromise, reject) => {
    const child = spawn('tar', ['-tzf', archivePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolvePromise(stdout) : reject(new Error(stderr || 'Unable to inspect release archive')));
  });
  for (const entry of output.split(/\r?\n/).filter(Boolean)) {
    if (entry.startsWith('/') || entry.split('/').includes('..')) throw new Error(`Unsafe archive entry: ${entry}`);
  }
}

async function extractBundle(archivePath) {
  await verifyTarEntries(archivePath);
  const directory = await fs.mkdtemp(join(tmpdir(), 'workflow-recycle-bin-extract-'));
  await runCommand('tar', ['--extract', '--gzip', '--file', archivePath, '--no-same-owner', '--directory', directory], { stdio: 'ignore' });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const bundleRoot = entries.length === 1 && entries[0].isDirectory() ? join(directory, entries[0].name) : directory;
  for (const required of ['Dockerfile', 'deploy/docker-compose.sidecar.yml', 'scripts/preflight.mjs']) {
    await fs.access(join(bundleRoot, required));
  }
  return { directory, bundleRoot };
}

function composeArgs(composeFile, envFile, project, command, ...rest) {
  return ['compose', '--project-name', project, '--file', composeFile, '--env-file', envFile, command, ...rest];
}

function envFileContent({ image, network, n8nInternalUrl, hookTokenFile }) {
  return [
    `RECYCLE_BIN_IMAGE=${image}`,
    `DATABUILDER_NETWORK=${network}`,
    `N8N_INTERNAL_URL=${n8nInternalUrl}`,
    `RECYCLE_BIN_HOOK_TOKEN_FILE=${hookTokenFile}`,
    'RECYCLE_BIN_VOLUME_NAME=workflow-recycle-bin-data',
    '',
  ].join('\n');
}

export async function installFromBundle({
  target,
  version,
  n8nVersion,
  bundlePath,
  repository = DEFAULT_REPOSITORY,
  network,
  n8nInternalUrl,
  hookTokenFile,
  image = `ghcr.io/ninjadatabuilder/n8n-workflow-recycle-bin:${version}`,
  project = 'workflow-recycle-bin',
  dryRun = false,
  start = false,
  run = runCommand,
}) {
  const targetPath = resolve(target);
  await ensureDirectory(targetPath, 'Target');
  await assertSupportedN8nVersion(n8nVersion);
  if (!network || !n8nInternalUrl) throw new Error('--network and --n8n-internal-url are required');
  if (start && !hookTokenFile) throw new Error('--hook-token-file is required with --start');
  const secretPath = hookTokenFile ? await ensureSecretFile(hookTokenFile) : null;
  const composeParent = join(targetPath, 'docker-compose.yml');
  await fs.access(composeParent).catch(() => { throw new Error(`Target Compose file not found: ${composeParent}`); });

  let release;
  let extracted;
  try {
    if (bundlePath) {
      const archivePath = resolve(bundlePath);
      await fs.access(archivePath);
      release = { archivePath, checksum: await sha256File(archivePath), cleanup: async () => {} };
    } else {
      release = await fetchRelease({ repository, version });
    }
    extracted = await extractBundle(release.archivePath);
    await run(process.execPath, [join(extracted.bundleRoot, 'scripts/preflight.mjs'), n8nVersion], { stdio: 'ignore' });

    const destination = join(targetPath, 'workflow-recycle-bin');
    const backupRoot = join(targetPath, '.recycle-bin-backups', new Date().toISOString().replaceAll(/[:.]/g, '-'));
    const plan = {
      target: targetPath,
      destination,
      backup: await fs.stat(destination).then(() => join(backupRoot, 'workflow-recycle-bin')).catch(() => null),
      version,
      n8nVersion,
      image,
      network,
      n8nInternalUrl,
      composeProject: project,
      bundleSha256: release.checksum,
      start,
    };
    if (dryRun) return { ok: true, dryRun: true, plan };

    await fs.mkdir(backupRoot, { recursive: true, mode: 0o700 });
    if (plan.backup) await fs.cp(destination, plan.backup, { recursive: true, force: false });
    const staging = await fs.mkdtemp(join(targetPath, '.recycle-bin-stage-'));
    await fs.cp(extracted.bundleRoot, staging, { recursive: true });
    const envPath = join(staging, '.env');
    await fs.writeFile(envPath, envFileContent({ image, network, n8nInternalUrl, hookTokenFile: secretPath ?? '/absolute/path/to/hook-token' }), { mode: 0o600 });
    await fs.rm(destination, { recursive: true, force: true });
    await fs.rename(staging, destination);

    const composeFile = join(destination, 'deploy/docker-compose.sidecar.yml');
    const envFile = join(destination, '.env');
    try {
      await run('docker', composeArgs(composeFile, envFile, project, 'config', '--quiet'));
      if (start) {
        await run('docker', composeArgs(composeFile, envFile, project, 'pull'));
        await run('docker', composeArgs(composeFile, envFile, project, 'up', '--detach'));
      }
    } catch (installError) {
      const rollbackErrors = [];
      if (start) {
        await run('docker', composeArgs(composeFile, envFile, project, 'down')).catch((error) => rollbackErrors.push(`sidecar stop: ${error.message}`));
      }
      await fs.rm(destination, { recursive: true, force: true });
      if (plan.backup) {
        await fs.cp(plan.backup, destination, { recursive: true }).catch((error) => rollbackErrors.push(`restore: ${error.message}`));
      }
      const suffix = rollbackErrors.length ? ` Rollback warnings: ${rollbackErrors.join('; ')}` : ' Staged files were rolled back.';
      throw new Error(`${installError.message}.${suffix}`);
    }
    const manifest = { ...plan, installedAt: new Date().toISOString(), destination, envFile: '.env' };
    await fs.writeFile(join(destination, 'install-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    return { ok: true, dryRun: false, plan: manifest };
  } catch (error) {
    throw error;
  } finally {
    if (extracted?.directory) await fs.rm(extracted.directory, { recursive: true, force: true });
    if (release) await release.cleanup();
  }
}

export async function doctor({ target, n8nVersion, network, run = runCommand }) {
  const targetPath = resolve(target);
  await ensureDirectory(targetPath, 'Target');
  assertSupportedN8nVersion(n8nVersion);
  await fs.access(join(targetPath, 'docker-compose.yml')).catch(() => { throw new Error(`Target Compose file not found: ${join(targetPath, 'docker-compose.yml')}`); });
  const docker = await commandAvailable('docker', ['info', '--format', '{{.ServerVersion}}'], run);
  const compose = docker && await commandAvailable('docker', ['compose', 'version'], run);
  if (!docker || !compose) throw new Error('Docker Engine and Docker Compose are required');
  return { ok: true, target: targetPath, n8nVersion, network: network ?? null, docker, compose };
}

export async function uninstall({ target, confirm = false, project = 'workflow-recycle-bin', run = runCommand }) {
  if (!confirm) throw new Error('Uninstall requires --confirm');
  const targetPath = resolve(target);
  const destination = join(targetPath, 'workflow-recycle-bin');
  await ensureDirectory(destination, 'Installed bundle');
  const envFile = join(destination, '.env');
  const composeFile = join(destination, 'deploy/docker-compose.sidecar.yml');
  const backupRoot = join(targetPath, '.recycle-bin-backups', `uninstall-${new Date().toISOString().replaceAll(/[:.]/g, '-')}`);
  await fs.mkdir(backupRoot, { recursive: true, mode: 0o700 });
  await fs.cp(destination, join(backupRoot, 'workflow-recycle-bin'), { recursive: true });
  if (await fs.stat(envFile).catch(() => null) && await fs.stat(composeFile).catch(() => null)) {
    await run('docker', composeArgs(composeFile, envFile, project, 'down'));
  }
  await fs.rm(destination, { recursive: true, force: true });
  return { ok: true, removed: destination, backup: join(backupRoot, 'workflow-recycle-bin'), dataVolumePreserved: true };
}

function help() {
  return [
    'Workflow Recycle Bin CLI',
    '',
    'Commands:',
    '  doctor     Validate Docker, target Compose, and n8n compatibility',
    '  install    Stage and validate the sidecar; add --start to pull/start it',
    '  uninstall  Stop the sidecar and remove staged files; requires --confirm',
    '',
    'Required install options:',
    '  --target PATH --version VERSION --n8n-version VERSION',
    '  --network NAME --n8n-internal-url URL',
    '  --bundle PATH (local release) or omit it to download from GitHub',
    '',
    'Security:',
    '  API keys and hook tokens are file-backed. The CLI never accepts secret values as arguments.',
    '',
  ].join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help || options.command === 'help') {
    console.log(help());
    return;
  }
  if (options.command === 'doctor') {
    const result = await doctor({ target: requireOption(options, 'target'), n8nVersion: requireOption(options, 'version'), network: options.network });
    console.log(options.json ? JSON.stringify(result, null, 2) : 'Doctor: OK');
    return;
  }
  if (options.command === 'install') {
    const result = await installFromBundle({
      target: requireOption(options, 'target'),
      version: requireOption(options, 'version'),
      n8nVersion: requireOption(options, 'n8n_version'),
      bundlePath: options.bundle,
      repository: options.repository ?? DEFAULT_REPOSITORY,
      network: options.network,
      n8nInternalUrl: options.n8n_internal_url,
      hookTokenFile: options.hook_token_file,
      image: options.image,
      project: options.project ?? 'workflow-recycle-bin',
      dryRun: Boolean(options.dry_run),
      start: Boolean(options.start),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (options.command === 'uninstall') {
    const result = await uninstall({ target: requireOption(options, 'target'), confirm: Boolean(options.confirm), project: options.project ?? 'workflow-recycle-bin' });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error(`Unknown command: ${options.command}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(join(root, 'package.json'), 'utf8'));
const version = process.argv[2] ?? packageJson.version;
const bundleName = `workflow-recycle-bin-${version}`;
const archiveName = `workflow-recycle-bin-v${version}.tar.gz`;
const releaseDir = join(root, 'release');
const stagingParent = join(releaseDir, '.staging');
const stagingRoot = join(stagingParent, bundleName);

const files = [
  '.dockerignore',
  '.env.example',
  'Dockerfile',
  'docker-entrypoint.sh',
  'LICENSE',
  'package.json',
  'README.md',
  'app',
  'deploy',
  'docs',
  'hooks',
  'scripts/preflight.mjs',
  'scripts/uninstall.sh',
  'scripts/n8n-toolchain-compatibility-audit.py',
  'scripts/n8n-toolchain-compatibility.json',
  'src',
];

await fs.rm(stagingRoot, { recursive: true, force: true });
await fs.mkdir(stagingRoot, { recursive: true });
await fs.mkdir(releaseDir, { recursive: true });

for (const relativePath of files) {
  const source = join(root, relativePath);
  const destination = join(stagingRoot, relativePath);
  try {
    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, destination, { recursive: true });
    } else {
      await fs.mkdir(dirname(destination), { recursive: true });
      await fs.copyFile(source, destination);
    }
  } catch (error) {
    if (error.code === 'ENOENT' && relativePath === 'README.md') continue;
    throw error;
  }
}

await fs.chmod(join(stagingRoot, 'hooks/workflow-recycle-bin.cjs'), 0o644);

const manifest = {
  product: 'workflow-recycle-bin',
  version,
  n8nCompatibility: '2.36.8 (exact adapter; also retains tested 2.36.7, 2.35.3, and 2.32.5 assets)',
  archive: archiveName,
  generatedAt: new Date().toISOString(),
  contents: files.filter((entry) => entry !== 'README.md'),
};
await fs.writeFile(join(stagingRoot, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });

const archivePath = join(releaseDir, archiveName);
const tar = spawnSync('tar', ['-czf', archivePath, '-C', stagingParent, bundleName], { encoding: 'utf8' });
if (tar.status !== 0) {
  process.stderr.write(tar.stderr || 'tar failed\n');
  process.exit(tar.status || 1);
}

const digest = createHash('sha256').update(await fs.readFile(archivePath)).digest('hex');
await fs.writeFile(join(releaseDir, 'SHA256SUMS'), `${digest}  ${archiveName}\n`, { mode: 0o644 });
await fs.rm(stagingParent, { recursive: true, force: true });
console.log(JSON.stringify({ version, archive: archivePath, sha256: digest }, null, 2));

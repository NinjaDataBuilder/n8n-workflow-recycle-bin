# Installation guide

## Supported target

The first release supports self-hosted n8n `2.32.x` running with Docker Compose. The installer refuses another minor release line before it mounts hooks, changes a proxy, or starts the sidecar.

The sidecar is installed beside the existing n8n stack. It does not replace the parent Compose project and does not publish a host port by default.

## Prerequisites

- Docker Engine and the Docker Compose plugin;
- an existing n8n Compose directory containing `docker-compose.yml`;
- the exact running n8n version;
- the name of the existing Docker network shared with n8n;
- the internal n8n URL reachable from that network;
- a local hook-token file with permissions `600`;
- a backup location writable by the installer.

The CLI never asks for or prints the hook token value.

## Recommended CLI installation

The public release will be installed with a pinned version:

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin install \
  --target /opt/n8n/compose \
  --version 0.1.3 \
  --n8n-version 2.32.5 \
  --network n8n_default \
  --n8n-internal-url http://n8n:5678 \
  --hook-token-file /opt/n8n/secrets/recycle-bin-hook-token \
  --dry-run
```

Review the JSON plan. Remove `--dry-run` to stage and validate. Add `--start` only after the target network, hook configuration, and rollback path have been reviewed.

The CLI downloads the GitHub release tarball, verifies its SHA-256 checksum, runs the bundled compatibility preflight, creates a backup, writes a mode `600` installation environment file, validates the sidecar Compose configuration, and optionally pulls/starts only the sidecar.

## Hook secret

Create the file outside Git and outside the n8n workflow database. Example:

```bash
install -d -m 700 /opt/n8n/secrets
umask 077
openssl rand -hex 32 > /opt/n8n/secrets/recycle-bin-hook-token
chmod 600 /opt/n8n/secrets/recycle-bin-hook-token
```

The same value must be made available to the version-specific n8n external-hook configuration. Do not paste it into chat, issues, README examples, workflow exports, or Compose environment values.

## Rollback and uninstall

Every replacement is backed up below:

```text
<target>/.recycle-bin-backups/<timestamp>/workflow-recycle-bin
```

If Compose validation or an explicitly requested sidecar start fails, the CLI removes the staged candidate and restores the previous bundle. The named audit-data volume is not removed by rollback or normal uninstall.

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin uninstall \
  --target /opt/n8n/compose \
  --confirm
```

## Compatibility rule

The core service may remain reachable only through the dedicated reverse-proxy route when a UI adapter is unavailable. The sidebar adapter must not be installed on an untested n8n release line.

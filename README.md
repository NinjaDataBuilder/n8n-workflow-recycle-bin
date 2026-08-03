# Workflow Recycle Bin

A guarded recycle-bin sidecar for self-hosted n8n. It provides a dedicated UI/API route for archived workflows, retention metadata, reversible restore, and confirmation-gated permanent deletion.

> **Current state:** public source repository with GitHub Release `v0.1.2`. The GHCR image was pushed successfully but still requires public package visibility; npm publication is pending npm scope authorization.

## Supported target

- self-hosted n8n running with Docker Compose;
- n8n `2.32.x` only, initially tested with `2.32.5`;
- Docker Engine with the Compose plugin;
- an existing external Docker network shared with the n8n service;
- an n8n browser/session boundary that the sidecar can validate.

n8n Cloud and unverified community-node installation are not supported by this sidecar architecture.

## Architecture

```text
existing n8n Compose project
          │
          └── existing external Docker network
                    │
                    └── isolated Workflow Recycle Bin sidecar
                          ├── versioned Docker image
                          ├── file-backed hook secret
                          ├── dedicated audit-data volume
                          └── optional version-tested UI adapter
```

The installer never replaces the parent n8n Compose project. The sidecar has no host-published port by default. Permanent deletion remains server-mediated and confirmation-gated.

## Local release candidate

Build and test the runtime:

```bash
npm test
npm run release:bundle
sudo -n docker build --build-arg RELEASE_VERSION=0.1.2 \
  -t workflow-recycle-bin:0.1.2 .
```

Test the CLI:

```bash
cd cli
npm test
node src/cli.mjs --help
```

## Installation through the CLI

After a public release, the intended user-facing flow will be:

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin install \
  --target /opt/n8n/compose \
  --version 0.1.2 \
  --n8n-version 2.32.5 \
  --network n8n_default \
  --n8n-internal-url http://n8n:5678 \
  --hook-token-file /opt/n8n/secrets/recycle-bin-hook-token \
  --start
```

The CLI will:

1. verify Node, Docker, Compose, target Compose, and n8n compatibility;
2. download the pinned GitHub release bundle and verify `SHA256SUMS`;
3. stage the sidecar under `workflow-recycle-bin/`;
4. preserve a timestamped backup of an existing installation;
5. write only non-secret configuration to a mode `600` `.env` file;
6. validate `docker compose config`;
7. pull and start only the sidecar when `--start` is explicitly supplied;
8. preserve the named data volume during uninstall.

Use `--dry-run` to inspect the intended target without writing or invoking Docker. The CLI never accepts a token value as an argument.

## Manual Docker installation

The release bundle contains `deploy/docker-compose.sidecar.yml`. Copy `.env.example` to `.env`, set the existing n8n network and internal URL, create the hook-token file with mode `600`, and validate:

```bash
docker compose \
  --project-name workflow-recycle-bin \
  --file deploy/docker-compose.sidecar.yml \
  --env-file .env \
  config --quiet
```

Start only the sidecar after reviewing the rendered configuration:

```bash
docker compose \
  --project-name workflow-recycle-bin \
  --file deploy/docker-compose.sidecar.yml \
  --env-file .env \
  pull

docker compose \
  --project-name workflow-recycle-bin \
  --file deploy/docker-compose.sidecar.yml \
  --env-file .env \
  up -d
```

## Security boundaries

- API keys and hook tokens are file-backed, not stored in workflow JSON or `.env` values.
- The sidecar uses the n8n session/browser boundary for browser requests.
- Hooks authenticate to the sidecar with a separate local token.
- The UI adapter is version-specific and optional; the core route remains the safety boundary.
- Automatic retention starts in dry-run/inactive mode.
- Never enable permanent deletion or automatic cleanup without a controlled read-only and disposable-resource test.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SECURITY.md`](docs/SECURITY.md), and [`docs/INSTALL.md`](docs/INSTALL.md).

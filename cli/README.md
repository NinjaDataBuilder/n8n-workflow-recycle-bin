# Workflow Recycle Bin CLI

Local development package for installing the Workflow Recycle Bin sidecar beside a self-hosted n8n deployment.

> The package is currently a private release candidate. It is not published to npm yet.

## Safe installation model

The CLI never replaces the existing n8n Compose project. It stages an isolated sidecar under the target directory, creates a timestamped backup, validates the target n8n release, and renders the sidecar Compose file before any container action.

Starting the sidecar requires the explicit `--start` flag. The sidecar has no host-published port by default and uses a file-backed hook token.

## Local usage

From this repository:

```bash
node src/cli.mjs doctor \
  --target /path/to/n8n-compose \
  --version 2.32.5 \
  --network n8n_default

node src/cli.mjs install \
  --target /path/to/n8n-compose \
  --version 0.1.2 \
  --n8n-version 2.32.5 \
  --bundle ../release/workflow-recycle-bin-v0.1.2.tar.gz \
  --network n8n_default \
  --n8n-internal-url http://n8n:5678 \
  --hook-token-file /path/to/recycle-bin-hook-token \
  --dry-run
```

Remove `--dry-run` to stage and validate. Add `--start` only when the external Docker network and secret file are ready:

```bash
node src/cli.mjs install ... --start
```

The CLI keeps the sidecar data volume during uninstall. Use the Compose project directly only after reviewing the intended volume operation.

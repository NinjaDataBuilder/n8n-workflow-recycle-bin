# ♻️ n8n Workflow Recycle Bin CLI

[![npm version](https://img.shields.io/npm/v/%40ninjadatabuilder%2Fn8n-workflow-recycle-bin?label=npm)](https://www.npmjs.com/package/@ninjadatabuilder/n8n-workflow-recycle-bin)
[![License](https://img.shields.io/npm/l/%40ninjadatabuilder%2Fn8n-workflow-recycle-bin?label=license)](LICENSE)
[![n8n](https://img.shields.io/badge/n8n-self--hosted-EA4B71?logo=n8n&logoColor=white)](https://n8n.io/)

The CLI installs, validates, upgrades, and uninstalls the [n8n Workflow Recycle Bin](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin) sidecar beside an existing self-hosted n8n deployment.

> [!IMPORTANT]
> The public package is available as `@ninjadatabuilder/n8n-workflow-recycle-bin@0.1.5`. Pin the version in production and run the preflight before changing a deployment.

> [!WARNING]
> This CLI targets self-hosted n8n `2.36.7` with the latest validated Recycle Bin `0.1.5` adapter. Previously stable validated adapters remain available for n8n `2.35.3` and `2.32.5`. It does not support n8n Cloud and it never accepts a hook token as a command-line argument.

## 🚀 Install

Run a no-write health check first:

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin@0.1.5 doctor
```

See the complete installer options before staging a deployment:

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin@0.1.5 install --help
```

The CLI can also be installed globally when that matches your operating model:

```bash
npm install --global @ninjadatabuilder/n8n-workflow-recycle-bin@0.1.5
```

## 🔒 Safe installation model

The CLI:

- checks Node.js, Docker, Compose, the target Compose project, and n8n compatibility;
- downloads a pinned GitHub Release bundle and verifies `SHA256SUMS`;
- stages an isolated sidecar under the target directory;
- preserves a timestamped backup of an existing installation;
- writes only non-secret configuration;
- validates the rendered Compose file before container actions;
- starts the sidecar only when `--start` is explicitly supplied;
- preserves the named sidecar data volume during uninstall.

> [!CAUTION]
> `install` can change a deployment and `uninstall` can remove containers or files. Use `--dry-run` first, review the target path and Compose output, and test in a disposable staging environment before production.

## 🧪 Example dry run

From the repository checkout:

```bash
node src/cli.mjs doctor \
  --target /path/to/n8n-compose \
  --version 2.32.5 \
  --network n8n_default

node src/cli.mjs install \
  --target /path/to/n8n-compose \
  --version 0.1.5 \
  --n8n-version 2.32.5 \
  --network n8n_default \
  --n8n-internal-url http://n8n:5678 \
  --hook-token-file /path/to/recycle-bin-hook-token \
  --dry-run
```

Remove `--dry-run` only after reviewing the plan. Add `--start` only when the external Docker network and secret file are ready.

## 📚 Documentation

- [Main project README](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin#readme)
- [Installation guide](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/blob/main/docs/INSTALL.md)
- [Architecture](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/blob/main/docs/ARCHITECTURE.md)
- [Security model](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/blob/main/docs/SECURITY.md)
- [GitHub Releases](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/releases)

## 📄 License

MIT. See [LICENSE](LICENSE).

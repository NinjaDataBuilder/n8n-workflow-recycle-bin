# 🗑️ n8n Workflow Recycle Bin

[![CI](https://img.shields.io/github/actions/workflow/status/NinjaDataBuilder/n8n-workflow-recycle-bin/ci.yml?branch=main&label=CI)](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/NinjaDataBuilder/n8n-workflow-recycle-bin?display_name=tag&label=release)](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/releases)
[![License](https://img.shields.io/github/license/NinjaDataBuilder/n8n-workflow-recycle-bin)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![n8n](https://img.shields.io/badge/n8n-self--hosted-EA4B71?logo=n8n&logoColor=white)](https://n8n.io/)

<p align="center">
  <img src="https://raw.githubusercontent.com/NinjaDataBuilder/n8n-workflow-recycle-bin/main/docs/assets/github-header.png" alt="N8N Recycle Bin — guarded workflow archiving and restore for self-hosted n8n" width="100%">
</p>

A guarded sidecar for **self-hosted n8n** that archives workflows, preserves retention metadata, supports reversible restore, and protects permanent deletion behind explicit confirmation.

> [!IMPORTANT]
> The public source repository and GitHub Release `v0.1.3` are available. The supported target is self-hosted n8n `2.32.x`, initially validated against n8n `2.32.5`.

> [!WARNING]
> The GHCR image has been built and pushed as `ghcr.io/ninjadatabuilder/n8n-workflow-recycle-bin:0.1.3`, but the container package is currently private. The CLI is publicly available as `@ninjadatabuilder/n8n-workflow-recycle-bin@0.1.3`; use npm or the GitHub Release bundle according to your deployment process.

<hr>

## 🧭 Start here

| If you are... | Start with |
| --- | --- |
| Evaluating the project | [Architecture and supported target](#-architecture) |
| Watching a real demonstration | [Workflow demonstration](#-demonstration) |
| Installing for the first time | [Safe installation path](#-safe-installation-path) |
| Reviewing risk | [Security boundaries](#-security-boundaries) |
| Operating a deployment | [Installation guide](docs/INSTALL.md) |
| Reviewing the release | [Release notes and assets](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/releases/tag/v0.1.3) |
| Contributing or debugging | [Development checks](#-development-checks) |

## 🎯 What it is

The Workflow Recycle Bin is a **sidecar service**, not a replacement for n8n. It stays beside an existing n8n deployment and provides a guarded lifecycle for workflows that would otherwise be archived or permanently deleted without a dedicated review surface.

The runtime combines:

- a small UI/API surface for archived workflows;
- n8n API and session validation;
- lifecycle hook integration;
- retention metadata and scheduler support;
- an audit store;
- a CLI that stages, validates, upgrades, and uninstalls the sidecar.

## 🎬 Demonstration

![Animated preview of the n8n Workflow Recycle Bin demonstration](https://raw.githubusercontent.com/NinjaDataBuilder/n8n-workflow-recycle-bin/main/docs/assets/demo/n8n-workflow-recycle-bin-preview.gif)

[▶️ Open the full original demonstration video (MP4)](docs/assets/demo/n8n-workflow-recycle-bin-001.mp4)

The demonstration shows a self-hosted n8n environment with archived workflows, retention status, search filters, restore controls, and guarded permanent deletion. It also shows how a workflow can move through a controlled lifecycle instead of remaining indefinitely in the active environment.

> [!NOTE]
> This animated preview and the full video are usage demonstrations. Do not publish credentials, tokens, account identifiers, or production data in screenshots, recordings, or issue attachments.

## 🚫 What it is not

- It is not an n8n Cloud feature.
- It is not a traditional community node for the canvas.
- It does not replace the parent n8n Compose project.
- It does not accept secrets as CLI arguments.
- It does not silently delete workflows.
- It does not make production retention safe without staging and disposable-resource tests.

## 🏗️ Architecture

```text
existing n8n Compose project
│
├── n8n service
│   ├── authenticated browser/session boundary
│   └── lifecycle hook
│
└── external Docker network
    │
    └── Workflow Recycle Bin sidecar
        ├── guarded UI/API
        ├── n8n API/session bridge
        ├── file-backed hook secret
        ├── audit-data volume
        └── retention scheduler
```

The installer operates alongside the existing deployment. It does not recreate n8n, replace PostgreSQL or Redis, or take ownership of the parent Compose project.

## ✅ Supported target

| Requirement | Initial support |
| --- | --- |
| n8n | Self-hosted `2.32.x` |
| Reference validation | n8n `2.32.5` |
| Runtime | Node.js `22+` |
| Deployment | Docker Engine with Compose plugin |
| Network | Existing external Docker network shared with n8n |
| Cloud | n8n Cloud is not supported by this sidecar architecture |

> [!NOTE]
> Compatibility is intentionally narrow in the first release. Validate a newer n8n version in a disposable environment before using it in production.

## 🚀 Safe installation path

### 1. Use the published CLI

For a normal installation, use the pinned public CLI:

```bash
npx @ninjadatabuilder/n8n-workflow-recycle-bin@0.1.3 doctor
npx @ninjadatabuilder/n8n-workflow-recycle-bin@0.1.3 install --help
```

The CLI performs preflight, backup, staging, Compose validation, and rollback checks. Use `--dry-run` before any deployment change.

### 2. Download the pinned release bundle

Use the GitHub Release asset and checksum instead of an unpinned branch archive:

```bash
gh release download v0.1.3 \
  --repo NinjaDataBuilder/n8n-workflow-recycle-bin \
  --pattern 'workflow-recycle-bin-v0.1.3.tar.gz' \
  --pattern 'SHA256SUMS'

sha256sum --check SHA256SUMS
```

### 3. Run the preflight before changing a deployment

Extract the bundle into a staging directory and validate the target n8n version before mounting hooks or starting the sidecar.

```bash
tar -xzf workflow-recycle-bin-v0.1.3.tar.gz
cd workflow-recycle-bin-v0.1.3
node scripts/preflight.mjs --n8n-version 2.32.5
```

### 4. Configure only non-secret values

Copy `.env.example` to `.env` and set the existing network, internal n8n URL, and release version. Create the hook-token file separately with mode `600`.

```bash
install -m 600 /dev/null /opt/n8n/secrets/recycle-bin-hook-token
# Write the token through your secret-management process; never place it in Git or chat.
```

### 5. Render and review Compose

```bash
docker compose \
  --project-name workflow-recycle-bin \
  --file deploy/docker-compose.sidecar.yml \
  --env-file .env \
  config --quiet
```

Start only after reviewing the rendered configuration. The CLI uses `--dry-run` for a no-write preview and requires an explicit start option for container startup.

See the complete [installation guide](docs/INSTALL.md) and [Portuguese guide](docs/INSTALL.pt-BR.md) for staging, hooks, backup, upgrade, rollback, and uninstall.

## 🔄 Lifecycle and safety model

| Action | Result | Guard |
| --- | --- | --- |
| Archive | Keeps the workflow recoverable and records retention metadata | Authenticated n8n session and hook token |
| Restore | Returns the workflow through the n8n API | Valid session and resource visibility |
| Retain | Marks an archived item as eligible for policy evaluation | Scheduler starts inactive/dry-run |
| Permanent delete | Removes the workflow through the n8n API and records an audit event | Archive state, permission, and literal `DELETAR` confirmation |

> [!CAUTION]
> Permanent deletion is irreversible at the workflow level. Exercise it only against disposable resources first, review the target and audit record, and type the literal confirmation `DELETAR`.

## 🔒 Security boundaries

- Secrets are file-backed and excluded from source, workflow JSON, and `.env` values.
- Browser requests are validated through the n8n session/browser boundary.
- Hook delivery uses a separate local token.
- The sidecar has no host-published port by default.
- The optional UI adapter is version-specific; the core API remains the safety boundary.
- Retention is not active by default.
- The Docker application process runs as a non-root user after secret bootstrap.

> [!WARNING]
> Do not paste hook tokens, cookies, OAuth values, customer workflow data, or production exports into issues, screenshots, logs, or chat. Use [SECURITY.md](docs/SECURITY.md) for responsible reports.

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Installation — English](docs/INSTALL.md)
- [Installation — Português do Brasil](docs/INSTALL.pt-BR.md)
- [Security model](docs/SECURITY.md)
- [Release contract](docs/RELEASE.md)
- [GitHub Releases](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/releases)
- [CI workflow](https://github.com/NinjaDataBuilder/n8n-workflow-recycle-bin/actions/workflows/ci.yml)

## 🧪 Development checks

```bash
npm test
npm run release:bundle

cd cli
npm test
node src/cli.mjs --help
```

The CI also checks syntax, bundle contents, Docker buildability, CLI packaging, and whitespace. Keep release artifacts, `.env` files, secrets, customer data, and temporary tarballs out of commits.

## 📦 Distribution status

| Surface | Status |
| --- | --- |
| GitHub source | Public |
| GitHub Release `v0.1.3` | Available |
| GHCR image `:0.1.3` | Pushed; package visibility pending |
| npm CLI `0.1.3` | Public on npm |
| Runtime package | Private by design |

## 📄 License

MIT. See [LICENSE](LICENSE).

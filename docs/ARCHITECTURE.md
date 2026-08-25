# Workflow Recycle Bin architecture

## Product objective

Provide a portable recycle-bin experience for **self-hosted n8n**. A workflow is archived first, retained for 30 days by default, then eligible for permanent deletion. Immediate deletion requires an explicit irreversible-action dialog and typing `DELETAR` in the localized UI.

## Boundaries

- The n8n public API is the only workflow-management interface used by the core service.
- The core must never issue arbitrary HTTP requests, evaluate user supplied methods, or accept raw workflow-delete payloads.
- The sidebar adapter is version-specific. The core UI remains reachable through a stable reverse-proxy route even when a sidebar adapter is unavailable.
- Installers must abort before modifying the n8n instance when the detected version has no supported adapter.

## Components

```text
Recycle Bin UI/API service
  - lists archived workflows
  - restore
  - archive
  - requests permanent deletion
  - exposes retention metadata

n8n external hooks
  - records archive/unarchive events in the extension audit store
  - `archivedAt` is created from the authoritative `workflow.afterArchive` event; it is never inferred from a generic workflow timestamp
  - does not block `workflow.delete`: a global hook cannot distinguish the native menu from the extension's own approved deletion call

retention scheduler
  - runs daily
  - proposes/executes deletion only after policy checks

sidebar adapter
  - injects the link above Templates only for tested n8n versions
```

## Compatibility policy

The tested adapters currently cover n8n `2.32.5`, `2.35.3`, and `2.36.7`. Any other exact version is refused by the installer until tested and explicitly added to `src/compatibility.mjs`.

## Security policy

- Store an n8n API key only in the target deployment's secret store or root-owned environment file.
- On Enterprise, request only the workflow read/list/archive/unarchive/delete scopes required by the installed mode.
- On non-Enterprise, n8n API keys are broader; the extension still limits its own routes, but installation must display this limitation before accepting a key.
- Never delete active workflows directly. Archive/deactivate first.
- Never permit bulk permanent deletion in v1.
- Protect the recycle-bin system workflows and configured protected IDs/tags.

# Security model

## Non-negotiable boundary

The Recycle Bin sidecar must not expose browser-facing archive, restore, or permanent-delete endpoints authenticated only by a token embedded in frontend code.

In n8n `2.32.x`, `n8n.ready` provides an Express server (`server.app`), but a route manually added by an external hook is not automatically protected by n8n user-session middleware. The extension must treat a manually-added route as unauthenticated until proven otherwise by a version-specific integration test.

## Approved separation

```text
Sidebar/UI adapter (same n8n origin and authenticated user session)
  → invokes only version-tested n8n workflow lifecycle operations
  → renders the DELETAR confirmation

Recycle Bin sidecar (private network)
  → receives authenticated archive/restore audit events from hooks
  → stores retention metadata
  → computes dry-run candidates
  → never accepts an unauthenticated browser delete request
```

## Sidebar integration policy

The supported product surface is a dedicated Recycle Bin route served by the extension. It is the only required UI path for installation, user training, and security testing.

A sidebar insertion above Templates may be released only as an **optional navigation adapter** for explicitly tested n8n versions. It must not be required for the Recycle Bin to work, carry authentication/authorization logic, or be used as an enforcement control. If the adapter becomes incompatible after an n8n update, the installer disables it while the dedicated route remains available.

A maintained fork of the n8n editor is out of scope for v1 because it would couple the security product to a custom n8n image on every upstream release.
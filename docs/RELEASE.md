# Public release contract

## Approved public names

| Surface | Name | Status |
|---|---|---|
| GitHub repository | `NinjaDataBuilder/n8n-workflow-recycle-bin` | Approved; repository not created yet |
| OCI image | `ghcr.io/ninjadatabuilder/n8n-workflow-recycle-bin` | Approved; version tags only |
| npm CLI | `@ninjadatabuilder/n8n-workflow-recycle-bin` | Approved; package not published yet |
| Private runtime package | `@ninjadatabuilder/n8n-workflow-recycle-bin-runtime` | Remains private; never publish as the community node |

The optional community node, if created later, must use a separate package name and release lifecycle.

## Release inputs

- Git tag: `vX.Y.Z`;
- root runtime version and CLI version must equal `X.Y.Z`;
- supported n8n line: `2.32.x`;
- release bundle: `workflow-recycle-bin-vX.Y.Z.tar.gz`;
- checksum file: `SHA256SUMS`;
- image tags: `X.Y.Z` and immutable commit tag; no `latest` tag.

## Publication order

1. Validate runtime, CLI, bundle, Compose, image, and release contents.
2. Publish the versioned OCI image to GHCR.
3. Create the GitHub Release with the TAR.GZ and `SHA256SUMS`.
4. Publish the CLI to npm with provenance.
5. Verify the GitHub, GHCR, and npm handles before announcing availability.

The GitHub Actions workflow uses `GITHUB_TOKEN` for GHCR and npm trusted publishing/OIDC. No long-lived registry or npm token belongs in repository secrets.

## Explicit checkpoint

Creating a tag is the publication authorization boundary. Do not create or push `vX.Y.Z` until the owner explicitly confirms:

- the public repository has been created under the NinjaDataBuilder organization;
- GHCR and npm trusted publishing are configured;
- the version and release notes are approved;
- the n8n `2.32.x` compatibility limitation is visible in the release notes;
- rollback/support ownership is understood.

A green local build or a valid workflow file is not publication evidence.

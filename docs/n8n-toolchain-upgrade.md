# n8n toolchain compatibility routine

The production stack uses exact, tested n8n versions. A frontend adapter must not be assumed compatible with a future n8n patch or minor release merely because the core API still responds.

## Routine

1. Read the live n8n version from the editor container.
2. Compare it with `scripts/n8n-toolchain-compatibility.json`.
3. Run the runtime, CLI, GTM, Meta Ads, and Baserow test suites.
4. Stop the release process when the n8n version is absent from the matrix, a test fails, or a package version differs from the expected release.
5. After the adapter and package changes are tested, update the GitHub repository and create a versioned GitHub release.
6. Publish to npm only after npm authentication, package audit, tarball inspection, and live package verification.

The host watchdog invokes `scripts/n8n-toolchain-compatibility-audit.py` every six hours through Hermes. It stores the latest JSON report at:

```text
~/.hermes/state/n8n-toolchain-compatibility-latest.json
```

The watchdog is detection-only. It does not recreate n8n, modify workflows, publish packages, or push Git commits automatically.

## Adding a new n8n release

- Confirm the official non-prerelease release.
- Upgrade editor, worker, webhook, and runners together.
- Extract the actual frontend assets from the running editor.
- Update the Recycle Bin sidebar, router, workflow-list, and embedded-view adapters.
- Add the exact version and expected package versions to the matrix.
- Run all test and package gates.
- Perform a read-only live smoke test.
- Commit, push, create the GitHub releases, then publish to npm.

Do not use `latest` and do not add a version to the matrix before its exact adapter has been tested.

#!/usr/bin/env bash
set -euo pipefail

# Safe installer: stages an isolated bundle and creates a rollback snapshot.
# It never starts or recreates containers.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TARGET=${1:?Usage: scripts/install.sh /path/to/n8n-compose-directory}
VERSION=${N8N_VERSION:?Set N8N_VERSION before installing}
DEST="$TARGET/workflow-recycle-bin"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP="$TARGET/.recycle-bin-backups/$STAMP"

node "$ROOT/scripts/preflight.mjs" "$VERSION"
test -f "$TARGET/docker-compose.yml" || { echo "Missing $TARGET/docker-compose.yml" >&2; exit 2; }
mkdir -p "$BACKUP"
if test -e "$DEST"; then cp -a "$DEST" "$BACKUP/workflow-recycle-bin"; fi
mkdir -p "$DEST"
cp -a "$ROOT/app" "$ROOT/src" "$ROOT/hooks" "$ROOT/deploy" "$ROOT/package.json" "$ROOT/Dockerfile" "$ROOT/.env.example" "$DEST/"
printf '%s\n' "staged=$DEST" "backup=$BACKUP" "next=review local .env and run docker compose config manually"

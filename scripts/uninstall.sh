#!/usr/bin/env bash
set -euo pipefail
# Removes only the staged bundle. It never removes n8n data or Docker volumes.
TARGET=${1:?Usage: scripts/uninstall.sh /path/to/n8n-compose-directory}
DEST="$TARGET/workflow-recycle-bin"
test -d "$DEST" || { echo "No staged Recycle Bin bundle at $DEST" >&2; exit 2; }
printf 'Refusing destructive removal without --confirm\n' >&2
if test "${2:-}" != "--confirm"; then exit 3; fi
rm -rf -- "$DEST"
echo "removed=$DEST"

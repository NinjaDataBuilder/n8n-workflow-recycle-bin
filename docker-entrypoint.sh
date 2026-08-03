#!/bin/sh
set -eu

if [ -n "${N8N_RECYCLE_BIN_HOOK_TOKEN_FILE:-}" ]; then
  if [ ! -r "$N8N_RECYCLE_BIN_HOOK_TOKEN_FILE" ]; then
    echo 'Hook token file is not readable by the runtime user' >&2
    exit 1
  fi
  N8N_RECYCLE_BIN_HOOK_TOKEN=$(tr -d '\r\n' < "$N8N_RECYCLE_BIN_HOOK_TOKEN_FILE")
  export N8N_RECYCLE_BIN_HOOK_TOKEN
  unset N8N_RECYCLE_BIN_HOOK_TOKEN_FILE
fi

mkdir -p /data
if [ "$(id -u)" -eq 0 ]; then
  chown node:node /data
  exec su-exec node node src/main.mjs
fi

exec node src/main.mjs

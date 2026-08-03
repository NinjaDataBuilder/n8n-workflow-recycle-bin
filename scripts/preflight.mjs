#!/usr/bin/env node
import { assertCompatible } from '../src/compatibility.mjs';

const version = process.argv[2] ?? process.env.N8N_VERSION;
if (!version) {
  console.error('Usage: node scripts/preflight.mjs <n8n-version>');
  process.exitCode = 2;
} else {
  try {
    const result = assertCompatible(version);
    console.log(JSON.stringify({ ok: true, version: result.version, sidebarAdapter: result.sidebarAdapter }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, version, reason: error.message }, null, 2));
    process.exitCode = 1;
  }
}

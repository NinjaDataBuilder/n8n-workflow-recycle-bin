import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NATIVE_ASSETS = Object.freeze({
  'app-0aL7xNtl.js': '3e71f9416e329312f3f49de0d805dc5746cb9c30d95342399192318367d0bdea',
  'AppSidebar-DqEHFut7.js': '0d48244dcdf54d84e49f03fe3fd01a4012ab9041ecacd7702c1666ac6b951528',
  'WorkflowsView-DXcBW1OL.js': 'e8270144005c6f9b0f670c5b0646408c76888bf9d38b7084242d6dce2a7c51fe',
  'vendor-COD0pq0C.js': 'f22bfaa2e32a54539c908cb256b9070da9b043ed28cbdb20853621bf91228b28',
});
const MARKER = '// NinjaDataBuilder Workflow Recycle Bin candidate adapter for exact n8n 2.44.5\n';
export const EMBEDDED_VIEW = `import { qd as h } from './vendor-COD0pq0C.js';
export default {
  name: 'RecycleBinEmbeddedView2445',
  render() {
    return h('iframe', {
      src: '/recycle-bin/', title: 'Workflow Recycle Bin',
      style: { border: '0', display: 'block', width: '100%', minHeight: 'calc(100vh - 48px)' },
    });
  },
};
`;
function replaceOnce(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error('Expected one exact adapter anchor');
  return MARKER + source.replace(anchor, replacement);
}
export function patchApp(source) {
  const anchor = '{path:`/entity-not-found/:entityType(credential|workflow)`';
  const route = '{path:`/home/recycle-bin`,name:`recycle-bin`,component:()=>import("./RecycleBinEmbeddedView-n8n-2.44.5.js"),meta:{middleware:[`authenticated`]}},';
  return replaceOnce(source, anchor, route + anchor);
}
export function renderRootBasePath(source) {
  // n8n renders these build placeholders when serving app JS over HTTP.
  // The sidecar bypasses that handler, so mirror its observed root-only result.
  const encoded = '/%7B%7BBASE_PATH%7D%7D/';
  const raw = '/{{BASE_PATH}}/';
  if (source.split(encoded).length !== 6 || source.split(raw).length !== 2) {
    throw new Error('Unexpected exact 2.44.5 base-path placeholder shape');
  }
  return source.replaceAll(encoded, '/').replaceAll(raw, '/');
}
export function patchSidebar(source) {
  const anchor = '{id:`templates`';
  if (!source.includes(anchor) || source.includes('id:`recycle-bin`')) throw new Error('Unexpected sidebar adapter anchor');
  const item = '{id:`recycle-bin`,icon:`trash-2`,label:`Workflow Recycle Bin`,position:`bottom`,available:!0,route:{to:{name:`recycle-bin`}}},';
  return MARKER + source.replace(anchor, item + anchor);
}
export function patchWorkflows(source) {
  return replaceOnce(source, 'label:x.baseText(`workflows.item.archive`),value:i.ARCHIVE,divided:!0', 'label:`Move to Recycle Bin`,value:i.ARCHIVE,divided:!0');
}
export async function generateAdapter(sourceDir, outputDir) {
  const sources = {};
  for (const [name, expected] of Object.entries(NATIVE_ASSETS)) {
    const bytes = await readFile(join(sourceDir, name));
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Native asset fingerprint mismatch: ' + name);
    sources[name] = bytes.toString('utf8');
  }
  // This public vendor export is Vue's h() factory, not openBlock/createElementBlock.
  if (!sources['vendor-COD0pq0C.js'].includes('Ea as qd') || !sources['vendor-COD0pq0C.js'].includes('function Ea(e,t,n)')) throw new Error('Verified Vue h export is unavailable');
  const files = {
    'app-0aL7xNtl.js': patchApp(renderRootBasePath(sources['app-0aL7xNtl.js'])),
    'AppSidebar-DqEHFut7.js': patchSidebar(sources['AppSidebar-DqEHFut7.js']),
    'WorkflowsView-DXcBW1OL.js': patchWorkflows(sources['WorkflowsView-DXcBW1OL.js']),
    'RecycleBinEmbeddedView-n8n-2.44.5.js': EMBEDDED_VIEW,
  };
  await mkdir(outputDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) await writeFile(join(outputDir, name), content);
  return Object.keys(files);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw new Error('Usage: node generate-n8n-2445-adapter.mjs <native-assets-directory> <output-directory>');
  console.log(JSON.stringify({ n8n: '2.44.5', assets: await generateAdapter(resolve(process.argv[2]), resolve(process.argv[3])), acceptance: 'candidate; authenticated UI gate remains separate' }));
}

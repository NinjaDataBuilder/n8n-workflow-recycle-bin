import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const asset = (name) => readFile(new URL(`../app/public/assets/${name}`, import.meta.url), 'utf8');

test('router registers the embedded recycle-bin route before the catch-all 404', async () => {
  const source = await asset('router-BfHF4NzA.js');
  const route = "{path:`/home/recycle-bin`,name:`recycle-bin`,component:{render:()=>u(`iframe`,{src:`/recycle-bin/`,title:`Workflow Recycle Bin`,style:{border:`0`,display:`block`,width:`100%`,minHeight:`calc(100vh - 48px)`}})},meta:{middleware:[`authenticated`]}}";
  assert.notEqual(source.indexOf(route), -1);
  assert.ok(source.indexOf(route) < source.indexOf('path:`/:pathMatch(.*)*`'));
});

test('router renders the same-origin recycle-bin iframe in the main panel', async () => {
  const source = await asset('router-BfHF4NzA.js');
  assert.match(source, /j as u,w as d\}from\"\.\/vue\.runtime\.esm-bundler-BZlJNr-r\.js\"/);
  assert.match(source, /src:`\/recycle-bin\//);
  assert.match(source, /title:`Workflow Recycle Bin`/);
  assert.match(source, /minHeight:`calc\(100vh - 48px\)`/);
});

